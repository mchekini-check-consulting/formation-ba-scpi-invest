import { describe, expect, it } from 'vitest';
import {
  NUE_PROPRIETE,
  PLEINE_PROPRIETE,
  USUFRUIT,
  annees,
  apresFiscalite,
  calculerLigne,
  calculerSimulation,
  changerDemembrement,
  changerType,
  horizon,
  lignesAEstimer,
  lireLignes,
  moisProductifs,
  nouvelleLigne,
  periodes,
  revenusParAnnee,
  tauxParLigne,
  typesProposes,
} from './calculs.js';

const TRANSITIONS = {
  id: 1,
  nom: 'Transitions Europe',
  prixPart: 200,
  tauxDistribution: 8.35,
  minimum: 200,
  delaiJouissance: 5,
  demembrement: false,
  decotes: [],
};
const IROKO = {
  id: 2,
  nom: 'Iroko Zen',
  prixPart: 202,
  tauxDistribution: 7.12,
  minimum: 202,
  delaiJouissance: 6,
  demembrement: false,
  decotes: [],
};
const CHERE = { ...TRANSITIONS, id: 3, prixPart: 250, minimum: 2500, delaiJouissance: 0 };
const DEMEMBREE = {
  ...TRANSITIONS,
  id: 4,
  delaiJouissance: 0,
  demembrement: true,
  decotes: [
    { duree: 5, decote: 20 },
    { duree: 10, decote: 30 },
  ],
};

const ligne = (parts, type = PLEINE_PROPRIETE, dureeDemembrement = null) => ({
  parts: String(parts),
  type,
  dureeDemembrement,
});

