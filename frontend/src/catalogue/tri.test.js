import { describe, expect, it } from 'vitest';
import { OPTIONS_TRI, TRI_PAR_DEFAUT, parametreTri } from './tri.js';

describe('Tri du Catalogue (US-11)', () => {
  it('6 critères dans les deux sens, taux décroissant en premier (par défaut)', () => {
    expect(OPTIONS_TRI).toHaveLength(12);
    expect(OPTIONS_TRI[0]).toEqual({ valeur: TRI_PAR_DEFAUT, libelle: expect.any(String) });
    const criteres = new Set(OPTIONS_TRI.map((o) => o.valeur.split('-')[0]));
    expect([...criteres]).toEqual(['taux', 'capitalisation', 'pays', 'secteur', 'gerant', 'nom']);
    for (const critere of criteres) {
      const sens = OPTIONS_TRI.filter((o) => o.valeur.startsWith(`${critere}-`)).map(
        (o) => o.valeur.split('-')[1],
      );
      expect(sens.sort()).toEqual(['asc', 'desc']);
    }
  });

  it('libellés de la story : « Capitalisation — croissant », « Nom A → Z »', () => {
    const libelles = OPTIONS_TRI.map((o) => o.libelle);
    expect(libelles).toContain('Capitalisation — croissant');
    expect(libelles).toContain('Nom A → Z');
  });

  it('paramètre de l’URL : absent pour le tri par défaut', () => {
    expect(parametreTri(TRI_PAR_DEFAUT)).toBe('');
    expect(parametreTri(undefined)).toBe('');
    expect(parametreTri('nom-asc')).toBe('tri=nom-asc');
  });
});
