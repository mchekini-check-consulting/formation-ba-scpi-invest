import { describe, expect, it } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { CRITERES_TRI, TRI_PAR_DEFAUT, lireTri } from './tri.js';

describe('Tri du Catalogue (US-11)', () => {
  it('scénario 1 : sans tri choisi, taux N-1 décroissant', () => {
    expect(lireTri(undefined)).toEqual({ critere: 'taux', sens: 'desc' });
    expect(lireTri('')).toBe(TRI_PAR_DEFAUT);
  });

  it('6 critères, chacun dans les deux sens', () => {
    expect(CRITERES_TRI).toEqual(['taux', 'capitalisation', 'pays', 'secteur', 'gerant', 'nom']);
    for (const critere of CRITERES_TRI) {
      expect(lireTri(`${critere}-asc`)).toEqual({ critere, sens: 'asc' });
      expect(lireTri(`${critere}-desc`)).toEqual({ critere, sens: 'desc' });
    }
  });

  it.each([['inconnu-asc'], ['taux'], ['taux-haut'], ['taux-asc-desc'], [['taux-asc']], [3]])(
    'tri %j invalide -> 400',
    (brut) => {
      let erreur: unknown;
      try {
        lireTri(brut);
      } catch (e) {
        erreur = e;
      }
      expect(erreur).toBeInstanceOf(HttpError);
      expect(erreur).toMatchObject({ status: 400, message: 'Tri invalide' });
    },
  );
});
