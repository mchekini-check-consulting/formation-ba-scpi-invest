import { describe, expect, it } from 'vitest';
import { classeEntree } from './transitions.js';

describe('classeEntree', () => {
  it('fiche d’une SCPI : affichée sans animation', () => {
    expect(classeEntree('/catalogue/12')).toBe('fiche-entre');
    expect(classeEntree('/catalogue/12/')).toBe('fiche-entre');
  });

  it('autres écrans, Catalogue compris : fondu', () => {
    expect(classeEntree('/catalogue')).toBe('ecran-entre');
    expect(classeEntree('/investir/12')).toBe('ecran-entre');
    expect(classeEntree('/')).toBe('ecran-entre');
  });
});