describe('Simulation (US-08) : calculs', () => {
  it('scénario une SCPI : 250 parts sur 10 ans', () => {
    const r = calculerLigne(ligne(250), TRANSITIONS, 10);
    expect(r).toMatchObject({ etat: 'ok', montant: 50000, delai: 5 });
    expect(calculerSimulation([r])).toEqual({
      lignes: 1,
      montant: 50000,
      annuel: 4175,
      mensuel: 347.92,
      cumul: 40010.42,
    });
  });

  it('scénario deux SCPI', () => {
    const resultats = [
      calculerLigne(ligne(250), TRANSITIONS, 10),
      calculerLigne(ligne(250), IROKO, 10),
    ];
    expect(calculerSimulation(resultats)).toMatchObject({
      montant: 100500,
      annuel: 7770.6,
      cumul: 74168.62,
    });
  });

  it('scénario sous le minimum : ligne jamais prise en compte', () => {
    const sous = calculerLigne(ligne(4), CHERE, 10);
    expect(sous).toEqual({ etat: 'sousMinimum', minimum: 2500 });
    const resultats = [
      calculerLigne(ligne(250), TRANSITIONS, 10),
      calculerLigne(ligne(250), IROKO, 10),
      sous,
    ];
    expect(calculerSimulation(resultats)).toMatchObject({
      lignes: 2,
      montant: 100500,
      annuel: 7770.6,
    });
  });

  it('scénario nue-propriété : 100 parts, 5 ans de démembrement, placement de 10 ans', () => {
    const r = calculerLigne(ligne(100, NUE_PROPRIETE, 5), DEMEMBREE, 10);
    expect(r).toMatchObject({ etat: 'ok', montant: 16000, demembrement: 5 });
    // Nue-propriété : 0 € en année pleine (C6) ; 1 670 € par an les 5 dernières années
    expect(calculerSimulation([r])).toMatchObject({ annuel: 0, mensuel: 0, cumul: 8350 });
  });

  it('usufruit : montant = valeur × décote, revenus pendant le démembrement seulement', () => {
    const r = calculerLigne(ligne(100, USUFRUIT, 5), DEMEMBREE, 10);
    expect(r).toMatchObject({ etat: 'ok', montant: 4000, annuelAnneePleine: 1670 });
    expect(calculerSimulation([r]).cumul).toBe(8350);
  });

  it('mois productifs : délai de jouissance, usufruit, nue-propriété, durée courte', () => {
    expect(moisProductifs({ type: PLEINE_PROPRIETE, delai: 5, demembrement: 0 }, 10)).toBe(115);
    expect(moisProductifs({ type: USUFRUIT, delai: 6, demembrement: 5 }, 10)).toBe(54);
    expect(moisProductifs({ type: NUE_PROPRIETE, delai: 6, demembrement: 5 }, 10)).toBe(60);
    expect(moisProductifs({ type: NUE_PROPRIETE, delai: 0, demembrement: 10 }, 5)).toBe(0);
    expect(moisProductifs({ type: PLEINE_PROPRIETE, delai: 18, demembrement: 0 }, 1)).toBe(0);
  });

  it('lignes non prises en compte : vide, parts invalides, donnée non communiquée', () => {
    expect(calculerLigne(ligne(1), null, 10)).toEqual({ etat: 'vide' });
    for (const parts of ['0', '', '2.5', '-3']) {
      expect(calculerLigne(ligne(parts), TRANSITIONS, 10)).toEqual({ etat: 'partsInvalides' });
    }
    expect(calculerLigne(ligne(10), { ...TRANSITIONS, tauxDistribution: null }, 10)).toEqual({
      etat: 'nonCommunique',
    });
    // Délai et minimum absents : 0 mois, pas de minimum
    const r = calculerLigne(ligne(1), { ...TRANSITIONS, delaiJouissance: null, minimum: null }, 1);
    expect(r).toMatchObject({ etat: 'ok', delai: 0, cumul: 16.7 });
    expect(calculerSimulation([])).toEqual({
      lignes: 0,
      montant: 0,
      annuel: 0,
      mensuel: 0,
      cumul: 0,
    });
  });

  it('ouverture pré-remplie : ?scpi=3:10, SCPI inconnues ignorées, parts invalides -> 1', () => {
    const scpis = [TRANSITIONS, IROKO, CHERE];
    expect(lireLignes('3:10', scpis).map(({ scpi, parts, type }) => [scpi, parts, type])).toEqual([
      [3, '10', PLEINE_PROPRIETE],
    ]);
    expect(lireLignes('1:x,99:4,2', scpis).map((l) => [l.scpi, l.parts])).toEqual([
      [1, '1'],
      [2, '1'],
    ]);
    expect(lireLignes(null, scpis).map((l) => l.scpi)).toEqual([null]);
  });

  it('types proposés : démembrement seulement s’il est autorisé ; durée par défaut', () => {
    expect(typesProposes(TRANSITIONS).map((t) => t.code)).toEqual([PLEINE_PROPRIETE]);
    expect(typesProposes({ ...TRANSITIONS, demembrement: true }).map((t) => t.code)).toEqual([
      PLEINE_PROPRIETE,
    ]);
    expect(typesProposes(DEMEMBREE)).toHaveLength(3);
    const nue = changerType(ligne(1), NUE_PROPRIETE, DEMEMBREE);
    expect(nue.dureeDemembrement).toBe(5);
    const garde = changerType({ ...nue, dureeDemembrement: 10 }, USUFRUIT, DEMEMBREE);
    expect(garde).toMatchObject({ type: USUFRUIT, dureeDemembrement: 10 });
    expect(changerType(garde, PLEINE_PROPRIETE, DEMEMBREE).dureeDemembrement).toBeNull();
  });

  it('usufruit : durée de placement = durée du démembrement ; autres types : inchangée', () => {
    const usufruit = changerType(ligne(1), USUFRUIT, DEMEMBREE);
    expect(usufruit).toMatchObject({ dureeDemembrement: 5, duree: 5 });
    expect(changerDemembrement(usufruit, 10)).toMatchObject({ dureeDemembrement: 10, duree: 10 });
    const nue = changerType({ ...ligne(1), duree: 12 }, NUE_PROPRIETE, DEMEMBREE);
    expect(changerDemembrement(nue, 10)).toMatchObject({ dureeDemembrement: 10, duree: 12 });
  });
});

