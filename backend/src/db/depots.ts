import { randomBytes } from 'node:crypto';
import { type SQL, and, asc, desc, eq, gte, isNull, max, or, sql } from 'drizzle-orm';
import type { Db } from './index.js';
import {
  type FiltresCatalogue,
  type Plage,
  TRANCHES_CAPITALISATION,
} from '../catalogue/filtres.js';
import type { DepotCatalogue, ScpiCatalogue, ValeursFiltres } from '../catalogue/service.js';
import { type CritereTri, TRI_PAR_DEFAUT, type TriCatalogue } from '../catalogue/tri.js';
import type { DepotTentativesConnexion } from '../comptes/service.js';
import { ETAPE_RECAPITULATIF } from '../kyc/champs.js';
import type { DepotPieces, PieceKyc } from '../kyc/pieces-service.js';
import type { DepotKyc, EtatKyc } from '../kyc/service.js';
import type { DepotInformations, Justificatif, LigneHistorique } from '../informations/service.js';
import type { DepotProfils, DepotQuestionnaires } from '../investisseur/service.js';
import type { DepotOutilsImport } from '../outils/service.js';
import {
  acceptationCgu,
  historiqueInformation,
  justificatif,
  kyc,
  kycPiece,
  parametre,
  profilInvestisseur,
  questionnaireInvestisseur,
  tentativeConnexion,
  TABLE_IMPORT_RAPPORT,
  TABLE_SCPI_CATALOG,
} from './schema.js';

// Accès aux données (testé par test/*.e2e-test.ts sur une vraie base)

// Clé de signature des sessions Better-Auth : BETTER_AUTH_SECRET si la plateforme la
// fournit, sinon générée au premier démarrage et gardée en base (identique pour tous
// les réplicas, aucune valeur secrète dans le dépôt ni dans helm.yaml).
export async function secretDesSessions(
  db: Db,
  depuisEnvironnement = process.env.BETTER_AUTH_SECRET,
): Promise<string> {
  if (depuisEnvironnement) {
    return depuisEnvironnement;
  }
  const cle = 'better_auth_secret';
  await db
    .insert(parametre)
    .values({ cle, valeur: randomBytes(32).toString('base64url') })
    .onConflictDoNothing();
  const [ligne] = await db.select().from(parametre).where(eq(parametre.cle, cle));
  return ligne.valeur;
}

// US-05a : une ligne par utilisateur, créée à la première étape puis mise à jour
export function depotQuestionnaires(db: Db): DepotQuestionnaires {
  return {
    async lire(utilisateurId) {
      const [ligne] = await db
        .select({
          etapeCourante: questionnaireInvestisseur.etapeCourante,
          reponses: questionnaireInvestisseur.reponses,
        })
        .from(questionnaireInvestisseur)
        .where(eq(questionnaireInvestisseur.utilisateurId, utilisateurId));
      return ligne ?? null;
    },
    async enregistrer(utilisateurId, { etapeCourante, reponses }, versionQuestionnaire) {
      await db
        .insert(questionnaireInvestisseur)
        .values({ utilisateurId, etapeCourante, reponses, versionQuestionnaire })
        .onConflictDoUpdate({
          target: questionnaireInvestisseur.utilisateurId,
          set: { etapeCourante, reponses, versionQuestionnaire, misAJourLe: new Date() },
        });
    },
  };
}

// US-05b : profils validés, jamais modifiés (une mise à jour ajoute une ligne, US-05d)
export function depotProfils(db: Db): DepotProfils {
  return {
    async existe(utilisateurId) {
      const lignes = await db
        .select({ id: profilInvestisseur.id })
        .from(profilInvestisseur)
        .where(eq(profilInvestisseur.utilisateurId, utilisateurId))
        .limit(1);
      return lignes.length > 0;
    },
    async derniereValidation(utilisateurId) {
      const [ligne] = await db
        .select({
          valideLe: profilInvestisseur.valideLe,
          versionQuestionnaire: profilInvestisseur.versionQuestionnaire,
        })
        .from(profilInvestisseur)
        .where(eq(profilInvestisseur.utilisateurId, utilisateurId))
        .orderBy(desc(profilInvestisseur.valideLe), desc(profilInvestisseur.id))
        .limit(1);
      return ligne ?? null;
    },
    async enregistrer(utilisateurId, p) {
      await db.insert(profilInvestisseur).values({
        utilisateurId,
        profil: p.profil,
        score: p.score,
        reponses: p.reponses,
        avertissements: p.avertissements,
        versionQuestionnaire: p.versionQuestionnaire,
      });
    },
  };
}

