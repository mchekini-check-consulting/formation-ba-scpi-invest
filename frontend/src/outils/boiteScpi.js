// Appels de l'écran « Boîte de réception de la SCPI » (dev uniquement) au backend
// societe-gestion, la SCPI partenaire simulée :
//   GET /messages -> { kafka: { active, connecte, topic, groupe, erreur }, compteurs,
//                      messages : [{ partition, offset, cle, recuLe, doublon, invalide,
//                                    message, brut }] } (plus récent d'abord)
// Ouvert sans connexion ; ailleurs qu'en dev, le backend répond 404.
import { apiBase } from '../api.js';

export const BACKEND = 'societe-gestion';

export async function lireMessages(base = apiBase(location.hostname, BACKEND)) {
  const reponse = await fetch(`${base}/messages`);
  if (!reponse.ok) {
    throw new Error(`La société de gestion ne répond pas (${reponse.status}).`);
  }
  return reponse.json();
}

// ---- Affichage (BoiteScpi.jsx) --------------------------------------------------------

export const euros = (n) =>
  typeof n === 'number'
    ? n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
    : '—';

export const date = (iso) =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      })
    : '—';

// Données personnelles directes masquées par défaut : email, identité, coordonnées
export const MASQUE = '•••';
const SENSIBLES = ['identite', 'coordonnees'];

export function masquer(msg) {
  const copie = structuredClone(msg);
  const inv = copie.investisseur ?? {};
  if ('email' in inv) inv.email = MASQUE;
  for (const bloc of SENSIBLES) {
    for (const champ of Object.keys(inv[bloc] ?? {})) inv[bloc][champ] = MASQUE;
  }
  return copie;
}
