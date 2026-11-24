import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';

// US-06 « Renseigner mes informations fiscales » (SCPI-255) : situation fiscale du foyer de
// l'investisseur connecté, pour une estimation calculée sur ses données réelles (US-07).
//   - trois champs obligatoires : revenu net imposable annuel du foyer (euros, entier
//     ≥ 0, sans plafond), situation familiale (seul, en couple), nombre d'enfants à
//     charge (entier ≥ 0) ;
//   - « Enregistrer » remplace les valeurs précédentes ; « Effacer mes informations »
//     les supprime : l'investisseur redevient « sans informations fiscales » ;
//   - indépendantes du KYC (sa situation familiale n'est pas reprise).
// Données personnelles : jamais dans les logs (loggable ne journalise ni les arguments ni
// le retour ; les messages d'erreur ne contiennent aucune valeur saisie).

export const SITUATIONS_FAMILIALES = ['seul', 'couple'] as const;
export type SituationFamiliale = (typeof SITUATIONS_FAMILIALES)[number];

export type InformationsFiscales = {
  revenuNetImposable: number;
  situationFamiliale: SituationFamiliale;
  nombreEnfants: number;
};

export type DepotFiscalite = {
  // Informations de l'utilisateur ; null s'il n'en a pas
  lire(utilisateurId: string): Promise<InformationsFiscales | null>;
  // Crée ou remplace la ligne de l'utilisateur
  enregistrer(utilisateurId: string, informations: InformationsFiscales): Promise<void>;
  effacer(utilisateurId: string): Promise<void>;
};

export const CHAMP_OBLIGATOIRE = 'Ce champ est obligatoire.';
export const ENTIER_INVALIDE = 'Saisissez un nombre entier positif ou nul.';
export const SITUATION_INVALIDE = 'Choisissez « Seul » ou « En couple ».';
export const ERREUR_SAISIE = 'Merci de corriger les champs signalés.';

type Champ = keyof InformationsFiscales;
export type Erreurs = Partial<Record<Champ, string>>;

function vide(valeur: unknown): boolean {
  return valeur === undefined || valeur === null || valeur === '';
}

// Entier ≥ 0, envoyé en nombre ou en texte (« 40000 ») ; null si invalide
function entierPositif(valeur: unknown): number | null {
  const nombre =
    typeof valeur === 'string' && /^\d+$/.test(valeur.trim()) ? Number(valeur.trim()) : valeur;
  return typeof nombre === 'number' && Number.isSafeInteger(nombre) && nombre >= 0 ? nombre : null;
}

// Contrôle des trois champs : valeurs nettoyées, ou message par champ en erreur
export function verifier(
  saisie: Record<string, unknown>,
): { informations: InformationsFiscales } | { erreurs: Erreurs } {
  const erreurs: Erreurs = {};
  const entier = (champ: 'revenuNetImposable' | 'nombreEnfants') => {
    if (vide(saisie[champ])) {
      erreurs[champ] = CHAMP_OBLIGATOIRE;
      return 0;
    }
    const nombre = entierPositif(saisie[champ]);
    if (nombre === null) erreurs[champ] = ENTIER_INVALIDE;
    return nombre ?? 0;
  };
  const revenuNetImposable = entier('revenuNetImposable');
  const situation = saisie.situationFamiliale;
  if (vide(situation)) {
    erreurs.situationFamiliale = CHAMP_OBLIGATOIRE;
  } else if (!SITUATIONS_FAMILIALES.includes(situation as SituationFamiliale)) {
    erreurs.situationFamiliale = SITUATION_INVALIDE;
  }
  const nombreEnfants = entier('nombreEnfants');
  if (Object.keys(erreurs).length > 0) return { erreurs };
  return {
    informations: {
      revenuNetImposable,
      situationFamiliale: situation as SituationFamiliale,
      nombreEnfants,
    },
  };
}

export function creerFiscaliteService(depot: DepotFiscalite) {
  // null : l'investisseur n'a pas (ou plus) d'informations fiscales
  async function lire(utilisateurId: string): Promise<InformationsFiscales | null> {
    return depot.lire(utilisateurId);
  }

  // 400 { message, erreurs: { <champ>: message } } si un champ manque ou est invalide :
  // rien n'est enregistré
  async function enregistrer(
    utilisateurId: string,
    saisie: Record<string, unknown>,
  ): Promise<InformationsFiscales> {
    const resultat = verifier(saisie);
    if ('erreurs' in resultat) {
      throw new HttpError(400, ERREUR_SAISIE, { erreurs: resultat.erreurs });
    }
    await depot.enregistrer(utilisateurId, resultat.informations);
    return resultat.informations;
  }

  // Sans informations enregistrées : rien à faire, pas d'erreur
  async function effacer(utilisateurId: string): Promise<void> {
    await depot.effacer(utilisateurId);
  }

  return loggable('FiscaliteService', { lire, enregistrer, effacer });
}

export type FiscaliteService = ReturnType<typeof creerFiscaliteService>;
