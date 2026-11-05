import { describe, expect, it } from 'vitest';
import {
  adresseValide,
  chiffresNationaux,
  codePostalValide,
  exempleCodePostal,
  sansCodePostal,
  telephoneValide,
  villeValide,
} from './coordonnees.js';
import { PAYS, indicatifDe, nomPays, paysConnu } from './pays.js';

describe('liste des pays', () => {
  it('France en tête, puis ordre alphabétique, noms en français', () => {
    expect(PAYS[0]).toEqual({ code: 'FR', nom: 'France', indicatif: '33' });
    const noms = PAYS.slice(1).map((p) => p.nom);
    expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
    expect(PAYS.length).toBeGreaterThan(230);
    expect(nomPays('DE')).toBe('Allemagne');
    expect(nomPays('MA')).toBe('Maroc');
  });

  it('codes connus, indicatifs, ancienne saisie libre', () => {
    expect(paysConnu('BE')).toBe(true);
    expect(paysConnu('jqgdgdv')).toBe(false);
    expect(paysConnu(undefined)).toBe(false);
    expect(indicatifDe('BE')).toBe('32');
    expect(indicatifDe('US')).toBe('1');
    expect(indicatifDe('ZZ')).toBe('');
    expect(nomPays('Belgique')).toBe('Belgique');
    expect(nomPays(undefined)).toBe('');
  });
});

describe('code postal selon le pays', () => {
  it.each([
    ['FR', '75008', true],
    ['FR', '20000', true], // Corse
    ['FR', '97400', true], // La Réunion
    ['FR', '7500', false],
    ['FR', '00100', false],
    ['FR', '96000', false],
    ['FR', 'ABCDE', false],
    ['BE', '1000', true],
    ['BE', '0999', false],
    ['CH', '1201', true],
    ['LU', 'L-1009', true],
    ['GB', 'SW1A 1AA', true],
    ['GB', 'sw1a 1aa', true], // minuscules acceptées
    ['GB', '12345', false],
    ['CA', 'H2X 1Y4', true],
    ['NL', '1012 AB', true],
    ['PT', '1100-148', true],
    ['PT', '1100', false],
    ['US', '10001-1234', true],
    ['MA', '20000', true],
    ['ZZ', 'AB-123', true], // pays sans format connu : règle générale
    ['ZZ', 'ABCDEF', false], // pas de chiffre
    ['ZZ', 'jqgdgdv', false],
  ])('%s %s -> %s', (pays, code, attendu) => {
    expect(codePostalValide(code, pays)).toBe(attendu);
  });

  it('pays sans code postal et exemples', () => {
    expect(sansCodePostal('AE')).toBe(true);
    expect(sansCodePostal('FR')).toBe(false);
    expect(exempleCodePostal('CA')).toBe('H2X 1Y4');
    expect(exempleCodePostal('ZZ')).toBeNull();
  });
});

describe('téléphone selon l’indicatif', () => {
  it.each([
    ['FR', '06 12 34 56 78', true],
    ['FR', '6 12 34 56 78', true],
    ['FR', '01.46.00.12.34', true],
    ['FR', '+33 6 12 34 56 78', true], // indicatif retapé : retiré
    ['FR', '0033 6 12 34 56 78', true],
    ['FR', '06 12 34', false],
    ['FR', '06 12 34 56 78 90', false],
    ['FR', '06 12 AB 56 78', false],
    ['BE', '0470 12 34 56', true],
    ['MA', '0612 345 678', true],
    ['US', '(212) 555-0100', true],
    ['US', '555-0100', false],
    ['IT', '06 1234 5678', true], // le 0 fait partie du numéro en Italie
    ['ZZ', '1234567890123456', false],
    ['NG', '0803 123 4567', true], // pays sans règle propre : 4 à 14 chiffres
  ])('%s %s -> %s', (pays, numero, attendu) => {
    expect(telephoneValide(numero, pays)).toBe(attendu);
  });

  it('chiffres nationaux : indicatif et 0 initial retirés', () => {
    expect(chiffresNationaux('+33 6 12 34 56 78', 'FR')).toBe('612345678');
    expect(chiffresNationaux('06 12 34 56 78', 'FR')).toBe('612345678');
    expect(chiffresNationaux('06 1234 5678', 'IT')).toBe('0612345678');
  });
});

describe('adresse et ville', () => {
  it.each([
    ['12 rue des Lilas', true],
    ['Lieu-dit Les Granges', true],
    ['3, avenue Foch', true],
    ['Apt 4B, 221B Baker Street', true],
    ['jqgdgdv', false], // un seul mot
    ['12 34', false], // pas de lettre
    ['ab', false],
    ['12 rue <script>', false],
  ])('adresse « %s » -> %s', (adresse, attendu) => {
    expect(adresseValide(adresse)).toBe(attendu);
  });

  it.each([
    ['Lyon', true],
    ['Saint-Étienne', true],
    ['L’Haÿ-les-Roses', true],
    ['Paris 15', true],
    ['123', false],
    ['a', false],
    ['Lyon!', false],
  ])('ville « %s » -> %s', (ville, attendu) => {
    expect(villeValide(ville)).toBe(attendu);
  });
});
