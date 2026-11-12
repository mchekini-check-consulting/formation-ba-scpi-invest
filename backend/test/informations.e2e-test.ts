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
  depotInformations,
  depotKyc,
  depotPieces,
  depotTentativesConnexion,
  secretDesSessions,
} from '../src/db/depots.js';
import { createDb, createPool } from '../src/db/index.js';
import { routesInformations } from '../src/informations/routes.js';
import { creerInformationsService } from '../src/informations/service.js';
import { KYC_COMPLET, PDF, PNG } from '../src/kyc/exemple.js';
import { routesPiecesKyc } from '../src/kyc/pieces-routes.js';
import { creerPiecesService, type StockagePieces } from '../src/kyc/pieces-service.js';
import { routesKyc } from '../src/kyc/routes.js';
import { creerKycService } from '../src/kyc/service.js';
import { captureLogs } from '../src/logging/capture.js';
import { migrate } from '../src/migrate.js';

// US-06 : informations personnelles câblées comme dans server.ts, sur un PostgreSQL 16
// jetable, avec le vrai Better-Auth (mot de passe, changement d'e-mail) et un stockage en
// mémoire à la place de R2. make test-integration ; Docker requis.
describe('informations personnelles (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let pool: Pool;
  let app: Express;
  const MOT_DE_PASSE = 'Tr0pBien!Choisi';
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
        routesComptes(
          creerCompteService(fournisseur, {
            cgu: depotAcceptationsCgu(db),
            tentatives: depotTentativesConnexion(db),
          }),
          fournisseur,
        ),
        routesKyc(creerKycService(depotKyc(db)), fournisseur),
        routesPiecesKyc(creerPiecesService(depotKyc(db), depotPieces(db), stockage), fournisseur),
        routesInformations(
          creerInformationsService(depotInformations(db), stockage, fournisseur),
          fournisseur,
        ),
      ],
    });
  });

  afterAll(async () => {
    await pool?.end();
    await postgres?.stop();
  });

  async function compteAvecKycValide(email: string): Promise<string> {
    const res = await request(app)
      .post('/comptes')
      .send({ email, motDePasse: MOT_DE_PASSE, confirmation: MOT_DE_PASSE, cguAcceptees: true })
      .expect(201);
    const bearer = `Bearer ${res.body.jeton}`;
    await request(app)
      .put('/connaissance-client')
      .set('Authorization', bearer)
      .send({ etape: 5, reponses: KYC_COMPLET })
      .expect(200);
    for (const type of ['identite', 'domicile', 'rib']) {
      await request(app)
        .put(`/connaissance-client/pieces/${type}`)
        .query({ nom: `${type}.pdf` })
        .set('Authorization', bearer)
        .set('Content-Type', 'application/octet-stream')
        .send(PDF)
        .expect(200);
    }
    await request(app)
      .post('/connaissance-client/validation')
      .set('Authorization', bearer)
      .expect(200);
    return bearer;
  }

  it('modifications appliquées tout de suite, historisées, pièces en vérification', async () => {
    // KYC pas encore validé : 409
    const autre = await request(app)
      .post('/comptes')
      .send({
        email: 'sans.kyc@exemple.fr',
        motDePasse: MOT_DE_PASSE,
        confirmation: MOT_DE_PASSE,
        cguAcceptees: true,
      })
      .expect(201);
    await request(app)
      .get('/informations-personnelles')
      .set('Authorization', `Bearer ${autre.body.jeton}`)
      .expect(409);

    const bearer = await compteAvecKycValide('claire.martin@exemple.fr');
    const appel = (methode: 'get' | 'put' | 'post', chemin = '') =>
      request(app)[methode](`/informations-personnelles${chemin}`).set('Authorization', bearer);
    const deposer = async (contenu: Buffer, nom: string) =>
      (
        await appel('post', '/justificatifs')
          .query({ nom })
          .set('Content-Type', 'application/octet-stream')
          .send(contenu)
          .expect(201)
      ).body.id as number;

    const debut = (await appel('get').expect(200)).body;
    expect(debut).toMatchObject({
      email: 'claire.martin@exemple.fr',
      reponses: { ville: 'Lyon' },
      historique: [],
    });

    // Adresse : sans justificatif refusée, avec justificatif appliquée
    const adresse = {
      adresse: '24 avenue Jean Jaurès',
      codePostal: '75019',
      ville: 'Paris',
      pays: 'France',
    };
    await appel('put', '/adresse').send(adresse).expect(400);
    await appel('post', '/justificatifs').send(Buffer.from('texte')).expect(400);
    const quittance = await deposer(PNG, 'quittance.png');
    const apresAdresse = (
      await appel('put', '/adresse')
        .send({ ...adresse, justificatif: quittance })
        .expect(200)
    ).body;
    expect(apresAdresse.reponses).toMatchObject({ ville: 'Paris', codePostal: '75019' });
    expect(apresAdresse.historique.map((l: { champ: string }) => l.champ).sort()).toEqual([
      'adresse',
      'codePostal',
      'ville',
    ]);
    const { rows: domicile } = await pool.query(
      "select nom_fichier, statut from kyc_piece where type = 'domicile'",
    );
    expect(domicile[0]).toEqual({ nom_fichier: 'quittance.png', statut: 'en_verification' });
    // Ancien fichier conservé, nouveau ajouté
    expect(fichiers.size).toBe(4);

    // Coordonnées : mot de passe faux refusé, bon mot de passe -> e-mail de connexion changé
    const coordonnees = {
      telephone: '06 98 76 54 32',
      email: 'claire.durand@exemple.fr',
      motDePasse: 'mauvais-mot-de-passe',
    };
    await appel('put', '/coordonnees').send(coordonnees).expect(403);
    const apresCoordonnees = (
      await appel('put', '/coordonnees')
        .send({ ...coordonnees, motDePasse: MOT_DE_PASSE })
        .expect(200)
    ).body;
    expect(apresCoordonnees.email).toBe('claire.durand@exemple.fr');
    await request(app)
      .post('/comptes/connexion')
      .send({ email: 'claire.durand@exemple.fr', motDePasse: MOT_DE_PASSE })
      .expect(200);
    // Session en cours toujours valable, e-mail à jour
    expect((await appel('get').expect(200)).body.email).toBe('claire.durand@exemple.fr');

    // Pièce d'identité : recto et verso
    const recto = await deposer(PDF, 'cni-recto.pdf');
    const verso = await deposer(PDF, 'cni-verso.pdf');
    await appel('put', '/identite').send({ recto, verso }).expect(200);
    const { rows: identite } = await pool.query(
      "select type, nom_fichier, statut from kyc_piece where type in ('identite', 'identite_verso') order by type",
    );
    expect(identite).toEqual([
      { type: 'identite', nom_fichier: 'cni-recto.pdf', statut: 'en_verification' },
      { type: 'identite_verso', nom_fichier: 'cni-verso.pdf', statut: 'en_verification' },
    ]);

    // Historique : une ligne par champ, la plus récente en premier, justificatif relié
    const { rows: historique } = await pool.query(
      'select bloc, champ, justificatif_id from historique_information order by id',
    );
    expect(historique.map((l) => `${l.bloc}.${l.champ}`)).toEqual([
      'adresse.adresse',
      'adresse.codePostal',
      'adresse.ville',
      'coordonnees.telephone',
      'coordonnees.email',
      'identite.identite',
      'identite.identite_verso',
    ]);
    expect(Number(historique[0].justificatif_id)).toBe(quittance);
    const fin = (await appel('get').expect(200)).body;
    expect(fin.historique[0].champ).toBe('identite_verso');
  });
});
