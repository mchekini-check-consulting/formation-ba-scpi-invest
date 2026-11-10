import { describe, expect, it } from 'vitest';
import { GROUPES_TRI, OPTIONS_TRI, TRI_PAR_DEFAUT, libelleTri, parametreTri } from './tri.js';

describe('Tri du Catalogue (US-11)', () => {
  it('6 critères dans les deux sens, taux décroissant en premier (par défaut)', () => {
    expect(OPTIONS_TRI).toHaveLength(12);
    expect(OPTIONS_TRI[0]).toMatchObject({ valeur: TRI_PAR_DEFAUT, court: 'Décroissant' });
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

  it('6 groupes de 2 sens pour le menu ; libellé d’un tri, défaut si inconnu', () => {
    expect(GROUPES_TRI.map((g) => g.titre)).toEqual([
      'Taux de distribution',
      'Capitalisation',
      'Zone géographique',
      'Catégorie',
      'Société de gestion',
      'Nom',
    ]);
    expect(GROUPES_TRI[5].options.map((o) => o.court)).toEqual(['A → Z', 'Z → A']);
    expect(libelleTri('nom-desc')).toBe('Nom Z → A');
    expect(libelleTri('inconnu')).toBe('Taux de distribution — décroissant');
  });

  it('paramètre de l’URL : absent pour le tri par défaut', () => {
    expect(parametreTri(TRI_PAR_DEFAUT)).toBe('');
    expect(parametreTri(undefined)).toBe('');
    expect(parametreTri('nom-asc')).toBe('tri=nom-asc');
  });
});
