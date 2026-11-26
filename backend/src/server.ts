import { sql } from 'drizzle-orm';
import { toNodeHandler } from 'better-auth/node';
import type { RequestHandler } from 'express';
import { routesAdresses } from './adresses/routes.js';
import { creerAdressesService } from './adresses/service.js';
import { createApp } from './app.js';
import { creerAuth, fournisseurBetterAuth } from './auth/better-auth.js';
import { routesCatalogue } from './catalogue/routes.js';
import { creerCatalogueService } from './catalogue/service.js';
import { routesComparaison } from './comparaison/routes.js';
import { creerComparaisonService } from './comparaison/service.js';
import { routesComptes } from './comptes/routes.js';
import { routesDemandes } from './demandes/routes.js';
import { creerDemandesService } from './demandes/service.js';
import { routesFiche } from './fiche/routes.js';
import { creerFicheService } from './fiche/service.js';
import { routesFiscalite } from './fiscalite/routes.js';
import { creerFiscaliteService } from './fiscalite/service.js';
import {
  decrirePlanification,
  demarrerImportNocturne,
  lancerSurUnSeulReplica,
} from './csv/planification.js';
import { creerImportService } from './csv/service.js';
import { s3Client, s3Config, sourceR2, type S3Config } from './csv/source.js';
import type { S3Client } from '@aws-sdk/client-s3';
import { creerCompteService } from './comptes/service.js';
import {
  depotAcceptationsCgu,
  depotTentativesConnexion,
  depotCatalogue,
  depotComparaison,
  depotDemandes,
  depotFiche,
  depotFiscalite,
  depotInformations,
  depotKyc,
  depotOutilsImport,
  depotPieces,
  depotProfils,
  depotQuestionnaires,
  secretDesSessions,
} from './db/depots.js';
import { createDb, createPool } from './db/index.js';
import { routesInformations } from './informations/routes.js';
import { creerInformationsService } from './informations/service.js';
import { routesQuestionnaire } from './investisseur/routes.js';
import { creerQuestionnaireService } from './investisseur/service.js';
import { routesPiecesKyc } from './kyc/pieces-routes.js';
import { creerPiecesService } from './kyc/pieces-service.js';
import { routesKyc } from './kyc/routes.js';
import { creerKycService } from './kyc/service.js';
import { stockagePieces } from './kyc/stockage.js';
import { topics } from './kafka/config.js';
import { creerCanalKafka } from './kafka/producteur.js';
import { routesOutilsKafka } from './outils/kafka-routes.js';
import { creerOutilsKafkaService } from './outils/kafka-service.js';
import { logger } from './logging/logger.js';
import { migrate } from './migrate.js';
import { routesOutilsImport } from './outils/routes.js';
import { creerOutilsImportService, stockageCsvR2 } from './outils/service.js';

// Migrations au démarrage, puis écoute sur 8080 (helm.yaml : containerPort)
const pool = createPool();
await migrate(pool);
const db = createDb(pool);

// Authentification : Better-Auth derrière l'interface FournisseurIdentite (src/auth/)
const auth = creerAuth(db, await secretDesSessions(db));
const fournisseur = fournisseurBetterAuth(auth);
const betterAuth: RequestHandler = toNodeHandler(auth);
const comptes = creerCompteService(fournisseur, {
  cgu: depotAcceptationsCgu(db),
  tentatives: depotTentativesConnexion(db),
});
const questionnaires = creerQuestionnaireService(depotQuestionnaires(db), depotProfils(db));
const kyc = creerKycService(depotKyc(db));
// KYC, étape « Coordonnées » : suggestions d'adresses (service national des adresses)
const adresses = creerAdressesService();
// US-08 : liste des SCPI du Catalogue
const catalogue = creerCatalogueService(depotCatalogue(db));
// US-04 : SCPI du comparateur
const comparaison = creerComparaisonService(depotComparaison(db));
// US-02 : fiche d'une SCPI
const fiche = creerFicheService(depotFiche(db));
// US-04c : fichiers des pièces dans R2 (dépôt indisponible, 503, sans les variables R2)
const pieces = creerPiecesService(depotKyc(db), depotPieces(db), stockagePieces());
// US-06 : mise à jour des informations personnelles (justificatifs dans R2, comme les pièces)
const informations = creerInformationsService(depotInformations(db), stockagePieces(), fournisseur);
// US-06 (SCPI-255) : informations fiscales du foyer
const fiscalite = creerFiscaliteService(depotFiscalite(db));
// US-11 (SCPI-259) : demandes d'investissement (dossiers)
const demandes = creerDemandesService(depotDemandes(db));

// US-07a : import du catalogue au démarrage puis chaque nuit à 2h (désactivé sans les variables R2)
const tacheImport = demarrerImportNocturne(pool, db);

// Outil de test de l'import (dev et poste uniquement, src/outils/environnement.ts) :
// même fichier R2 et même verrou que l'import de nuit ; sans variables R2 : 503
let r2: { config: S3Config; client: S3Client } | null = null;
let r2Absent: string | undefined;
try {
  const config = s3Config();
  r2 = { config, client: s3Client(config) };
} catch (err) {
  r2Absent = err instanceof Error ? err.message : String(err);
}
const outilsImport = creerOutilsImportService({
  depot: depotOutilsImport(db),
  stockage: r2 && stockageCsvR2(r2.client, r2.config),
  stockageAbsent: r2Absent,
  lancer: r2 && ((executer) => lancerSurUnSeulReplica(pool, executer, false)),
  executer: () => creerImportService(db, sourceR2(r2!.client, r2!.config)).executer(),
  planification: () => decrirePlanification(tacheImport),
  pod: process.env.HOSTNAME ?? null,
});

// Canal d'envoi Kafka (src/kafka/) : actif seulement si KAFKA_BOOTSTRAP_SERVERS est
// renseignée (helm.yaml : dev). Connexion au premier envoi. Utilisé par l'US-12.
const kafka = creerCanalKafka();
const outilsKafka = creerOutilsKafkaService({
  canal: kafka,
  topic: topics().test,
  pod: process.env.HOSTNAME ?? null,
});

const port = Number(process.env.PORT ?? 8080);
createApp(() => db.execute(sql`select 1`), logger, {
  auth: betterAuth,
  routeurs: [
    routesComptes(comptes, fournisseur),
    routesKyc(kyc, fournisseur),
    routesAdresses(adresses, fournisseur),
    routesPiecesKyc(pieces, fournisseur),
    routesQuestionnaire(questionnaires, fournisseur),
    routesInformations(informations, fournisseur),
    routesFiscalite(fiscalite, fournisseur),
    routesDemandes(demandes, fournisseur),
    // Avant le Catalogue : /scpis/comparables ne doit pas être pris pour une adresse /scpis/<id>
    routesComparaison(comparaison, fournisseur),
    routesCatalogue(catalogue, fournisseur),
    // US-02 : après le Comparateur et le Catalogue (/scpis/filtres, /scpis/recherche...)
    routesFiche(fiche, fournisseur),
    routesOutilsImport(outilsImport),
    routesOutilsKafka(outilsKafka),
  ],
}).listen(port, () => logger.info({ port }, 'backend démarré'));
