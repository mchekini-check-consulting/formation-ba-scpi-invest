import { describe, expect, it } from 'vitest';
import { calculerProfil } from './profil.js';
import { REPONSES_EXEMPLE } from './reponses-exemple.js';

// Réponses de l'exemple, étape 4 (horizon et risque) et connaissances remplacées
function avec(
  risque: { horizon: string; reactionBaisse: string; perteAcceptee: string },
  bonnesReponses = 4,
) {
  const attendues = {
    revente: 'vrai',
    capitalGaranti: 'faux',
    frais: 'vrai',
    revenusGarantis: 'faux',
  };
  const fausses = {
    revente: 'faux',
    capitalGaranti: 'vrai',
    frais: 'faux',
    revenusGarantis: 'vrai',
  };
  const cles = Object.keys(attendues) as (keyof typeof attendues)[];
  const connaissances = Object.fromEntries(
    cles.map((cle, i) => [cle, i < bonnesReponses ? attendues[cle] : fausses[cle]]),
  );
  return calculerProfil({
    ...REPONSES_EXEMPLE,
    2: { ...REPONSES_EXEMPLE[2], ...connaissances },
    4: risque,
  });
}

describe('calcul du profil investisseur (US-05b)', () => {
  it('score sur 8 : horizon + réaction à une baisse + perte acceptée', () => {
    expect(avec({ horizon: '>15', reactionBaisse: 'investir', perteAcceptee: '>25' }).score).toBe(
      8,
    );
    expect(avec({ horizon: '3-8', reactionBaisse: 'vendre', perteAcceptee: '<10' }).score).toBe(2);
    expect(
      avec({ horizon: '8-15', reactionBaisse: 'attendre', perteAcceptee: '10-25' }).score,
    ).toBe(5);
  });

  it('scénario 2 : 0 à 3 Prudent, 4 à 6 Équilibré, 7 à 8 Dynamique', () => {
    const profil = (horizon: string, reactionBaisse: string, perteAcceptee: string) =>
      avec({ horizon, reactionBaisse, perteAcceptee }).profil;
    expect(profil('3-8', 'attendre', '<10')).toBe('prudent'); // 3
    expect(profil('3-8', 'investir', '<10')).toBe('equilibre'); // 4
    expect(profil('8-15', 'investir', '10-25')).toBe('equilibre'); // 6
    expect(profil('>15', 'investir', '10-25')).toBe('dynamique'); // 7
    expect(profil('>15', 'investir', '>25')).toBe('dynamique'); // 8
  });

  it('scénario 3 : moins de 3 bonnes réponses -> Prudent et avertissement risques', () => {
    const dynamique = { horizon: '>15', reactionBaisse: 'investir', perteAcceptee: '>25' };
    expect(avec(dynamique, 2)).toEqual({
      profil: 'prudent',
      score: 8,
      avertissements: ['connaissances'],
    });
    expect(avec(dynamique, 3)).toMatchObject({ profil: 'dynamique', avertissements: [] });
  });

  it('scénario 4 : horizon de moins de 3 ans -> Prudent et avertissement durée', () => {
    const resultat = avec({ horizon: '<3', reactionBaisse: 'investir', perteAcceptee: '>25' });
    expect(resultat).toEqual({ profil: 'prudent', score: 5, avertissements: ['horizon'] });
  });

  it('scénario 5 : horizon de 3 à 8 ans -> avertissement durée, pas de plafonnement', () => {
    const resultat = avec({ horizon: '3-8', reactionBaisse: 'investir', perteAcceptee: '>25' });
    expect(resultat).toEqual({ profil: 'equilibre', score: 6, avertissements: ['horizon'] });
  });

  it('scénario 6 : aucune perte acceptée -> Prudent, quel que soit le score', () => {
    const resultat = avec({ horizon: '>15', reactionBaisse: 'investir', perteAcceptee: 'aucune' });
    expect(resultat).toEqual({ profil: 'prudent', score: 5, avertissements: [] });
  });

  it('les deux avertissements peuvent s’afficher ensemble', () => {
    expect(
      avec({ horizon: '<3', reactionBaisse: 'vendre', perteAcceptee: 'aucune' }, 0).avertissements,
    ).toEqual(['connaissances', 'horizon']);
  });

  it('réponses absentes : score 0, Prudent', () => {
    expect(calculerProfil({})).toEqual({
      profil: 'prudent',
      score: 0,
      avertissements: ['connaissances'],
    });
  });
});
