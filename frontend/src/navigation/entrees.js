// Entrées de la sidebar (US-06, EN-03), dans l'ordre d'affichage, regroupées par usage.
// Chaque chemin est une route de Routeur.jsx (à l'intérieur de <ExigerKycComplete>).
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
      },
      {
        id: 'simulation',
        libelle: 'Simulation',
        description: 'Estimer vos revenus',
        chemin: '/simulation',
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
      },
      {
        id: 'versements',
        libelle: 'Versements programmés',
        description: 'Vos investissements réguliers',
        chemin: '/versements/nouveau',
      },
    ],
  },
];

export const ENTREES = GROUPES.flatMap((g) => g.entrees);

// Accès affiché en bas du menu, au-dessus de la pastille Profil
export const INFOS_FISCALES = {
  id: 'fiscalite',
  libelle: 'Infos fiscales',
  chemin: '/fiscalite',
};
