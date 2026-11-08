import type { ReponsesKyc } from '../db/schema.js';

// Champs du formulaire KYC (US-04a), même liste que frontend/src/kyc/etapes.js.
// L'email n'en fait pas partie : c'est celui du compte, déjà connu.
// pays : code ISO à 2 lettres (liste des pays de l'écran). codePostal : facultatif ici, car
// certains pays n'en ont pas ; son format, selon le pays, est contrôlé par l'écran.
type Champ = {
  nom: string;
  multiple?: boolean;
  facultatif?: boolean;
  siAutrePays?: boolean;
  pays?: boolean;
};

export const CHAMPS_KYC: Champ[] = [
  // 1. Identité
  { nom: 'civilite' },
  { nom: 'nom' },
  { nom: 'prenom' },
  { nom: 'nomNaissance', facultatif: true },
  { nom: 'dateNaissance' },
  { nom: 'lieuNaissance' },
  { nom: 'nationalite', pays: true },
  // 2. Coordonnées
  { nom: 'pays', pays: true },
  { nom: 'adresse' },
  { nom: 'codePostal', facultatif: true },
  { nom: 'ville' },
  { nom: 'indicatif', pays: true },
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
  { nom: 'paysResidenceFiscale', siAutrePays: true, pays: true },
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

// Champ à contrôler : obligatoire, et demandé selon les réponses (pays de résidence
// fiscale seulement si « Autre pays »)
function aControler(champ: Champ, reponses: ReponsesKyc): boolean {
  if (champ.facultatif) return false;
  return !champ.siAutrePays || reponses.residenceFiscale === 'Autre pays';
}

// Champ rempli, et pour un pays : code ISO à 2 lettres
function champComplet(champ: Champ, valeur: string | string[] | undefined): boolean {
  if (!rempli(valeur)) return false;
  return !champ.pays || /^[A-Z]{2}$/.test(String(valeur));
}

// Texte saisi (champ rempli) qui ne respecte pas la règle donnée
function texteInvalide(
  valeur: string | string[] | undefined,
  valide: (texte: string) => boolean,
): boolean {
  return typeof valeur === 'string' && rempli(valeur) && !valide(valeur);
}

const telephoneValide = (telephone: string) => /^\+?[\d\s.()-]{4,20}$/.test(telephone);

const naissanceValide = (le: Date) => (naissance: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(naissance) && age(naissance, le) >= 18;

// Champs obligatoires vides ou invalides : rien ne doit manquer pour valider le KYC
export function champsIncomplets(reponses: ReponsesKyc, le: Date): string[] {
  const manquants = CHAMPS_KYC.filter(
    (champ) => aControler(champ, reponses) && !champComplet(champ, reponses[champ.nom]),
  ).map((champ) => champ.nom);
  if (texteInvalide(reponses.telephone, telephoneValide)) manquants.push('telephone');
  if (texteInvalide(reponses.dateNaissance, naissanceValide(le))) manquants.push('dateNaissance');
  return manquants;
}
