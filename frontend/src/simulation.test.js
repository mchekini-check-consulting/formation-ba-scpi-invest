import { describe, expect, it } from 'vitest';
import { formatDuree, formatEuros, formatPourcent, simuler } from './simulation';

const sansEspaceSpecial = (valeur) => valeur.replace(/\s/g, ' ');

describe('simuler', () => {
  it('calcule le capital investi après frais et les revenus bruts', () => {
    expect(simuler({ montant: 10000, taux: 6, frais: 8, duree: 5 })).toEqual({
      net: 9200,
      mensuel: 50,
      cumul: 3000,
    });
  });

  it('ne retire rien quand il n’y a pas de frais', () => {
    expect(simuler({ montant: 5000, taux: 4, frais: 0, duree: 1 }).net).toBe(5000);
  });
});

describe('formats', () => {
  it('affiche les euros sans centimes', () => {
    expect(sansEspaceSpecial(formatEuros(12345.6))).toBe('12 346 €');
  });

  it('affiche les pourcentages avec une décimale', () => {
    expect(sansEspaceSpecial(formatPourcent(4.5))).toBe('4,5 %');
  });

  it('accorde la durée au singulier et au pluriel', () => {
    expect(formatDuree(1)).toBe('1 an');
    expect(formatDuree(12)).toBe('12 ans');
  });
});
