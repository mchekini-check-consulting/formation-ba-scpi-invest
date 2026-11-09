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
import { VERSION_CGU, creerCompteService, empreinte } from '../src/comptes/service.js';
import {
  depotAcceptationsCgu,
  depotTentativesConnexion,
  secretDesSessions,
} from '../src/db/depots.js';
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
  let db: ReturnType<typeof createDb>;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16').start();
    pool = createPool(postgres.getConnectionUri());
    await migrate(pool);
    db = createDb(pool);
    const { log } = captureLogs();
    const auth = creerAuth(db, await secretDesSessions(db, ''), log);
    const fournisseur = fournisseurBetterAuth(auth);
    const service = creerCompteService(fournisseur, {
      cgu: depotAcceptationsCgu(db),
      tentatives: depotTentativesConnexion(db),
      log,
    });
    app = createApp(() => db.execute(sql`select 1`), log, {
      auth: toNodeHandler(auth),
      routeurs: [routesComptes(service, fournisseur)],
    });
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('crée le compte, connecte l’utilisateur 45 minutes, puis le déconnecte', async () => {
    const creation = await request(app).post('/comptes').send(COMPTE).expect(201);
    const { utilisateur, jeton } = creation.body;
    expect(utilisateur.email).toBe('jean.dupont@exemple.fr');

    // Session reconnue grâce au jeton (Authorization: Bearer)
    const bearer = `Bearer ${jeton}`;
    await request(app).get('/comptes/moi').set('Authorization', bearer).expect(200, utilisateur);
    const session = await request(app)
      .get('/auth/get-session')
      .set('Authorization', bearer)
      .expect(200);
    const duree = new Date(session.body.session.expiresAt).getTime() - Date.now();
    expect(duree / 60_000).toBeCloseTo(45, 0);

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
    await request(app).get('/comptes/moi').set('Authorization', bearer).expect(401);
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
      .post('/comptes/connexion')
      .send({ email: ' Jean.Dupont@Exemple.fr ', motDePasse: COMPTE.motDePasse })
      .expect(200);
    const { utilisateur, jeton } = connexion.body;
    expect(utilisateur.email).toBe('jean.dupont@exemple.fr');
    await request(app)
      .get('/comptes/moi')
      .set('Authorization', `Bearer ${jeton}`)
      .expect(200, utilisateur);

    // Même message pour un mauvais mot de passe et un email inconnu
    const message = { message: 'Email ou mot de passe incorrect' };
    await request(app)
      .post('/comptes/connexion')
      .send({ email: 'jean.dupont@exemple.fr', motDePasse: 'Mauvais!Mdp123' })
      .expect(401, message);
    await request(app)
      .post('/comptes/connexion')
      .send({ email: 'inconnu@exemple.fr', motDePasse: COMPTE.motDePasse })
      .expect(401, message);
  });

  it('US-03b : chaque appel connecté repousse la fin de session à 45 min ; sans appel, elle expire', async () => {
    const connexion = await request(app)
      .post('/comptes/connexion')
      .send({ email: COMPTE.email, motDePasse: COMPTE.motDePasse })
      .expect(200);
    const bearer = `Bearer ${connexion.body.jeton}`;
    const finDeSession = async () => {
      const { rows } = await pool.query('select expires_at from auth_session where token = $1', [
        connexion.body.jeton,
      ]);
      return (new Date(rows[0].expires_at).getTime() - Date.now()) / 60_000;
    };
    const finDansMinutes = (minutes: number) =>
      pool.query(
        `update auth_session set expires_at = now() + make_interval(secs => $1) where token = $2`,
        [minutes * 60, connexion.body.jeton],
      );

    // 2 minutes sans activité (il reste 43 min) : l'appel suivant repousse à 45 min
    await finDansMinutes(43);
    await request(app).get('/comptes/moi').set('Authorization', bearer).expect(200);
    expect(await finDeSession()).toBeCloseTo(45, 0);

    // Moins d'une minute depuis la dernière prolongation : pas d'écriture en base
    await finDansMinutes(44.5);
    await request(app).get('/comptes/moi').set('Authorization', bearer).expect(200);
    expect(await finDeSession()).toBeCloseTo(44.5, 0);

    // Plus de 45 minutes sans activité : session expirée
    await finDansMinutes(-0.1);
    await request(app).get('/comptes/moi').set('Authorization', bearer).expect(401);
  });

  it('US-03b : 5e échec -> bloqué 10 min (même avec le bon mot de passe), puis débloqué', async () => {
    await pool.query('delete from tentative_connexion'); // échecs laissés par les tests précédents
    const email = 'jean.dupont@exemple.fr';
    const echouer = () =>
      request(app).post('/comptes/connexion').send({ email, motDePasse: 'Mauvais!Mdp123' });

    for (let i = 1; i <= 4; i++) {
      await echouer().expect(401);
    }
    const blocage = await echouer().expect(429);
    expect(blocage.body.message).toBe('Trop de tentatives : votre compte est bloqué.');
    const minutes = (new Date(blocage.body.debloqueA).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeCloseTo(10, 0);

    // Bon mot de passe pendant le blocage : refusé, blocage inchangé
    await request(app)
      .post('/comptes/connexion')
      .send({ email, motDePasse: COMPTE.motDePasse })
      .expect(429, blocage.body);

    // Aucun email en clair dans la table
    const { rows } = await pool.query('select * from tentative_connexion');
    expect(JSON.stringify(rows)).not.toContain('jean');

    // Blocage terminé : nouvel échec compté à partir de 1, puis connexion qui efface tout
    await pool.query(`update tentative_connexion set bloque_jusqua = now() - interval '1 second'`);
    await echouer().expect(401);
    const { rows: apres } = await pool.query('select echecs from tentative_connexion');
    expect(apres).toEqual([{ echecs: 1 }]);
    await request(app)
      .post('/comptes/connexion')
      .send({ email, motDePasse: COMPTE.motDePasse })
      .expect(200);
    const { rows: vide } = await pool.query('select count(*)::int as n from tentative_connexion');
    expect(vide[0].n).toBe(0);
  });

  it('US-03b : email sans compte bloqué pareil ; échecs de plus de 10 min oubliés', async () => {
    await pool.query('delete from tentative_connexion');
    const echecsDe = async (email: string) => {
      const { rows } = await pool.query(
        'select echecs, bloque_jusqua is not null as bloque from tentative_connexion where cle = $1',
        [empreinte(email)],
      );
      return rows[0];
    };
    const echouer = (email: string) =>
      request(app).post('/comptes/connexion').send({ email, motDePasse: 'Mauvais!Mdp123' });
    for (let i = 1; i <= 4; i++) {
      await echouer('inconnu@exemple.fr').expect(401);
    }
    await echouer('inconnu@exemple.fr').expect(429);
    expect(await echecsDe('inconnu@exemple.fr')).toEqual({ echecs: 5, bloque: true });

    // 4 échecs, puis 11 minutes sans essai : le compteur repart à 1
    for (let i = 1; i <= 4; i++) {
      await echouer('autre@exemple.fr').expect(401);
    }
    await pool.query(
      `update tentative_connexion set dernier_echec = now() - interval '11 minutes' where cle = $1`,
      [empreinte('autre@exemple.fr')],
    );
    await echouer('autre@exemple.fr').expect(401);
    expect(await echecsDe('autre@exemple.fr')).toEqual({ echecs: 1, bloque: false });
  });

  it('US-03b : essais envoyés en même temps -> jamais plus de 5 mots de passe vérifiés', async () => {
    await pool.query('delete from tentative_connexion');
    const regle = { echecsAvantBlocage: 5, dureeMs: 600_000 };
    const tentatives = depotTentativesConnexion(db);
    const maintenant = new Date();
    const reponses = await Promise.all(
      Array.from({ length: 20 }, () => tentatives.reserverEssai('rafale', maintenant, regle)),
    );
    expect(reponses.filter((fin) => fin === null)).toHaveLength(5);
    const finsDeBlocage = new Set(reponses.filter(Boolean).map((fin) => fin?.toISOString()));
    expect(finsDeBlocage.size).toBe(1); // un seul blocage, posé par le 6e essai

    // Par l'API : 20 mauvais mots de passe d'un coup, au plus 5 réponses « incorrect »
    const email = 'jean.dupont@exemple.fr';
    const statuts = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(app)
          .post('/comptes/connexion')
          .send({ email, motDePasse: 'Mauvais!Mdp123' })
          .then((r) => r.status),
      ),
    );
    expect(statuts.filter((s) => s === 401).length).toBeLessThanOrEqual(5);
    expect(statuts.every((s) => s === 401 || s === 429)).toBe(true);
    await request(app)
      .post('/comptes/connexion')
      .send({ email, motDePasse: COMPTE.motDePasse })
      .expect(429);
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