export function depotAcceptationsCgu(db: Db) {
  return {
    async enregistrer(utilisateurId: string, versionCgu: string, accepteeLe: Date): Promise<void> {
      await db.insert(acceptationCgu).values({ utilisateurId, versionCgu, accepteeLe });
    },
  };
}

// US-03b : échecs de connexion par empreinte d'email
export function depotTentativesConnexion(db: Db): DepotTentativesConnexion {
  const t = tentativeConnexion;
  return {
    // Un seul calcul en base par essai : deux essais simultanés (même sur deux réplicas)
    // ne peuvent pas lire le même compteur.
    async reserverEssai(cle, maintenant, { echecsAvantBlocage, dureeMs }) {
      const oubli = new Date(maintenant.getTime() - dureeMs).toISOString();
      const fin = new Date(maintenant.getTime() + dureeMs).toISOString();
      const instant = maintenant.toISOString();
      // Lignes périmées (essais oubliés, blocage terminé) : effacées au passage
      await db
        .delete(t)
        .where(
          and(
            sql`${t.dernierEchec} < ${oubli}::timestamptz`,
            or(isNull(t.bloqueJusqua), sql`${t.bloqueJusqua} <= ${instant}::timestamptz`),
          ),
        );
      const bloque = sql`${t.bloqueJusqua} > ${instant}::timestamptz`;
      // Compteur précédent oublié, ou blocage terminé : l'essai repart à 1 (coalesce : sans
      // blocage, bloque_jusqua est null et la comparaison doit valoir faux, pas null)
      const perime = sql`(${t.dernierEchec} < ${oubli}::timestamptz
        or coalesce(${t.bloqueJusqua} <= ${instant}::timestamptz, false))`;
      const [ligne] = await db
        .insert(t)
        .values({ cle, echecs: 1, dernierEchec: maintenant, bloqueJusqua: null })
        .onConflictDoUpdate({
          target: t.cle,
          set: {
            echecs: sql`case when ${bloque} then ${t.echecs} when ${perime} then 1
              else ${t.echecs} + 1 end`,
            dernierEchec: sql`case when ${bloque} then ${t.dernierEchec}
              else ${instant}::timestamptz end`,
            // Plus d'essais en cours ou échoués que permis : essais simultanés -> bloqué
            bloqueJusqua: sql`case when ${bloque} then ${t.bloqueJusqua}
              when not ${perime} and ${t.echecs} + 1 > ${echecsAvantBlocage}::int
              then ${fin}::timestamptz else null end`,
          },
        })
        .returning({ fin: t.bloqueJusqua });
      return ligne.fin;
    },

    async enregistrerEchec(cle, maintenant, { echecsAvantBlocage, dureeMs }) {
      const fin = new Date(maintenant.getTime() + dureeMs).toISOString();
      const [ligne] = await db
        .update(t)
        .set({
          bloqueJusqua: sql`case when ${t.bloqueJusqua} > ${maintenant.toISOString()}::timestamptz
            then ${t.bloqueJusqua} else ${fin}::timestamptz end`,
        })
        .where(and(eq(t.cle, cle), gte(t.echecs, echecsAvantBlocage)))
        .returning({ fin: t.bloqueJusqua });
      return ligne?.fin ?? null;
    },

    async effacer(cle) {
      await db.delete(t).where(eq(t.cle, cle));
    },
  };
}

