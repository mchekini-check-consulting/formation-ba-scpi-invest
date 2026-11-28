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
  depotDemandes,
  depotTentativesConnexion,
  secretDesSessions,
} from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { routesDemandes } from '../src/demandes/routes.js';
import { creerDemandesService } from '../src/demandes/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// Demandes d'investissement (US-11, SCPI-259) câblées comme dans server.ts, sur un
// PostgreSQL 16 jetable : création au prix de part le plus récent, minimum, cloisonnement
// entre investisseurs (EN-02 règle 3). Docker requis.
describe('demandes d’investissement (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;
  let lignes: Record<string, unknown>[];
  let scpiId: number;

  // Compte avec un KYC validé, sauf demande contraire
  const creerCompte = async (email: string, kycValide = true) => {
    const motDePasse = 'Tr0pBien!Choisi';
    const compte = await request(app)
      .post('/comptes')
      .send({ email, motDePasse, confirmation: motDePasse, cguAcceptees: true })
      .expect(201);
    if (kycValide) {
      await pool.query(
        `insert into kyc (utilisateur_id, statut, valide_le) values ($1, 'complete', now())`,
        [compte.body.utilisateur.id],
      );
    }
    return `Bearer ${compte.body.jeton}`;
  };

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    const db = createDb(pool);
    const capture = captureLogs();
    lignes = capture.lignes;
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
        routesDemandes(creerDemandesService(depotDemandes(db)), fournisseur),
      ],
    });
    // SCPI du critère d'acceptation : part à 200 € (190 € l'année d'avant), minimum 1 000 €
    const { rows } = await pool.query<{ id: number }>(
      `insert into scpi_catalog (nom, gerant, minimum_souscription)
       values ('SCPI Exemple', 'Gestion Exemple', 1000) returning id`,
    );
    scpiId = rows[0].id;
    await pool.query(
      'insert into scpi_prix_part (prix, annee, scpi_id) values (190, 2025, $1), (200, 2026, $1)',
      [scpiId],
    );
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('demande valide : dossier de 5 parts et 1 000 € créé « Demande envoyée », puis relu', async () => {
    const jean = await creerCompte('jean@exemple.fr');
    const cree = await request(app)
      .post('/demandes')
      .set('Authorization', jean)
      .send({ scpiId, nombreParts: 5, type: 'pleine_propriete' })
      .expect(201);

    expect(cree.body).toEqual({
      id: expect.any(Number),
      numero: `D-${cree.body.id}`,
      scpiId,
      scpiNom: 'SCPI Exemple',
      gerant: 'Gestion Exemple',
      nombreParts: 5,
      prixPart: 200,
      montant: 1000,
      type: 'pleine_propriete',
      statut: 'demande_envoyee',
      demandeLe: expect.any(String),
      accuseReceptionLe: null,
      motifRefus: null,
      paiement: null,
      jouissanceLe: null,
    });
    const relu = await request(app)
      .get(`/demandes/${cree.body.id}`)
      .set('Authorization', jean)
      .expect(200);
    expect(relu.body).toEqual(cree.body);

    // Champs EN-02 des US suivantes : vides ; mode ponctuel par défaut
    const { rows } = await pool.query(
      'select mode, accuse_reception_le, motif_refus, jouissance_le from dossier_investissement where id = $1',
      [cree.body.id],
    );
    expect(rows[0]).toEqual({
      mode: 'ponctuel',
      accuse_reception_le: null,
      motif_refus: null,
      jouissance_le: null,
    });
    // Valeurs saisies : jamais dans les logs
    expect(JSON.stringify(lignes)).not.toContain('pleine_propriete');
  });

  it('minimum non atteint : 400, aucun dossier créé', async () => {
    const paul = await creerCompte('paul@exemple.fr');
    const refus = await request(app)
      .post('/demandes')
      .set('Authorization', paul)
      .send({ scpiId, nombreParts: 4, type: 'pleine_propriete' })
      .expect(400);
    expect(refus.body.message).toBe(
      'Le minimum à investir pour cette SCPI est de 1 000 €, soit 5 parts.',
    );
    const { rows } = await pool.query(
      `select count(*)::int as n from dossier_investissement d
       join auth_user u on u.id = d.utilisateur_id where u.email = 'paul@exemple.fr'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it('KYC non validé : 403, aucun dossier créé', async () => {
    const zoe = await creerCompte('zoe@exemple.fr', false);
    const refus = await request(app)
      .post('/demandes')
      .set('Authorization', zoe)
      .send({ scpiId, nombreParts: 5, type: 'pleine_propriete' })
      .expect(403);
    expect(refus.body.message).toBe('Votre KYC doit être validé avant de pouvoir investir.');
    const { rows } = await pool.query(
      `select count(*)::int as n from dossier_investissement d
       join auth_user u on u.id = d.utilisateur_id where u.email = 'zoe@exemple.fr'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it('un investisseur ne lit pas le dossier d’un autre', async () => {
    const marie = await creerCompte('marie@exemple.fr');
    const luc = await creerCompte('luc@exemple.fr');
    const cree = await request(app)
      .post('/demandes')
      .set('Authorization', marie)
      .send({ scpiId, nombreParts: 6, type: 'usufruit' })
      .expect(201);

    const vu = await request(app)
      .get(`/demandes/${cree.body.id}`)
      .set('Authorization', luc)
      .expect(404);
    expect(vu.body.message).toBe('Cette demande est introuvable.');
  });

  it('US-16 : suivi d’un dossier accepté, avec les coordonnées du virement', async () => {
    const ines = await creerCompte('ines@exemple.fr');
    const cree = await request(app)
      .post('/demandes')
      .set('Authorization', ines)
      .send({ scpiId, nombreParts: 5, type: 'pleine_propriete' })
      .expect(201);
    // Étapes franchies par la SCPI partenaire (US-13 à 15), simulées en base
    await pool.query(
      `update dossier_investissement set statut = 'acceptee_attente_paiement',
         accuse_reception_le = '2026-11-13T09:30:00Z', iban_paiement = 'FR7630006000011234567890189',
         bic_paiement = 'AGRIFRPP', reference_virement = 'SIP-COME-20261113-4HX8QA'
       where id = $1`,
      [cree.body.id],
    );

    const suivi = await request(app)
      .get(`/demandes/${cree.body.id}`)
      .set('Authorization', ines)
      .expect(200);
    expect(suivi.body).toMatchObject({
      statut: 'acceptee_attente_paiement',
      accuseReceptionLe: '2026-11-13T09:30:00.000Z',
      motifRefus: null,
      paiement: {
        iban: 'FR7630006000011234567890189',
        bic: 'AGRIFRPP',
        montant: 1000,
        reference: 'SIP-COME-20261113-4HX8QA',
      },
      jouissanceLe: null,
    });
  });
});
