import { detaillerAction } from '../logging/logger.js';
import { loggable } from '../logging/service.js';

// US-04 : SCPI du comparateur, avec les critères comparés. Une donnée non renseignée reste
// null (affichée « Non communiqué » par l'écran), jamais remplacée par 0.

// Pays ou secteur le plus représenté, avec sa part en %
export type ValeurPrincipale = { libelle: string; part: number };

export type PrixAnnuel = { annee: number; prix: number };

// Prix de part de l'année la plus récente - 5 (ou la plus ancienne connue après elle) à
// l'année la plus récente ; variation en %, arrondie à deux décimales
export type EvolutionPrix = { debut: PrixAnnuel; fin: PrixAnnuel; variation: number };

export type ScpiComparable = {
  id: number;
  nom: string;
  // dernier taux connu, en %, et son année
  tauxDistribution: number | null;
  anneeTaux: number | null;
  // prix de part de l'année la plus récente, en euros
  prixPart: number | null;
  evolutionPrix: EvolutionPrix | null;
  minimum: number | null;
  capitalisation: number | null;
  // en %
  fraisSouscription: number | null;
  fraisGestion: number | null;
  // en mois
  delaiJouissance: number | null;
  frequence: string | null;
  demembrement: boolean | null;
  versementProgramme: boolean | null;
  paysPrincipal: ValeurPrincipale | null;
  secteurPrincipal: ValeurPrincipale | null;
};

// Ligne lue en base : prix des 5 dernières années (et l'année de départ), du plus ancien
// au plus récent
export type LigneComparable = Omit<ScpiComparable, 'prixPart' | 'evolutionPrix'> & {
  prix: PrixAnnuel[];
};

export type DepotComparaison = {
  // toutes les SCPI du catalogue, triées par nom
  lister(): Promise<LigneComparable[]>;
};

export const DUREE_EVOLUTION = 5;

export function evolutionDuPrix(prix: PrixAnnuel[]): EvolutionPrix | null {
  if (prix.length < 2) return null;
  const debut = prix[0];
  const fin = prix[prix.length - 1];
  const variation = Math.round(((fin.prix - debut.prix) / debut.prix) * 10000) / 100;
  return { debut, fin, variation };
}

// Couche service du comparateur (US-04)
export function creerComparaisonService(depot: DepotComparaison) {
  async function lister(): Promise<ScpiComparable[]> {
    const lignes = await depot.lister();
    detaillerAction({ resultats: lignes.length });
    return lignes.map(({ prix, ...scpi }) => ({
      ...scpi,
      prixPart: prix.at(-1)?.prix ?? null,
      evolutionPrix: evolutionDuPrix(prix),
    }));
  }

  return loggable('ComparaisonService', { lister });
}

export type ComparaisonService = ReturnType<typeof creerComparaisonService>;
