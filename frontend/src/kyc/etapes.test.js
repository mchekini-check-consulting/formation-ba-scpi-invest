import { describe, expect, it } from 'vitest';
import {
  ETAPES,
  MESSAGE_DATE,
  MESSAGE_MAJEUR,
  MESSAGE_OBLIGATOIRE,
  MESSAGE_ADRESSE,
  MESSAGE_PAYS,
  MESSAGE_TELEPHONE,
  MESSAGE_VILLE,
  aideDe,
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
    expect(noms(coordonnees)).toEqual([
      'pays',
      'adresse',
      'codePostal',
      'ville',
      'telephone',
      'email',
    ]);
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

  it('coordonnées : pays, code postal, ville, adresse et téléphone contrôlés', () => {
    const erreurs = erreursEtape(coordonnees, {
      pays: 'jqgdgdv',
      adresse: 'jqgdgdv',
      codePostal: 'jqgdgdv',
      ville: '123',
      telephone: '0612',
      email: 'jean@exemple.fr',
    });
    expect(erreurs).toEqual({
      pays: MESSAGE_PAYS,
      adresse: MESSAGE_ADRESSE,
      codePostal:
        'Code postal invalide : lettres, chiffres, espaces ou tirets, avec au moins un chiffre.',
      ville: MESSAGE_VILLE,
      telephone: MESSAGE_TELEPHONE,
    });
    const france = erreursEtape(coordonnees, { pays: 'FR', codePostal: '7500' });
    expect(france.codePostal).toBe('Code postal invalide pour France (exemple : 75008).');
    expect(
      erreursEtape(coordonnees, {
        pays: 'FR',
        adresse: '12 rue des Lilas',
        codePostal: '69003',
        ville: 'Lyon',
        telephone: '06 12 34 56 78',
        email: 'jean@exemple.fr',
      }),
    ).toEqual({});
  });

  it('téléphone : contrôlé selon l’indicatif choisi, sinon celui du pays de l’adresse', () => {
    const tel = coordonnees.champs.find((c) => c.nom === 'telephone');
    expect(indicatifChoisi(tel, {})).toBe('FR');
    expect(indicatifChoisi(tel, { pays: 'BE' })).toBe('BE');
    expect(indicatifChoisi(tel, { pays: 'BE', indicatif: 'MA' })).toBe('MA');
    expect(indicatifChoisi(tel, { pays: 'BE', indicatif: 'xx' })).toBe('BE');
    // le même numéro belge est refusé avec l'indicatif des États-Unis (10 chiffres)
    expect(
      erreursEtape(coordonnees, { telephone: '0470 12 34 56', indicatif: 'BE' }),
    ).not.toHaveProperty('telephone');
    expect(
      erreursEtape(coordonnees, { telephone: '0470 12 34 56', indicatif: 'US' }).telephone,
    ).toBe(MESSAGE_TELEPHONE);
  });

  it('pays sans code postal : champ non demandé ; exemple adapté au pays', () => {
    const noms = (reponses) => champsVisibles(coordonnees, reponses).map((c) => c.nom);
    expect(noms({ pays: 'AE' })).not.toContain('codePostal');
    expect(noms({ pays: 'FR' })).toContain('codePostal');
    const cp = coordonnees.champs.find((c) => c.nom === 'codePostal');
    expect(aideDe(cp, { pays: 'GB' })).toBe('Par exemple : SW1A 1AA.');
    expect(aideDe(cp, { pays: 'ZZ' })).toBeUndefined();
    expect(aideDe(identite.champs[0], {})).toBeUndefined();
  });

  it('nationalité : un pays de la liste (US-04c)', () => {
    expect(erreursEtape(identite, { nationalite: 'FR' }).nationalite).toBeUndefined();
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
    // téléphone saisi : son indicatif est enregistré avec lui
    expect(reponsesAEnregistrer({ pays: 'BE', telephone: '0470 12 34 56' })).toEqual({
      pays: 'BE',
      telephone: '0470 12 34 56',
      indicatif: 'BE',
    });
    expect(
      reponsesAEnregistrer({ residenceFiscale: 'Autre pays', paysResidenceFiscale: 'Belgique' }),
    ).toEqual({
      residenceFiscale: 'Autre pays',
      paysResidenceFiscale: 'Belgique',
    });
  });

  it('réponses lisibles : date, choix multiples, champ vide', () => {
    const [date, texte] = [{ type: 'date' }, { type: 'texte' }];
    expect(reponseLisible(date, '1980-01-15')).toBe('15/01/1980');
    expect(reponseLisible(texte, 'Martin')).toBe('Martin');
    expect(reponseLisible(texte, ['Donation', 'Gains au jeu'])).toBe('Donation, Gains au jeu');
    expect(reponseLisible(texte, [])).toBe('Non renseigné');
    expect(reponseLisible(texte, '  ')).toBe('Non renseigné');
    expect(reponseLisible(texte, undefined)).toBe('Non renseigné');
    expect(reponseLisible({ type: 'pays' }, 'BE')).toBe('Belgique');
    expect(reponseLisible({ type: 'pays' }, 'Française')).toBe('Française'); // ancienne saisie
    const tel = { type: 'tel', indicatif: 'indicatif' };
    expect(reponseLisible(tel, '0470 12 34 56', { indicatif: 'BE' })).toBe('+32 0470 12 34 56');
  });
});
