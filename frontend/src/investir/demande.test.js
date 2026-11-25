import { describe, expect, it } from 'vitest';
import {
  chiffresSeulement,
  evaluer,
  formaterDate,
  libelleStatut,
  libelleType,
  messageMinimum,
  PARTS_INVALIDES,
  partsInitiales,
  PRIX_INCONNU,
} from './demande.js';

// SCPI du critère d'acceptation : part à 200 €, minimum 1 000 € (5 parts)
const FICHE = { prixPart: { annee: 2026, valeur: 200 }, minimum: 1000, minimumParts: 5 };
const espaces = (t) => t.replace(/[  ]/g, ' ');

describe('règles de saisie de l’écran Investir (US-11)', () => {
  it('scénario « saisie d’un nombre non entier impossible » : 2 , 5 -> 25', () => {
    expect(chiffresSeulement('2,5')).toBe('25');
    expect(chiffresSeulement('2.5')).toBe('25');
    expect(chiffresSeulement('-3a')).toBe('3');
    expect(chiffresSeulement('007')).toBe('7');
    expect(chiffresSeulement('0')).toBe('0');
    expect(chiffresSeulement('')).toBe('');
  });

  it('scénario « demande valide » : 5 parts -> 1 000 €, minimum atteint', () => {
    expect(evaluer('5', FICHE)).toEqual({
      nombre: 5,
      montant: 1000,
      erreur: '',
      minimumAtteint: true,
      progression: 100,
    });
  });

  it('scénario « minimum non atteint » : 4 parts -> message de la story', () => {
    const evaluation = evaluer('4', FICHE);
    expect(evaluation.montant).toBe(800);
    expect(evaluation.minimumAtteint).toBe(false);
    expect(evaluation.progression).toBe(80);
    expect(espaces(evaluation.erreur)).toBe(
      'Le minimum à investir pour cette SCPI est de 1 000 €, soit 5 parts.',
    );
  });

  it.each(['0', ''])(
    'scénario « nombre de parts à zéro » (« %s ») : message de la règle 2',
    (p) => {
      expect(evaluer(p, FICHE)).toMatchObject({ nombre: 0, montant: 0, erreur: PARTS_INVALIDES });
    },
  );

  it('au-delà du minimum : jauge plafonnée à 100 %', () => {
    expect(evaluer('12', FICHE)).toMatchObject({ montant: 2400, progression: 100 });
  });

  it('SCPI sans minimum connu : pas de contrôle ni de jauge', () => {
    expect(evaluer('1', { ...FICHE, minimum: null, minimumParts: null })).toMatchObject({
      erreur: '',
      minimumAtteint: true,
      progression: null,
    });
  });

  it('prix de part inconnu : validation impossible', () => {
    expect(evaluer('5', { ...FICHE, prixPart: null })).toMatchObject({
      montant: 0,
      erreur: PRIX_INCONNU,
    });
  });

  it('prix décimal : montant arrondi au centime', () => {
    expect(evaluer('3', { ...FICHE, prixPart: { valeur: 210.15 } }).montant).toBe(630.45);
  });

  it('nombre de parts proposé : celui du minimum, 1 sans minimum', () => {
    expect(partsInitiales(FICHE)).toBe('5');
    expect(partsInitiales({ ...FICHE, minimumParts: null })).toBe('1');
  });

  it('libellés et date', () => {
    expect(libelleType('nue_propriete')).toBe('Nue-propriété');
    expect(libelleType('inconnu')).toBe('inconnu');
    expect(libelleStatut('demande_envoyee')).toBe('Demande envoyée');
    expect(libelleStatut('autre')).toBe('autre');
    expect(formaterDate('2026-11-24T10:00:00.000Z')).toBe('24/11/2026');
    expect(espaces(messageMinimum(FICHE))).toContain('1 000 €, soit 5 parts');
  });
});
