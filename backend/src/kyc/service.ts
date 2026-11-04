import type { ReponsesKyc } from '../db/schema.js';
import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';
import { ETAPE_RECAPITULATIF, champsIncomplets, nettoyer } from './champs.js';

export type StatutKyc = 'en_cours' | 'complete';

export type EtatKyc = {
  statut: StatutKyc;
  etape: number;
  reponses: ReponsesKyc;
  valideLe: Date | null;
};

export type DemandeEnregistrement = { etape?: unknown; reponses?: unknown };

export type DepotKyc = {
  lire(utilisateurId: string): Promise<EtatKyc | null>;
  // Crée ou remplace les réponses d'un KYC en cours ; false si le KYC est déjà complété
  enregistrer(
    utilisateurId: string,
    etape: number,
    reponses: ReponsesKyc,
    le: Date,
  ): Promise<boolean>;
  // Passe le KYC en cours au statut complété ; false s'il n'était plus en cours
  valider(utilisateurId: string, le: Date): Promise<boolean>;
};

export const KYC_DEJA_VALIDE = 'Votre KYC est déjà validé : il ne peut plus être modifié.';
export const KYC_INCOMPLET =
  'Le formulaire KYC est incomplet : complétez toutes les étapes avant de le valider.';

const NOUVEAU: EtatKyc = { statut: 'en_cours', etape: 1, reponses: {}, valideLe: null };

// Couche service du KYC (US-04b) : reprise du formulaire là où l'utilisateur l'a laissé,
// enregistrement à chaque étape, validation (statut « complété » et date). Les réponses
// sont des données personnelles : elles ne passent jamais dans les logs.
export function creerKycService(depot: DepotKyc, maintenant: () => Date = () => new Date()) {
  async function lire(utilisateurId: string): Promise<EtatKyc> {
    return (await depot.lire(utilisateurId)) ?? { ...NOUVEAU };
  }

  async function enregistrer(
    utilisateurId: string,
    demande: DemandeEnregistrement,
  ): Promise<EtatKyc> {
    const etape = demande.etape;
    if (
      !Number.isInteger(etape) ||
      (etape as number) < 1 ||
      (etape as number) > ETAPE_RECAPITULATIF
    ) {
      throw new HttpError(
        400,
        `Étape invalide : un nombre de 1 à ${ETAPE_RECAPITULATIF} est attendu`,
      );
    }
    const reponses = nettoyer(demande.reponses);
    const enregistre = await depot.enregistrer(
      utilisateurId,
      etape as number,
      reponses,
      maintenant(),
    );
    if (!enregistre) {
      throw new HttpError(409, KYC_DEJA_VALIDE);
    }
    return { statut: 'en_cours', etape: etape as number, reponses, valideLe: null };
  }

  async function valider(utilisateurId: string): Promise<EtatKyc> {
    const etat = await depot.lire(utilisateurId);
    if (etat?.statut === 'complete') {
      throw new HttpError(409, KYC_DEJA_VALIDE);
    }
    const le = maintenant();
    if (!etat || champsIncomplets(etat.reponses, le).length > 0) {
      throw new HttpError(400, KYC_INCOMPLET);
    }
    if (!(await depot.valider(utilisateurId, le))) {
      throw new HttpError(409, KYC_DEJA_VALIDE);
    }
    return { ...etat, statut: 'complete', etape: ETAPE_RECAPITULATIF, valideLe: le };
  }

  return loggable('KycService', { lire, enregistrer, valider });
}

export type KycService = ReturnType<typeof creerKycService>;
