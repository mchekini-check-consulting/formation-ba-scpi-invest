import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ETAT_INITIAL, memoriserEtat, oublierEtat, relireEtat } from './etat.js';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('Catalogue : page, tri et recherche gardés (US-02, règle 7)', () => {
  it('gardés puis relus, effacés à la déconnexion', () => {
    memoriserEtat({ page: 2, tri: 'nom-asc', saisie: 'pier' });
    expect(relireEtat()).toEqual({ page: 2, tri: 'nom-asc', saisie: 'pier' });
    oublierEtat();
    expect(relireEtat()).toEqual(ETAT_INITIAL);
  });

  it('valeur gardée invalide ou illisible : état initial', () => {
    for (const valeur of [
      '{',
      'null',
      JSON.stringify({ page: 0, tri: 'nom-asc', saisie: '' }),
      JSON.stringify({ page: 1, tri: 'inconnu', saisie: '' }),
      JSON.stringify({ page: 1, tri: 'nom-asc', saisie: 3 }),
    ]) {
      sessionStorage.setItem('scpi-invest.catalogue.etat', valeur);
      expect(relireEtat()).toEqual(ETAT_INITIAL);
    }
  });

  it('stockage indisponible (navigation privée) : aucune erreur', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('indisponible');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('indisponible');
    });
    expect(() => memoriserEtat(ETAT_INITIAL)).not.toThrow();
    expect(() => oublierEtat()).not.toThrow();
  });
});
