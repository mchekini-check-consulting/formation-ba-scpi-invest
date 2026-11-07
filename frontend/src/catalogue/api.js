import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Catalogue (US-08) : une page de 12 SCPI triées par taux de distribution N-1
// { scpis, total, page, taillePage, nombrePages, anneeTaux, misAJourLe }
// (backend/src/catalogue/)
export function listerScpis(page = 1, base = apiBase()) {
  return appelAuthentifie(`${base}/scpis?page=${page}`);
}
