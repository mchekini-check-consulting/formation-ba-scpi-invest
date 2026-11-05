// Entrées de la sidebar (US-06), dans l'ordre d'affichage, regroupées par usage. Une
// entrée devient active quand son écran existe : retirer `inactive` et déclarer sa route
// dans Routeur.jsx (à l'intérieur de <ExigerKycComplete>).
export const GROUPES = [
  {
    titre: 'Investir',
    entrees: [
      {
        id: 'catalogue',
        libelle: 'Catalogue',
        description: 'Toutes les SCPI et leurs indicateurs',
        chemin: '/catalogue',
      },
      {
        id: 'comparaison',
        libelle: 'Comparaison',
        description: 'Jusqu’à 4 SCPI côte à côte',
        chemin: '/comparaison',
        inactive: true,
      },
      {
        id: 'simulation',
        libelle: 'Simulation',
        description: 'Estimer vos revenus',
        chemin: '/simulation',
        inactive: true,
      },
    ],
  },
  {
    titre: 'Suivre',
    entrees: [
      {
        id: 'portefeuille',
        libelle: 'Portefeuille',
        description: 'Vos parts et revenus réunis',
        chemin: '/portefeuille',
        inactive: true,
      },
    ],
  },
];

export const ENTREES = GROUPES.flatMap((g) => g.entrees);

// Adresses des écrans pas encore disponibles : redirigées vers le Catalogue (Routeur.jsx)
export const CHEMINS_INACTIFS = ENTREES.filter((e) => e.inactive).map((e) => e.chemin);
