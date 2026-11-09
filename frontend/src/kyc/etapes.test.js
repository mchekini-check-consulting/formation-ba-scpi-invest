import { describe, expect, it } from 'vitest';
import {
  ETAPES,
  MESSAGE_DATE,
  MESSAGE_MAJEUR,
  MESSAGE_OBLIGATOIRE,
  MESSAGE_PAYS,
  MESSAGE_TELEPHONE,
  age,
  champsVisibles,
  erreursEtape,
  indicatifChoisi,
  reponseLisible,
  reponsesAEnregistrer,
} from './etapes.js';

const [identite, coordonnees, situation, declarations] = ETAPES;
const AUJOURDHUI = new Date(2026, 10, 4); // 4 novembre 2026

describe('Contenu du KYC (US-04a)', () => {
  it('4 étapes dans l’ordre de la story, avec leurs champs, puis les pièces (US-04c)', () => {
    expect(ETAPES.map((e) => e.titre)).toEqual([
      'Identité',
      'Coordonnées',
      'Situation personnelle et professionnelle',
      'Déclarations réglementaires',
      'Pièces justificatives',
    ]);
    expect(ETAPES[4].champs).toEqual([]);
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

  it('téléphone : contrôlé selon l’indicatif choisi, sinon le pays de l’adresse', () => {
    const erreur = (reponses) => erreursEtape(coordonnees, reponses, AUJOURDHUI).telephone;
    expect(indicatifChoisi({})).toBe('France');
    expect(indicatifChoisi({ pays: 'Belgique' })).toBe('Belgique');
    expect(indicatifChoisi({ pays: 'Belgique', indicatif: 'Maroc' })).toBe('Maroc');
    expect(indicatifChoisi({ pays: 'Belgique', indicatif: 'Inconnu' })).toBe('Belgique');
    expect(erreur({ telephone: '06 12 34 56 78' })).toBeUndefined();
    expect(erreur({ telephone: '0612' })).toBe(MESSAGE_TELEPHONE);
    expect(erreur({ telephone: '0470 12 34 56', pays: 'Belgique' })).toBeUndefined();
    expect(erreur({ telephone: '0470 12 34 56', indicatif: 'États-Unis' })).toBe(MESSAGE_TELEPHONE);
  });

  it('téléphone : indicatif enregistré avec le numéro, affiché au récapitulatif', () => {
    const tel = coordonnees.champs.find((c) => c.nom === 'telephone');
    expect(reponsesAEnregistrer({ telephone: '06 12 34 56 78' }).indicatif).toBe('France');
    expect(reponsesAEnregistrer({ nom: 'Martin' })).not.toHaveProperty('indicatif');
    expect(reponseLisible(tel, '0470 12 34 56', { indicatif: 'Belgique' })).toBe(
      '+32 0470 12 34 56',
    );
  });

  it('coordonnées : pays de la liste, code postal selon le pays', () => {
    const erreurs = (reponses) => erreursEtape(coordonnees, reponses, AUJOURDHUI);
    expect(erreurs({ pays: 'Fance' }).pays).toBe(MESSAGE_PAYS);
    expect(erreurs({ pays: 'France', codePostal: '6900' }).codePostal).toBe(
      'Code postal invalide : 5 chiffres attendus pour ce pays.',
    );
    expect(erreurs({ pays: 'France', codePostal: '69003' }).codePostal).toBeUndefined();
    expect(erreurs({ pays: 'Royaume-Uni', codePostal: 'SW1A 1AA' }).codePostal).toBeUndefined();
    expect(
      erreursEtape(declarations, { residenceFiscale: 'Autre pays', paysResidenceFiscale: 'Belgiq' })
        .paysResidenceFiscale,
    ).toBe(MESSAGE_PAYS);
  });

  it('nationalité : un pays de la liste (US-04c)', () => {
    expect(erreursEtape(identite, { nationalite: 'France' }).nationalite).toBeUndefined();
    expect(erreursEtape(identite, { nationalite: 'Française' }).nationalite).toBe(MESSAGE_PAYS);
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
