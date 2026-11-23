import { describe, expect, it } from 'vitest';
import { lireSelection, meilleureValeur, montantMinimalCommun, revenuEstime } from './calculs.js';

const COMETE = { prixPart: 250, tauxDistribution: 8, minimum: 5000 };
const CORUM = { prixPart: 1135, tauxDistribution: 6.05, minimum: 1135 };

describe('Comparateur (US-04) : sélection de l’adresse', () => {
  const scpis = [1, 3, 7, 9].map((id) => ({ id }));

  it('SCPI de l’adresse dans l’ordre, emplacements restants vides', () => {
    expect(lireSelection('3,7', scpis)).toEqual([3, 7, null]);
    expect(lireSelection(null, scpis)).toEqual([null, null, null]);
  });

  it('au-delà de 3 : les 3 premières ; inconnues et doublons ignorés', () => {
    expect(lireSelection('9,7,3,1', scpis)).toEqual([9, 7, 3]);
    expect(lireSelection('3,3,999,abc,7', scpis)).toEqual([3, 7, null]);
  });
});

describe('Comparateur (US-04) : revenu annuel brut estimé', () => {
  it('scénario « revenu brut pour un montant » : 10 000 €', () => {
    expect(revenuEstime(10000, COMETE)).toEqual({
      etat: 'ok',
      parts: 40,
      investi: 10000,
      annuel: 800,
      mensuel: 66.67,
    });
    expect(revenuEstime(10000, CORUM)).toEqual({
      etat: 'ok',
      parts: 8,
      investi: 9080,
      annuel: 549.34,
      mensuel: 45.78,
    });
  });

  it('montant sous le minimum, ou qui ne paie pas une part', () => {
    expect(revenuEstime(3000, COMETE)).toEqual({ etat: 'sousMinimum', seuil: 5000 });
    expect(revenuEstime(100, { ...COMETE, minimum: null })).toEqual({
      etat: 'sousMinimum',
      seuil: 250,
    });
  });

  it('sans montant, ou sans prix ou taux connus', () => {
    expect(revenuEstime(null, COMETE)).toEqual({ etat: 'sansMontant' });
    expect(revenuEstime(10000, { ...COMETE, tauxDistribution: null })).toEqual({
      etat: 'nonCommunique',
    });
    expect(revenuEstime(10000, { ...COMETE, prixPart: null })).toEqual({
      etat: 'nonCommunique',
    });
  });
});

describe('Comparateur (US-04) : montant minimal commun', () => {
  it('le plus grand des minimums, arrondi au nombre de parts supérieur', () => {
    expect(montantMinimalCommun([COMETE, CORUM])).toBe(5000);
    // minimum 1 000 €, part à 610 € : 2 parts -> 1 220 €
    expect(montantMinimalCommun([{ prixPart: 610, minimum: 1000 }, CORUM])).toBe(1220);
    // part à 2 085,50 € : arrondi à l'euro supérieur
    expect(montantMinimalCommun([{ prixPart: 2085.5, minimum: null }])).toBe(2086);
  });

  it('sans prix de part connu : aucun montant', () => {
    expect(montantMinimalCommun([{ prixPart: null, minimum: 1000 }])).toBeNull();
  });
});

describe('Comparateur (US-04) : meilleure valeur d’une ligne', () => {
  it('la plus haute ou la plus basse', () => {
    expect(meilleureValeur([7.12, 8, null], 'max')).toBe(8);
    expect(meilleureValeur([0, 12, null], 'min')).toBe(0);
  });

  it('égalité, ou moins de 2 valeurs connues : aucune', () => {
    expect(meilleureValeur([8, 8, 6], 'max')).toBeNull();
    expect(meilleureValeur([150000000, null, null], 'max')).toBeNull();
  });
});
