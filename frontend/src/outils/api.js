// Appels de l'outil de test de l'import du catalogue (dev uniquement) au backend :
//   GET  /outils/import-catalogue/etat      -> serveur, stockage R2, fichier déposé, planification
//   PUT  /outils/import-catalogue/fichier   corps = le CSV -> { bucket, cle, taille, deposeLe }
//   POST /outils/import-catalogue/lancement -> { issue, erreur, dureeMs, rapport } (409 : déjà en cours)
//   GET  /outils/import-catalogue/rapports  -> rapports d'exécution, du plus récent au plus ancien
//   GET  /outils/import-catalogue/catalogue -> catalogue en base avec ses tables liées
// Ouvert à tous : pas besoin d'être connecté (la session est envoyée si elle existe).
import { appelConnecte, envoyerFichierConnecte } from '../auth.js';

const BASE = '/outils/import-catalogue';

export function lireEtat() {
  return appelConnecte(`${BASE}/etat`);
}

// progression(part de 0 à 1) pendant l'envoi ; type forcé : un .csv a souvent un type vide
export function deposerCsv(fichier, progression) {
  const csv = fichier.type ? fichier : new Blob([fichier], { type: 'text/csv' });
  return envoyerFichierConnecte(`${BASE}/fichier`, csv, { progression });
}

export function lancerImport() {
  return appelConnecte(`${BASE}/lancement`, { methode: 'POST' });
}

export function lireRapports(limite = 50) {
  return appelConnecte(`${BASE}/rapports?limite=${limite}`);
}

export function lireCatalogue() {
  return appelConnecte(`${BASE}/catalogue`);
}
