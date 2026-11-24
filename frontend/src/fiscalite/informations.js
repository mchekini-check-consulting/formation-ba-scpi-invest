// US-06 « Renseigner mes informations fiscales » (SCPI-255) : règles de saisie de l'écran
// et appels au backend (backend/src/fiscalite/, mêmes règles vérifiées côté serveur).
import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

export const MESSAGE_ENREGISTREES = 'Vos informations fiscales sont enregistrées.';
export const MESSAGE_EFFACEES = 'Vos informations fiscales sont effacées.';
export const CHAMP_OBLIGATOIRE = 'Ce champ est obligatoire.';
export const ENTIER_INVALIDE = 'Saisissez un nombre entier positif ou nul.';

export const SITUATIONS = [
  { valeur: 'seul', libelle: 'Seul' },
  { valeur: 'couple', libelle: 'En couple' },
];

// Formulaire vide (jamais renseigné, ou informations effacées) ; les enfants se règlent avec
// les boutons − / + à partir de 0
export const VIDE = { revenuNetImposable: '', situationFamiliale: '', nombreEnfants: '0' };

// Revenu affiché avec ses espaces de milliers (« 40 000 ») ; texte non numérique laissé tel quel
export function formaterRevenu(texte) {
  const nettoye = texte.replace(/\s/g, '');
  return /^\d+$/.test(nettoye) ? Number(nettoye).toLocaleString('fr-FR') : texte;
}

// Récapitulatif « Votre foyer fiscal » : parts de quotient familial (règle 2 de l'US-07) :
// 1 seul, 2 en couple, + 0,5 par enfant pour les deux premiers, + 1 à partir du troisième ;
// null sans situation familiale
export function nombreParts(situationFamiliale, nombreEnfants) {
  if (!SITUATIONS.some(({ valeur }) => valeur === situationFamiliale)) return null;
  const enfants = Math.max(0, nombreEnfants);
  const base = situationFamiliale === 'couple' ? 2 : 1;
  return base + Math.min(enfants, 2) * 0.5 + Math.max(enfants - 2, 0);
}

// Valeurs du backend -> valeurs du formulaire (texte, revenu avec ses espaces de milliers) ;
// null -> formulaire vide
export function versFormulaire(informations) {
  if (!informations) return VIDE;
  return {
    revenuNetImposable: formaterRevenu(String(informations.revenuNetImposable)),
    situationFamiliale: informations.situationFamiliale,
    nombreEnfants: String(informations.nombreEnfants),
  };
}

// Espaces retirés (« 40 000 » accepté), puis chiffres uniquement : entier ≥ 0, sans plafond
function entier(texte) {
  const nettoye = texte.replace(/\s/g, '');
  return /^\d+$/.test(nettoye) ? Number(nettoye) : null;
}

// Contrôle avant envoi : { erreurs } par champ, ou { informations } prêtes à enregistrer
export function verifier(valeurs) {
  const erreurs = {};
  const nombre = (champ) => {
    if (valeurs[champ].trim() === '') {
      erreurs[champ] = CHAMP_OBLIGATOIRE;
      return null;
    }
    const valeur = entier(valeurs[champ]);
    if (valeur === null) erreurs[champ] = ENTIER_INVALIDE;
    return valeur;
  };
  const revenuNetImposable = nombre('revenuNetImposable');
  if (!SITUATIONS.some(({ valeur }) => valeur === valeurs.situationFamiliale)) {
    erreurs.situationFamiliale = CHAMP_OBLIGATOIRE;
  }
  const nombreEnfants = nombre('nombreEnfants');
  if (Object.keys(erreurs).length > 0) return { erreurs };
  return {
    informations: {
      revenuNetImposable,
      situationFamiliale: valeurs.situationFamiliale,
      nombreEnfants,
    },
  };
}

// Informations de l'investisseur connecté ; null s'il n'en a pas
export function lireInformationsFiscales(base = apiBase()) {
  return appelAuthentifie(`${base}/informations-fiscales`);
}

export function enregistrerInformationsFiscales(informations, base = apiBase()) {
  return appelAuthentifie(`${base}/informations-fiscales`, { method: 'PUT', corps: informations });
}

export function effacerInformationsFiscales(base = apiBase()) {
  return appelAuthentifie(`${base}/informations-fiscales`, { method: 'DELETE' });
}
