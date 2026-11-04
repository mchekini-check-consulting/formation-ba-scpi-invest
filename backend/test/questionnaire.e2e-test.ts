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
import { depotAcceptationsCgu, depotQuestionnaires, secretDesSessions } from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { REPONSES_EXEMPLE } from '../src/investisseur/reponses-exemple.js';
import { routesQuestionnaire } from '../src/investisseur/routes.js';
import { creerQuestionnaireService } from '../src/investisseur/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// Formulaire investisseur (US-05a) câblé comme dans server.ts, sur un PostgreSQL 16
// jetable : enregistrement étape par étape et reprise. Docker requis.
describe('formulaire investisseur (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;
  let bearer: string;

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
        routesQuestionnaire(creerQuestionnaireService(depotQuestionnaires(db)), fournisseur),
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

  it('enregistre chaque étape, reprend à la première étape non complétée', async () => {
    const lire = () =>
      request(app).get('/questionnaire-investisseur').set('Authorization', bearer).expect(200);
    expect((await lire()).body).toEqual({ etapeCourante: 1, reponses: {} });

    for (const etape of [1, 2]) {
      await request(app)
        .put(`/questionnaire-investisseur/etapes/${etape}`)
        .set('Authorization', bearer)
        .send(REPONSES_EXEMPLE[etape])
        .expect(200);
    }

    // Reprise : étape 3, réponses des étapes 1 et 2 conservées en base
    expect((await lire()).body).toEqual({
      etapeCourante: 3,
      reponses: { 1: REPONSES_EXEMPLE[1], 2: REPONSES_EXEMPLE[2] },
    });
    const { rows } = await pool.query(
      'select version_questionnaire, etape_courante from questionnaire_investisseur',
    );
    expect(rows).toEqual([{ version_questionnaire: '1.0', etape_courante: 3 }]);
  });

  it('refuse une étape non atteinte, des réponses incomplètes ou sans session', async () => {
    await request(app)
      .put('/questionnaire-investisseur/etapes/5')
      .set('Authorization', bearer)
      .send(REPONSES_EXEMPLE[5])
      .expect(400);
    await request(app)
      .put('/questionnaire-investisseur/etapes/3')
      .set('Authorization', bearer)
      .send({ objectifs: [] })
      .expect(400);
    await request(app).get('/questionnaire-investisseur').expect(401);
  });
});
