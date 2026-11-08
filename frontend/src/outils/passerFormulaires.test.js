import { describe, expect, it } from 'vitest';
import { formulairesPassables } from './passerFormulaires.js';

describe('raccourci « passer les formulaires »', () => {
  it('actif sur le poste quand la variable vaut true', () => {
    expect(formulairesPassables({ DEV: true, VITE_PASSER_FORMULAIRES: 'true' })).toBe(true);
  });

  it('inactif sans la variable ou avec une autre valeur', () => {
    expect(formulairesPassables({ DEV: true })).toBe(false);
    expect(formulairesPassables({ DEV: true, VITE_PASSER_FORMULAIRES: 'false' })).toBe(false);
  });

  it('jamais actif dans une image construite (dev, qualif, preprod, prod)', () => {
    expect(formulairesPassables({ DEV: false, VITE_PASSER_FORMULAIRES: 'true' })).toBe(false);
  });

  it('par défaut : inactif dans les tests', () => {
    expect(formulairesPassables()).toBe(false);
  });
});
