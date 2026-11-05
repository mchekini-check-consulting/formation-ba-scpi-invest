import { describe, expect, it } from 'vitest';
import { PAYS, filtrerPays, normaliser, paysParNom } from './pays.js';

describe('liste des pays (nationalité)', () => {
  it('noms en français, triés, sans territoire inhabité', () => {
    expect(PAYS.length).toBeGreaterThan(200);
    expect(PAYS[0]).toEqual({ code: 'af', nom: 'Afghanistan' });
    expect(paysParNom('france')).toEqual({ code: 'fr', nom: 'France' });
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
