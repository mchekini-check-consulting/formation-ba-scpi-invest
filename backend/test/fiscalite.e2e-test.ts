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
  depotFiscalite,
  depotTentativesConnexion,
  secretDesSessions,
} from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { routesFiscalite } from '../src/fiscalite/routes.js';
import { creerFiscaliteService } from '../src/fiscalite/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// Informations fiscales (US-06, SCPI-255) câblées comme dans server.ts, sur un
// PostgreSQL 16 jetable : enregistrer, ré-afficher, modifier, effacer. Docker requis.
describe('informations fiscales (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;
  let lignes: Record<string, unknown>[];

  const creerCompte = async (email: string) => {
    const motDePasse = 'Tr0pBien!Choisi';
    const compte = await request(app)
      .post('/comptes')
      .send({ email, motDePasse, confirmation: motDePasse, cguAcceptees: true })
      .expect(201);
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
        routesFiscalite(creerFiscaliteService(depotFiscalite(db)), fournisseur),
      ],
    });
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  it('enregistre, ré-affiche, modifie puis efface les informations', async () => {
    const jean = await creerCompte('jean@exemple.fr');
    const appel = (methode: 'get' | 'put' | 'delete') =>
      request(app)[methode]('/informations-fiscales').set('Authorization', jean);

    // Jamais renseignées
    expect((await appel('get').expect(200)).body).toBeNull();

    // Revenu manquant : rien n'est enregistré
    const refus = await appel('put')
      .send({ situationFamiliale: 'seul', nombreEnfants: 0 })
      .expect(400);
    expect(refus.body.erreurs).toEqual({ revenuNetImposable: 'Ce champ est obligatoire.' });
    expect((await appel('get').expect(200)).body).toBeNull();

    // Enregistrer puis rouvrir
    const saisie = { revenuNetImposable: 40000, situationFamiliale: 'seul', nombreEnfants: 0 };
    await appel('put').send(saisie).expect(200, saisie);
    expect((await appel('get').expect(200)).body).toEqual(saisie);

    // Modifier : la ligne est remplacée (sans plafond sur le revenu)
    const modifiee = {
      revenuNetImposable: 12_000_000_000,
      situationFamiliale: 'couple',
      nombreEnfants: 3,
    };
    await appel('put').send(modifiee).expect(200, modifiee);
    expect((await appel('get').expect(200)).body).toEqual(modifiee);
    const { rows } = await pool.query('select count(*)::int as n from information_fiscale');
    expect(rows[0].n).toBe(1);

    // Effacer : redevient « sans informations fiscales » ; effacer deux fois est sans effet
    await appel('delete').expect(204);
    expect((await appel('get').expect(200)).body).toBeNull();
    await appel('delete').expect(204);

    // Données personnelles : aucune valeur dans les logs
    expect(JSON.stringify(lignes)).not.toContain('12000000000');
  });

  it('chaque investisseur ne voit que ses informations', async () => {
    const paul = await creerCompte('paul@exemple.fr');
    const marie = await creerCompte('marie@exemple.fr');
    await request(app)
      .put('/informations-fiscales')
      .set('Authorization', paul)
      .send({ revenuNetImposable: 50000, situationFamiliale: 'couple', nombreEnfants: 1 })
      .expect(200);
    const vu = await request(app)
      .get('/informations-fiscales')
      .set('Authorization', marie)
      .expect(200);
    expect(vu.body).toBeNull();
  });
});