// US-04b : KYC de l'utilisateur. Les écritures ne touchent qu'un KYC en cours : une fois
// validé, il est figé (traçabilité LCB-FT).
export function depotKyc(db: Db): DepotKyc {
  return {
    async lire(utilisateurId: string): Promise<EtatKyc | null> {
      const [ligne] = await db
        .select({
          statut: kyc.statut,
          etape: kyc.etape,
          reponses: kyc.reponses,
          valideLe: kyc.valideLe,
        })
        .from(kyc)
        .where(eq(kyc.utilisateurId, utilisateurId));
      return ligne ?? null;
    },

    async enregistrer(utilisateurId, etape, reponses, le): Promise<boolean> {
      const lignes = await db
        .insert(kyc)
        .values({ utilisateurId, etape, reponses, creeLe: le, modifieLe: le })
        .onConflictDoUpdate({
          target: kyc.utilisateurId,
          set: { etape, reponses, modifieLe: le },
          setWhere: eq(kyc.statut, 'en_cours'),
        })
        .returning({ id: kyc.id });
      return lignes.length > 0;
    },

    // KYC et pièces dans la même transaction : jamais un KYC validé avec des pièces
    // encore modifiables
    async valider(utilisateurId, le): Promise<boolean> {
      return db.transaction(async (tx) => {
        const lignes = await tx
          .update(kyc)
          .set({ statut: 'complete', etape: ETAPE_RECAPITULATIF, valideLe: le, modifieLe: le })
          .where(and(eq(kyc.utilisateurId, utilisateurId), eq(kyc.statut, 'en_cours')))
          .returning({ id: kyc.id });
        if (lignes.length === 0) return false;
        await tx
          .update(kycPiece)
          .set({ statut: 'en_verification', modifieLe: le })
          .where(eq(kycPiece.utilisateurId, utilisateurId));
        return true;
      });
    },

    async typesPiecesDeposees(utilisateurId: string): Promise<string[]> {
      const lignes = await db
        .select({ type: kycPiece.type })
        .from(kycPiece)
        .where(eq(kycPiece.utilisateurId, utilisateurId));
      return lignes.map((ligne) => ligne.type);
    },
  };
}

// US-04c : pièces justificatives (métadonnées ; les fichiers sont dans R2)
const colonnesPiece = {
  type: kycPiece.type,
  nomFichier: kycPiece.nomFichier,
  format: kycPiece.format,
  taille: kycPiece.taille,
  statut: kycPiece.statut,
  deposeLe: kycPiece.deposeLe,
};

export function depotPieces(db: Db): DepotPieces {
  return {
    async lister(utilisateurId: string): Promise<PieceKyc[]> {
      return db
        .select(colonnesPiece)
        .from(kycPiece)
        .where(eq(kycPiece.utilisateurId, utilisateurId))
        .orderBy(kycPiece.id);
    },

    async enregistrer(utilisateurId, piece, le): Promise<PieceKyc> {
      const valeurs = { ...piece, statut: 'deposee' as const, deposeLe: le, modifieLe: le };
      const [ligne] = await db
        .insert(kycPiece)
        .values({ utilisateurId, ...valeurs })
        .onConflictDoUpdate({ target: [kycPiece.utilisateurId, kycPiece.type], set: valeurs })
        .returning(colonnesPiece);
      return ligne;
    },

    async supprimer(utilisateurId, type): Promise<void> {
      await db
        .delete(kycPiece)
        .where(and(eq(kycPiece.utilisateurId, utilisateurId), eq(kycPiece.type, type)));
    },
  };
}

// US-06 : informations personnelles. Une modification met à jour ensemble les réponses du
// KYC, l'historique et les pièces remplacées (statut « en cours de vérification ») ; les
// anciens fichiers restent dans R2 (contrôle a posteriori).
const colonnesJustificatif = {
  id: justificatif.id,
  nomFichier: justificatif.nomFichier,
  format: justificatif.format,
  taille: justificatif.taille,
  cle: justificatif.cle,
};

