import { describe, expect, it } from 'vitest';
import {
  COLONNES_OBLIGATOIRES,
  convertirLigne,
  empreinte,
  toBoolean,
  toFrequence,
  toInteger,
  toLocalisation,
  toNumber,
  toPaires,
  toSecteur,
  toValeursAnnuelles,
  verifierBic,
  verifierIban,
} from './convert.js';

describe('verifierIban', () => {
  it.each([
    'FR7630001007941234567890185',
    'FR76 3000 1007 9412 3456 7890 185',
    'DE89370400440532013000',
  ])('accepte %s', (iban) => {
    expect(() => verifierIban(iban)).not.toThrow();
  });

  it.each([
    'FR76123',
    'FR763000100794123456789018',
    '7630001007941234567890185',
    'FR76300010079412345678901-5',
  ])('refuse %s, sans recopier la valeur dans le motif', (iban) => {
    expect(() => verifierIban(iban)).toThrow(/^iban : format invalide$/);
  });
});

describe('verifierBic', () => {
  it.each(['BNPAFRPP', 'BNPAFRPPXXX', 'bnpafrpp'])('accepte %s', (bic) => {
    expect(() => verifierBic(bic)).not.toThrow();
  });

  it.each(['BNPAFRP', 'BNPAFRPPXX', '1234FRPP'])('refuse %s', (bic) => {
    expect(() => verifierBic(bic)).toThrow('bic : format invalide (8 ou 11 caractères attendus)');
  });
});

describe('toNumber', () => {
  it('convertit un nombre décimal', () => {
    expect(toNumber('10.51', 'frais')).toBe(10.51);
  });

  it('case vide -> null', () => {
    expect(toNumber('', 'frais')).toBeNull();
  });

  it('erreur si ce n’est pas un nombre', () => {
    expect(() => toNumber('abc', 'frais')).toThrow('frais : nombre attendu, reçu "abc"');
  });
});

describe('toInteger', () => {
  it('convertir un nombre entier', () => {
    expect(toInteger('20', 'capitalisation')).toBe(20);
  });

  it('case vide -> null', () => {
    expect(toInteger('', 'capitalisation')).toBeNull();
  });

  it('erreur si décimal', () => {
    expect(() => toInteger('4.5', 'delai_jouissance')).toThrow(
      'delai_jouissance : nombre entier attendu, reçu "4.5"',
    );
  });

  it('nombre trop grand pour JavaScript', () => {
    expect(() => toInteger('87765445678937238', 'capitalisation')).toThrow(
      'capitalisation : nombre entier attendu, reçu "87765445678937238"',
    );
  });

  it('erreur si pas un nombre', () => {
    expect(() => toInteger('bonjour', 'capitalisation')).toThrow(
      'capitalisation : nombre attendu, reçu "bonjour"',
    );
  });
});

describe('toBoolean', () => {
  it.each([
    ['Oui', true],
    ['OUI', true],
    ['Non', false],
    ['non', false],
  ])('%s -> %s', (entree, attendu) => {
    expect(toBoolean(entree, 'demembrement')).toBe(attendu);
  });

  it('case vide -> null', () => {
    expect(toBoolean('', 'demembrement')).toBeNull();
  });

  it('erreur si ni Oui ni Non', () => {
    expect(() => toBoolean('Peut-être', 'demembrement')).toThrow(
      'demembrement : Oui ou Non attendu, reçu "Peut-être"',
    );
  });
});

describe('toFrequence', () => {
  it.each(['Trimestrielle', 'Mensuelle'])('%s : valeur du CSV acceptée', (valeur) => {
    expect(toFrequence(valeur)).toBe(valeur);
  });

  it('case vide -> null', () => {
    expect(toFrequence('')).toBeNull();
  });

  it('erreur si la fréquence est inconnue', () => {
    expect(() => toFrequence('Hebdomadaire')).toThrow(
      'frequence_loyers : valeur inconnue "Hebdomadaire"',
    );
  });
});

// L'année de référence est celle du jour (convert.ts) : attendus calculés de la même façon
const annee = new Date().getFullYear();

