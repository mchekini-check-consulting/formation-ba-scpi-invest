import { describe, expect, it } from 'vitest';
import {
  chiffresCodePostal,
  chiffresNationaux,
  codePostalValide,
  filtrerCodePostal,
  filtrerTelephone,
  messageCodePostal,
  telephoneValide,
} from './coordonnees.js';

describe('code postal selon le pays', () => {
  it('pays à code numérique : nombre de chiffres attendu', () => {
    expect(chiffresCodePostal('France')).toBe(5);
    expect(chiffresCodePostal('belgique')).toBe(4);
    expect(chiffresCodePostal('Royaume-Uni')).toBeNull();
    expect(chiffresCodePostal('')).toBeNull();
    expect(chiffresCodePostal(undefined)).toBeNull();
  });

  it('frappe : lettres retirées et longueur limitée pour un pays à code numérique', () => {
    expect(filtrerCodePostal('69a00 3', 'France')).toBe('69003');
    expect(filtrerCodePostal('7500812', 'France')).toBe('75008');
    expect(filtrerCodePostal('B-1000', 'Belgique')).toBe('1000');
  });

  it('frappe : lettres gardées (en majuscules) pour les autres pays', () => {
    expect(filtrerCodePostal('sw1a 1aa!', 'Royaume-Uni')).toBe('SW1A 1AA');
    expect(filtrerCodePostal('1012 ab', 'Pays-Bas')).toBe('1012 AB');
    expect(filtrerCodePostal('h2x 1y4 extra long', '')).toBe('H2X 1Y4 EX');
  });

  it('contrôle : longueur exacte en chiffres, sinon format libre avec au moins un chiffre', () => {
    expect(codePostalValide('69003', 'France')).toBe(true);
    expect(codePostalValide('6900', 'France')).toBe(false);
    expect(codePostalValide('1000', 'Belgique')).toBe(true);
    expect(codePostalValide('SW1A 1AA', 'Royaume-Uni')).toBe(true);
    expect(codePostalValide('ABC', 'Royaume-Uni')).toBe(false);
    expect(messageCodePostal('France')).toBe(
      'Code postal invalide : 5 chiffres attendus pour ce pays.',
    );
    expect(messageCodePostal('Canada')).toContain('lettres, chiffres');
  });
});

describe('téléphone selon l’indicatif', () => {
  it('frappe : seulement chiffres et espaces', () => {
    expect(filtrerTelephone('06.12-34 ab56 78')).toBe('061234 56 78');
    expect(filtrerTelephone('+32 470 12 34 56')).toBe('32 470 12 34 56');
    expect(filtrerTelephone('0'.repeat(30))).toHaveLength(20);
  });

  it('nombre de chiffres attendu pour le pays de l’indicatif (0 initial non compté)', () => {
    expect(telephoneValide('06 12 34 56 78', 'France')).toBe(true);
    expect(telephoneValide('6 12 34 56 78', 'France')).toBe(true);
    expect(telephoneValide('0033 6 12 34 56 78', 'France')).toBe(true);
    expect(telephoneValide('06 12 34 56', 'France')).toBe(false);
    expect(telephoneValide('0470 12 34 56', 'Belgique')).toBe(true);
    expect(telephoneValide('0470 12 34 56', 'États-Unis')).toBe(false);
    expect(telephoneValide('06 12 34 56 78', 'Italie')).toBe(true); // le 0 compte en Italie
    expect(telephoneValide('1234', 'Islande')).toBe(true); // autre pays : 4 à 14 chiffres
    expect(telephoneValide('123', 'Islande')).toBe(false);
  });

  it('autre caractère que chiffres et espaces : refusé', () => {
    expect(telephoneValide('01.46.00.12.34', 'France')).toBe(false);
    expect(telephoneValide('+33 6 12 34 56 78', 'France')).toBe(false);
    expect(chiffresNationaux('06 12', 'France')).toBe('612');
  });
});
