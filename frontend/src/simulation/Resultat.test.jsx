import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NUE_PROPRIETE, PLEINE_PROPRIETE, USUFRUIT, horizon, periodes } from './calculs.js';
import Resultat, { INFOBULLE_PART_ETRANGERE, MAX_PERIODES_EN_CARTES } from './Resultat.jsx';

afterEach(cleanup);

const espaces = (texte) => texte.replace(/\s/g, ' ');
const texte = (element) => espaces(element.textContent);

// Ligne prise en compte, comme la construit Simulation.jsx (taux d'impôt de 5 %)
const ligne = (nom, type, demembrement, duree, revenuAnnuel, autres = {}) => ({
  scpi: { nom, prixPart: 250, tauxDistribution: 8, delaiJouissance: 5 },
  nom,
  type,
  demembrement,
  duree,
  parts: 30,
  delai: 5,
  montant: 7500,
  revenuAnnuel,
  tauxImpot: 0.05,
  ...autres,
});

// Détail de l'impôt sur la durée, 100 % français
const DETAIL_FRANCAIS = {
  revenuFrance: 1000,
  revenuEtranger: 0,
  impotRevenuFrance: 110,
  impotRevenuEtranger: 0,
  prelevementsSociaux: 172,
};
const AVEC_INFORMATIONS = {
  avecInformations: true,
  foyer: { parts: 1, tmi: 11, impotFoyer: 1000, tauxMoyen: 6.27 },
  detailCumul: DETAIL_FRANCAIS,
  tauxProposes: [0, 11, 30, 41, 45],
  tauxParDefaut: 30,
};
const SANS_INFORMATIONS = { ...AVEC_INFORMATIONS, avecInformations: false, foyer: null };

function afficher(lignes, { total, net, estimation = AVEC_INFORMATIONS, tauxPeriodes } = {}) {
  // Estimation du backend : impôt de chaque période au taux de ses lignes (5 %) et, si
  // donnés, TMI et taux moyen avec ses revenus (tauxPeriodes)
  const estimees = periodes(lignes).map((p, i) => {
    const actives = p.indices.map((k) => lignes[k]);
    if (actives.some((l) => l.tauxImpot === null)) return null;
    return {
      impot: actives.reduce((s, l) => s + l.revenuAnnuel * l.tauxImpot, 0),
      avecScpi: tauxPeriodes?.[i] ?? null,
    };
  });
  const lesPeriodes = periodes(lignes, estimees);
  render(
    <MemoryRouter>
      <Resultat
        total={{ lignes: lignes.length, montant: 17120, annuel: 0, mensuel: 0, cumul: 0, ...total }}
        net={net === undefined ? { annuel: 0, mensuel: 0, cumul: 0, impot: 0 } : net}
        duree={horizon(lignes)}
        periodes={lesPeriodes}
        lignes={lignes}
        estimation={estimation}
        taux={null}
        choisirTaux={vi.fn()}
        impotIndisponible={false}
      />
    </MemoryRouter>,
  );
  return lesPeriodes;
}

// Carte « Détail de l'impôt sur N ans » : colonne de droite, juste après l'encadré SCPI
const carteImpot = () => document.querySelector('.simulation__carte-impot');
const carteImpotADroiteSousLEncadre = (encadre) => {
  const carte = carteImpot();
  expect(carte.parentElement.className).toContain('simulation__resultat-droite');
  expect(carte.previousElementSibling).toBe(encadre);
  expect(carte.parentElement.lastElementChild).toBe(carte);
};
const colonnes = () => [...document.querySelectorAll('.simulation__resultat-colonne')];
const detailScpi = () => screen.getByRole('region', { name: 'Détail par SCPI' });
// Ligne d'une SCPI dans « Détail par SCPI »
const scpi = (nom) => within(detailScpi()).getByText(nom).closest('li');
const badge = (element) => element.querySelector('.simulation__badge');
const cellule = (ligneTitre, colonne) => {
  const cellules = screen.getByRole('rowheader', { name: ligneTitre }).parentElement;
  return texte(cellules.querySelectorAll('td')[colonne]);
};
const aucuneValeurCassee = () =>
  expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);

