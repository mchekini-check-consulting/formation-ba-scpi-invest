import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { depotAccuseReception } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';
import { creerAccuseReceptionService, MOTIFS } from '../src/reception/accuse-service.js';

// US-13 (SCPI-261) sur un PostgreSQL 16 jetable, Kafka remplacé par un faux canal : les
// 4 scénarios du ticket. Docker requis.
const TOPIC = 'scpi.souscription.accuse-reception.v1';

describe('accusé de réception de la SCPI (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  const publier = vi.fn().mockResolvedValue({ topic: `${TOPIC}.dlq`, partition: 0, offset: '0' });
  let service: ReturnType<typeof creerAccuseReceptionService>;

  const dossier = async (statut: string) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into dossier_investissement
         (utilisateur_id, scpi_id, scpi_nom, nombre_parts, prix_part, montant, type, statut)
       values ('u1', 1, 'SCPI', 5, 200, 1000, 'pleine_propriete', $1) returning id`,
      [statut],
    );
    return Number(rows[0].id);
  };
  const lire = async (id: number) =>
    (
      await pool.query<{ statut: string; accuse_reception_le: Date | null }>(
        'select statut, accuse_reception_le from dossier_investissement where id = $1',
        [id],
      )
    ).rows[0];
  const accuse = (idMessage: string, id: number, dateReception = '2026-11-18T09:15:00Z') =>
    service.traiter({
      topic: TOPIC,
      cle: `D-${id}`,
      valeur: JSON.stringify({ idMessage, idDossier: `D-${id}`, dateReception }),
    });

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    service = creerAccuseReceptionService(
      depotAccuseReception(createDb(pool)),
      { publier },
      captureLogs().log,
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  beforeEach(async () => {
    publier.mockClear();
    await pool.query('truncate dossier_investissement, message_recu');
  });

  it('accusé de réception : « Demande envoyée » -> « Demande reçue » avec la date', async () => {
    const id = await dossier('demande_envoyee');
    expect(await accuse('m-1', id)).toBe('traite');
    expect(await lire(id)).toEqual({
      statut: 'demande_recue',
      accuse_reception_le: new Date('2026-11-18T09:15:00Z'),
    });
  });

  it('accusé tardif : date enregistrée, statut inchangé', async () => {
    const id = await dossier('acceptee_attente_paiement');
    expect(await accuse('m-2', id)).toBe('traite');
    expect(await lire(id)).toEqual({
      statut: 'acceptee_attente_paiement',
      accuse_reception_le: new Date('2026-11-18T09:15:00Z'),
    });
  });

  it('doublon : ignoré, la première date reste', async () => {
    const id = await dossier('demande_envoyee');
    await accuse('m-3', id);
    expect(await accuse('m-3', id, '2026-11-20T08:00:00Z')).toBe('doublon');
    expect((await lire(id)).accuse_reception_le).toEqual(new Date('2026-11-18T09:15:00Z'));
    expect(publier).not.toHaveBeenCalled();
  });

  it('dossier inconnu : rien enregistré, message sur le topic d’erreur', async () => {
    expect(await accuse('m-4', 9999)).toBe('rejete');
    expect(publier).toHaveBeenCalledWith(
      `${TOPIC}.dlq`,
      'D-9999',
      expect.objectContaining({ motif: MOTIFS.dossierInconnu }),
    );
    // idMessage non retenu : rejeté à nouveau s'il revient
    expect((await pool.query('select count(*)::int as n from message_recu')).rows[0].n).toBe(0);
  });
});
