import { afterEach, describe, expect, it, vi } from 'vitest';
import { destinationApresConnexion, memoriserPage, pageMemorisee } from './destination.js';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('retour sur le dernier écran après reconnexion', () => {
  it('seuls les écrans du parcours sont mémorisés, gardés après fermeture du navigateur', () => {
    memoriserPage('/formulaire-investisseur');
    memoriserPage('/mentions-legales');
    memoriserPage('/connexion');
    expect(pageMemorisee()).toBe('/formulaire-investisseur');
    expect(localStorage.getItem('scpi-invest.derniere-page')).toBe('/formulaire-investisseur');
  });

  it('dernier écran = formulaire investisseur -> retour au formulaire', () => {
    memoriserPage('/formulaire-investisseur');
    expect(destinationApresConnexion({ etapeCourante: 3, valide: false })).toBe(
      '/formulaire-investisseur',
    );
  });

  it('dernier écran = Catalogue mais profil non validé -> formulaire investisseur', () => {
    expect(destinationApresConnexion({ valide: false }, '/catalogue')).toBe(
      '/formulaire-investisseur',
    );
  });

  it('profil validé -> Catalogue, quel que soit le dernier écran', () => {
    expect(destinationApresConnexion({ valide: true }, '/connaissance-client')).toBe('/catalogue');
  });

  it('dernier écran = KYC, ou aucun -> KYC', () => {
    expect(destinationApresConnexion({ valide: false }, '/connaissance-client')).toBe(
      '/connaissance-client',
    );
    expect(destinationApresConnexion(null, null)).toBe('/connaissance-client');
  });

  it('ancienne adresse /kyc mémorisée avant le renommage -> KYC (nouvelle adresse)', () => {
    expect(destinationApresConnexion({ valide: false }, '/kyc')).toBe('/connaissance-client');
  });

  it('stockage indisponible : pas d’erreur, reprise sur le KYC', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    expect(() => memoriserPage('/connaissance-client')).not.toThrow();
    expect(pageMemorisee()).toBeNull();
    expect(destinationApresConnexion(null)).toBe('/connaissance-client');
  });
});

describe('Raccourci de test du poste : formulaires passés', () => {
  it('Catalogue directement, même sans KYC ni profil', () => {
    expect(destinationApresConnexion(null, null, true)).toBe('/catalogue');
    expect(destinationApresConnexion({ valide: false }, '/formulaire-investisseur', true)).toBe(
      '/catalogue',
    );
  });
});
