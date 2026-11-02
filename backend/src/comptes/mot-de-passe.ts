// Règles de sécurité du mot de passe (US-02b), vérifiées ici (source de vérité) et
// reprises à l'identique par le frontend (frontend/src/inscription/mot-de-passe.js)
// pour guider la saisie.

// Mots trop courants, comparés après retrait des chiffres et caractères spéciaux :
// « Azerty123456! » -> « azerty »
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

export const REGLES = {
  longueur: 'Au moins 12 caractères',
  majuscule: 'Au moins une majuscule',
  minuscule: 'Au moins une minuscule',
  chiffre: 'Au moins un chiffre',
  special: 'Au moins un caractère spécial (! @ # $ % & * …)',
  espace: 'Le mot de passe ne doit pas contenir d’espace',
  email: 'Le mot de passe ne doit pas contenir votre email ou votre nom',
  courant: 'Ce mot de passe est trop courant, choisissez-en un autre',
} as const;

export function reglesNonRespectees(motDePasse: string, email = ''): string[] {
  const erreurs: string[] = [];
  if (motDePasse.length < 12) erreurs.push(REGLES.longueur);
  if (!/\p{Lu}/u.test(motDePasse)) erreurs.push(REGLES.majuscule);
  if (!/\p{Ll}/u.test(motDePasse)) erreurs.push(REGLES.minuscule);
  if (!/\d/.test(motDePasse)) erreurs.push(REGLES.chiffre);
  if (!/[^\p{L}\d\s]/u.test(motDePasse)) erreurs.push(REGLES.special);
  if (/\s/.test(motDePasse)) erreurs.push(REGLES.espace);
  if (contientEmail(motDePasse, email)) erreurs.push(REGLES.email);
  if (MOTS_COURANTS.has(motDePasse.toLowerCase().replace(/[^a-z]/g, ''))) {
    erreurs.push(REGLES.courant);
  }
  return erreurs;
}

function contientEmail(motDePasse: string, email: string): boolean {
  const mdp = motDePasse.toLowerCase();
  const adresse = email.trim().toLowerCase();
  const identifiant = adresse.split('@')[0];
  return (
    (adresse !== '' && mdp.includes(adresse)) ||
    (identifiant.length >= 3 && mdp.includes(identifiant))
  );
}

export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
