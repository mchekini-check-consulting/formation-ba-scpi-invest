import { describe, expect, it } from 'vitest';
import { REGLES, emailValide, reglesNonRespectees } from './mot-de-passe.js';

describe('reglesNonRespectees', () => {
  it('mot de passe conforme : aucune règle signalée', () => {
    expect(reglesNonRespectees('Tr0pBien!Choisi', 'jean.dupont@exemple.fr')).toEqual([]);
  });

  it('signale chaque règle manquante', () => {
    expect(reglesNonRespectees('')).toEqual([
      REGLES.longueur,
      REGLES.majuscule,
      REGLES.minuscule,
      REGLES.chiffre,
      REGLES.special,
    ]);
    expect(reglesNonRespectees('abcdefghijk1!')).toEqual([REGLES.majuscule]);
    expect(reglesNonRespectees('ABCDEFGHIJK1!')).toEqual([REGLES.minuscule]);
    expect(reglesNonRespectees('Abcdefghijkl!')).toEqual([REGLES.chiffre]);
    expect(reglesNonRespectees('Abcdefghijk12')).toEqual([REGLES.special]);
    expect(reglesNonRespectees('Xyz1!')).toEqual([REGLES.longueur]);
  });

  it('refuse les espaces', () => {
    expect(reglesNonRespectees('Tr0p Bien!Choisi')).toEqual([REGLES.espace]);
  });

  it('refuse l’email ou l’identifiant de l’email', () => {
    expect(reglesNonRespectees('Xjean.dupont1!', 'Jean.Dupont@exemple.fr')).toEqual([REGLES.email]);
    expect(reglesNonRespectees('Jd@ex.fr!Abcd12', 'jd@ex.fr')).toEqual([REGLES.email]);
    // identifiant trop court pour être significatif
    expect(reglesNonRespectees('Tr0pBien!Choisijd', 'jd@exemple.fr')).toEqual([]);
  });

  it('refuse les mots de passe trop courants', () => {
    expect(reglesNonRespectees('Azerty123456!')).toEqual([REGLES.courant]);
    expect(reglesNonRespectees('MotDePasse2026#')).toEqual([REGLES.courant]);
  });
});

describe('emailValide', () => {
  it('accepte un email complet', () => {
    expect(emailValide('jean@exemple.fr')).toBe(true);
  });

  it('refuse un email sans @, sans domaine ou avec espace', () => {
    expect(emailValide('jean.exemple.fr')).toBe(false);
    expect(emailValide('jean@exemple')).toBe(false);
    expect(emailValide('jean @exemple.fr')).toBe(false);
  });
});
