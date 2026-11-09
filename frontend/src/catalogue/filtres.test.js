import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FILTRES_VIDES,
  basculer,
  changerPlage,
  memoriserFiltres,
  oublierFiltres,
  parametresFiltres,
  pastilles,
  relireFiltres,
} from './filtres.js';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

const OPTIONS = { capitalisations: [{ code: 'plus-3md', libelle: 'Plus de 3 Md€' }] };

describe('filtres du Catalogue (US-10)', () => {
  it('aucun filtre : aucun paramètre, aucune pastille', () => {
    expect(parametresFiltres(FILTRES_VIDES)).toBe('');
    expect(pastilles(FILTRES_VIDES, OPTIONS)).toEqual([]);
  });

  it('paramètres : valeurs répétées pour les choix multiples, bornes des plages', () => {
    const filtres = {
      ...FILTRES_VIDES,
      categories: ['Santé', 'Bureaux'],
      gerants: ['Gestion & Co'],
      capitalisations: ['plus-3md'],
      taux: { min: 4, max: 6.5 },
      minimum: { min: null, max: 1000 },
    };
    const parametres = new URLSearchParams(parametresFiltres(filtres));
    expect(parametres.getAll('categorie')).toEqual(['Santé', 'Bureaux']);
    expect(Object.fromEntries(parametres)).toMatchObject({
      gerant: 'Gestion & Co',
      capitalisation: 'plus-3md',
      tauxMin: '4',
      tauxMax: '6.5',
      minimumMax: '1000',
    });
  });

  it('basculer : ajoute puis retire une valeur', () => {
    const avec = basculer(FILTRES_VIDES, 'pays', 'France');
    expect(avec.pays).toEqual(['France']);
    expect(basculer(avec, 'pays', 'France').pays).toEqual([]);
  });

  it('changerPlage : une borne laissée à l’extrémité du curseur ne filtre pas', () => {
    const bornes = { min: 2, max: 9 };
    expect(changerPlage(FILTRES_VIDES, 'taux', { min: 2, max: 9 }, bornes).taux).toEqual({
      min: null,
      max: null,
    });
    expect(changerPlage(FILTRES_VIDES, 'taux', { min: 4, max: null }, bornes).taux).toEqual({
      min: 4,
      max: null,
    });
  });

  it('pastilles : une par valeur et une par plage, libellés lisibles, retrait individuel', () => {
    const filtres = {
      ...FILTRES_VIDES,
      categories: ['Santé'],
      capitalisations: ['plus-3md'],
      taux: { min: 4, max: 6.5 },
      prix: { min: 200, max: null },
      frais: { min: null, max: 8 },
    };
    const liste = pastilles(filtres, OPTIONS);
    expect(liste.map((p) => p.libelle.replaceAll(' ', ' '))).toEqual([
      'Santé',
      'Plus de 3 Md€',
      'Taux de distribution : 4 % à 6,5 %',
      'Prix de la part : 200 € minimum',
      'Frais de souscription : 8 % maximum',
    ]);
    const sansSante = liste[0].retirer(filtres);
    expect(sansSante.categories).toEqual([]);
    expect(sansSante.capitalisations).toEqual(['plus-3md']);
    expect(liste[2].retirer(filtres).taux).toEqual({ min: null, max: null });
    // Tranche inconnue des options : son code est affiché
    expect(pastilles({ ...FILTRES_VIDES, capitalisations: ['x'] }, null)[0].libelle).toBe('x');
  });

  it('session du navigateur : gardés, relus, effacés ; contenu illisible ignoré', () => {
    const filtres = { ...FILTRES_VIDES, pays: ['France'] };
    memoriserFiltres(filtres);
    expect(relireFiltres()).toEqual(filtres);
    oublierFiltres();
    expect(relireFiltres()).toEqual(FILTRES_VIDES);
    sessionStorage.setItem('scpi-invest.catalogue.filtres', '{pas du json');
    expect(relireFiltres()).toEqual(FILTRES_VIDES);
    sessionStorage.setItem('scpi-invest.catalogue.filtres', '{"pays":"France"}');
    expect(relireFiltres()).toEqual(FILTRES_VIDES);
  });

  it('stockage indisponible : aucune erreur', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    expect(() => memoriserFiltres(FILTRES_VIDES)).not.toThrow();
    expect(() => oublierFiltres()).not.toThrow();
  });
});
