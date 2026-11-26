import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { depotTransmission } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import type { CanalKafka } from '../src/kafka/producteur.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';
import type { MessageDossier } from '../src/transmission/message.js';
import { creerTransmissionService } from '../src/transmission/service.js';

// US-12 (SCPI-260) sur un PostgreSQL 16 jetable, Kafka remplacé par un faux canal :
// transmission une seule fois, transmis_le, reprise après une panne avec le même
// idMessage, deux serveurs en parallèle. Docker requis.
const TOPIC = 'scpi.souscription.dossier.v1';

describe('transmission des dossiers (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let publies: { cle: string; message: MessageDossier; le: Date }[];
  let panne: boolean;
  let service: ReturnType<typeof creerTransmissionService>;
  let scpiTreu: number;
  let scpiSansCode: number;

  const canal: CanalKafka = {
    active: true,
    publier: async (_topic, cle, message) => {
      // Laisse l'autre serveur tourner pendant la publication (test en parallèle)
      await new Promise((r) => setTimeout(r, 20));
      if (panne) throw Object.assign(new Error('Connection refused'), { name: 'NetworkError' });
      // Heure de la base au moment de la publication (comparée à transmis_le)
      const { rows } = await pool.query<{ le: Date }>('select clock_timestamp() as le');
      publies.push({ cle, message: message as MessageDossier, le: rows[0].le });
      return { topic: TOPIC, partition: 0, offset: String(publies.length - 1) };
    },
    fermer: vi.fn(),
  };

  const dossier = async (scpiId: number, mode = 'ponctuel', statut = 'demande_envoyee') => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into dossier_investissement
         (utilisateur_id, scpi_id, scpi_nom, nombre_parts, prix_part, montant, type, mode, statut)
       values ('u1', $1, 'SCPI', 5, 200, 1000, 'pleine_propriete', $2, $3) returning id`,
      [scpiId, mode, statut],
    );
    return Number(rows[0].id);
  };
  const transmisLe = async (id: number) =>
    (await pool.query('select transmis_le from dossier_investissement where id = $1', [id])).rows[0]
      .transmis_le as Date | null;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    service = creerTransmissionService(
      depotTransmission(createDb(pool)),
      canal,
      TOPIC,
      captureLogs().log,
    );
    await pool.query(
      `insert into auth_user (id, name, email) values ('u1', 'Claire', 'claire@exemple.test')`,
    );
    await pool.query(
      `insert into kyc (utilisateur_id, statut, reponses)
       values ('u1', 'complete', '{"nom": "Martin", "prenom": "Claire", "origineFonds": ["Épargne"]}')`,
    );
    await pool.query(
      `insert into profil_investisseur (utilisateur_id, profil, score, reponses, version_questionnaire, valide_le)
       values ('u1', 'Prudent', 10, '{}', 'v1', now() - interval '1 day'),
              ('u1', 'Équilibré', 42, '{}', 'v1', now())`,
    );
    await pool.query(
      `insert into kyc_piece (utilisateur_id, type, nom_fichier, format, taille, cle)
       values ('u1', 'identite', 'cni.pdf', 'application/pdf', 10, 'kyc/u1/identite')`,
    );
    const { rows } = await pool.query<{ id: number }>(
      `insert into scpi_catalog (nom, code) values ('Transitions Europe', 'TREU'), ('Sans Code', null)
       returning id`,
    );
    [scpiTreu, scpiSansCode] = rows.map((r) => r.id);
  });

  beforeEach(async () => {
    await pool.query('delete from dossier_investissement');
    publies = [];
    panne = false;
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  // US-12, scénario « publication »
  it('dossier non transmis : publié avec les données de l’investisseur, transmis_le écrit', async () => {
    const id = await dossier(scpiTreu);

    expect(await service.transmettre()).toEqual({
      transmis: 1,
      enAttenteSansCode: 0,
      erreur: null,
    });

    expect(publies).toHaveLength(1);
    expect(publies[0].cle).toBe(`D-${id}`);
    expect(publies[0].message).toMatchObject({
      idDossier: `D-${id}`,
      codeSCPI: 'TREU',
      nombreParts: 5,
      prixPart: 200,
      montant: 1000,
      typeInvestissement: 'PLEINE_PROPRIETE',
      modeInvestissement: 'PONCTUELLE',
      investisseur: {
        email: 'claire@exemple.test',
        identite: { nom: 'Martin', prenom: 'Claire', civilite: null },
        declarations: { origineFonds: ['Épargne'] },
        profil: { profil: 'Équilibré', score: 42 },
      },
      justificatifs: [{ type: 'identite', nomFichier: 'cni.pdf' }],
    });
    expect(publies[0].message.idMessage).toMatch(/^[0-9a-f-]{36}$/);
    // RG4 : heure réelle de la publication, pas celle du début du passage
    expect((await transmisLe(id))!.getTime()).toBeGreaterThanOrEqual(publies[0].le.getTime());
  });

  // US-12, scénario « pas de double envoi »
  it('dossier déjà transmis : rien de publié au passage suivant', async () => {
    await dossier(scpiTreu);
    await service.transmettre();
    expect(await service.transmettre()).toMatchObject({ transmis: 0 });
    expect(publies).toHaveLength(1);
  });

  // US-12, scénario « Kafka indisponible »
  it('Kafka indisponible puis revenu : publié une seule fois, même idMessage', async () => {
    const id = await dossier(scpiTreu);
    const { rows } = await pool.query(
      'select id_message from dossier_investissement where id = $1',
      [id],
    );

    panne = true;
    expect(await service.transmettre()).toMatchObject({ transmis: 0, erreur: 'NetworkError' });
    expect(await transmisLe(id)).toBeNull();

    panne = false;
    expect(await service.transmettre()).toMatchObject({ transmis: 1 });
    expect(await service.transmettre()).toMatchObject({ transmis: 0 });
    expect(publies.map((p) => p.message.idMessage)).toEqual([rows[0].id_message]);
  });

  it('non transmis : versement programmé, autre statut, SCPI sans code (compté en attente)', async () => {
    await dossier(scpiTreu, 'programme');
    await dossier(scpiTreu, 'ponctuel', 'demande_recue');
    const sansCode = await dossier(scpiSansCode);

    expect(await service.transmettre()).toEqual({
      transmis: 0,
      enAttenteSansCode: 1,
      erreur: null,
    });
    expect(publies).toEqual([]);

    // Code ajouté par l'import suivant : transmis au passage suivant
    await pool.query(`update scpi_catalog set code = 'SACO' where id = $1`, [scpiSansCode]);
    expect(await service.transmettre()).toMatchObject({ transmis: 1, enAttenteSansCode: 0 });
    expect(publies[0].cle).toBe(`D-${sansCode}`);
  });

  it('deux serveurs en même temps : chaque dossier publié une seule fois', async () => {
    const ids = await Promise.all([1, 2, 3, 4, 5].map(() => dossier(scpiTreu)));

    const [a, b] = await Promise.all([service.transmettre(), service.transmettre()]);

    expect(a.transmis + b.transmis).toBe(5);
    expect(publies.map((p) => p.cle).sort()).toEqual(ids.map((id) => `D-${id}`).sort());
  });
});
