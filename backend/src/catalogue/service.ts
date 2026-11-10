import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';
import {
  type FiltresCatalogue,
  type Plage,
  TRANCHES_CAPITALISATION,
  lireFiltres,
} from './filtres.js';

// US-08 : liste des SCPI du Catalogue. Une donnée non renseignée reste null (affichée
// « N/C » par l'écran), jamais remplacée par 0.
export type ScpiCatalogue = {
  id: number;
  nom: string;
  gerant: string | null;
  // taux de distribution de l'année N-1, en %
  tauxDistribution: number | null;
  // en euros
  capitalisation: number | null;
  // secteur majoritaire (plus fort pourcentage)
  categorie: string | null;
  // pays majoritaire (plus fort pourcentage)
  zoneGeographique: string | null;
};

export type PageCatalogue = {
  scpis: ScpiCatalogue[];
  total: number;
  page: number;
  taillePage: number;
  nombrePages: number;
  anneeTaux: number;
  // fin du dernier import réussi (US-07a), null si aucun import n'a encore réussi
  misAJourLe: Date | null;
};

// Valeurs proposées dans le panneau des filtres (US-10a, US-10b), issues du référentiel
export type ValeursFiltres = {
  categories: string[];
  pays: string[];
  gerants: string[];
  // bornes des curseurs : plus petite et plus grande valeur renseignée (null si aucune)
  taux: Plage;
  prix: Plage;
  frais: Plage;
  minimum: Plage;
};

export type OptionsFiltres = ValeursFiltres & {
  capitalisations: { code: string; libelle: string }[];
  anneeTaux: number;
};

export type DepotCatalogue = {
  // SCPI qui satisfont les filtres (toutes sans filtre)
  compter(anneeTaux: number, filtres: FiltresCatalogue): Promise<number>;
  // Tri par défaut : taux N-1 décroissant, SCPI sans taux N-1 en fin de liste
  lister(
    anneeTaux: number,
    limite: number,
    decalage: number,
    filtres: FiltresCatalogue,
  ): Promise<ScpiCatalogue[]>;
  valeursFiltres(anneeTaux: number): Promise<ValeursFiltres>;
  dateDernierImport(): Promise<Date | null>;
  // SCPI dont le nom contient le texte recherché (majuscules ignorées), même carte et même
  // tri que le Catalogue (taux N-1 décroissant)
  rechercher(anneeTaux: number, texte: string, limite: number): Promise<ScpiCatalogue[]>;
};

// Résultat de la recherche par nom : SCPI trouvées, avec l'année de leur taux affiché
export type ResultatRecherche = {
  scpis: ScpiCatalogue[];
  anneeTaux: number;
};

// Nombre maximum de SCPI renvoyées par la recherche
export const LIMITE_RECHERCHE = 20;

export const TAILLE_PAGE = 12;

// Couche service du Catalogue (US-08)
export function creerCatalogueService(depot: DepotCatalogue, maintenant = () => new Date()) {
  // Taux N-1 : l'import range le premier taux du CSV sous l'année précédente
  const anneeN1 = () => maintenant().getFullYear() - 1;

  async function lister(
    pageDemandee: unknown = 1,
    requete: Record<string, unknown> = {},
  ): Promise<PageCatalogue> {
    const page = pageDemandee === undefined || pageDemandee === '' ? 1 : Number(pageDemandee);
    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(400, 'Numéro de page invalide');
    }
    const filtres = lireFiltres(requete);
    const anneeTaux = anneeN1();
    const [total, scpis, misAJourLe] = await Promise.all([
      depot.compter(anneeTaux, filtres),
      depot.lister(anneeTaux, TAILLE_PAGE, (page - 1) * TAILLE_PAGE, filtres),
      depot.dateDernierImport(),
    ]);
    return {
      scpis,
      total,
      page,
      taillePage: TAILLE_PAGE,
      nombrePages: Math.max(1, Math.ceil(total / TAILLE_PAGE)),
      anneeTaux,
      misAJourLe,
    };
  }

  async function filtres(): Promise<OptionsFiltres> {
    const anneeTaux = anneeN1();
    return {
      ...(await depot.valeursFiltres(anneeTaux)),
      capitalisations: TRANCHES_CAPITALISATION.map(({ code, libelle }) => ({ code, libelle })),
      anneeTaux,
    };
  }

  // Recherche d'une SCPI par son nom
  // 400 si q n'est pas un texte (absent ou répété dans l'adresse), aucune SCPI si le texte
  // est vide
  async function rechercher(q: unknown): Promise<ResultatRecherche> {
    if (typeof q !== 'string') {
      throw new HttpError(400, 'Recherche invalide');
    }
    const texte = q.trim();
    const anneeTaux = anneeN1();
    if (texte === '') {
      return { scpis: [], anneeTaux };
    }
    return { scpis: await depot.rechercher(anneeTaux, texte, LIMITE_RECHERCHE), anneeTaux };
  }

  return loggable('CatalogueService', { lister, filtres, rechercher });
}

export type CatalogueService = ReturnType<typeof creerCatalogueService>;
