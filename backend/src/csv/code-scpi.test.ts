import { describe, expect, it } from 'vitest';
import { attribuerCode, attribuerCodes, codeCandidat, FORMAT_CODE } from './code-scpi.js';

describe('code candidat de la SCPI', () => {
  it.each([
    ['Iroko Zen', 'IRZE'],
    ['Coeur de Ville', 'COVI'],
    ["Coeur d'Avenir", 'COAV'],
    ['Foncière des Praticiens', 'FOPR'],
    ['Upéka', 'UPEK'],
    ['Comète', 'COME'],
    ['Novapierre 1', 'NOVA'],
    ['Log In', 'LOIN'],
    ["Cap'HebergImmo", 'CAHE'],
    ['SCPI Primovie', 'PRIM'],
  ])('%s -> %s', (nom, code) => {
    expect(codeCandidat(nom)).toBe(code);
  });

  it('nom trop court : complété par X ; sans lettre : XXXX', () => {
    expect(codeCandidat('Zo')).toBe('ZOXX');
    expect(codeCandidat('A B')).toBe('ABXX');
    expect(codeCandidat('360')).toBe('XXXX');
  });

  it('même nom, même code', () => {
    expect(codeCandidat('Iroko Zen')).toBe(codeCandidat('iroko  zen'));
  });
});

describe('attribution d’un code libre', () => {
  it('candidat libre : gardé', () => {
    expect(attribuerCode('Epargne Pierre', new Set(['COVI']))).toBe('EPPI');
  });

  it('candidat pris : 4e lettre suivante du nom', () => {
    expect(attribuerCode('Epargne Pierre Europe', new Set(['EPPI']))).toBe('EPPE');
    expect(attribuerCode('Primopierre', new Set(['PRIM']))).toBe('PRIO');
  });

  it('lettres du nom épuisées : A à Z, puis 2 lettres + AA à ZZ', () => {
    expect(attribuerCode('Zo', new Set(['ZOXX']))).toBe('ZOXA');
    const zoxPris = new Set([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((l) => `ZOX${l}`));
    expect(attribuerCode('Zo', zoxPris)).toBe('ZOAA');
  });

  it('aucun code libre : erreur', () => {
    const tous = new Set<string>();
    for (const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      for (const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') tous.add(`ZO${a}${b}`);
    }
    expect(() => attribuerCode('Zo', tous)).toThrow('aucun code libre');
  });
});

describe('attribution de plusieurs codes', () => {
  it('par ordre alphabétique, quel que soit l’ordre du fichier, sans doublon', () => {
    const pris = new Set(['IRZE']);
    const codes = attribuerCodes(['Primovie', 'Primopierre', 'Primofamily', 'Iroko Zen 2'], pris);
    expect(Object.fromEntries(codes)).toEqual({
      Primofamily: 'PRIM',
      Primopierre: 'PRIO',
      Primovie: 'PRIV',
      'Iroko Zen 2': 'IRZN',
    });
    expect(pris).toEqual(new Set(['IRZE', 'PRIM', 'PRIO', 'PRIV', 'IRZN']));
    for (const code of codes.values()) expect(code).toMatch(FORMAT_CODE);
  });
});
