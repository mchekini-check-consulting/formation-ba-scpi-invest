import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FILTRES_VIDES,
  basculer,
  basculerTousCashbacks,
  groupesActifs,
  changerPlage,
  memoriserFiltres,
  oublierFiltres,
  parametresFiltres,
  pastilles,
  phraseRecherche,
  regle,
  relireFiltres,
  valeursVisibles,
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

  it('SCPI-252 : cashbacks choisis, 0 = aucun cashback, une pastille par choix', () => {
    const filtres = { ...FILTRES_VIDES, cashback: [0, 5] };
    expect(new URLSearchParams(parametresFiltres(filtres)).getAll('cashback')).toEqual(['0', '5']);
    const liste = pastilles(filtres, OPTIONS);
    expect(liste.map((p) => p.libelle.replaceAll(/\s/gu, ' '))).toEqual(['Aucun cashback', '5 %']);
    expect(liste[0].retirer(filtres).cashback).toEqual([5]);
    expect(
      phraseRecherche(filtres, OPTIONS)[0]
        .map((m) => m.liaison ?? m)
        .join(''),
    ).toMatch(/^Cashback : Aucun cashback ou\s5\s%$/u);
  });

  it('SCPI-252 : « Tous les cashbacks » = 1 à 5 %, une seule pastille', () => {
    const tous = basculerTousCashbacks({ ...FILTRES_VIDES, cashback: [0, 3] });
    expect(tous.cashback).toEqual([0, 1, 2, 3, 4, 5]);
    const liste = pastilles(tous, OPTIONS);
    expect(liste.map((p) => p.libelle)).toEqual(['Aucun cashback', 'Tous les cashbacks']);
    expect(liste[1].retirer(tous).cashback).toEqual([0]);
    expect(basculerTousCashbacks(tous).cashback).toEqual([0]);
  });

  it('nouveaux filtres : fréquence, frais de gestion, jouissance, cases « possible »', () => {
    const filtres = {
      ...FILTRES_VIDES,
      frequences: ['Mensuelle'],
      fraisGestion: { min: 8, max: null },
      jouissance: { min: null, max: 3 },
      demembrement: true,
      versementProgramme: true,
    };
    expect(Object.fromEntries(new URLSearchParams(parametresFiltres(filtres)))).toEqual({
      frequence: 'Mensuelle',
      fraisGestionMin: '8',
      jouissanceMax: '3',
      demembrement: 'oui',
      versementProgramme: 'oui',
    });
    const liste = pastilles(filtres, OPTIONS);
    expect(liste.map((p) => p.libelle.replaceAll(/\s/gu, ' '))).toEqual([
      'Mensuelle',
      'Frais de gestion : 8 % minimum',
      'Délai de jouissance : 3 mois maximum',
      'Démembrement possible',
      'Versement programmé possible',
    ]);
    const sansDemembrement = liste[3].retirer(filtres);
    expect(sansDemembrement.demembrement).toBe(false);
    expect(sansDemembrement.versementProgramme).toBe(true);
  });

  it('filtres gardés avant l’ajout des nouveaux filtres : relus, nouveaux filtres vides', () => {
    sessionStorage.setItem(
      'scpi-invest.catalogue.filtres',
      JSON.stringify({
        pays: ['France'],
        categories: [],
        capitalisations: [],
        gerants: [],
        taux: { min: null, max: null },
        prix: { min: null, max: null },
        frais: { min: null, max: null },
        minimum: { min: null, max: null },
      }),
    );
    expect(relireFiltres()).toEqual({ ...FILTRES_VIDES, pays: ['France'] });
    sessionStorage.setItem(
      'scpi-invest.catalogue.filtres',
      JSON.stringify({ ...FILTRES_VIDES, demembrement: 'oui' }),
    );
    expect(relireFiltres()).toEqual(FILTRES_VIDES);
    sessionStorage.setItem('scpi-invest.catalogue.filtres', 'null');
    expect(relireFiltres()).toEqual(FILTRES_VIDES);
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

  it('mode : envoyé seulement s’il n’est pas « au moins un » et que des valeurs sont cochées', () => {
    const avec = (f) => Object.fromEntries(new URLSearchParams(parametresFiltres(f)));
    expect(avec({ ...FILTRES_VIDES, categories: ['Santé'] })).toEqual({ categorie: 'Santé' });
    expect(avec({ ...FILTRES_VIDES, categories: ['Santé'], modeCategories: 'uniquement' })).toEqual(
      { categorie: 'Santé', categorieMode: 'uniquement' },
    );
    expect(avec({ ...FILTRES_VIDES, pays: ['France'], modePays: 'tous' })).toEqual({
      pays: 'France',
      paysMode: 'tous',
    });
    // Mode choisi sans valeur cochée : ne filtre pas
    expect(avec({ ...FILTRES_VIDES, modePays: 'tous' })).toEqual({});
  });

  it('filtres actifs regroupés par critère ; phrase avec ses liaisons ou / et', () => {
    const filtres = {
      ...FILTRES_VIDES,
      categories: ['Santé', 'Bureaux', 'Commerces'],
      pays: ['France', 'Espagne'],
      modePays: 'tous',
      gerants: ['Gestion A'],
      demembrement: true,
    };
    expect(
      groupesActifs(filtres, OPTIONS).map((g) => [
        g.court,
        g.mode?.code,
        g.pastilles.map((p) => p.libelle),
      ]),
    ).toEqual([
      ['Catégorie', 'au-moins-un', ['Santé', 'Bureaux', 'Commerces']],
      ['Pays', 'tous', ['France', 'Espagne']],
      ['Gestion', 'au-moins-un', ['Gestion A']],
      [undefined, undefined, ['Démembrement possible']],
    ]);
    expect(pastilles(filtres, OPTIONS)).toHaveLength(7);
    // Texte de la phrase ; les liaisons sont des morceaux à part (colorés à l'écran)
    const texte = (f) =>
      phraseRecherche(f, OPTIONS).map((morceaux) =>
        morceaux.map((m) => (typeof m === 'string' ? m : `[${m.liaison}]`)).join(''),
      );
    expect(texte(filtres)).toEqual([
      'Catégorie : Santé, Bureaux [ou] Commerces',
      'Pays : France [et] Espagne (tous)',
      'Société de gestion : Gestion A',
      'Démembrement possible',
    ]);
    const exclusif = {
      ...FILTRES_VIDES,
      categories: ['Santé', 'Bureaux'],
      modeCategories: 'uniquement',
    };
    expect(texte(exclusif)).toEqual(['Catégorie : uniquement Santé [ou] Bureaux']);
    expect(texte({ ...FILTRES_VIDES, modePays: 'tous', pays: ['France'] })).toEqual([
      'Pays : France',
    ]);
    expect(texte(FILTRES_VIDES)).toEqual([]);
  });

  it('valeursVisibles : 7 premières + cochées, tout, ou recherche sans accent', () => {
    const valeurs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Élan', 'J'];
    expect(valeursVisibles(valeurs, { choisies: ['J'] })).toEqual({
      visibles: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'J'],
      cachees: 2,
    });
    expect(valeursVisibles(valeurs, { choisies: [], tout: true })).toEqual({
      visibles: valeurs,
      cachees: 0,
    });
    expect(valeursVisibles(valeurs, { choisies: [], texte: '  ELA ' })).toEqual({
      visibles: ['Élan'],
      cachees: 0,
    });
    expect(
      valeursVisibles(['x'], { choisies: [], texte: 'plus', libelle: () => 'Plus de 3 Md€' })
        .visibles,
    ).toEqual(['x']);
  });

  it('règle affichée sous un filtre selon son mode', () => {
    expect(regle('au-moins-un')).toBe('Plusieurs cases : au moins une (OU)');
    expect(regle('tous', 'secteurs')).toBe('Plusieurs cases : toutes présentes (ET)');
    expect(regle('uniquement', 'pays')).toContain('Seulement ces pays');
  });

  it('mode inconnu gardé dans la session : filtres remis à zéro', () => {
    sessionStorage.setItem(
      'scpi-invest.catalogue.filtres',
      JSON.stringify({ ...FILTRES_VIDES, modeCategories: 'exclusif' }),
    );
    expect(relireFiltres()).toEqual(FILTRES_VIDES);
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
