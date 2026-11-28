import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { toNodeHandler } from 'better-auth/node';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { creerAuth, fournisseurBetterAuth } from '../src/auth/better-auth.js';
import { routesComptes } from '../src/comptes/routes.js';
import { creerCompteService } from '../src/comptes/service.js';
import {
  depotAcceptationsCgu,
  depotPortefeuille,
  depotTentativesConnexion,
  secretDesSessions,
} from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';
import { routesPortefeuille } from '../src/portefeuille/routes.js';
import { creerPortefeuilleService } from '../src/portefeuille/service.js';

// Portefeuille (US-20, SCPI-267) câblé comme dans server.ts, sur un PostgreSQL 16 jetable :
// regroupement par SCPI, dernier taux de distribution, cloisonnement entre investisseurs
// (EN-02 règle 3). Docker requis.
describe('portefeuille : liste de mes investissements (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;

  const creerCompte = async (email: string) => {
    const motDePasse = 'Tr0pBien!Choisi';
    const compte = await request(app)
      .post('/comptes')
      .send({ email, motDePasse, confirmation: motDePasse, cguAcceptees: true })
      .expect(201);
    return { jeton: `Bearer ${compte.body.jeton}`, id: compte.body.utilisateur.id as string };
  };

  const ajouterDossier = (
    utilisateurId: string,
    scpiId: number,
    montant: number,
    statut: 'investissement_actif' | 'refusee',
    joursAvant = 0,
  ) =>
    pool.query(
      `insert into dossier_investissement
         (utilisateur_id, scpi_id, scpi_nom, nombre_parts, prix_part, montant, type, statut,
          demande_le, jouissance_le, motif_refus)
       values ($1, $2, 'Transitions Europe', $3, 200, $4, 'pleine_propriete', $5,
               now() - make_interval(days => $6), $7, $8)`,
      [
        utilisateurId,
        scpiId,
        montant / 200,
        montant,
        statut,
        joursAvant,
        statut === 'investissement_actif' ? '2026-01-01' : null,
        statut === 'refusee' ? 'Dossier incomplet' : null,
      ],
    );

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    const db = createDb(pool);
    const capture = captureLogs();
    const auth = creerAuth(db, await secretDesSessions(db, ''), capture.log);
    const fournisseur = fournisseurBetterAuth(auth);
    app = createApp(() => db.execute(sql`select 1`), capture.log, {
      auth: toNodeHandler(auth),
      routeurs: [
        routesComptes(
          creerCompteService(fournisseur, {
            cgu: depotAcceptationsCgu(db),
            tentatives: depotTentativesConnexion(db),
          }),
          fournisseur,
        ),
        routesPortefeuille(creerPortefeuilleService(depotPortefeuille(db)), fournisseur),
      ],
    });
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('critère d’acceptation : 3 dossiers « Transitions Europe », 7 000 € investis', async () => {
    const { rows } = await pool.query<{ id: number }>(
      `insert into scpi_catalog (nom, gerant) values ('Transitions Europe', 'Arkéa REIM')
       returning id`,
    );
    const scpiId = rows[0].id;
    // Dernier taux connu : 2025 (6 %) ; 2024 (5 %) ignoré
    await pool.query(
      `insert into scpi_taux_distribution (taux, annee, scpi_id) values (5, 2024, $1), (6, 2025, $1)`,
      [scpiId],
    );
    const jean = await creerCompte('jean@exemple.fr');
    const marie = await creerCompte('marie@exemple.fr');
    await ajouterDossier(jean.id, scpiId, 5000, 'investissement_actif', 30);
    await ajouterDossier(jean.id, scpiId, 2000, 'investissement_actif', 20);
    await ajouterDossier(jean.id, scpiId, 1000, 'refusee', 10);
    // Dossier d'un autre investisseur : jamais visible par Jean
    await ajouterDossier(marie.id, scpiId, 9000, 'investissement_actif');

    const { body } = await request(app)
      .get('/portefeuille/investissements')
      .set('Authorization', jean.jeton)
      .expect(200);

    expect(body.scpis).toHaveLength(1);
    expect(body.scpis[0]).toMatchObject({
      scpiId,
      scpiNom: 'Transitions Europe',
      gerant: 'Arkéa REIM',
      nombreDossiers: 3,
      montantInvesti: 7000,
      nombreParts: 35,
      revenusMensuels: 35, // 7 000 × 6 % ÷ 12
    });
    // Du plus récent au plus ancien ; le refusé affiche son motif
    expect(body.scpis[0].dossiers.map((d: { montant: number }) => d.montant)).toEqual([
      1000, 2000, 5000,
    ]);
    expect(body.scpis[0].dossiers[0]).toMatchObject({
      statut: 'refusee',
      motifRefus: 'Dossier incomplet',
    });
    expect(body.scpis[0].dossiers[2]).toMatchObject({ jouissanceLe: '2026-01-01' });
  });

  it('investisseur sans dossier : liste vide', async () => {
    const paul = await creerCompte('paul@exemple.fr');
    await request(app)
      .get('/portefeuille/investissements')
      .set('Authorization', paul.jeton)
      .expect(200, { scpis: [] });
  });

  it('non connecté : 401', async () => {
    await request(app).get('/portefeuille/investissements').expect(401);
  });
});
