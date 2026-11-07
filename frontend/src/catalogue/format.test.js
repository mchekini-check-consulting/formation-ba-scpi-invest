import { describe, expect, it } from 'vitest';
import {
  NON_COMMUNIQUE,
  SEGMENTS,
  formaterCapitalisation,
  formaterDate,
  formaterTaux,
  formaterTexte,
  segmentsPleins,
} from './format.js';

const sansEspace = (texte) => texte.replaceAll(' ', ' ');

describe('mise en forme du Catalogue (US-08)', () => {
  it('taux de distribution en %, à 2 décimales', () => {
    expect(sansEspace(formaterTaux(5.1))).toBe('5,10 %');
    expect(sansEspace(formaterTaux(0))).toBe('0,00 %');
  });

  it('capitalisation en Md€, M€ ou €', () => {
    expect(sansEspace(formaterCapitalisation(1250000000))).toBe('1,25 Md€');
    expect(sansEspace(formaterCapitalisation(289000000))).toBe('289 M€');
    expect(sansEspace(formaterCapitalisation(850000))).toBe('850 000 €');
  });

  it('jauge : segments pleins arrondis au % le plus proche, de 0 à 10', () => {
    expect(SEGMENTS).toBe(10);
    expect(segmentsPleins(8.35)).toBe(8);
    expect(segmentsPleins(2.6)).toBe(3);
    expect(segmentsPleins(12.4)).toBe(10);
    expect(segmentsPleins(-1)).toBe(0);
    expect(segmentsPleins(null)).toBe(0);
  });

  it('texte et date', () => {
    expect(formaterTexte('Bureaux')).toBe('Bureaux');
    expect(formaterDate('2026-11-05T02:00:00.000Z')).toBe('05/11/2026');
  });

  it('donnée non renseignée : « N/C », jamais 0', () => {
    for (const formater of [formaterTaux, formaterCapitalisation, formaterTexte, formaterDate]) {
      expect(formater(null)).toBe(NON_COMMUNIQUE);
      expect(formater(undefined)).toBe('N/C');
      expect(formater('')).toBe('N/C');
    }
  });
});
