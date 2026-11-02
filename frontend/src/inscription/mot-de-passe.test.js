import { describe, expect, it } from 'vitest';
import { emailValide, reglesNonRespectees } from './mot-de-passe.js';

// Mêmes cas que backend/src/comptes/mot-de-passe.test.ts
describe('reglesNonRespectees', () => {
  it('mot de passe conforme', () => {
    expect(reglesNonRespectees('Tr0pBien!Choisi', 'jean.dupont@exemple.fr')).toEqual([]);
  });

  it('chaque règle manquante', () => {
    expect(reglesNonRespectees('')).toEqual([
      'longueur',
      'majuscule',
      'minuscule',
      'chiffre',
      'special',
    ]);
    expect(reglesNonRespectees('Tr0p Bien!Choisi')).toEqual(['espace']);
    expect(reglesNonRespectees('Xjean.dupont1!', 'Jean.Dupont@exemple.fr')).toEqual(['email']);
    expect(reglesNonRespectees('Jd@ex.fr!Abcd12', 'jd@ex.fr')).toEqual(['email']);
    expect(reglesNonRespectees('Tr0pBien!Choisijd', 'jd@exemple.fr')).toEqual([]);
    expect(reglesNonRespectees('Azerty123456!')).toEqual(['courant']);
  });
});

describe('emailValide', () => {
  it('format attendu : texte@domaine.extension', () => {
    expect(emailValide(' jean@exemple.fr ')).toBe(true);
    expect(emailValide('jean.exemple.fr')).toBe(false);
    expect(emailValide('jean@exemple')).toBe(false);
  });
});
