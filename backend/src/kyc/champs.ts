import type { ReponsesKyc } from '../db/schema.js';

// Champs du formulaire KYC (US-04a), même liste que frontend/src/kyc/etapes.js.
// L'email n'en fait pas partie : c'est celui du compte, déjà connu.
type Champ = { nom: string; multiple?: boolean; facultatif?: boolean; siAutrePays?: boolean };

export const CHAMPS_KYC: Champ[] = [
  // 1. Identité
  { nom: 'civilite' },
  { nom: 'nom' },
  { nom: 'prenom' },
  { nom: 'nomNaissance', facultatif: true },
  { nom: 'dateNaissance' },
  { nom: 'lieuNaissance' },
  { nom: 'nationalite' },
  // 2. Coordonnées
  { nom: 'adresse' },
  { nom: 'codePostal' },
  { nom: 'ville' },
  { nom: 'pays' },
  { nom: 'telephone' },
  // 3. Situation personnelle et professionnelle
  { nom: 'situationFamiliale' },
  { nom: 'profession' },
  { nom: 'categorie' },
  { nom: 'secteur' },
  // 4. Déclarations réglementaires
  { nom: 'origineFonds', multiple: true },
  { nom: 'ppe' },
  { nom: 'residenceFiscale' },
  { nom: 'paysResidenceFiscale', siAutrePays: true },
  { nom: 'usPerson' },
];

// Étapes 1 à 4, 5 = pièces justificatives (US-04c), puis 6 = récapitulatif avant validation
export const ETAPE_RECAPITULATIF = 6;

const LONGUEUR_MAX = 300;
const CHOIX_MAX = 20;

// Garde seulement les champs connus, au bon format (texte, ou liste de textes pour les
// choix multiples), coupés à une longueur raisonnable
export function nettoyer(reponses: unknown): ReponsesKyc {
  const propre: ReponsesKyc = {};
  if (typeof reponses !== 'object' || reponses === null || Array.isArray(reponses)) {
    return propre;
  }
  const brutes = reponses as Record<string, unknown>;
  for (const champ of CHAMPS_KYC) {
    const valeur = brutes[champ.nom];
    if (champ.multiple && Array.isArray(valeur)) {
      propre[champ.nom] = valeur
        .filter((v): v is string => typeof v === 'string')
        .slice(0, CHOIX_MAX)
        .map((v) => v.slice(0, LONGUEUR_MAX));
    } else if (!champ.multiple && typeof valeur === 'string') {
      propre[champ.nom] = valeur.slice(0, LONGUEUR_MAX);
    }
  }
  return propre;
}

function rempli(valeur: string | string[] | undefined): boolean {
  if (Array.isArray(valeur)) return valeur.length > 0;
  return (valeur ?? '').trim() !== '';
}

// Âge révolu à une date donnée, depuis une date « AAAA-MM-JJ »
export function age(dateIso: string, le: Date): number {
  const [annee, mois, jour] = dateIso.split('-').map(Number);
  let ans = le.getFullYear() - annee;
  const moisCourant = le.getMonth() + 1;
  if (moisCourant < mois || (moisCourant === mois && le.getDate() < jour)) ans -= 1;
  return ans;
}

// Champs obligatoires vides ou invalides : rien ne doit manquer pour valider le KYC
export function champsIncomplets(reponses: ReponsesKyc, le: Date): string[] {
  const manquants: string[] = [];
  for (const champ of CHAMPS_KYC) {
    if (champ.facultatif) continue;
    if (champ.siAutrePays && reponses.residenceFiscale !== 'Autre pays') continue;
    if (!rempli(reponses[champ.nom])) manquants.push(champ.nom);
  }
  const naissance = reponses.dateNaissance;
  if (typeof naissance === 'string' && rempli(naissance)) {
    const valide = /^\d{4}-\d{2}-\d{2}$/.test(naissance) && age(naissance, le) >= 18;
    if (!valide) manquants.push('dateNaissance');
  }
  return manquants;
}
