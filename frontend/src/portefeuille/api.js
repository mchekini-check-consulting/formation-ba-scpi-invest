import { apiBase } from '../api.js';
import { appelAuthentifie } from '../auth.js';

// Portefeuille (US-20, SCPI-267), backend/src/portefeuille/ :
//   listerInvestissements() -> { scpis: [...] } : dossiers de l'investisseur connecté,
//     regroupés par SCPI, triés par montant investi décroissant
export function listerInvestissements(base = apiBase()) {
  return appelAuthentifie(`${base}/portefeuille/investissements`);
}
