import { describe, expect, it } from 'vitest';
import {
  ETAPES,
  MESSAGES,
  NOMBRE_ETAPES,
  basculer,
  erreursEtape,
  questionsVisibles,
  reponsesAEnvoyer,
} from './questionnaire.js';

describe('questionnaire investisseur (US-05a)', () => {
  it('5 étapes dans l’ordre de l’US', () => {
    expect(NOMBRE_ETAPES).toBe(5);
    expect(ETAPES.map((e) => e.titre)).toEqual([
      'Situation financière',
      'Connaissances et expérience',
      'Objectifs',
      'Horizon et risque',
      'Préférences de durabilité',
    ]);
  });

  it('question obligatoire sans réponse : « Merci de répondre à cette question. »', () => {
    expect(erreursEtape(4, { horizon: '<3' })).toEqual({
      reactionBaisse: MESSAGES.obligatoire,
      perteAcceptee: MESSAGES.obligatoire,
    });
    expect(erreursEtape(3, { objectifs: [] })).toEqual({ objectifs: MESSAGES.obligatoire });
  });

  it('montant vide, nul, négatif, décimal ou non numérique : message du montant', () => {
    const base = { revenus: '<30k', patrimoine: '<50k', charges: '<20' };
    for (const epargne of [undefined, '', '0', '-5', '12,5', 'mille']) {
      expect(erreursEtape(1, { ...base, epargne })).toEqual({ epargne: MESSAGES.montant });
    }
    expect(erreursEtape(1, { ...base, epargne: ' 15000 ' })).toEqual({});
  });

  it('ISR visible et facultative seulement si ESG = oui', () => {
    expect(questionsVisibles(5, { esg: 'oui' }).map((q) => q.cle)).toEqual(['esg', 'isr']);
    expect(questionsVisibles(5, { esg: 'non' }).map((q) => q.cle)).toEqual(['esg']);
    expect(questionsVisibles(5, {}).map((q) => q.cle)).toEqual(['esg']);
    expect(erreursEtape(5, { esg: 'oui' })).toEqual({});
  });

  it('réponses envoyées : montant en nombre, questions masquées retirées', () => {
    expect(
      reponsesAEnvoyer(1, { revenus: '<30k', patrimoine: '<50k', charges: '<20', epargne: '900' }),
    ).toEqual({ revenus: '<30k', patrimoine: '<50k', charges: '<20', epargne: 900 });
    expect(reponsesAEnvoyer(5, { esg: 'non', isr: 'oui' })).toEqual({ esg: 'non' });
    expect(reponsesAEnvoyer(5, { esg: 'oui' })).toEqual({ esg: 'oui' });
  });

  it('« Aucun » exclusif : cocher Aucun retire les autres choix', () => {
    const placements = ETAPES[1].questions.find((q) => q.cle === 'placements');
    expect(basculer(placements, ['livrets'], 'actions')).toEqual(['livrets', 'actions']);
    expect(basculer(placements, ['livrets', 'actions'], 'aucun')).toEqual(['aucun']);
    expect(basculer(placements, ['livrets'], 'livrets')).toEqual([]);
    expect(basculer(placements, undefined, 'livrets')).toEqual(['livrets']);
  });

  it('aucun texte ne recommande un produit', () => {
    const textes = JSON.stringify(ETAPES).toLowerCase();
    expect(textes).not.toMatch(/recommand|conseill/);
  });
});