describe('toValeursAnnuelles', () => {
  it('de gauche à droite : année -1, -2, ...', () => {
    expect(toValeursAnnuelles('8.35,8.16,7.9', 'taux_distribution')).toEqual([
      { valeur: 8.35, annee: annee - 1 },
      { valeur: 8.16, annee: annee - 2 },
      { valeur: 7.9, annee: annee - 3 },
    ]);
  });

  it('une seule valeur -> année -1 ; espaces ignorés', () => {
    expect(toValeursAnnuelles(' 200 ', 'prix_part')).toEqual([{ valeur: 200, annee: annee - 1 }]);
  });

  it('case vide -> liste vide', () => {
    expect(toValeursAnnuelles('', 'prix_part')).toEqual([]);
  });

  it('erreur si une valeur est vide dans la liste', () => {
    expect(() => toValeursAnnuelles('8.35,,8.16', 'taux_distribution')).toThrow(
      'taux_distribution : valeur vide dans la liste "8.35,,8.16"',
    );
  });

  it('erreur si une valeur n’est pas un nombre', () => {
    expect(() => toValeursAnnuelles('8.35,abc', 'taux_distribution')).toThrow(
      'taux_distribution : nombre attendu, reçu "abc"',
    );
  });
});

describe('toPaires', () => {
  it('lit les morceaux deux par deux, nombres décimaux compris', () => {
    expect(toPaires('Allemagne,6.3, Belgique , 30.4', 'localisation')).toEqual([
      { libelle: 'Allemagne', nombre: 6.3 },
      { libelle: 'Belgique', nombre: 30.4 },
    ]);
  });

  it('case vide -> liste vide', () => {
    expect(toPaires('', 'localisation')).toEqual([]);
  });

  it.each([
    ['nombre manquant', 'Pays-Bas,47,Espagne'],
    ['virgule en trop à la fin', 'Pays-Bas,47,'],
  ])('erreur si nombre impair de morceaux : %s', (_cas, valeur) => {
    expect(() => toPaires(valeur, 'localisation')).toThrow(
      `localisation : couple libellé + nombre non respecté "${valeur}"`,
    );
  });

  it.each([
    ['libellé vide', ',47'],
    ['nombre vide', 'Pays-Bas,'],
  ])('erreur si entité vide : %s', (_cas, valeur) => {
    expect(() => toPaires(valeur, 'localisation')).toThrow(
      `localisation : entité vide dans la liste "${valeur}"`,
    );
  });

  it('erreur si le nombre n’en est pas un', () => {
    expect(() => toPaires('Pays-Bas,Espagne', 'localisation')).toThrow(
      'localisation : nombre attendu, reçu "Espagne"',
    );
  });
});

describe('toLocalisation', () => {
  it('paires -> pays et pourcentage', () => {
    expect(toLocalisation('Pays-Bas,47,Espagne,53', 'localisation')).toEqual([
      { pays: 'Pays-Bas', pourcentage: 47 },
      { pays: 'Espagne', pourcentage: 53 },
    ]);
  });

  it('case vide -> liste vide', () => {
    expect(toLocalisation('', 'localisation')).toEqual([]);
  });
});

describe('toSecteur', () => {
  it.each([
    ['Bureau', 'Bureaux'],
    ['Commerce', 'Commerces'],
    ['Hotels', 'Hôtels'],
    ["Locaux d'activite", 'Locaux d’activité'],
    ['Residentiel', 'Résidentiel'],
    ['Sante', 'Santé'],
    ['Reste', 'Autre'],
    ['Restant', 'Autre'],
  ])('écriture du CSV %s -> %s', (csv, secteur) => {
    expect(toSecteur(`${csv},100`, 'secteurs')).toEqual([{ secteur, pourcentage: 100 }]);
  });

  it('valeur de l’enum (avec accents) acceptée telle quelle', () => {
    expect(toSecteur('Santé,60,Logistique,40', 'secteurs')).toEqual([
      { secteur: 'Santé', pourcentage: 60 },
      { secteur: 'Logistique', pourcentage: 40 },
    ]);
  });

  it('case vide -> liste vide', () => {
    expect(toSecteur('', 'secteurs')).toEqual([]);
  });

  it.each(['Spatial', 'toString', 'bureaux'])('erreur si secteur inconnu : %s', (libelle) => {
    expect(() => toSecteur(`${libelle},100`, 'secteurs')).toThrow(
      `secteurs : secteur inconnu "${libelle}"`,
    );
  });
});