const ENTETE_PARTS = ['Part', 'Revenus', 'Impôt sur le revenu', 'Prélèv. sociaux'];

// Lignes du tableau « Part française / Part étrangère » (texte de chaque cellule non vide)
function lignesParts() {
  return [...document.querySelectorAll('.simulation__parts tr')].map((tr) =>
    [...tr.children].map((c) => c.textContent.replace(/\u202f|\u00a0/g, ' ')).filter((t) => t),
  );
}

describe('Bloc Résultat (refonte maquette A)', () => {
  it('seuil des cartes : constante nommée', () => {
    expect(MAX_PERIODES_EN_CARTES).toBe(4);
  });

  it('cas 1 : une période, plusieurs SCPI dont une en nue-propriété sur toute la durée', () => {
    const lesPeriodes = afficher(
      [
        ligne('Comète', PLEINE_PROPRIETE, 0, 10, 600),
        ligne('Remake Live', PLEINE_PROPRIETE, 0, 10, 476.75),
        ligne('Transitions Europe', NUE_PROPRIETE, 10, 10, 418),
      ],
      {
        total: { annuel: 1076.75, mensuel: 89.73, cumul: 10398.29 },
        net: { annuel: 984.42, mensuel: 82.03, cumul: 9502.81, impot: 92.33 },
      },
    );
    expect(lesPeriodes).toHaveLength(1);
    const [gauche, droite] = colonnes();
    // Gauche : montant, tableau actuel, TMI et taux moyen
    expect(
      within(document.querySelector('.simulation__resultat-haut')).getByText('Montant simulé'),
    ).toBeDefined();
    expect(cellule('Revenus annuels', 0)).toBe('1 076,75 €');
    expect(cellule('Revenus cumulés sur 10 ans', 1)).toBe('9 502,81 €');
    expect(cellule('Impôt estimé annuel', 1)).toBe('92,33 €');
    expect(within(gauche).getByText('TMI retenue')).toBeDefined();
    expect(within(gauche).getByText('Taux moyen retenu')).toBeDefined();
    // TMI et taux moyen : petit encadré beige sous le tableau
    expect(gauche.querySelector('.simulation__fiscal--encadre')).not.toBeNull();
    // Droite : « Détail par SCPI » puis la carte de l'impôt sur 10 ans, sans part étrangère
    carteImpotADroiteSousLEncadre(detailScpi());
    expect(screen.getByRole('heading', { name: 'Détail de l’impôt sur 10 ans' })).toBeDefined();
    expect(screen.queryByText(/Part étrangère/)).toBeNull();
    // Droite : détail par SCPI, badges, nue-propriété sans revenu, total par an
    expect(within(droite).getByRole('region', { name: 'Détail par SCPI' })).toBeDefined();
    expect(droite.className).not.toContain('simulation__resultat-droite--cartes');
    expect(texte(badge(scpi('Comète')))).toBe('Pleine propriété · années 1 à 10');
    expect(texte(scpi('Comète'))).toContain('600,00 € / 570,00 €');
    const nue = scpi('Transitions Europe');
    expect(texte(badge(nue))).toBe('Nue-propriété · démembrement 10 ans');
    expect(badge(nue).className).toContain('simulation__badge--nue');
    expect(badge(scpi('Comète')).className).not.toContain('simulation__badge--nue');
    expect(within(nue).getByText('Aucun revenu sur la durée')).toBeDefined();
    expect(texte(nue)).toContain('Pleine propriété récupérée à la fin de l’année 10');
    expect(texte(within(detailScpi()).getByText('Total par an').parentElement)).toBe(
      'Total par an1 076,75 € / 984,42 €',
    );
    // Pas de cartes ni de tableau par période
    expect(screen.queryByRole('region', { name: 'Années 1 à 10' })).toBeNull();
    expect(screen.queryByText('Détail par période')).toBeNull();
    aucuneValeurCassee();
  });

  it('cas 2 : 3 périodes (nombre impair), cartes sur deux colonnes', () => {
    afficher(
      [
        ligne('Comète', PLEINE_PROPRIETE, 0, 10, 600),
        ligne('Épargne Pierre', PLEINE_PROPRIETE, 0, 3, 300),
        ligne('Eurovalys', PLEINE_PROPRIETE, 0, 6, 484),
      ],
      { total: { cumul: 9000 }, net: { annuel: 0, mensuel: 0, cumul: 8550, impot: 0 } },
    );
    const cartes = [...document.querySelectorAll('.simulation__frise > li')];
    expect(cartes.map((c) => c.querySelector('section').getAttribute('aria-label'))).toEqual([
      'Années 1 à 3',
      'Années 4 à 6',
      'Années 7 à 10',
    ]);
    // La dernière carte (3e, rang impair) est celle que la règle CSS étend sur 2 colonnes
    expect(cartes.at(-1).matches(':last-child:nth-child(odd)')).toBe(true);
    // Événement en sous-titre de la carte qu'il ouvre
    expect(
      within(cartes[1]).getByText(
        'Fin du placement de Épargne Pierre (année 3) : ses revenus s’arrêtent',
      ),
    ).toBeDefined();
    expect(texte(within(cartes[0]).getByRole('rowheader', { name: 'Par an' }).parentElement)).toBe(
      'Par an1 384,00 €1 314,80 €',
    );
    aucuneValeurCassee();
  });

  it('cas 3 : 4 périodes (usufruit, pleine propriété, nue-propriété) : cartes, cumul à gauche, impôt à droite', () => {
    afficher(
      [
        ligne('Comète', USUFRUIT, 3, 10, 600),
        ligne('Eurovalys', PLEINE_PROPRIETE, 0, 6, 484),
        ligne('Transitions Europe', NUE_PROPRIETE, 5, 10, 418),
      ],
      {
        total: { cumul: 6338.94 },
        net: { annuel: 0, mensuel: 0, cumul: 6039.07, impot: 0 },
        tauxPeriodes: [
          { tmi: 30, tauxMoyen: 7.5, depassement: { plafond: 29579, montant: 120 } },
          { tmi: 30, tauxMoyen: 7.1, depassement: { plafond: 29579, montant: 40 } },
          { tmi: 11, tauxMoyen: 6.6, depassement: null },
          { tmi: 11, tauxMoyen: 6.4, depassement: null },
        ],
      },
    );
    expect(document.querySelectorAll('.simulation__frise > li')).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'Année 6' })).toBeDefined();
    const [gauche, droite] = colonnes();
    expect(within(gauche).getByRole('region', { name: 'Années 1 à 3' })).toBeDefined();
    // Encadré de droite à la hauteur de la première carte (sous le montant simulé)
    expect(droite.className).toContain('simulation__resultat-droite--cartes');
    // Droite : détail par SCPI, cumul, TMI ; pas de total par an (revenus qui changent)
    expect(texte(badge(scpi('Comète')))).toBe('Usufruit 3 ans · années 1 à 3');
    expect(texte(badge(scpi('Eurovalys')))).toBe('Pleine propriété · années 1 à 6');
    expect(texte(badge(scpi('Transitions Europe')))).toBe(
      'Nue-propriété 5 ans · revenus années 6 à 10',
    );
    expect(within(droite).queryByText('Total par an')).toBeNull();
    // Revenus cumulés : à gauche, sous les cartes
    expect(
      within(droite).queryByRole('rowheader', { name: 'Revenus cumulés sur 10 ans' }),
    ).toBeNull();
    const cumul = within(gauche).getByRole('rowheader', { name: 'Revenus cumulés sur 10 ans' });
    expect(texte(cumul.parentElement)).toBe('Revenus cumulés sur 10 ans6 338,94 €6 039,07 €');
    expect(cumul.closest('table').previousElementSibling.className).toBe('simulation__frise');
    // TMI et taux moyen avec les revenus SCPI dans chaque carte, plus sous le cumul. Flèche
    // quand la TMI change par rapport à la période d'avant (première : foyer avant les
    // loyers, 11 %) ; dépassement seulement quand elle monte depuis celle du foyer
    expect(within(droite).queryByText('TMI retenue')).toBeNull();
    const taux = (annees) =>
      texte(screen.getByRole('region', { name: annees }).querySelector('.simulation__fiscal'));
    expect(taux('Années 1 à 3')).toBe(
      'TMI retenue11 % → 30 %120 € au-dessus de 29 579 €Taux moyen retenu7,50 %',
    );
    expect(taux('Années 4 et 5')).toBe('TMI retenue30 %Taux moyen retenu7,10 %');
    expect(taux('Année 6')).toBe('TMI retenue30 % → 11 %Taux moyen retenu6,60 %');
    expect(taux('Années 7 à 10')).toBe('TMI retenue11 %Taux moyen retenu6,40 %');
    expect(screen.queryByText('Détail par période')).toBeNull();
    // Droite : « Détail par SCPI » puis la carte de l'impôt
    carteImpotADroiteSousLEncadre(detailScpi());
    aucuneValeurCassee();
  });

  it('cas 4 : 7 périodes : fourchettes à gauche, tableau « Détail par période » pleine largeur', () => {
    const lesPeriodes = afficher(
      [
        ligne('Comète', USUFRUIT, 3, 15, 600),
        ligne('Épargne Pierre', PLEINE_PROPRIETE, 0, 4, 300),
        ligne('Eurovalys', PLEINE_PROPRIETE, 0, 6, 484),
        ligne('Transitions Europe', NUE_PROPRIETE, 5, 12, 418),
        ligne('Remake Live', NUE_PROPRIETE, 8, 15, 477),
      ],
      {
        total: { cumul: 12169 },
        net: { annuel: 0, mensuel: 0, cumul: 11303, impot: 0 },
        tauxPeriodes: [{ tmi: 30, tauxMoyen: 7, depassement: null }],
      },
    );
    expect(lesPeriodes).toHaveLength(7);
    // Plus de cartes
    expect(document.querySelector('.simulation__frise')).toBeNull();
    // Synthèse en fourchettes « min → max » selon la période, cumul exact
    expect(cellule('Revenus annuels selon la période', 0)).toBe('418,00 € → 1 384,00 €');
    expect(cellule('Revenus mensuels selon la période', 0)).toBe('34,83 € → 115,33 €');
    expect(cellule('Revenus cumulés sur 15 ans', 0)).toBe('12 169,00 €');
    expect(cellule('Revenus cumulés sur 15 ans', 1)).toBe('11 303,00 €');
    expect(cellule('Impôt estimé annuel', 1)).toBe('20,90 € → 69,20 €');
    // TMI et taux moyen : colonnes du tableau des périodes, plus sous les fourchettes
    expect(within(colonnes()[0]).queryByText('TMI retenue')).toBeNull();
    // Tableau pleine largeur, hors des deux colonnes
    const tableau = screen.getByRole('region', { name: 'Détail par période' });
    expect(tableau.closest('.simulation__resultat-grille')).toBeNull();
    expect(tableau.parentElement.lastElementChild).toBe(tableau);
    // Carte de l'impôt sur 15 ans : à droite, sous « Détail par SCPI »
    carteImpotADroiteSousLEncadre(detailScpi());
    expect(
      within(carteImpot()).getByRole('heading', { name: 'Détail de l’impôt sur 15 ans' }),
    ).toBeDefined();
    const lignesPeriodes = [
      ...tableau.querySelectorAll('tbody tr:not(.simulation__ligne-evenement)'),
    ];
    expect(lignesPeriodes.map((tr) => texte(tr.querySelector('th')))).toEqual([
      'Années 1 à 3',
      'Année 4',
      'Année 5',
      'Année 6',
      'Années 7 et 8',
      'Années 9 à 12',
      'Années 13 à 15',
    ]);
    expect(texte(lignesPeriodes[0])).toBe(
      'Années 1 à 3Comète, Épargne Pierre, Eurovalys1 384,00 €1 314,80 €115,33 €109,57 €69,20 €' +
        '11 % → 30 %7,00 %',
    );
    // Sans TMI connue pour la période : celle du foyer, flèche depuis la période d'avant
    expect(texte(lignesPeriodes[1]).endsWith('30 % → 11 %6,27 %')).toBe(true);
    expect(texte(lignesPeriodes[2]).endsWith('€11 %6,27 %')).toBe(true);
    expect([...tableau.querySelectorAll('thead th')].map(texte).slice(-2)).toEqual([
      'TMI retenue',
      'Taux moyen retenu',
    ]);
    // Événements entre deux lignes (pas avant la première)
    const evenements = [...tableau.querySelectorAll('.simulation__ligne-evenement')].map(texte);
    expect(evenements).toEqual([
      'Fin de l’usufruit de Comète (année 3) : ses revenus s’arrêtent',
      'Fin du placement de Épargne Pierre (année 4) : ses revenus s’arrêtent',
      'Fin du démembrement de Transitions Europe (année 5) : ses revenus commencent',
      'Fin du placement de Eurovalys (année 6) : ses revenus s’arrêtent',
      'Fin du démembrement de Remake Live (année 8) : ses revenus commencent',
      'Fin du placement de Transitions Europe (année 12) : ses revenus s’arrêtent',
    ]);
    expect(tableau.querySelector('tbody tr').className).not.toContain('evenement');
    // Défilement horizontal sur écran étroit (aussi au clavier)
    expect(tableau.querySelector('.simulation__defilement').getAttribute('tabindex')).toBe('0');
    aucuneValeurCassee();
  });

  it('cas 4 : impôt pas encore connu : « … » dans les fourchettes et le détail', () => {
    afficher(
      [
        ligne('Comète', USUFRUIT, 3, 15, 600, { tauxImpot: null }),
        ligne('Épargne Pierre', PLEINE_PROPRIETE, 0, 4, 300, { tauxImpot: null }),
        ligne('Eurovalys', PLEINE_PROPRIETE, 0, 6, 484, { tauxImpot: null }),
        ligne('Transitions Europe', NUE_PROPRIETE, 5, 12, 418, { tauxImpot: null }),
        ligne('Remake Live', NUE_PROPRIETE, 8, 15, 477, { tauxImpot: null }),
      ],
      { total: { cumul: 12169 }, net: null },
    );
    expect(cellule('Revenus annuels selon la période', 0)).toBe('418,00 € → 1 384,00 €');
    expect(cellule('Revenus annuels selon la période', 1)).toBe('…');
    expect(texte(scpi('Comète'))).toContain('600,00 € / …');
    aucuneValeurCassee();
  });

  it('cas 5 : une seule SCPI : encadré « Votre SCPI »', () => {
    afficher([ligne('Comète', PLEINE_PROPRIETE, 0, 10, 600)], {
      total: { montant: 7500, annuel: 600, mensuel: 50, cumul: 5750 },
      net: { annuel: 570, mensuel: 47.5, cumul: 5462.5, impot: 30 },
    });
    expect(screen.queryByRole('region', { name: 'Détail par SCPI' })).toBeNull();
    const encadre = screen.getByRole('region', { name: 'Votre SCPI : Comète' });
    expect(within(colonnes()[1]).getByRole('region', { name: 'Votre SCPI : Comète' })).toBe(
      encadre,
    );
    expect(texte(badge(encadre))).toBe('Pleine propriété · années 1 à 10');
    // Version compacte : 4 repères sur une ligne, plus de « Revenus par an » (déjà à gauche)
    const reperes = [...encadre.querySelectorAll('.simulation__reperes-scpi > div')].map(texte);
    expect(reperes).toEqual([
      'Parts30',
      'Prix de la part250 €',
      'Distribution8,00 %',
      'Jouissance5 mois',
    ]);
    expect(within(encadre).queryByText('Revenus par an')).toBeNull();
    // Puis la carte de l'impôt
    carteImpotADroiteSousLEncadre(encadre);
    expect(cellule('Revenus annuels', 0)).toBe('600,00 €');
    aucuneValeurCassee();
  });

  it('cas 5 : délai de jouissance absent du référentiel', () => {
    afficher([
      ligne('Comète', PLEINE_PROPRIETE, 0, 10, 600, {
        delai: 0,
        scpi: { nom: 'Comète', prixPart: 250, tauxDistribution: 8, delaiJouissance: null },
      }),
    ]);
    expect(texte(screen.getByText('Jouissance').nextElementSibling)).toBe(
      '0 mois (non communiqué)',
    );
  });

  it('cas 6 : une seule SCPI en nue-propriété sur toute la durée : aucun revenu, rien ne casse', () => {
    afficher([ligne('Transitions Europe', NUE_PROPRIETE, 10, 10, 418)], {
      total: { montant: 11200, annuel: 0, mensuel: 0, cumul: 0 },
      net: { annuel: 0, mensuel: 0, cumul: 0, impot: 0 },
      estimation: SANS_INFORMATIONS,
    });
    const encadre = screen.getByRole('region', { name: 'Votre SCPI : Transitions Europe' });
    expect(texte(badge(encadre))).toBe('Nue-propriété · démembrement 10 ans');
    // Nue-propriété : le délai de jouissance ne joue pas (3 repères)
    expect(within(encadre).queryByText('Jouissance')).toBeNull();
    expect(encadre.querySelectorAll('.simulation__reperes-scpi > div')).toHaveLength(3);
    // Sans informations fiscales : pas de carte de l'impôt
    expect(carteImpot()).toBeNull();
    expect(cellule('Revenus annuels', 0)).toBe('0,00 €');
    expect(cellule('Revenus cumulés sur 10 ans', 1)).toBe('0,00 €');
    // Sans informations fiscales : le taux se choisit dans « Ma fiscalité », pas ici
    expect(screen.queryByLabelText('Taux d’imposition estimé')).toBeNull();
    aucuneValeurCassee();
  });

  it('changement de TMI : « 11 % → 30 % », dépassement du plafond, taux moyen avec SCPI', () => {
    afficher([ligne('Mistral Selection', PLEINE_PROPRIETE, 0, 10, 1080)], {
      total: { annuel: 1080, mensuel: 90, cumul: 10440 },
      estimation: {
        ...AVEC_INFORMATIONS,
        foyer: { parts: 1, tmi: 11, impotFoyer: 1903, tauxMoyen: 6.58 },
        avecScpi: {
          tmi: 30,
          tauxMoyen: 7,
          depassement: { plafond: 29579, montant: 401 },
          revenuFrance: 1080,
          revenuEtranger: 0,
          impotRevenuFrance: 194.99,
          impotRevenuEtranger: 0,
          prelevementsSociaux: 185.76,
        },
        detailCumul: {
          revenuFrance: 10440,
          revenuEtranger: 0,
          impotRevenuFrance: 1884.9,
          impotRevenuEtranger: 0,
          prelevementsSociaux: 1795.68,
        },
      },
    });
    const tmi = screen.getByText('TMI retenue').nextElementSibling;
    expect(texte(tmi)).toBe('11 % → 30 %401 € au-dessus de 29 579 €');
    expect(texte(tmi.querySelector('.simulation__depassement'))).toBe(
      '401 € au-dessus de 29 579 €',
    );
    expect(texte(screen.getByText('Taux moyen retenu').nextElementSibling)).toBe('7,00 %');
    const intitules = [...document.querySelectorAll('.simulation__fiscal dt')].map(
      (d) => d.textContent,
    );
    expect(intitules).toEqual(['TMI retenue', 'Taux moyen retenu']);
    // Sous le taux moyen : tableau des parts sur toute la durée, sans part étrangère
    expect(screen.getByRole('table', { name: 'Détail de l’impôt sur 10 ans' })).toBeDefined();
    expect(lignesParts()).toEqual([
      ENTETE_PARTS,
      ['Part française', '10 440,00 €', '1 884,90 €', '1 795,68 €'],
      ['Total', '10 440,00 €', '1 884,90 €', '1 795,68 €'],
    ]);
    expect(screen.queryByText(/Part étrangère/)).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('revenus étrangers : ligne « Part étrangère » (sans prélèvements sociaux) et info-bulle', () => {
    afficher([ligne('Europa', PLEINE_PROPRIETE, 0, 10, 1000)], {
      estimation: {
        ...AVEC_INFORMATIONS,
        foyer: { parts: 1, tmi: 30, impotFoyer: 5103.99, tauxMoyen: 12.76 },
        avecScpi: {
          tmi: 30,
          tauxMoyen: 13.18,
          depassement: null,
          revenuFrance: 200,
          revenuEtranger: 800,
          impotRevenuFrance: 60,
          impotRevenuEtranger: 134.56,
          prelevementsSociaux: 34.4,
        },
        detailCumul: {
          revenuFrance: 2000,
          revenuEtranger: 8000,
          impotRevenuFrance: 600,
          impotRevenuEtranger: 1345.6,
          prelevementsSociaux: 344,
        },
      },
    });
    const tableau = screen.getByRole('table', { name: 'Détail de l’impôt sur 10 ans' });
    expect(lignesParts()).toEqual([
      ENTETE_PARTS,
      ['Part française', '2 000,00 €', '600,00 €', '344,00 €'],
      ['Part étrangère i' + INFOBULLE_PART_ETRANGERE, '8 000,00 €', '1 345,60 €', '—'],
      ['Total', '10 000,00 €', '1 945,60 €', '344,00 €'],
    ]);
    const bouton = within(tableau).getByRole('button', {
      name: 'Pourquoi un impôt sur la part étrangère ?',
    });
    expect(bouton.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
    expect(screen.getByRole('tooltip').textContent).toBe(
      'Vos revenus étrangers sont imposés dans leur pays. En France, ils augmentent le taux ' +
        'appliqué à vos autres revenus.',
    );
    expect(screen.queryByText('Effet des revenus étrangers')).toBeNull();
  });

  it('maquette 2 (Activimmo, 1 000 parts, 10 ans) : carte de l’impôt, total = cumul brut', () => {
    afficher([ligne('Activimmo', PLEINE_PROPRIETE, 0, 10, 32269)], {
      total: { annuel: 32269, mensuel: 2689.08, cumul: 322690 },
      net: { annuel: 21457.5, mensuel: 1788.13, cumul: 214575.01, impot: 10811.5 },
      estimation: {
        ...AVEC_INFORMATIONS,
        detailCumul: {
          revenuFrance: 271059.6,
          revenuEtranger: 51630.4,
          impotRevenuFrance: 52877.73,
          impotRevenuEtranger: 8615.01,
          prelevementsSociaux: 46622.25,
        },
      },
    });
    expect(lignesParts().slice(1)).toEqual([
      ['Part française', '271 059,60 €', '52 877,73 €', '46 622,25 €'],
      ['Part étrangère i' + INFOBULLE_PART_ETRANGERE, '51 630,40 €', '8 615,01 €', '—'],
      ['Total', '322 690,00 €', '61 492,74 €', '46 622,25 €'],
    ]);
    // Total des revenus = revenus cumulés sur 10 ans, colonne Bruts
    expect(cellule('Revenus cumulés sur 10 ans', 0)).toBe('322 690,00 €');
    expect(cellule('Total', 0)).toBe('322 690,00 €');
  });

  it('TMI inchangée avec les SCPI : une seule TMI, pas de dépassement', () => {
    afficher([ligne('Mistral Selection', PLEINE_PROPRIETE, 0, 10, 108)], {
      estimation: {
        ...AVEC_INFORMATIONS,
        avecScpi: { tmi: 11, tauxMoyen: 6.6, depassement: null },
      },
    });
    expect(texte(screen.getByText('TMI retenue').nextElementSibling)).toBe('11 %');
    expect(texte(screen.getByText('Taux moyen retenu').nextElementSibling)).toBe('6,60 %');
  });

  it('aucune SCPI prise en compte : résultat vide, trois étapes numérotées', () => {
    afficher([], { total: { montant: 0 }, net: null, estimation: null });
    expect(colonnes()).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
      'Vos revenus s’afficheront ici',
    );
    const etapes = [...document.querySelectorAll('.simulation__etape')].map(texte);
    expect(etapes).toEqual([
      '1Choisissez une SCPI dans le catalogue, avec son prix de part et son taux de distribution.',
      '2Indiquez le nombre de parts et, si la SCPI le permet, le type : pleine propriété, nue-propriété ou usufruit.',
      '3Lisez vos revenus par an, par mois et cumulés, bruts et après fiscalité.',
    ]);
    aucuneValeurCassee();
  });
});
