import { describe, expect, it } from 'vitest';
import {
  ETAPES,
  MESSAGE_DATE,
  MESSAGE_MAJEUR,
  MESSAGE_OBLIGATOIRE,
  MESSAGE_TELEPHONE,
  age,
  champsVisibles,
  erreursEtape,
  reponseLisible,
  reponsesAEnregistrer,
  telephoneValide,
} from './etapes.js';

const [identite, coordonnees, situation, declarations] = ETAPES;
const AUJOURDHUI = new Date(2026, 10, 4); // 4 novembre 2026

describe('Contenu du KYC (US-04a)', () => {
  it('4 étapes dans l’ordre de la story, avec leurs champs', () => {
    expect(ETAPES.map((e) => e.titre)).toEqual([
      'Identité',
      'Coordonnées',
      'Situation personnelle et professionnelle',
      'Déclarations réglementaires',
    ]);
    const noms = (e) => e.champs.map((c) => c.nom);
    expect(noms(identite)).toEqual([
      'civilite',
      'nom',
      'prenom',
      'nomNaissance',
      'dateNaissance',
      'lieuNaissance',
      'nationalite',
    ]);
    expect(noms(coordonnees)).toContain('email');
    expect(noms(situation)).toEqual(['situationFamiliale', 'profession', 'categorie', 'secteur']);
    expect(noms(declarations)).toEqual([
      'origineFonds',
      'ppe',
      'residenceFiscale',
      'paysResidenceFiscale',
      'usPerson',
    ]);
  });
});

describe('Règles de saisie', () => {
  it('champs obligatoires manquants, sauf le nom de naissance', () => {
    const erreurs = erreursEtape(identite, { nom: '   ' }, AUJOURDHUI);
    expect(Object.keys(erreurs)).toEqual([
      'civilite',
      'nom',
      'prenom',
      'dateNaissance',
      'lieuNaissance',
      'nationalite',
    ]);
    expect(erreurs.nom).toBe(MESSAGE_OBLIGATOIRE);
  });

  it('âge révolu, anniversaire compris', () => {
    expect(age('2008-11-04', AUJOURDHUI)).toBe(18);
    expect(age('2008-11-05', AUJOURDHUI)).toBe(17);
    expect(age('2008-12-01', AUJOURDHUI)).toBe(17);
    expect(age('1980-01-15', AUJOURDHUI)).toBe(46);
  });

  it('date de naissance : majeur obligatoire, date plausible', () => {
    const erreur = (dateNaissance) =>
      erreursEtape(identite, { dateNaissance }, AUJOURDHUI).dateNaissance;
    expect(erreur('2008-11-04')).toBeUndefined();
    expect(erreur('2008-11-05')).toBe(MESSAGE_MAJEUR);
    expect(erreur('2030-01-01')).toBe(MESSAGE_DATE);
    expect(erreur('1850-01-01')).toBe(MESSAGE_DATE);
    expect(erreur('04/11/1980')).toBe(MESSAGE_DATE);
  });

  it('téléphone : 10 à 15 chiffres, formats français et international', () => {
    expect(telephoneValide('06 12 34 56 78')).toBe(true);
    expect(telephoneValide('+33 6 12 34 56 78')).toBe(true);
    expect(telephoneValide('01.46.00.12.34')).toBe(true);
    expect(telephoneValide('06 12 34')).toBe(false);
    expect(telephoneValide('06 12 AB 56 78')).toBe(false);
    expect(telephoneValide('1234567890123456')).toBe(false);
    expect(erreursEtape(coordonnees, { telephone: '0612' }).telephone).toBe(MESSAGE_TELEPHONE);
  });

  it('origine des fonds : au moins un choix', () => {
    expect(erreursEtape(declarations, { origineFonds: [] }).origineFonds).toBe(MESSAGE_OBLIGATOIRE);
    expect(erreursEtape(declarations, { origineFonds: ['Donation'] }).origineFonds).toBeUndefined();
  });

  it('pays de résidence fiscale demandé seulement pour une résidence hors de France', () => {
    const noms = (reponses) => champsVisibles(declarations, reponses).map((c) => c.nom);
    expect(noms({ residenceFiscale: 'France' })).not.toContain('paysResidenceFiscale');
    expect(noms({ residenceFiscale: 'Autre pays' })).toContain('paysResidenceFiscale');
    expect(erreursEtape(declarations, { residenceFiscale: 'France' })).not.toHaveProperty(
      'paysResidenceFiscale',
    );
    expect(
      erreursEtape(declarations, { residenceFiscale: 'Autre pays' }).paysResidenceFiscale,
    ).toBe(MESSAGE_OBLIGATOIRE);
  });
});

describe('Réponses enregistrées et récapitulatif (US-04b)', () => {
  it('enregistre les champs affichés seulement, sans l’email', () => {
    const reponses = {
      nom: 'Martin',
      email: 'jean@exemple.fr',
      residenceFiscale: 'France',
      paysResidenceFiscale: 'Belgique',
      inconnu: 'x',
    };
    expect(reponsesAEnregistrer(reponses)).toEqual({ nom: 'Martin', residenceFiscale: 'France' });
    expect(
      reponsesAEnregistrer({ residenceFiscale: 'Autre pays', paysResidenceFiscale: 'Belgique' }),
    ).toEqual({ residenceFiscale: 'Autre pays', paysResidenceFiscale: 'Belgique' });
  });

  it('réponses lisibles : date, choix multiples, champ vide', () => {
    const [date, texte] = [{ type: 'date' }, { type: 'texte' }];
    expect(reponseLisible(date, '1980-01-15')).toBe('15/01/1980');
    expect(reponseLisible(texte, 'Martin')).toBe('Martin');
    expect(reponseLisible(texte, ['Donation', 'Gains au jeu'])).toBe('Donation, Gains au jeu');
    expect(reponseLisible(texte, [])).toBe('Non renseigné');
    expect(reponseLisible(texte, '  ')).toBe('Non renseigné');
    expect(reponseLisible(texte, undefined)).toBe('Non renseigné');
  });
});
