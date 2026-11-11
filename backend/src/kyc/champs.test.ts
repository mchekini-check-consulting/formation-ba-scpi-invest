import { describe, expect, it } from 'vitest';
import { age, champsIncomplets, nettoyer, residentFrance } from './champs.js';
import { KYC_COMPLET } from './exemple.js';

const LE = new Date(2026, 10, 4);

describe('nettoyer les réponses reçues', () => {
  it('garde les champs connus au bon format, ignore le reste', () => {
    const propre = nettoyer({
      nom: 'Martin',
      origineFonds: ['Donation', 3, 'Gains au jeu'],
      email: 'pirate@exemple.fr',
      inconnu: 'x',
      prenom: 12,
      ppe: ['Oui'],
    });
    expect(propre).toEqual({ nom: 'Martin', origineFonds: ['Donation', 'Gains au jeu'] });
  });

  it('coupe les textes trop longs et les listes trop longues', () => {
    const propre = nettoyer({
      nom: 'a'.repeat(1000),
      origineFonds: Array.from({ length: 50 }, (_, i) => `choix ${i}`),
    });
    expect(propre.nom).toHaveLength(300);
    expect(propre.origineFonds).toHaveLength(20);
  });

  it('réponses absentes ou mal formées : objet vide', () => {
    expect(nettoyer({ telephone: '06 12 34 56 78', indicatif: 'France' })).toEqual({
      telephone: '06 12 34 56 78',
      indicatif: 'France',
    });
    expect(champsIncomplets(KYC_COMPLET, LE)).not.toContain('indicatif'); // facultatif
    expect(nettoyer(undefined)).toEqual({});
    expect(nettoyer('texte')).toEqual({});
    expect(nettoyer(['a'])).toEqual({});
    expect(nettoyer(null)).toEqual({});
  });
});

describe('champs incomplets avant validation', () => {
  it('KYC complet : rien ne manque (nom de naissance facultatif)', () => {
    expect(champsIncomplets(KYC_COMPLET, LE)).toEqual([]);
  });

  it('champs vides ou absents', () => {
    const { nom: _nom, ...sansNom } = KYC_COMPLET;
    expect(champsIncomplets({ ...sansNom, prenom: '  ', origineFonds: [] }, LE)).toEqual([
      'nom',
      'prenom',
      'origineFonds',
    ]);
  });

  it('plus de pays de résidence fiscale demandé', () => {
    const autrePays = { ...KYC_COMPLET, residenceFiscale: 'Autre pays' };
    expect(champsIncomplets(autrePays, LE)).toEqual([]);
    expect(nettoyer({ paysResidenceFiscale: 'Belgique' })).toEqual({});
  });

  it('résident en France : adresse et résidence fiscale en France', () => {
    expect(residentFrance(KYC_COMPLET)).toBe(true);
    expect(residentFrance({ ...KYC_COMPLET, residenceFiscale: 'Autre pays' })).toBe(false);
    expect(residentFrance({ ...KYC_COMPLET, pays: 'Belgique' })).toBe(false);
    expect(residentFrance({})).toBe(false);
  });

  it('date de naissance : majeur et au format AAAA-MM-JJ', () => {
    expect(champsIncomplets({ ...KYC_COMPLET, dateNaissance: '2010-01-01' }, LE)).toEqual([
      'dateNaissance',
    ]);
    expect(champsIncomplets({ ...KYC_COMPLET, dateNaissance: '15/01/1980' }, LE)).toEqual([
      'dateNaissance',
    ]);
  });

  it('âge révolu, anniversaire compris', () => {
    expect(age('2008-11-04', LE)).toBe(18);
    expect(age('2008-11-05', LE)).toBe(17);
    expect(age('2008-12-01', LE)).toBe(17);
  });
});
