import { describe, expect, it } from 'vitest';
import { age, champsIncomplets, nettoyer } from './champs.js';
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

  it('pays de résidence fiscale exigé seulement hors de France', () => {
    const autrePays = { ...KYC_COMPLET, residenceFiscale: 'Autre pays' };
    expect(champsIncomplets(autrePays, LE)).toEqual(['paysResidenceFiscale']);
    expect(champsIncomplets({ ...autrePays, paysResidenceFiscale: 'BE' }, LE)).toEqual([]);
  });

  it('date de naissance : majeur et au format AAAA-MM-JJ', () => {
    expect(champsIncomplets({ ...KYC_COMPLET, dateNaissance: '2010-01-01' }, LE)).toEqual([
      'dateNaissance',
    ]);
    expect(champsIncomplets({ ...KYC_COMPLET, dateNaissance: '15/01/1980' }, LE)).toEqual([
      'dateNaissance',
    ]);
  });

  it('pays, nationalité et indicatif : code pays à 2 lettres (liste de l’écran)', () => {
    const saisieLibre = {
      ...KYC_COMPLET,
      pays: 'jqgdgdv',
      nationalite: 'Française',
      indicatif: '33',
    };
    expect(champsIncomplets(saisieLibre, LE)).toEqual(['nationalite', 'pays', 'indicatif']);
  });

  it('code postal facultatif (pays sans code postal), téléphone fait de chiffres', () => {
    const { codePostal: _cp, ...sansCodePostal } = KYC_COMPLET;
    expect(champsIncomplets(sansCodePostal, LE)).toEqual([]);
    expect(champsIncomplets({ ...KYC_COMPLET, telephone: 'abc' }, LE)).toEqual(['telephone']);
  });

  it('âge révolu, anniversaire compris', () => {
    expect(age('2008-11-04', LE)).toBe(18);
    expect(age('2008-11-05', LE)).toBe(17);
    expect(age('2008-12-01', LE)).toBe(17);
  });
});
