import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Comparateur (US-04) : toutes les SCPI, triées par nom, avec les critères comparés
// (backend/src/comparaison/)
export function lireComparables(base = apiBase()) {
  return appelAuthentifie(`${base}/scpis/comparables`);
}
