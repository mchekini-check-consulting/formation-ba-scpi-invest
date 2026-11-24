import { describe, expect, it } from 'vitest';
import {
  NUE_PROPRIETE,
  PLEINE_PROPRIETE,
  USUFRUIT,
  calculerLigne,
  calculerSimulation,
  changerType,
  lireLignes,
  moisProductifs,
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
});