describe('revenus après fiscalité (US-09)', () => {
  it('cas 1 : impôt et net de la période, cumul année par année du backend', () => {
    const estimation = {
      periodes: [{ revenus: 1080, impot: 380.75, net: 699.25 }],
      cumul: { revenus: 10440, impot: 3637.58, net: 6802.42 },
    };
    expect(apresFiscalite(estimation)).toEqual({
      impot: 380.75,
      annuel: 699.25,
      mensuel: 58.27,
      cumul: 6802.42,
    });
  });

  it('aucune période : 0', () => {
    expect(apresFiscalite({ periodes: [], cumul: { net: 0 } })).toEqual({
      impot: 0,
      annuel: 0,
      mensuel: 0,
      cumul: 0,
    });
  });

  it('lignes à estimer : SCPI et revenu des lignes « ok », dans l’ordre', () => {
    expect(
      lignesAEstimer(
        [{ scpi: 3 }, { scpi: 4 }, { scpi: 5 }],
        [{ etat: 'ok', revenuAnnuel: 1000.004 }, { etat: 'vide' }, { etat: 'ok', revenuAnnuel: 5 }],
      ),
    ).toEqual([
      { scpiId: 3, revenuAnnuel: 1000 },
      { scpiId: 5, revenuAnnuel: 5 },
    ]);
  });
});

describe('périodes du placement (US-09 : démembrement, une durée par SCPI)', () => {
  const ligne = (nom, type, demembrement, revenuAnnuel, duree = 10) => ({
    scpi: { id: nom.charCodeAt(0) },
    nom,
    type,
    demembrement,
    duree,
    revenuAnnuel,
  });
  // Estimation du backend à 30 % sur le total de chaque période
  const a30 = (lesPeriodes) => lesPeriodes.map((p) => ({ impot: p.brut * 0.3 }));

  it('TMI et taux moyen de chaque période repris de l’estimation (null sans)', () => {
    const lignes = [ligne('A', PLEINE_PROPRIETE, 0, 4000), ligne('B', USUFRUIT, 5, 1000)];
    const avecScpi = { tmi: 30, tauxMoyen: 13.61, depassement: null };
    const lesPeriodes = periodes(lignes, [{ impot: 1500, avecScpi }, { impot: 1200 }]);
    expect(lesPeriodes.map((p) => p.avecScpi)).toEqual([avecScpi, null]);
    expect(periodes(lignes).map((p) => p.avecScpi)).toEqual([null, null]);
  });

  it('nouvelle ligne : 10 ans par défaut ; calcul avec la durée de la ligne', () => {
    expect(nouvelleLigne().duree).toBe(10);
    const r = calculerLigne(
      { parts: '250', type: PLEINE_PROPRIETE, dureeDemembrement: null, duree: 1 },
      TRANSITIONS,
    );
    expect(r).toMatchObject({ duree: 1, cumul: (4175 / 12) * 7 });
  });

  it('exemple BA : A pleine propriété, B usufruit 5 ans, C nue-propriété 7 ans, 10 ans', () => {
    const lignes = [
      ligne('A', PLEINE_PROPRIETE, 0, 4000),
      ligne('B', USUFRUIT, 5, 2000),
      ligne('C', NUE_PROPRIETE, 7, 1500),
    ];
    const resultat = periodes(lignes, a30(periodes(lignes)));
    expect(resultat.map((p) => [annees(p), p.scpis, p.brut, p.impot, p.net])).toEqual([
      ['Années 1 à 5', ['A', 'B'], 6000, 1800, 4200],
      ['Années 6 et 7', ['A'], 4000, 1200, 2800],
      ['Années 8 à 10', ['A', 'C'], 5500, 1650, 3850],
    ]);
    expect(resultat[1].evenements).toEqual([{ type: USUFRUIT, nom: 'B', annee: 5 }]);
    expect(resultat[2].evenements).toEqual([{ type: NUE_PROPRIETE, nom: 'C', annee: 7 }]);
    expect(resultat[0]).toMatchObject({ mensuel: 500, netMensuel: 350, evenements: [] });
    // Revenus par an de chaque période, envoyés à l'estimation fiscale
    expect(resultat[0].indices).toEqual([0, 1]);
    expect(resultat[2].revenus).toEqual([
      { scpiId: 65, revenuAnnuel: 4000 },
      { scpiId: 67, revenuAnnuel: 1500 },
    ]);
  });

  it('durées différentes : la SCPI placée moins longtemps cesse de rapporter', () => {
    const lignes = [
      ligne('A', PLEINE_PROPRIETE, 0, 4000, 5),
      ligne('B', PLEINE_PROPRIETE, 0, 2000, 8),
      // Usufruit déjà terminé à la fin de son placement : pas de second événement
      ligne('U', USUFRUIT, 3, 1000, 6),
    ];
    expect(horizon(lignes)).toBe(8);
    const resultat = periodes(lignes);
    expect(resultat.map((p) => [annees(p), p.scpis, p.brut])).toEqual([
      ['Années 1 à 3', ['A', 'B', 'U'], 7000],
      ['Années 4 et 5', ['A', 'B'], 6000],
      ['Années 6 à 8', ['B'], 2000],
    ]);
    expect(resultat[2].evenements).toEqual([{ type: 'fin', nom: 'A', annee: 5 }]);
  });

  it('démembrement au-delà du placement : une seule période', () => {
    const resultat = periodes([
      ligne('B', USUFRUIT, 10, 2000),
      ligne('C', NUE_PROPRIETE, 12, 1500),
    ]);
    expect(resultat).toHaveLength(1);
    expect(resultat[0]).toMatchObject({ debut: 1, fin: 10, scpis: ['B'], brut: 2000 });
  });

  it('impôt pas encore connu : impôt et nets absents ; aucune SCPI : 0', () => {
    expect(periodes([ligne('A', PLEINE_PROPRIETE, 0, 100, 3)])[0]).toMatchObject({
      brut: 100,
      impot: null,
      net: null,
      netMensuel: null,
    });
    expect(periodes([ligne('C', NUE_PROPRIETE, 2, 100, 3)])[0]).toMatchObject({
      debut: 1,
      fin: 2,
      scpis: [],
      brut: 0,
    });
    expect(horizon([])).toBe(0);
  });

  it('libellé des années', () => {
    expect(annees({ debut: 8, fin: 8 })).toBe('Année 8');
    expect(annees({ debut: 6, fin: 7 })).toBe('Années 6 et 7');
    expect(annees({ debut: 1, fin: 5 })).toBe('Années 1 à 5');
  });
});

