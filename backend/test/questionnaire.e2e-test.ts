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
  depotProfils,
  depotQuestionnaires,
  secretDesSessions,
} from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { REPONSES_EXEMPLE } from '../src/investisseur/reponses-exemple.js';
import { routesQuestionnaire } from '../src/investisseur/routes.js';
import { creerQuestionnaireService } from '../src/investisseur/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// Formulaire investisseur câblé comme dans server.ts, sur un PostgreSQL 16 jetable :
// enregistrement étape par étape et reprise (US-05a), profil et validation (US-05b).
// Docker requis.
describe('formulaire investisseur (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;
  let bearer: string;

  const appel = (methode: 'get' | 'put' | 'post' | 'delete', chemin = '') =>
    request(app)[methode](`/questionnaire-investisseur${chemin}`).set('Authorization', bearer);

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
        routesQuestionnaire(
          creerQuestionnaireService(depotQuestionnaires(db), depotProfils(db)),
          fournisseur,
        ),
      ],
    });
    const motDePasse = 'Tr0pBien!Choisi';
    const compte = await request(app)
      .post('/comptes')
      .send({ email: 'jean@exemple.fr', motDePasse, confirmation: motDePasse, cguAcceptees: true })
      .expect(201);
    bearer = `Bearer ${compte.body.jeton}`;
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('US-05a : enregistre chaque étape, reprend à la première étape non complétée', async () => {
    expect((await appel('get').expect(200)).body).toEqual({
      etapeCourante: 1,
      reponses: {},
      valide: false,
    });

    for (const etape of [1, 2]) {
      await appel('put', `/etapes/${etape}`).send(REPONSES_EXEMPLE[etape]).expect(200);
    }

    // Reprise : étape 3, réponses des étapes 1 et 2 conservées en base
    expect((await appel('get').expect(200)).body).toEqual({
      etapeCourante: 3,
      reponses: { 1: REPONSES_EXEMPLE[1], 2: REPONSES_EXEMPLE[2] },
      valide: false,
    });
    const { rows } = await pool.query(
      'select version_questionnaire, etape_courante from questionnaire_investisseur',
    );
    expect(rows).toEqual([{ version_questionnaire: '1.0', etape_courante: 3 }]);
  });

  it('US-05a : « Réinitialiser » efface en base les réponses de l’étape', async () => {
    await appel('delete', '/etapes/2').expect(200);
    const { rows } = await pool.query(
      'select etape_courante, reponses from questionnaire_investisseur',
    );
    expect(rows).toEqual([{ etape_courante: 2, reponses: { 1: REPONSES_EXEMPLE[1] } }]);

    // l'étape se remplit de nouveau normalement
    await appel('put', '/etapes/2').send(REPONSES_EXEMPLE[2]).expect(200);
    expect((await appel('get').expect(200)).body.etapeCourante).toBe(3);
  });

  it('US-05a : refuse une étape non atteinte, des réponses incomplètes ou sans session', async () => {
    await appel('put', '/etapes/5').send(REPONSES_EXEMPLE[5]).expect(400);
    await appel('put', '/etapes/3').send({ objectifs: [] }).expect(400);
    await request(app).get('/questionnaire-investisseur').expect(401);
  });

  it('US-05b : profil calculé, validation enregistrée en base, formulaire terminé', async () => {
    // profil indisponible tant que les 5 étapes ne sont pas complétées
    await appel('get', '/profil').expect(409);
    for (const etape of [3, 4, 5]) {
      await appel('put', `/etapes/${etape}`).send(REPONSES_EXEMPLE[etape]).expect(200);
    }
    await appel('get', '/profil').expect(200, { profil: 'equilibre', avertissements: [] });

    // certification obligatoire, puis validation
    await appel('post', '/validation').send({ certification: false }).expect(400);
    await appel('post', '/validation')
      .send({ certification: true })
      .expect(201, { profil: 'equilibre', avertissements: [] });

    const { rows } = await pool.query(
      'select profil, score, version_questionnaire, valide_le, reponses from profil_investisseur',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profil: 'equilibre', score: 4, version_questionnaire: '1.0' });
    expect(Date.now() - new Date(rows[0].valide_le).getTime()).toBeLessThan(60_000);
    expect(rows[0].reponses['4']).toEqual(REPONSES_EXEMPLE[4]);

    // formulaire terminé : signalé, plus modifiable, pas de seconde validation
    expect((await appel('get').expect(200)).body.valide).toBe(true);
    await appel('put', '/etapes/1').send(REPONSES_EXEMPLE[1]).expect(409);
    await appel('post', '/validation').send({ certification: true }).expect(409);
  });
});