export function depotInformations(db: Db): DepotInformations {
  return {
    async lireKyc(utilisateurId) {
      const [ligne] = await db
        .select({ statut: kyc.statut, reponses: kyc.reponses })
        .from(kyc)
        .where(eq(kyc.utilisateurId, utilisateurId));
      return ligne ?? null;
    },

    async pieces(utilisateurId) {
      return db
        .select({ type: kycPiece.type, nomFichier: kycPiece.nomFichier })
        .from(kycPiece)
        .where(eq(kycPiece.utilisateurId, utilisateurId));
    },

    async enregistrerJustificatif(utilisateurId, piece, le) {
      const [ligne] = await db
        .insert(justificatif)
        .values({ utilisateurId, ...piece, deposeLe: le })
        .returning(colonnesJustificatif);
      return ligne as Justificatif;
    },

    async lireJustificatif(utilisateurId, id) {
      const [ligne] = await db
        .select(colonnesJustificatif)
        .from(justificatif)
        .where(and(eq(justificatif.id, id), eq(justificatif.utilisateurId, utilisateurId)));
      return (ligne as Justificatif | undefined) ?? null;
    },

    async appliquer(utilisateurId, modification, le) {
      await db.transaction(async (tx) => {
        if (Object.keys(modification.reponses).length > 0) {
          await tx
            .update(kyc)
            .set({
              reponses: sql`${kyc.reponses} || ${JSON.stringify(modification.reponses)}::jsonb`,
              modifieLe: le,
            })
            .where(eq(kyc.utilisateurId, utilisateurId));
        }
        await tx.insert(historiqueInformation).values(
          modification.historique.map((ligne) => ({
            utilisateurId,
            ...ligne,
            justificatifId: modification.justificatifId,
            modifieLe: le,
          })),
        );
        for (const { type, justificatif: piece } of modification.pieces) {
          const valeurs = {
            nomFichier: piece.nomFichier,
            format: piece.format,
            taille: piece.taille,
            cle: piece.cle,
            statut: 'en_verification' as const,
            deposeLe: le,
            modifieLe: le,
          };
          await tx
            .insert(kycPiece)
            .values({ utilisateurId, type, ...valeurs })
            .onConflictDoUpdate({ target: [kycPiece.utilisateurId, kycPiece.type], set: valeurs });
        }
      });
    },

    async historique(utilisateurId) {
      const lignes = await db
        .select({
          bloc: historiqueInformation.bloc,
          champ: historiqueInformation.champ,
          ancienneValeur: historiqueInformation.ancienneValeur,
          nouvelleValeur: historiqueInformation.nouvelleValeur,
          modifieLe: historiqueInformation.modifieLe,
        })
        .from(historiqueInformation)
        .where(eq(historiqueInformation.utilisateurId, utilisateurId))
        .orderBy(desc(historiqueInformation.modifieLe), desc(historiqueInformation.id));
      return lignes as LigneHistorique[];
    },
  };
}

// US-08 : SCPI du Catalogue, une ligne par SCPI avec son taux N-1, son secteur et son pays
// majoritaires (null si non renseignés : jamais 0), triées selon le choix de l'investisseur
// (US-11) ; valeur absente pour le critère -> fin de liste.
// Conditions SQL des filtres du Catalogue (US-10a, US-10b), sur scpi_catalog c et le taux
// N-1 t. Une comparaison avec une valeur absente (null) est fausse : une SCPI sans valeur
// ne satisfait jamais un filtre actif sur cette donnée.
const PRIX_RECENT = sql`(select p.prix from scpi_prix_part p where p.scpi_id = c.id
  order by p.annee desc limit 1)`;

function liste(valeurs: string[]): SQL {
  return sql.join(
    valeurs.map((v) => sql`${v}`),
    sql`, `,
  );
}

function bornes(colonne: SQL, { min, max }: Plage): SQL[] {
  const conditions: SQL[] = [];
  if (min !== null) conditions.push(sql`${colonne} >= ${min}`);
  if (max !== null) conditions.push(sql`${colonne} <= ${max}`);
  return conditions;
}

