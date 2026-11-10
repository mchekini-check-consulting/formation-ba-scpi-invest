import { HttpError } from '../logging/http-error.js';

// Tri du Catalogue (US-11, SCPI-28), lu dans l'URL de GET /scpis : tri=<critère>-<sens>
// (ex. ?tri=capitalisation-asc). Absent : taux N-1 décroissant. Valeur inconnue : 400.
// Règles appliquées par la requête (db/depots.ts) : égalité -> ordre alphabétique du nom ;
// valeur manquante -> fin de liste dans les deux sens, jamais assimilée à zéro.

export const CRITERES_TRI = ['taux', 'capitalisation', 'pays', 'secteur', 'gerant', 'nom'] as const;
export type CritereTri = (typeof CRITERES_TRI)[number];
export type SensTri = 'asc' | 'desc';
export type TriCatalogue = { critere: CritereTri; sens: SensTri };

export const TRI_PAR_DEFAUT: TriCatalogue = { critere: 'taux', sens: 'desc' };

export function lireTri(brut: unknown): TriCatalogue {
  if (brut === undefined || brut === '') return TRI_PAR_DEFAUT;
  const [critere, sens, ...reste] = typeof brut === 'string' ? brut.split('-') : [];
  const critereConnu = (CRITERES_TRI as readonly string[]).includes(critere);
  if (!critereConnu || (sens !== 'asc' && sens !== 'desc') || reste.length > 0) {
    throw new HttpError(400, 'Tri invalide');
  }
  return { critere: critere as CritereTri, sens };
}
