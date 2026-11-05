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
    expect(destinationApresConnexion({ valide: true }, '/kyc')).toBe('/catalogue');
  });

  it('dernier écran = KYC, ou aucun -> KYC', () => {
    expect(destinationApresConnexion({ valide: false }, '/kyc')).toBe('/kyc');
    expect(destinationApresConnexion(null, null)).toBe('/kyc');
  });

  it('stockage indisponible : pas d’erreur, reprise sur le KYC', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    expect(() => memoriserPage('/kyc')).not.toThrow();
    expect(pageMemorisee()).toBeNull();
    expect(destinationApresConnexion(null)).toBe('/kyc');
  });
});