function conditionsFiltres(filtres: FiltresCatalogue): SQL {
  const conditions: SQL[] = [];
  if (filtres.categories.length) {
    conditions.push(sql`exists (select 1 from scpi_secteurs s where s.scpi_id = c.id
      and s.secteur::text in (${liste(filtres.categories)}))`);
  }
  if (filtres.pays.length) {
    conditions.push(sql`exists (select 1 from scpi_localisation l where l.scpi_id = c.id
      and l.pays in (${liste(filtres.pays)}))`);
  }
  if (filtres.gerants.length) {
    conditions.push(sql`trim(c.gerant) in (${liste(filtres.gerants)})`);
  }
  if (filtres.capitalisations.length) {
    const tranches = TRANCHES_CAPITALISATION.filter((t) =>
      filtres.capitalisations.includes(t.code),
    ).map((t) => {
      const parties = [sql`c.capitalisation is not null`];
      if (t.min !== null) parties.push(sql`c.capitalisation >= ${t.min}`);
      if (t.max !== null) parties.push(sql`c.capitalisation < ${t.max}`);
      return sql`(${sql.join(parties, sql` and `)})`;
    });
    conditions.push(sql`(${sql.join(tranches, sql` or `)})`);
  }
  conditions.push(
    ...bornes(sql`t.taux`, filtres.taux),
    ...bornes(PRIX_RECENT, filtres.prix),
    ...bornes(sql`c.frais_souscription`, filtres.frais),
    ...bornes(sql`c.minimum_souscription`, filtres.minimum),
    ...bornes(sql`c.frais_gestion`, filtres.fraisGestion),
    ...bornes(sql`c.delai_jouissance`, filtres.jouissance),
  );
  if (filtres.frequences.length) {
    conditions.push(sql`c.frequence::text in (${liste(filtres.frequences)})`);
  }
  if (filtres.demembrement) conditions.push(sql`c.demembrement = true`);
  if (filtres.versementProgramme) conditions.push(sql`c.versement_programme = true`);
  return conditions.length ? sql.join(conditions, sql` and `) : sql`true`;
}

// US-11 : colonne de la liste du Catalogue pour chaque critère de tri (catalogue/tri.ts).
// Valeur manquante (null) en fin de liste dans les deux sens (nulls last), égalité ->
// ordre alphabétique du nom. Pays et secteur : ceux affichés (majoritaires).
const COLONNES_TRI: Record<CritereTri, string> = {
  taux: 'x."tauxDistribution"',
  capitalisation: 'x.capitalisation',
  pays: 'x."zoneGeographique"',
  secteur: 'x.categorie',
  gerant: 'x.gerant',
  nom: 'x.nom',
};

// Cartes du Catalogue qui satisfont les conditions (filtres ou recherche par nom), triées
// selon `tri` (US-11 ; par défaut taux N-1 décroissant) : valeur manquante en fin de
// liste, égalité -> ordre alphabétique du nom
function cartesCatalogue(
  anneeTaux: number,
  conditions: SQL,
  limite: number,
  decalage: number,
  tri: TriCatalogue = TRI_PAR_DEFAUT,
) {
  const colonne = sql.raw(COLONNES_TRI[tri.critere]);
  const sens = sql.raw(tri.sens === 'asc' ? 'asc' : 'desc');
  return sql`
    select * from (
      select c.id,
             c.nom,
             nullif(trim(c.gerant), '') as gerant,
             t.taux::float8 as "tauxDistribution",
             c.capitalisation,
             (select s.secteur::text from scpi_secteurs s where s.scpi_id = c.id
               order by s.pourcentage desc, s.secteur limit 1) as categorie,
             (select l.pays from scpi_localisation l where l.scpi_id = c.id
               order by l.pourcentage desc, l.pays limit 1) as "zoneGeographique"
      from scpi_catalog c
      left join scpi_taux_distribution t on t.scpi_id = c.id and t.annee = ${anneeTaux}
      where ${conditions}
    ) x
    order by ${colonne} ${sens} nulls last, x.nom, x.id
    limit ${limite} offset ${decalage}`;
}

