import { describe, expect, it } from 'vitest';
import {
  ETAPES,
  MESSAGE_DATE,
  MESSAGE_MAJEUR,
  MESSAGE_OBLIGATOIRE,
  MESSAGE_PAYS,
  MESSAGE_RESIDENCE,
  MESSAGE_US_PERSON,
  PAYS_RESIDENCE,
  MESSAGE_TELEPHONE,
  age,
  champsVisibles,
  erreursEtape,
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
    expect(noms(declarations)).toEqual(['origineFonds', 'ppe', 'residenceFiscale', 'usPerson']);
  });

  it('propose le secteur « Informatique », juste après « Information, communication »', () => {
    const secteurs = situation.champs.find((c) => c.nom === 'secteur').options;
    const position = secteurs.indexOf('Information, communication');
    expect(secteurs[position + 1]).toBe('Informatique');
    expect(secteurs).toHaveLength(17);
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

  it('téléphone : toujours contrôlé comme un numéro français (+33)', () => {
    const erreur = (reponses) => erreursEtape(coordonnees, reponses, AUJOURDHUI).telephone;
    expect(erreur({ telephone: '06 12 34 56 78' })).toBeUndefined();
    expect(erreur({ telephone: '0612' })).toBe(MESSAGE_TELEPHONE);
    // numéro belge à 8 chiffres : refusé, même avec un ancien indicatif belge enregistré
    expect(erreur({ telephone: '02 123 45 67', indicatif: 'Belgique' })).toBe(MESSAGE_TELEPHONE);
  });

  it('téléphone : indicatif enregistré avec le numéro, affiché au récapitulatif', () => {
    const tel = coordonnees.champs.find((c) => c.nom === 'telephone');
    expect(reponsesAEnregistrer({ telephone: '06 12 34 56 78' }).indicatif).toBe('France');
    expect(reponsesAEnregistrer({ nom: 'Martin' })).not.toHaveProperty('indicatif');
    expect(reponseLisible(tel, '06 12 34 56 78')).toBe('+33 06 12 34 56 78');
  });

  it('coordonnées : pays fixé à France, non modifiable ; code postal français', () => {
    const pays = coordonnees.champs.find((c) => c.nom === 'pays');
    expect(pays.lectureSeule).toBe(true);
    expect(PAYS_RESIDENCE).toBe('France');
    const erreurs = (reponses) => erreursEtape(coordonnees, reponses, AUJOURDHUI);
    expect(erreurs({ pays: 'France', codePostal: '6900' }).codePostal).toBe(
      'Code postal invalide : 5 chiffres attendus pour ce pays.',
    );
    expect(erreurs({ pays: 'France', codePostal: '69003' }).codePostal).toBeUndefined();
  });

  it('nationalité : un pays de la liste (US-04c)', () => {
    expect(erreursEtape(identite, { nationalite: 'France' }).nationalite).toBeUndefined();
    expect(erreursEtape(identite, { nationalite: 'Française' }).nationalite).toBe(MESSAGE_PAYS);
  });

  it('origine des fonds : au moins un choix', () => {
    expect(erreursEtape(declarations, { origineFonds: [] }).origineFonds).toBe(MESSAGE_OBLIGATOIRE);
    expect(erreursEtape(declarations, { origineFonds: ['Donation'] }).origineFonds).toBeUndefined();
  });

  it('résidence fiscale hors de France refusée : résidents en France uniquement', () => {
    const erreur = (residenceFiscale) =>
      erreursEtape(declarations, { residenceFiscale }).residenceFiscale;
    expect(erreur('France')).toBeUndefined();
    expect(erreur('Autre pays')).toBe(MESSAGE_RESIDENCE);
    expect(erreur('')).toBe(MESSAGE_OBLIGATOIRE);
    const noms = champsVisibles(declarations, { residenceFiscale: 'Autre pays' }).map((c) => c.nom);
    expect(noms).not.toContain('paysResidenceFiscale');
  });

  it('US Person refusée, même résidente en France', () => {
    const erreur = (usPerson) =>
      erreursEtape(declarations, { residenceFiscale: 'France', usPerson }).usPerson;
    expect(erreur('Non')).toBeUndefined();
    expect(erreur('Oui')).toBe(MESSAGE_US_PERSON);
    expect(erreur('')).toBe(MESSAGE_OBLIGATOIRE);
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
