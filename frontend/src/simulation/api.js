import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Simulation (US-08) : toutes les SCPI, triées par nom, avec prix de part, taux, minimum,
// délai de jouissance et décotes de démembrement (backend/src/simulation/)
export function lireSimulables(base = apiBase()) {
  return appelAuthentifie(`${base}/scpis/simulables`);
}