export function depotCatalogue(db: Db): DepotCatalogue {
  return {
    async compter(anneeTaux, filtres): Promise<number> {
      const resultat = await db.execute<{ total: number }>(sql`
        select count(*)::int as total
        from scpi_catalog c
        left join scpi_taux_distribution t on t.scpi_id = c.id and t.annee = ${anneeTaux}
        where ${conditionsFiltres(filtres)}`);
      return resultat.rows[0].total;
    },

    async lister(anneeTaux, limite, decalage, filtres, tri): Promise<ScpiCatalogue[]> {
      const resultat = await db.execute<ScpiCatalogue>(
        cartesCatalogue(anneeTaux, conditionsFiltres(filtres), limite, decalage, tri),
      );
      return resultat.rows;
    },

    // Valeurs du panneau des filtres : secteurs, pays et sociétés de gestion présents,
    // bornes des curseurs sur les valeurs renseignées
    async valeursFiltres(anneeTaux): Promise<ValeursFiltres> {
      const textes = async (requete: SQL) =>
        (await db.execute<{ valeur: string }>(requete)).rows.map((r) => r.valeur);
      const [categories, pays, gerants, frequences, nombres] = await Promise.all([
        textes(sql`select distinct secteur::text as valeur from scpi_secteurs order by 1`),
        textes(sql`select distinct pays as valeur from scpi_localisation order by 1`),
        textes(sql`select distinct trim(gerant) as valeur from scpi_catalog
          where trim(gerant) <> '' order by 1`),
        textes(sql`select distinct frequence::text as valeur from scpi_catalog
          where frequence is not null order by 1`),
        db.execute<Record<string, number | null>>(sql`
          select min(t.taux)::float8 as "tauxMin", max(t.taux)::float8 as "tauxMax",
                 min(p.prix)::float8 as "prixMin", max(p.prix)::float8 as "prixMax",
                 min(c.frais_souscription)::float8 as "fraisMin",
                 max(c.frais_souscription)::float8 as "fraisMax",
                 min(c.minimum_souscription)::float8 as "minimumMin",
                 max(c.minimum_souscription)::float8 as "minimumMax",
                 min(c.frais_gestion)::float8 as "fraisGestionMin",
                 max(c.frais_gestion)::float8 as "fraisGestionMax",
                 min(c.delai_jouissance)::float8 as "jouissanceMin",
                 max(c.delai_jouissance)::float8 as "jouissanceMax"
          from scpi_catalog c
          left join scpi_taux_distribution t on t.scpi_id = c.id and t.annee = ${anneeTaux}
          left join lateral (select p.prix from scpi_prix_part p where p.scpi_id = c.id
            order by p.annee desc limit 1) p on true`),
      ]);
      const n = nombres.rows[0];
      const plage = (nom: string): Plage => ({ min: n[`${nom}Min`], max: n[`${nom}Max`] });
      return {
        categories,
        pays,
        gerants,
        taux: plage('taux'),
        prix: plage('prix'),
        frais: plage('frais'),
        minimum: plage('minimum'),
        fraisGestion: plage('fraisGestion'),
        jouissance: plage('jouissance'),
        frequences,
      };
    },

    // Date de mise à jour des données = fin du dernier import réussi (US-07a)
    async dateDernierImport(): Promise<Date | null> {
      const [ligne] = await db
        .select({ fin: max(TABLE_IMPORT_RAPPORT.fin) })
        .from(TABLE_IMPORT_RAPPORT)
        .where(eq(TABLE_IMPORT_RAPPORT.statut, 'reussi'));
      return ligne?.fin ?? null;
    },

    // Recherche d'une SCPI par son nom
    // % et _ tapés par l'utilisateur sont cherchés tels quels (pas comme jokers de ilike)
    // US-12 : nom qui contient le texte ET filtres actifs, dans l'ordre du tri choisi
    async rechercher(anneeTaux, texte, limite, filtres, tri): Promise<ScpiCatalogue[]> {
      const motif = `%${texte.replace(/[\\%_]/g, '\\$&')}%`;
      const conditions = sql`c.nom ilike ${motif} and ${conditionsFiltres(filtres)}`;
      const resultat = await db.execute<ScpiCatalogue>(
        cartesCatalogue(anneeTaux, conditions, limite, 0, tri),
      );
      return resultat.rows;
    },
  };
}

// Outil de test de l'import du catalogue (dev) : rapports d'exécution complets et
// catalogue avec toutes ses tables liées, pour diagnostiquer
export function depotOutilsImport(db: Db): DepotOutilsImport {
  const rapports = (limite: number) =>
    db
      .select()
      .from(TABLE_IMPORT_RAPPORT)
      .orderBy(desc(TABLE_IMPORT_RAPPORT.debut), desc(TABLE_IMPORT_RAPPORT.id))
      .limit(limite);
  return {
    rapports,
    async dernierRapport() {
      const [rapport] = await rapports(1);
      return rapport ?? null;
    },
    catalogue() {
      return db.query.TABLE_SCPI_CATALOG.findMany({
        orderBy: [asc(TABLE_SCPI_CATALOG.nom)],
        with: {
          taux_distribution: true,
          localisation: true,
          secteurs: true,
          prix_part: true,
          valeur_reconstitution: true,
          decote_demembrement: true,
        },
      });
    },
  };
}
