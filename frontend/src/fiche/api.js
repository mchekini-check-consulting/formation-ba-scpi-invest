import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Fiche d'une SCPI (US-02) : informations, historiques et répartitions
// (backend/src/fiche/). SCPI absente : erreur 404 dont le message dit si elle n'est
// « plus » ou « pas » disponible.
export function lireFiche(id, base = apiBase()) {
  return appelAuthentifie(`${base}/scpis/${encodeURIComponent(id)}`);
}
