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
import { depotAcceptationsCgu, depotKyc, secretDesSessions } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { KYC_COMPLET } from '../src/kyc/exemple.js';
import { routesKyc } from '../src/kyc/routes.js';
import { creerKycService } from '../src/kyc/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// KYC (US-04b) câblé comme dans server.ts, sur un PostgreSQL 16 jetable :
// reprise, validation, KYC figé après validation. make test-integration ; Docker requis.
describe('KYC (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;

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

    // Récapitulatif atteint avec toutes les réponses, puis validation
    await request(app)
      .put('/kyc')
      .set('Authorization', bearer)
      .send({ etape: 5, reponses: KYC_COMPLET })
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
