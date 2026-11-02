// Règles de sécurité du mot de passe (US-02b), pour guider la saisie. Copie de
// backend/src/comptes/mot-de-passe.ts, qui reste la référence : toute modification
// se fait dans les deux fichiers.

const MOTS_COURANTS = new Set([
  'azerty',
  'azertyuiop',
  'qwerty',
  'qwertyuiop',
  'password',
  'motdepasse',
  'admin',
  'administrateur',
  'bonjour',
  'soleil',
  'iloveyou',
  'jetaime',
  'welcome',
  'bienvenue',
  'letmein',
  'abc',
  'abcdef',
  'abcdefgh',
  'football',
  'marseille',
  'paris',
  'doudou',
  'loulou',
  'chouchou',
  'test',
  'user',
  'scpi',
  'scpiinvest',
]);

// Règles toujours affichées (liste à cocher) puis interdits, signalés seulement s'ils
// s'appliquent
export const REGLES = {
  longueur: 'Au moins 12 caractères',
  majuscule: 'Au moins une majuscule',
  minuscule: 'Au moins une minuscule',
  chiffre: 'Au moins un chiffre',
  special: 'Au moins un caractère spécial (! @ # $ % & * …)',
  espace: 'Le mot de passe ne doit pas contenir d’espace',
  email: 'Le mot de passe ne doit pas contenir votre email ou votre nom',
  courant: 'Ce mot de passe est trop courant, choisissez-en un autre',
};

export const REGLES_A_COCHER = ['longueur', 'majuscule', 'minuscule', 'chiffre', 'special'];

// Clés des règles non respectées (voir REGLES)
export function reglesNonRespectees(motDePasse, email = '') {
  const erreurs = [];
  if (motDePasse.length < 12) erreurs.push('longueur');
  if (!/\p{Lu}/u.test(motDePasse)) erreurs.push('majuscule');
  if (!/\p{Ll}/u.test(motDePasse)) erreurs.push('minuscule');
  if (!/\d/.test(motDePasse)) erreurs.push('chiffre');
  if (!/[^\p{L}\d\s]/u.test(motDePasse)) erreurs.push('special');
  if (/\s/.test(motDePasse)) erreurs.push('espace');
  if (contientEmail(motDePasse, email)) erreurs.push('email');
  if (MOTS_COURANTS.has(motDePasse.toLowerCase().replace(/[^a-z]/g, ''))) {
    erreurs.push('courant');
  }
  return erreurs;
}

function contientEmail(motDePasse, email) {
  const mdp = motDePasse.toLowerCase();
  const adresse = email.trim().toLowerCase();
  const identifiant = adresse.split('@')[0];
  return (
    (adresse !== '' && mdp.includes(adresse)) ||
    (identifiant.length >= 3 && mdp.includes(identifiant))
  );
}

export function emailValide(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
