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
  depotKyc,
  depotPieces,
  secretDesSessions,
} from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { KYC_COMPLET, PDF, PNG } from '../src/kyc/exemple.js';
import { routesPiecesKyc } from '../src/kyc/pieces-routes.js';
import { creerPiecesService, type StockagePieces } from '../src/kyc/pieces-service.js';
import { routesKyc } from '../src/kyc/routes.js';
import { creerKycService } from '../src/kyc/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// KYC (US-04b) et pièces justificatives (US-04c) câblés comme dans server.ts, sur un
// PostgreSQL 16 jetable (R2 remplacé par un stockage en mémoire) : reprise, dépôt des
// pièces, validation, KYC et pièces figés après validation. make test-integration ; Docker requis.
describe('KYC (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;
  const fichiers = new Map<string, Buffer>();
  const stockage: StockagePieces = {
    async deposer(cle, contenu) {
      fichiers.set(cle, contenu);
    },
    async supprimer(cle) {
      fichiers.delete(cle);
    },
  };

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    const db = createDb(pool);
    const { log } = captureLogs();
    const auth = creerAuth(db, await secretDesSessions(db, ''), log);
    const fournisseur = fournisseurBetterAuth(auth);
    app = createApp(() => db.execute(sql`select 1`), log, {
      auth: toNodeHandler(auth),
      routeurs: [
        routesComptes(creerCompteService(fournisseur, depotAcceptationsCgu(db)), fournisseur),
        routesKyc(creerKycService(depotKyc(db)), fournisseur),
        routesPiecesKyc(creerPiecesService(depotKyc(db), depotPieces(db), stockage), fournisseur),
      ],
    });
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  async function nouveauCompte(email: string): Promise<string> {
    const motDePasse = 'Tr0pBien!Choisi';
    const res = await request(app)
      .post('/comptes')
      .send({ email, motDePasse, confirmation: motDePasse, cguAcceptees: true })
      .expect(201);
    return `Bearer ${res.body.jeton}`;
  }

  it('reprise à l’étape atteinte, validation, puis KYC figé', async () => {
    const bearer = await nouveauCompte('claire.martin@exemple.fr');

    // Nouveau compte : étape 1, aucune réponse
    const debut = await request(app).get('/kyc').set('Authorization', bearer).expect(200);
    expect(debut.body).toEqual({ statut: 'en_cours', etape: 1, reponses: {}, valideLe: null });

    // Validation refusée tant que le formulaire est incomplet
    await request(app).post('/kyc/validation').set('Authorization', bearer).expect(400);

    // Étapes 1 et 2 enregistrées, l'utilisateur quitte à l'étape 3 : reprise à l'étape 3
    const { nom, prenom, civilite } = KYC_COMPLET;
    await request(app)
      .put('/kyc')
      .set('Authorization', bearer)
      .send({ etape: 3, reponses: { nom, prenom, civilite } })
      .expect(200);
    const reprise = await request(app).get('/kyc').set('Authorization', bearer).expect(200);
    expect(reprise.body).toMatchObject({
      statut: 'en_cours',
      etape: 3,
      reponses: { nom: 'Martin' },
    });

    // Étape des pièces : toutes les réponses enregistrées, une pièce manque encore
    await request(app)
      .put('/kyc')
      .set('Authorization', bearer)
      .send({ etape: 5, reponses: KYC_COMPLET })
      .expect(200);
    const deposer = (type: string, contenu: Buffer, nom: string) =>
      request(app)
        .put(`/kyc/pieces/${type}`)
        .query({ nom })
        .set('Authorization', bearer)
        .set('Content-Type', 'application/octet-stream')
        .send(contenu);
    await deposer('identite', PDF, 'cni.pdf').expect(200);
    await deposer('domicile', PNG, 'facture.png').expect(200);
    await deposer('rib', Buffer.from('pas un pdf'), 'rib.pdf').expect(400);
    const sansRib = await request(app)
      .post('/kyc/validation')
      .set('Authorization', bearer)
      .expect(400);
    expect(sansRib.body.message).toContain('pièces justificatives');

    // Remplacement puis suppression d'une pièce, avant validation
    await deposer('domicile', PDF, 'quittance.pdf').expect(200);
    await deposer('identite_verso', PNG, 'verso.png').expect(200);
    await request(app)
      .delete('/kyc/pieces/identite_verso')
      .set('Authorization', bearer)
      .expect(204);
    const rib = await deposer('rib', PDF, 'rib.pdf').expect(200);
    expect(rib.body).toMatchObject({ type: 'rib', nomFichier: 'rib.pdf', statut: 'deposee' });
    const liste = await request(app).get('/kyc/pieces').set('Authorization', bearer).expect(200);
    expect(liste.body.map((p: { nomFichier: string }) => p.nomFichier)).toEqual([
      'cni.pdf',
      'quittance.pdf',
      'rib.pdf',
    ]);
    const utilisateurId = (
      await pool.query('select id from auth_user where email = $1', ['claire.martin@exemple.fr'])
    ).rows[0].id;
    expect([...fichiers.keys()].sort()).toEqual(
      ['domicile', 'identite', 'rib'].map((type) => `kyc/${utilisateurId}/${type}`),
    );

    // Récapitulatif atteint, puis validation
    await request(app)
      .put('/kyc')
      .set('Authorization', bearer)
      .send({ etape: 6, reponses: KYC_COMPLET })
      .expect(200);
    const validation = await request(app)
      .post('/kyc/validation')
      .set('Authorization', bearer)
      .expect(200);
    expect(validation.body.statut).toBe('complete');
    const valideLe = new Date(validation.body.valideLe).getTime();
    expect(Math.abs(valideLe - Date.now())).toBeLessThan(60_000);

    // Statut « complété » et date en base ; plus aucune modification possible
    const { rows } = await pool.query(
      'select statut, valide_le, etape, reponses from kyc where utilisateur_id = (select id from auth_user where email = $1)',
      ['claire.martin@exemple.fr'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].statut).toBe('complete');
    expect(rows[0].valide_le).not.toBeNull();
    expect(rows[0].reponses.nom).toBe('Martin');
    await request(app)
      .put('/kyc')
      .set('Authorization', bearer)
      .send({ etape: 2, reponses: { nom: 'Autre' } })
      .expect(409);
    await request(app).post('/kyc/validation').set('Authorization', bearer).expect(409);

    // Pièces « en cours de vérification », plus modifiables
    const verifiees = await request(app).get('/kyc/pieces').set('Authorization', bearer);
    expect(verifiees.body.map((p: { statut: string }) => p.statut)).toEqual([
      'en_verification',
      'en_verification',
      'en_verification',
    ]);
    await deposer('rib', PDF, 'autre.pdf').expect(409);
    await request(app).delete('/kyc/pieces/rib').set('Authorization', bearer).expect(409);
    const fige = await request(app).get('/kyc').set('Authorization', bearer).expect(200);
    expect(fige.body).toMatchObject({ statut: 'complete', reponses: { nom: 'Martin' } });
  });

  it('chaque utilisateur ne voit que son propre KYC', async () => {
    const alice = await nouveauCompte('alice@exemple.fr');
    const bob = await nouveauCompte('bob@exemple.fr');
    await request(app)
      .put('/kyc')
      .set('Authorization', alice)
      .send({ etape: 2, reponses: { nom: 'Alice' } })
      .expect(200);
    const deBob = await request(app).get('/kyc').set('Authorization', bob).expect(200);
    expect(deBob.body).toEqual({ statut: 'en_cours', etape: 1, reponses: {}, valideLe: null });
  });

  it('sans connexion : 401', async () => {
    await request(app).get('/kyc').expect(401);
  });
});
