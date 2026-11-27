// Libellés de l'écran « Mon portefeuille » (US-20, SCPI-267). Les calculs (regroupement,
// tri, montants, revenus) sont faits par le backend (backend/src/portefeuille/service.ts).
import { formaterDate, libelleStatut } from '../investir/demande.js';

// Mode dans le tableau des dossiers (maquette validée par le BA)
const MODES_COURTS = {
  ponctuel: 'Ponctuelle',
  programme: 'Programmé',
};

export const libelleModeCourt = (id) => MODES_COURTS[id] ?? id;

// Statut court dans le tableau des dossiers ; libellé complet sinon
const STATUTS_COURTS = {
  investissement_actif: 'Actif',
  acceptee_attente_paiement: 'En attente de paiement',
};

export const libelleStatutCourt = (id) => STATUTS_COURTS[id] ?? libelleStatut(id);

export const AUCUN_INVESTISSEMENT = 'Vous n’avez encore fait aucune demande d’investissement.';

// Pastilles du bandeau : « 1 SCPI », « 3 SCPI » (invariable) ; « 1 dossier », « 6 dossiers »
export const nombreScpis = (n) => `${n} SCPI`;
export const nombreDossiers = (n) => `${n} dossier${n > 1 ? 's' : ''}`;

// Règle 3 : selon le statut, date d'entrée en jouissance, référence de virement ou motif
// de refus (null si le dossier n'en a pas)
export function detailDossier(dossier) {
  if (dossier.statut === 'investissement_actif' && dossier.jouissanceLe) {
    return `Jouissance le ${formaterDate(dossier.jouissanceLe)}`;
  }
  if (dossier.statut === 'acceptee_attente_paiement' && dossier.referenceVirement) {
    return `Réf. virement : ${dossier.referenceVirement}`;
  }
  if (dossier.statut === 'refusee' && dossier.motifRefus) {
    return `Motif : ${dossier.motifRefus}`;
  }
  return null;
}
