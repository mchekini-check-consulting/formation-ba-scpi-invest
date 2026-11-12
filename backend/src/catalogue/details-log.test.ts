import { describe, expect, it } from 'vitest';
import { LONGUEUR_MAX, borner, detailsCatalogue } from './details-log.js';
import { AUCUN_FILTRE } from './filtres.js';
import { TRI_PAR_DEFAUT } from './tri.js';

describe('detailsCatalogue', () => {
  it('aucun filtre : le tri seulement', () => {
    expect(detailsCatalogue(AUCUN_FILTRE, TRI_PAR_DEFAUT)).toEqual({ tri: 'taux-desc' });
  });

  it('filtres actifs : listes et bornes lisibles', () => {
    const details = detailsCatalogue(
      {
        ...AUCUN_FILTRE,
        categories: ['Santé', 'Bureaux'],
        pays: ['France'],
        gerants: ['Gestion & Co'],
        capitalisations: ['moins-100m'],
        taux: { min: 4, max: 6 },
        prix: { min: 200, max: null },
        frais: { min: null, max: 10 },
      },
      { critere: 'nom', sens: 'asc' },
    );
    expect(details).toEqual({
      categories: 'Santé,Bureaux',
      pays: 'France',
      gerants: 'Gestion & Co',
      capitalisations: 'moins-100m',
      taux: '4 à 6',
      prix: '≥ 200',
      frais: '≤ 10',
      tri: 'nom-asc',
    });
  });

  it('texte libre borné', () => {
    expect(borner('x'.repeat(500))).toHaveLength(LONGUEUR_MAX);
    const details = detailsCatalogue(
      { ...AUCUN_FILTRE, categories: ['y'.repeat(500)] },
      TRI_PAR_DEFAUT,
    );
    expect(details.categories).toHaveLength(LONGUEUR_MAX);
  });
});