describe('impôt année par année et taux par ligne (changement de TMI)', () => {
  const mistral = (autres = {}) => ({
    scpi: { id: 16 },
    type: PLEINE_PROPRIETE,
    delai: 4,
    demembrement: 0,
    duree: 10,
    revenuAnnuel: 1080,
    ...autres,
  });

  it('cas 1 : année 1 réduite au délai de jouissance (8 mois), puis années pleines', () => {
    const resultat = revenusParAnnee([mistral()]);
    expect(resultat).toHaveLength(10);
    expect(resultat[0]).toEqual([{ scpiId: 16, revenuAnnuel: 720 }]);
    expect(resultat.slice(1).every((a) => a[0].revenuAnnuel === 1080)).toBe(true);
  });

  it('délai de plus d’un an, usufruit et nue-propriété : seulement les années qui produisent', () => {
    const resultat = revenusParAnnee([
      mistral({ scpi: { id: 1 }, delai: 18, duree: 3 }),
      mistral({ scpi: { id: 2 }, type: USUFRUIT, delai: 0, demembrement: 1, duree: 3 }),
      mistral({ scpi: { id: 3 }, type: NUE_PROPRIETE, delai: 0, demembrement: 2, duree: 3 }),
    ]);
    expect(resultat).toEqual([
      [{ scpiId: 2, revenuAnnuel: 1080 }],
      [{ scpiId: 1, revenuAnnuel: 540 }],
      [
        { scpiId: 1, revenuAnnuel: 1080 },
        { scpiId: 3, revenuAnnuel: 1080 },
      ],
    ]);
    // Aucune ligne : aucune année
    expect(revenusParAnnee([]).length).toBe(0);
  });

  it('taux par ligne : sa part de l’impôt dans sa première période ; jamais de revenu : 0', () => {
    const lesPeriodes = [{ indices: [0, 1] }, { indices: [1] }];
    const estimees = [
      {
        lignes: [
          { revenuAnnuel: 1000, impot: 300 },
          { revenuAnnuel: 500, impot: 0 },
        ],
      },
      { lignes: [{ revenuAnnuel: 500, impot: 100 }] },
    ];
    expect(tauxParLigne(3, lesPeriodes, estimees)).toEqual([0.3, 0, 0]);
    expect(tauxParLigne(2, lesPeriodes, null)).toEqual([null, null]);
  });
});
