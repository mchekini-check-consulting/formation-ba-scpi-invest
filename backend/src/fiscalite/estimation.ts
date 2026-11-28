import { HttpError } from '../logging/http-error.js';
import { detaillerAction } from '../logging/logger.js';
import { loggable } from '../logging/service.js';
import { estimer, type Estimation, type Parametres } from './calcul.js';
import type { DepotFiscalite } from './service.js';

// Estimation fiscale (calcul de l'US-07, SCPI-256) d'une liste de couples (SCPI, revenu
// annuel brut) envoyée par l'écran : lignes de la simulation (US-09, SCPI-258). Les
// informations fiscales sont celles de l'investisseur connecté ; sans elles, l'impôt est
// calculé avec le taux choisi dans la simulation (un taux du barème), 30 % par défaut.
// Revenus et informations fiscales : jamais dans les logs (seul le nombre de lignes).

export type DepotEstimation = {
  lireParametres(): Promise<Parametres>;
  // Part « France » (en %) de chaque SCPI demandée qui existe ; null sans répartition
  // géographique. Une SCPI inconnue est absente de la carte.
  partsFrance(ids: number[]): Promise<Map<number, number | null>>;
};

export type ReponseEstimation = Estimation & {
  // Taux des tranches du barème (liste « Taux d'imposition estimé », US-09 règle 8)
  tauxProposes: number[];
  tauxParDefaut: number;
};

export const LIGNES_MAX = 100;
// Périodes ou années de placement (durée maximale de la simulation : 30 ans)
export const GROUPES_MAX = 40;
export const DEMANDE_INVALIDE = 'Demande d’estimation invalide.';
export const SCPI_INCONNUE = 'SCPI inconnue.';
export const TAUX_INVALIDE = 'Taux d’imposition non proposé.';

type Ligne = { scpiId: number; revenuAnnuel: number };
type Demande = { lignes: Ligne[]; taux?: number; periodes?: Ligne[][]; annees?: Ligne[][] };

// Liste de { scpiId, revenuAnnuel } valide ; null sinon
function lireLignes(lignes: unknown): Ligne[] | null {
  if (!Array.isArray(lignes) || lignes.length > LIGNES_MAX) return null;
  const valides = lignes.every(
    (l) =>
      Number.isSafeInteger(l?.scpiId) &&
      l.scpiId > 0 &&
      typeof l.revenuAnnuel === 'number' &&
      Number.isFinite(l.revenuAnnuel) &&
      l.revenuAnnuel >= 0,
  );
  if (!valides) return null;
  return lignes.map((l: Ligne) => ({ scpiId: l.scpiId, revenuAnnuel: l.revenuAnnuel }));
}

// Groupes facultatifs (périodes, années) : absent -> undefined, invalide -> null
function lireGroupes(groupes: unknown): Ligne[][] | undefined | null {
  if (groupes === undefined) return undefined;
  if (!Array.isArray(groupes) || groupes.length > GROUPES_MAX) return null;
  const lus = groupes.map(lireLignes);
  return lus.some((g) => g === null) ? null : (lus as Ligne[][]);
}

// Corps attendu : { lignes: [{ scpiId, revenuAnnuel }], taux?, periodes?: [[...]],
// annees?: [[...]] } ; null si invalide
export function lireDemande(corps: unknown): Demande | null {
  const { taux, ...reste } = (corps ?? {}) as Record<string, unknown>;
  const lignes = lireLignes(reste.lignes);
  const periodes = lireGroupes(reste.periodes);
  const annees = lireGroupes(reste.annees);
  if (!lignes || periodes === null || annees === null) return null;
  if (taux !== undefined && (typeof taux !== 'number' || !Number.isFinite(taux))) return null;
  return {
    lignes,
    ...(taux === undefined ? {} : { taux }),
    ...(periodes === undefined ? {} : { periodes }),
    ...(annees === undefined ? {} : { annees }),
  };
}

export function creerEstimationService(depot: DepotEstimation, fiscalite: DepotFiscalite) {
  // 400 si la demande est invalide, une SCPI inconnue ou le taux hors barème
  async function estimerRevenus(utilisateurId: string, corps: unknown): Promise<ReponseEstimation> {
    const demande = lireDemande(corps);
    if (!demande) throw new HttpError(400, DEMANDE_INVALIDE);
    detaillerAction({ lignes: demande.lignes.length });
    const parametres = await depot.lireParametres();
    const tauxProposes = [...new Set(parametres.bareme.map((t) => t.taux))].sort((a, b) => a - b);
    if (demande.taux !== undefined && !tauxProposes.includes(demande.taux)) {
      throw new HttpError(400, TAUX_INVALIDE);
    }
    const toutes = [demande.lignes, ...(demande.periodes ?? []), ...(demande.annees ?? [])].flat();
    const ids = [...new Set(toutes.map((l) => l.scpiId))];
    const partsFrance = await depot.partsFrance(ids);
    if (ids.some((id) => !partsFrance.has(id))) throw new HttpError(400, SCPI_INCONNUE);
    const informations = await fiscalite.lire(utilisateurId);
    const avecPartFrance = (lignes: Ligne[]) =>
      lignes.map((l) => ({ ...l, partFrance: partsFrance.get(l.scpiId) ?? null }));
    return {
      ...estimer(avecPartFrance(demande.lignes), parametres, informations, demande.taux, {
        periodes: demande.periodes?.map(avecPartFrance),
        annees: demande.annees?.map(avecPartFrance),
      }),
      tauxProposes,
      tauxParDefaut: parametres.tauxForfaitaire,
    };
  }

  return loggable('EstimationFiscaleService', { estimerRevenus });
}

export type EstimationService = ReturnType<typeof creerEstimationService>;
