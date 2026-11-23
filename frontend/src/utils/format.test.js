import { describe, expect, it } from 'vitest';
import { formaterEuros, formaterMontantCalcule, formaterTaux, NON_COMMUNIQUE } from './format.js';

// Les espaces (milliers, avant € et %) sont insécables : on les compare comme des espaces
const texte = (valeur) => valeur.replace(/\s/g, ' ');

describe('Mise en forme commune (C4)', () => {
  it('montant : décimales seulement s’il n’est pas rond', () => {
    expect(texte(formaterEuros(1090))).toBe('1 090 €');
    expect(texte(formaterEuros(2085.5))).toBe('2 085,50 €');
    expect(texte(formaterEuros('1135.00'))).toBe('1 135 €');
  });

  it('montant calculé : toujours deux décimales', () => {
    expect(texte(formaterMontantCalcule(800))).toBe('800,00 €');
    expect(texte(formaterMontantCalcule(4175))).toBe('4 175,00 €');
    expect(texte(formaterMontantCalcule(549.34))).toBe('549,34 €');
  });

  it('taux : deux décimales', () => {
    expect(texte(formaterTaux(8.35))).toBe('8,35 %');
    expect(texte(formaterTaux(0))).toBe('0,00 %');
  });

  it('donnée absente : « Non communiqué », jamais 0', () => {
    for (const formater of [formaterEuros, formaterMontantCalcule, formaterTaux]) {
      expect(formater(null)).toBe(NON_COMMUNIQUE);
      expect(formater(undefined)).toBe(NON_COMMUNIQUE);
      expect(formater('')).toBe(NON_COMMUNIQUE);
    }
  });
});
