import { describe, expect, it } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { AUCUN_FILTRE, lireFiltres } from './filtres.js';

function erreur(requete: Record<string, unknown>): unknown {
  try {
    lireFiltres(requete);
  } catch (e) {
    return e;
  }
  return null;
}

describe('filtres du Catalogue lus dans l’URL (US-10a, US-10b)', () => {
  it('aucun filtre : rien n’est restreint', () => {
    expect(lireFiltres()).toEqual(AUCUN_FILTRE);
    expect(lireFiltres({ categorie: '', tauxMin: '' })).toEqual(AUCUN_FILTRE);
  });

  it('choix multiples : valeur seule ou répétée, sans doublon ni espace autour', () => {
    expect(
      lireFiltres({
        categorie: ['Santé', ' Bureaux ', 'Santé'],
        pays: 'France',
        gerant: ['Gestion & Co', ''],
        capitalisation: ['moins-100m', 'plus-3md'],
      }),
    ).toMatchObject({
      categories: ['Santé', 'Bureaux'],
      pays: ['France'],
      gerants: ['Gestion & Co'],
      capitalisations: ['moins-100m', 'plus-3md'],
    });
  });

  it('plages numériques : minimum et maximum, l’un sans l’autre possible', () => {
    expect(
      lireFiltres({
        tauxMin: '4',
        tauxMax: '6.5',
        prixMax: '300',
        fraisMin: '0',
        minimumMin: '1000',
        minimumMax: '1000',
      }),
    ).toMatchObject({
      taux: { min: 4, max: 6.5 },
      prix: { min: null, max: 300 },
      frais: { min: 0, max: null },
      minimum: { min: 1000, max: 1000 },
    });
  });

  it.each([
    { tauxMin: 'abc' },
    { prixMax: ['1', '2'] },
    { fraisMin: 'Infinity' },
    { tauxMin: '6', tauxMax: '4' },
    { capitalisation: 'enorme' },
  ])('filtre invalide %o -> 400 « Filtre invalide »', (requete) => {
    const err = erreur(requete);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 400, message: 'Filtre invalide' });
  });
});
