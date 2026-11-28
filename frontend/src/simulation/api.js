import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Simulation (US-08) : toutes les SCPI, triées par nom, avec prix de part, taux, minimum,
// délai de jouissance et décotes de démembrement (backend/src/simulation/)
export function lireSimulables(base = apiBase()) {
  return appelAuthentifie(`${base}/scpis/simulables`);
}

// US-09 : estimation fiscale (calcul US-07) de la simulation. demande : { lignes (en année
// pleine), periodes (revenus par an de chaque période), annees (revenus perçus chaque
// année) } ; taux : celui choisi sans informations fiscales (absent : taux par défaut du
// backend)
export function estimerFiscalite(demande, taux, base = apiBase()) {
  return appelAuthentifie(`${base}/estimation-fiscale`, {
    method: 'POST',
    corps: taux === null || taux === undefined ? demande : { ...demande, taux },
  });
}
