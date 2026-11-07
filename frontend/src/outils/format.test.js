import { describe, expect, it } from 'vitest';
import { dateHeure, duree, dureeEntre, nombre, ouiNon, relatif, taille, VIDE } from './format.js';

const MAINTENANT = new Date('2026-11-06T13:33:00Z');

describe('mise en forme de l’outil de test', () => {
  it('dateHeure : jour et heure à la seconde, heure de Paris', () => {
    expect(dateHeure('2026-11-06T13:33:05Z')).toBe('06/11/2026 14:33:05');
    expect(dateHeure(Date.parse('2026-07-01T10:00:00Z'))).toBe('01/07/2026 12:00:00');
    expect(dateHeure(null)).toBe(VIDE);
    expect(dateHeure('pas une date')).toBe(VIDE);
  });

  it.each([
    ['2026-11-06T13:32:30Z', 'il y a 30 s'],
    ['2026-11-06T13:30:00Z', 'il y a 3 min'],
    ['2026-11-06T10:33:00Z', 'il y a 3 h'],
    ['2026-11-04T13:33:00Z', 'il y a 2 j'],
    ['2026-11-07T01:00:00Z', 'dans 11 h'],
  ])('relatif %s -> %s', (iso, attendu) => {
    expect(relatif(iso, MAINTENANT)).toBe(attendu);
  });

  it('relatif : sans date ou date illisible, rien', () => {
    expect(relatif(null, MAINTENANT)).toBe('');
    expect(relatif('x', MAINTENANT)).toBe('');
  });

  it('relatif : maintenant par défaut', () => {
    expect(relatif(new Date(Date.now() + 120_000).toISOString())).toBe('dans 2 min');
  });

  it('duree : ms, s, min', () => {
    expect(duree(350)).toBe('350 ms');
    expect(duree(1250)).toBe('1,3 s');
    expect(duree(125_000)).toBe('2 min 5 s');
    expect(duree(null)).toBe(VIDE);
    expect(duree(undefined)).toBe(VIDE);
    expect(duree(Number.NaN)).toBe(VIDE);
  });

  it('dureeEntre : de debut à fin', () => {
    expect(dureeEntre('2026-11-06T13:33:00Z', '2026-11-06T13:33:02.500Z')).toBe('2,5 s');
    expect(dureeEntre('2026-11-06T13:33:00Z', null)).toBe(VIDE);
    expect(dureeEntre(null, '2026-11-06T13:33:00Z')).toBe(VIDE);
  });

  it('taille : o, Ko, Mo', () => {
    expect(taille(512)).toBe('512 o');
    expect(taille(48 * 1024)).toBe('48 Ko');
    expect(taille(3.5 * 1024 * 1024)).toBe('3,5 Mo');
    expect(taille(null)).toBe(VIDE);
    expect(taille(undefined)).toBe(VIDE);
  });

  it('nombre : séparateurs français, texte gardé tel quel', () => {
    expect(nombre(150000000).replace(/\s/g, ' ')).toBe('150 000 000');
    expect(nombre('5.1')).toBe('5,1');
    expect(nombre('abc')).toBe('abc');
    expect(nombre(null)).toBe(VIDE);
    expect(nombre('')).toBe(VIDE);
  });

  it('ouiNon', () => {
    expect(ouiNon(true)).toBe('Oui');
    expect(ouiNon(false)).toBe('Non');
    expect(ouiNon(null)).toBe(VIDE);
  });
});
