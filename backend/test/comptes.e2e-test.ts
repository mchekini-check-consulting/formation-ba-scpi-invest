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
import { VERSION_CGU, creerCompteService } from '../src/comptes/service.js';
import { depotAcceptationsCgu, secretDesSessions } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// Création de compte, session en base et déconnexion, câblées comme dans server.ts,
// sur un PostgreSQL 16 jetable. make test-integration ; Docker requis.
const COMPTE = {
  email: 'Jean.Dupont@Exemple.fr',
  motDePasse: 'Tr0pBien!Choisi',
  confirmation: 'Tr0pBien!Choisi',
  cguAcceptees: true,
};

describe('création de compte (e2e)', () => {
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
    const service = creerCompteService(fournisseur, depotAcceptationsCgu(db));
    app = createApp(() => db.execute(sql`select 1`), log, {
      auth: toNodeHandler(auth),
      routeurs: [routesComptes(service, fournisseur)],
    });
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('crée le compte, connecte l’utilisateur 7 jours, puis le déconnecte', async () => {
    const creation = await request(app).post('/comptes').send(COMPTE).expect(201);
    const { utilisateur, jeton } = creation.body;
    expect(utilisateur.email).toBe('jean.dupont@exemple.fr');

    // Session reconnue grâce au jeton (Authorization: Bearer)
    const bearer = `Bearer ${jeton}`;
    await request(app).get('/moi').set('Authorization', bearer).expect(200, utilisateur);
    const session = await request(app)
      .get('/auth/get-session')
      .set('Authorization', bearer)
      .expect(200);
    const duree = new Date(session.body.session.expiresAt).getTime() - Date.now();
    expect(duree / 86_400_000).toBeCloseTo(7, 1);

    // Mot de passe haché, session et acceptation des CGU en base
    const { rows: comptes } = await pool.query(
      'select password from auth_account where user_id = $1',
      [utilisateur.id],
    );
    expect(comptes[0].password).not.toContain(COMPTE.motDePasse);
    const { rows: sessions } = await pool.query('select count(*)::int as n from auth_session');
    expect(sessions[0].n).toBe(1);
    const { rows: cgu } = await pool.query(
      'select version_cgu, acceptee_le from acceptation_cgu where utilisateur_id = $1',
      [utilisateur.id],
    );
    expect(cgu).toHaveLength(1);
    expect(cgu[0].version_cgu).toBe(VERSION_CGU);

    // Déconnexion : session supprimée, jeton refusé
    await request(app).post('/auth/sign-out').set('Authorization', bearer).expect(200);
    await request(app).get('/moi').set('Authorization', bearer).expect(401);
  });

  it('email déjà utilisé : 409, aucun second compte', async () => {
    const res = await request(app)
      .post('/comptes')
      .send({ ...COMPTE, email: 'jean.dupont@exemple.fr' })
      .expect(409);
    expect(res.body).toEqual({ message: 'Un compte existe déjà avec cet email' });
    const { rows } = await pool.query('select count(*)::int as n from auth_user');
    expect(rows[0].n).toBe(1);
  });

  it('connexion (US-03a) : nouvelle session avec les bons identifiants, sinon 401', async () => {
    const connexion = await request(app)
      .post('/connexions')
      .send({ email: ' Jean.Dupont@Exemple.fr ', motDePasse: COMPTE.motDePasse })
      .expect(200);
    const { utilisateur, jeton } = connexion.body;
    expect(utilisateur.email).toBe('jean.dupont@exemple.fr');
    await request(app).get('/moi').set('Authorization', `Bearer ${jeton}`).expect(200, utilisateur);

    // Même message pour un mauvais mot de passe et un email inconnu
    const message = { message: 'Email ou mot de passe incorrect' };
    await request(app)
      .post('/connexions')
      .send({ email: 'jean.dupont@exemple.fr', motDePasse: 'Mauvais!Mdp123' })
      .expect(401, message);
    await request(app)
      .post('/connexions')
      .send({ email: 'inconnu@exemple.fr', motDePasse: COMPTE.motDePasse })
      .expect(401, message);
  });

  it('inscription directe de Better-Auth fermée : seules les règles de POST /comptes s’appliquent', async () => {
    await request(app)
      .post('/auth/sign-up/email')
      .send({ email: 'autre@exemple.fr', password: COMPTE.motDePasse, name: '' })
      .expect(404);
  });

  it('clé de signature des sessions : générée une fois, la même pour tous les réplicas', async () => {
    const db = createDb(pool);
    const [a, b] = await Promise.all([secretDesSessions(db, ''), secretDesSessions(db, '')]);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(await secretDesSessions(db, 'fournie-par-la-plateforme')).toBe(
      'fournie-par-la-plateforme',
    );
  });
});
