import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';

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

export type DepotCatalogue = {
  compter(): Promise<number>;
  // Tri par défaut : taux N-1 décroissant, SCPI sans taux N-1 en fin de liste
  lister(anneeTaux: number, limite: number, decalage: number): Promise<ScpiCatalogue[]>;
  dateDernierImport(): Promise<Date | null>;
};

export const TAILLE_PAGE = 12;

// Couche service du Catalogue (US-08)
export function creerCatalogueService(depot: DepotCatalogue, maintenant = () => new Date()) {
  async function lister(pageDemandee: unknown = 1): Promise<PageCatalogue> {
    const page = pageDemandee === undefined || pageDemandee === '' ? 1 : Number(pageDemandee);
    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(400, 'Numéro de page invalide');
    }
    // Taux N-1 : l'import range le premier taux du CSV sous l'année précédente
    const anneeTaux = maintenant().getFullYear() - 1;
    const [total, scpis, misAJourLe] = await Promise.all([
      depot.compter(),
      depot.lister(anneeTaux, TAILLE_PAGE, (page - 1) * TAILLE_PAGE),
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

  return loggable('CatalogueService', { lister });
}

export type CatalogueService = ReturnType<typeof creerCatalogueService>;
