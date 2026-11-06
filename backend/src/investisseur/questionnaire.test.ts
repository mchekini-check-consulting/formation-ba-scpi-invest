import { describe, expect, it } from 'vitest';
import { ETAPES, NOMBRE_ETAPES, reponsesValides } from './questionnaire.js';
import { REPONSES_EXEMPLE as REPONSES } from './reponses-exemple.js';

describe('questionnaire investisseur (US-05a)', () => {
  it('5 étapes, toutes définies', () => {
    expect(NOMBRE_ETAPES).toBe(5);
    expect(Object.keys(ETAPES)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('réponses complètes : acceptées pour chaque étape', () => {
    for (let etape = 1; etape <= 5; etape += 1) {
      expect(reponsesValides(etape, REPONSES[etape])).toEqual(REPONSES[etape]);
    }
  });

  it('question obligatoire sans réponse : refusée', () => {
    expect(reponsesValides(1, { ...REPONSES[1], revenus: '' })).toBeNull();
    expect(reponsesValides(4, { horizon: '<3', reactionBaisse: 'vendre' })).toBeNull();
    expect(reponsesValides(2, { ...REPONSES[2], dejaScpi: null })).toBeNull();
  });

  it('valeur non prévue : refusée', () => {
    expect(reponsesValides(1, { ...REPONSES[1], revenus: 'beaucoup' })).toBeNull();
    expect(reponsesValides(3, { objectifs: ['revenus', 'loterie'] })).toBeNull();
  });

  it('montant : entier strictement positif', () => {
    for (const epargne of [0, -10, 12.5, '1000', null]) {
      expect(reponsesValides(1, { ...REPONSES[1], epargne })).toBeNull();
    }
  });

  it('choix multiple : au moins un, sans doublon, « Aucun » exclusif', () => {
    const avec = (placements: unknown) => reponsesValides(2, { ...REPONSES[2], placements });
    expect(avec([])).toBeNull();
    expect(avec('livrets')).toBeNull();
    expect(avec(['livrets', 'livrets'])).toBeNull();
    expect(avec(['aucun', 'livrets'])).toBeNull();
    expect(avec(['aucun'])).toMatchObject({ placements: ['aucun'] });
  });

  it('ISR : facultative si ESG = oui, ignorée sinon', () => {
    expect(reponsesValides(5, { esg: 'oui' })).toEqual({ esg: 'oui' });
    expect(reponsesValides(5, { esg: 'non', isr: 'oui' })).toEqual({ esg: 'non' });
    expect(reponsesValides(5, { esg: 'oui', isr: 'peut-etre' })).toBeNull();
  });

  it('questions inconnues retirées, étape inconnue sans question', () => {
    expect(reponsesValides(3, { objectifs: ['revenus'], autre: 'x' })).toEqual({
      objectifs: ['revenus'],
    });
    expect(reponsesValides(9, {})).toEqual({});
  });
});
