import { describe, expect, it } from 'vitest';
import { PAYS, filtrerPays, normaliser, paysParCode, paysParNom } from './pays.js';

describe('liste des pays (nationalité)', () => {
  it('noms en français, France en tête puis ordre alphabétique, sans territoire inhabité', () => {
    expect(PAYS.length).toBeGreaterThan(200);
    expect(PAYS[0]).toEqual({ code: 'FR', nom: 'France', indicatif: '33' });
    expect(PAYS[1]).toEqual({ code: 'AF', nom: 'Afghanistan', indicatif: '93' });
    expect(paysParNom('france')).toEqual({ code: 'FR', nom: 'France', indicatif: '33' });
    expect(paysParCode('IT').nom).toBe('Italie');
    expect(paysParCode('Italie')).toBeNull();
    expect(paysParNom('Antarctique')).toBeNull();
    expect(paysParNom(undefined)).toBeNull();
  });

  it('recherche sans accents, ceux qui commencent par le texte en premier', () => {
    expect(normaliser(' Élysée ')).toBe('elysee');
    expect(filtrerPays('').length).toBe(PAYS.length);
    expect(filtrerPays('etats').map((p) => p.nom)[0]).toMatch(/^État/);
    expect(filtrerPays('ital').map((p) => p.nom)).toEqual(['Italie']);
    expect(filtrerPays('zzz')).toEqual([]);
  });
});
