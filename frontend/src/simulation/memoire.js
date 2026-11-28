// Simulation en cours, gardée en mémoire pendant la visite : l'investisseur peut quitter
// l'écran Simuler (par exemple pour saisir ses informations fiscales) et la retrouver en y
// revenant. Rien n'est enregistré : elle est perdue au rechargement de la page et à la
// déconnexion (qui recharge la page). origine : paramètre ?scpi= de l'adresse à
// l'ouverture (C1), pour ne pas la reprendre quand on arrive avec une autre sélection.
let enCours = null;

// { origine, lignes, taux } gardée, ou null
export function lireSimulationEnCours() {
  return enCours;
}

export function garderSimulation(simulation) {
  enCours = simulation;
}

export function oublierSimulation() {
  enCours = null;
}
