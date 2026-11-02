// Définitions des indicateurs SCPI (maquette « Définitions des indicateurs »), par thème.
// sigle : '' quand l'indicateur n'en a pas.
export const THEMES = [
  {
    id: 'prix',
    titre: 'Prix et valeur des parts',
    indicateurs: [
      {
        nom: 'Prix de souscription',
        sigle: '',
        definition: 'Prix payé pour acheter une part. Il inclut les frais de souscription.',
      },
      {
        nom: 'Prix de retrait',
        sigle: '',
        definition:
          'Somme reçue quand on revend une part à la SCPI : le prix de souscription moins les frais.',
      },
      {
        nom: 'Valeur de réalisation',
        sigle: '',
        definition:
          'Valeur des immeubles s’ils étaient vendus aujourd’hui, plus les autres actifs, moins les dettes. Estimée chaque année par un expert indépendant.',
      },
      {
        nom: 'Valeur de reconstitution',
        sigle: '',
        definition:
          'Ce qu’il faudrait payer pour reconstituer le même patrimoine, frais et droits compris.',
      },
      {
        nom: 'Surcote / décote',
        sigle: '',
        definition:
          'Écart entre le prix de souscription et la valeur de reconstitution. Une décote signifie que la part est vendue moins cher que ce qu’elle vaut.',
      },
      {
        nom: 'Variation du prix de la part',
        sigle: '',
        definition:
          'Évolution du prix de souscription sur une période. Une baisse signale une perte de valeur du patrimoine.',
      },
    ],
  },
  {
    id: 'rendement',
    titre: 'Rendement',
    indicateurs: [
      {
        nom: 'Taux de distribution',
        sigle: 'TD',
        definition:
          'Revenus versés dans l’année, divisés par le prix de la part. C’est le rendement affiché par les SCPI.',
      },
      {
        nom: 'Performance globale annuelle',
        sigle: 'PGA',
        definition:
          'Taux de distribution plus la variation du prix de la part sur l’année : le gain total, revenus et valeur compris.',
      },
      {
        nom: 'Taux de rendement interne',
        sigle: 'TRI',
        definition:
          'Performance moyenne par an sur 5, 10 ou 15 ans, en tenant compte des frais, des revenus et de la valeur de revente.',
      },
      {
        nom: 'Délai de jouissance',
        sigle: '',
        definition: 'Nombre de mois entre l’achat des parts et le premier versement de revenus.',
      },
    ],
  },
  {
    id: 'frais',
    titre: 'Frais',
    indicateurs: [
      {
        nom: 'Frais de souscription',
        sigle: '',
        definition:
          'Frais payés à l’entrée, en général 8 à 12 % du montant investi. Ils sont compris dans le prix de la part.',
      },
      {
        nom: 'Frais de gestion',
        sigle: '',
        definition: 'Prélevés chaque année par la société de gestion sur les loyers encaissés.',
      },
      {
        nom: 'Commission de cession',
        sigle: '',
        definition: 'Frais payés quand on revend ses parts à un autre épargnant.',
      },
      {
        nom: 'Durée pour amortir les frais',
        sigle: '',
        definition: 'Nombre d’années de revenus nécessaires pour compenser les frais d’entrée.',
      },
    ],
  },
  {
    id: 'sante',
    titre: 'Santé financière',
    indicateurs: [
      {
        nom: 'Taux d’occupation financier',
        sigle: 'TOF',
        definition:
          'Loyers réellement encaissés divisés par les loyers encaissés si tout était loué. Plus il est haut, mieux c’est.',
      },
      {
        nom: 'Taux d’occupation physique',
        sigle: 'TOP',
        definition: 'Surface louée divisée par la surface totale du patrimoine.',
      },
      {
        nom: 'Endettement',
        sigle: '',
        definition:
          'Part du patrimoine financée par emprunt (ratio « dettes et autres engagements »). Un endettement élevé augmente le risque.',
      },
      {
        nom: 'Report à nouveau',
        sigle: 'RAN',
        definition:
          'Bénéfices mis de côté, qui servent à maintenir les revenus pendant une année difficile. Souvent exprimé en mois de revenus.',
      },
      {
        nom: 'Provision pour gros entretien',
        sigle: 'PGE',
        definition: 'Argent réservé pour les gros travaux à venir sur les immeubles.',
      },
      {
        nom: 'Parts en attente de retrait',
        sigle: '',
        definition:
          'Parts que des épargnants veulent revendre sans trouver d’acheteur. C’est un signal d’alerte sur la liquidité.',
      },
      {
        nom: 'Durée moyenne restante des baux',
        sigle: 'WALB',
        definition:
          'Temps pendant lequel les locataires sont encore engagés à payer leur loyer. Plus elle est longue, plus les revenus sont sécurisés.',
      },
    ],
  },
  {
    id: 'taille',
    titre: 'Taille et activité',
    indicateurs: [
      {
        nom: 'Capitalisation',
        sigle: '',
        definition:
          'Valeur totale de la SCPI : le nombre de parts multiplié par le prix de la part.',
      },
      {
        nom: 'Collecte brute',
        sigle: '',
        definition: 'Argent investi par les épargnants pendant une période.',
      },
      {
        nom: 'Collecte nette',
        sigle: '',
        definition:
          'Collecte brute moins l’argent retiré par les épargnants qui revendent leurs parts.',
      },
      {
        nom: 'Nombre d’associés',
        sigle: '',
        definition: 'Nombre d’épargnants qui détiennent des parts.',
      },
    ],
  },
  {
    id: 'patrimoine',
    titre: 'Patrimoine',
    indicateurs: [
      {
        nom: 'Nombre d’immeubles et de locataires',
        sigle: '',
        definition: 'Plus ils sont nombreux, plus le risque est réparti.',
      },
      {
        nom: 'Répartition par type d’actif',
        sigle: '',
        definition: 'Bureaux, commerces, santé, logistique, résidentiel, hôtellerie…',
      },
      {
        nom: 'Répartition géographique',
        sigle: '',
        definition: 'Paris, Île-de-France, régions, Europe, international.',
      },
    ],
  },
  {
    id: 'risque',
    titre: 'Risque, durée et durabilité',
    indicateurs: [
      {
        nom: 'Indicateur de risque',
        sigle: 'SRI',
        definition:
          'Note de 1 (risque faible) à 7 (risque élevé), présente dans le document d’informations clés.',
      },
      {
        nom: 'Durée de placement recommandée',
        sigle: '',
        definition: 'Durée conseillée par la société de gestion, souvent 8 à 10 ans.',
      },
      {
        nom: 'Document d’informations clés',
        sigle: 'DIC',
        definition:
          'Document officiel de 3 pages qui résume le produit, ses risques, ses frais et ses scénarios de performance.',
      },
      {
        nom: 'Label ISR',
        sigle: 'ISR',
        definition:
          'Label d’État qui distingue les fonds ayant une démarche environnementale, sociale et de gouvernance.',
      },
      {
        nom: 'Classification SFDR',
        sigle: 'SFDR',
        definition:
          'Niveau d’engagement du fonds en matière de durabilité (article 6, 8 ou 9), selon la réglementation européenne.',
      },
    ],
  },
  {
    id: 'fonctionnement',
    titre: 'Fonctionnement',
    indicateurs: [
      {
        nom: 'SCPI à capital variable',
        sigle: '',
        definition:
          'La SCPI émet de nouvelles parts en continu : on achète et on revend directement auprès d’elle.',
      },
      {
        nom: 'SCPI à capital fixe',
        sigle: '',
        definition:
          'Le nombre de parts est limité : on achète et on revend entre épargnants, sur le marché secondaire.',
      },
      {
        nom: 'Société de gestion',
        sigle: '',
        definition:
          'Entreprise agréée par l’AMF qui gère la SCPI : elle achète les immeubles, les loue et verse les revenus.',
      },
      {
        nom: 'Bulletin d’information',
        sigle: '',
        definition:
          'Document publié au moins deux fois par an par la SCPI, avec ses chiffres clés.',
      },
    ],
  },
];

// Recherche insensible aux majuscules, aux accents et au type d'apostrophe (' ou ’)
function normaliser(texte) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').replaceAll('’', "'").toLowerCase();
}

// Thèmes à afficher pour une recherche et un thème donnés ('tous' = pas de filtre),
// sans les thèmes devenus vides
export function filtrerIndicateurs(recherche, theme) {
  const q = normaliser(recherche.trim());
  return THEMES.filter((t) => theme === 'tous' || t.id === theme)
    .map((t) => ({
      ...t,
      indicateurs: t.indicateurs.filter((i) =>
        normaliser(`${i.nom} ${i.sigle} ${i.definition}`).includes(q),
      ),
    }))
    .filter((t) => t.indicateurs.length > 0);
}
