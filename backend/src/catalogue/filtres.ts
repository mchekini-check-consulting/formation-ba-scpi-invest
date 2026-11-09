import { HttpError } from '../logging/http-error.js';

// Filtres du Catalogue (US-10a, US-10b), lus dans l'URL de GET /scpis :
//   categorie, pays, gerant, capitalisation : valeurs répétées (?categorie=Santé&categorie=Bureaux)
//   tauxMin/tauxMax, prixMin/prixMax, fraisMin/fraisMax, minimumMin/minimumMax : nombres
// Un filtre à plusieurs valeurs retient une SCPI qui correspond à au moins une valeur ;
// plusieurs filtres actifs doivent tous être satisfaits (ET). Bornes incluses. Une SCPI
// sans valeur pour un filtre actif ne le satisfait pas (jamais assimilée à zéro).

export type Plage = { min: number | null; max: number | null };

export type FiltresCatalogue = {
  // secteur présent dans la SCPI, quel que soit son pourcentage
  categories: string[];
  // pays présent dans la SCPI, quel que soit son pourcentage
  pays: string[];
  gerants: string[];
  // codes des tranches (TRANCHES_CAPITALISATION)
  capitalisations: string[];
  // taux de distribution N-1, en %
  taux: Plage;
  // prix de la part le plus récent, en euros
  prix: Plage;
  // frais de souscription, en %
  frais: Plage;
  // investissement minimum, en euros
  minimum: Plage;
};

// Tranches de capitalisation (en euros), bornes : min inclus, max exclu. À valider avec
// le Product Owner (US-10a).
export const TRANCHES_CAPITALISATION = [
  { code: 'moins-100m', libelle: 'Moins de 100 M€', min: null, max: 100_000_000 },
  { code: '100m-500m', libelle: '100 à 500 M€', min: 100_000_000, max: 500_000_000 },
  { code: '500m-1md', libelle: '500 M€ à 1 Md€', min: 500_000_000, max: 1_000_000_000 },
  { code: '1md-3md', libelle: '1 à 3 Md€', min: 1_000_000_000, max: 3_000_000_000 },
  { code: 'plus-3md', libelle: 'Plus de 3 Md€', min: 3_000_000_000, max: null },
] as const;

export const AUCUN_FILTRE: FiltresCatalogue = {
  categories: [],
  pays: [],
  gerants: [],
  capitalisations: [],
  taux: { min: null, max: null },
  prix: { min: null, max: null },
  frais: { min: null, max: null },
  minimum: { min: null, max: null },
};

const MESSAGE = 'Filtre invalide';

function valeurs(brut: unknown): string[] {
  const liste = Array.isArray(brut) ? brut : [brut];
  return [
    ...new Set(liste.filter((v): v is string => typeof v === 'string').map((v) => v.trim())),
  ].filter((v) => v !== '');
}

function nombre(brut: unknown): number | null {
  if (brut === undefined || brut === '') return null;
  const valeur = typeof brut === 'string' ? Number(brut) : Number.NaN;
  if (!Number.isFinite(valeur)) throw new HttpError(400, MESSAGE);
  return valeur;
}

function plage(requete: Record<string, unknown>, nom: string): Plage {
  const min = nombre(requete[`${nom}Min`]);
  const max = nombre(requete[`${nom}Max`]);
  if (min !== null && max !== null && min > max) throw new HttpError(400, MESSAGE);
  return { min, max };
}

// Filtres lus dans l'URL ; 400 « Filtre invalide » si un nombre ou une tranche est faux
export function lireFiltres(requete: Record<string, unknown> = {}): FiltresCatalogue {
  const capitalisations = valeurs(requete.capitalisation);
  const codes = new Set<string>(TRANCHES_CAPITALISATION.map((t) => t.code));
  if (capitalisations.some((c) => !codes.has(c))) throw new HttpError(400, MESSAGE);
  return {
    categories: valeurs(requete.categorie),
    pays: valeurs(requete.pays),
    gerants: valeurs(requete.gerant),
    capitalisations,
    taux: plage(requete, 'taux'),
    prix: plage(requete, 'prix'),
    frais: plage(requete, 'frais'),
    minimum: plage(requete, 'minimum'),
  };
}
