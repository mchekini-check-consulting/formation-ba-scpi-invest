import { detaillerAction } from '../logging/logger.js';
import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';

// US-02 : fiche d'une SCPI (informations, historiques, répartitions). Une donnée non
// renseignée reste null (affichée « Non communiqué » par l'écran), jamais remplacée par 0.
// L'IBAN et le BIC ne sont jamais lus ni renvoyés.

export type ValeurAnnuelle = { annee: number; valeur: number };
export type Part = { libelle: string; part: number };

// Ligne lue en base : historiques dans un ordre quelconque, répartitions non triées
export type LigneFiche = {
  id: number;
  nom: string;
  gerant: string | null;
  capitalisation: number | null;
  minimum: number | null;
  // en %
  fraisSouscription: number | null;
  fraisGestion: number | null;
  // en mois
  delaiJouissance: number | null;
  frequence: string | null;
  cashback: number | null;
  versementProgramme: boolean | null;
  publicite: string | null;
  prix: ValeurAnnuelle[];
  taux: ValeurAnnuelle[];
  valeursReconstitution: ValeurAnnuelle[];
  pays: Part[];
  secteurs: Part[];
};

export type FicheScpi = Omit<
  LigneFiche,
  'prix' | 'taux' | 'valeursReconstitution' | 'pays' | 'secteurs'
> & {
  // valeurs de l'année la plus récente, avec leur année
  prixPart: ValeurAnnuelle | null;
  tauxDistribution: ValeurAnnuelle | null;
  valeurReconstitution: ValeurAnnuelle | null;
  // nombre de parts pour atteindre le minimum (arrondi au-dessus : une part ne se divise pas)
  minimumParts: number | null;
  // une valeur par année connue, de la plus ancienne à la plus récente
  historiquePrix: ValeurAnnuelle[];
  historiqueTaux: ValeurAnnuelle[];
  // de la plus forte à la plus faible
  repartitionGeographique: Part[];
  repartitionSectorielle: Part[];
};

export type StatutAbsence = 'supprimee' | 'introuvable';

export type DepotFiche = {
  lire(id: number): Promise<LigneFiche | null>;
  // vrai si la SCPI a été retirée du référentiel par un import (table scpi_supprimee)
  estSupprimee(id: number): Promise<boolean>;
};

export const MESSAGES_ABSENCE: Record<StatutAbsence, string> = {
  supprimee: 'Cette SCPI n’est plus disponible',
  introuvable: 'Cette SCPI n’est pas disponible',
};

const parAnnee = (valeurs: ValeurAnnuelle[]) => [...valeurs].sort((a, b) => a.annee - b.annee);

const parPart = (parts: Part[]) =>
  [...parts].sort((a, b) => b.part - a.part || a.libelle.localeCompare(b.libelle, 'fr'));

// Texte vide ou fait d'espaces : considéré comme absent
const texte = (valeur: string | null) => (valeur?.trim() ? valeur.trim() : null);

export function nombreDeParts(minimum: number | null, prix: ValeurAnnuelle | null) {
  if (minimum === null || prix === null || prix.valeur <= 0) return null;
  return Math.ceil(minimum / prix.valeur);
}

// Identifiant d'adresse : entier positif, sinon la SCPI est introuvable
export function identifiant(brut: unknown): number | null {
  if (typeof brut !== 'string' || !/^\d{1,9}$/.test(brut)) return null;
  const id = Number(brut);
  return id > 0 ? id : null;
}

export function versFiche(ligne: LigneFiche): FicheScpi {
  const { prix, taux, valeursReconstitution, pays, secteurs, ...reste } = ligne;
  const historiquePrix = parAnnee(prix);
  const historiqueTaux = parAnnee(taux);
  const prixPart = historiquePrix.at(-1) ?? null;
  return {
    ...reste,
    gerant: texte(ligne.gerant),
    publicite: texte(ligne.publicite),
    prixPart,
    tauxDistribution: historiqueTaux.at(-1) ?? null,
    valeurReconstitution: parAnnee(valeursReconstitution).at(-1) ?? null,
    minimumParts: nombreDeParts(ligne.minimum, prixPart),
    historiquePrix,
    historiqueTaux,
    repartitionGeographique: parPart(pays),
    repartitionSectorielle: parPart(secteurs),
  };
}

// Couche service de la fiche SCPI (US-02)
export function creerFicheService(depot: DepotFiche) {
  // SCPI absente : 404, avec le statut qui choisit le message de l'écran (règle 8)
  async function lire(brut: unknown): Promise<FicheScpi> {
    const id = identifiant(brut);
    const ligne = id === null ? null : await depot.lire(id);
    if (ligne) {
      detaillerAction({ resultats: 1 });
      return versFiche(ligne);
    }
    const statut: StatutAbsence =
      id !== null && (await depot.estSupprimee(id)) ? 'supprimee' : 'introuvable';
    detaillerAction({ resultats: 0, statut });
    throw new HttpError(404, MESSAGES_ABSENCE[statut], { statut });
  }

  return loggable('FicheService', { lire });
}

export type FicheService = ReturnType<typeof creerFicheService>;