describe('convertirLigne', () => {
  const ligne = {
    Nom: 'Transitions Europe',
    taux_distribution: '8.35',
    minimum_souscription: '5000',
    localisation: 'Pays-Bas,100',
    secteurs: 'Bureaux,100',
    prix_part: '200',
    capitalisation: '289000000',
    Gerant: 'Arkea REIM',
    frais_souscription: '10',
    frais_gestion: '10.5',
    delai_jouissance: '5',
    frequence_loyers: 'Trimestrielle',
    valeur_reconstitution: '',
    iban: 'FR7630001007941234567890185',
    bic: 'BNPAFRPPXXX',
    decote_demembrement: '3,90',
    demembrement: 'Oui',
    cashback: '',
    versement_programme: 'Non',
    publicite: 'Texte libre',
  };
  const annee = new Date().getFullYear();

  it('fiche convertie et valeurs multiples', () => {
    expect(convertirLigne(ligne)).toEqual({
      fiche: {
        nom: 'Transitions Europe',
        minimum_souscription: 5000,
        capitalisation: 289000000,
        gerant: 'Arkea REIM',
        frais_souscription: 10,
        frais_gestion: 10.5,
        delai_jouissance: 5,
        frequence: 'Trimestrielle',
        iban: 'FR7630001007941234567890185',
        bic: 'BNPAFRPPXXX',
        demembrement: true,
        cashback: null,
        versement_programme: false,
        publicite: 'Texte libre',
      },
      taux: [{ valeur: 8.35, annee: annee - 1 }],
      prix: [{ valeur: 200, annee: annee - 1 }],
      valeurs: [],
      localisations: [{ pays: 'Pays-Bas', pourcentage: 100 }],
      secteurs: [{ secteur: 'Bureaux', pourcentage: 100 }],
      decotes: [{ duree: 3, decote: 90 }],
    });
  });

  it('erreur qui nomme la colonne', () => {
    expect(() => convertirLigne({ ...ligne, capitalisation: '1.5' })).toThrow(
      'capitalisation : nombre entier attendu, reçu "1.5"',
    );
  });

  it.each(COLONNES_OBLIGATOIRES)('colonne obligatoire vide : %s', (colonne) => {
    expect(() => convertirLigne({ ...ligne, [colonne]: '' })).toThrow(
      `${colonne} : champ obligatoire vide`,
    );
  });

  it('colonnes facultatives vides : acceptées, valeurs inconnues', () => {
    const scpi = convertirLigne({
      ...ligne,
      taux_distribution: '',
      cashback: '',
      demembrement: 'Non',
      decote_demembrement: '',
    });
    expect(scpi.taux).toEqual([]);
    expect(scpi.fiche.cashback).toBeNull();
    expect(scpi.decotes).toEqual([]);
  });

  it('demembrement = Oui sans decote_demembrement : refusée', () => {
    expect(() => convertirLigne({ ...ligne, decote_demembrement: '' })).toThrow(
      'decote_demembrement : obligatoire quand demembrement = Oui',
    );
  });

  it('IBAN et BIC au mauvais format : refusée', () => {
    expect(() => convertirLigne({ ...ligne, iban: 'FR76' })).toThrow('iban : format invalide');
    expect(() => convertirLigne({ ...ligne, bic: 'BNP' })).toThrow('bic : format invalide');
  });

  describe('empreinte', () => {
    it('sha256 en hexadécimal, identique pour une même ligne', () => {
      const e = empreinte(convertirLigne(ligne));
      expect(e).toMatch(/^[0-9a-f]{64}$/);
      expect(empreinte(convertirLigne({ ...ligne }))).toBe(e);
    });

    it('même valeur écrite autrement (200 / 200.00, espaces) : même empreinte', () => {
      expect(empreinte(convertirLigne({ ...ligne, prix_part: '200.00 ' }))).toBe(
        empreinte(convertirLigne(ligne)),
      );
    });

    it.each([
      ['prix_part', '201'],
      ['localisation', 'Pays-Bas,60,Espagne,40'],
      ['Gerant', 'Autre gérant'],
    ])('change si %s change', (colonne, valeur) => {
      expect(empreinte(convertirLigne({ ...ligne, [colonne]: valeur }))).not.toBe(
        empreinte(convertirLigne(ligne)),
      );
    });
  });
});
