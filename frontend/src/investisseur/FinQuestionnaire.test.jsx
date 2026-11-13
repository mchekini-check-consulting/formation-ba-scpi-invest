import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import FinQuestionnaire from './FinQuestionnaire.jsx';

afterEach(cleanup);

const REPONSES = {
  1: { revenus: '30-60k', patrimoine: '50-150k', charges: '<20', epargne: '15000' },
  2: {
    revente: 'vrai',
    capitalGaranti: 'faux',
    frais: 'vrai',
    revenusGarantis: 'faux',
    placements: ['livrets', 'actions'],
    dejaScpi: 'non',
  },
  3: { objectifs: ['revenus', 'retraite'] },
  4: { horizon: '<3', reactionBaisse: 'attendre', perteAcceptee: '<10' },
  5: { esg: 'non' },
};

function afficher({
  valider = vi.fn().mockResolvedValue({ profil: 'prudent', avertissements: ['horizon'] }),
  modifier = vi.fn(),
  allerA = vi.fn(),
} = {}) {
  render(
    <FinQuestionnaire
      reponses={REPONSES}
      valider={valider}
      modifier={modifier}
      destination="/catalogue"
      libelleBouton="Accéder au Catalogue"
      allerA={allerA}
    />,
  );
  return { valider, modifier, allerA };
}

const texte = () => document.body.textContent;
const certification = () =>
  screen.getByRole('checkbox', { name: 'Je certifie l’exactitude de mes réponses' });

async function cliquer(nom) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nom }));
  });
}

describe('Fin du formulaire investisseur : récapitulatif puis résultat', () => {
  it('récapitulatif des 5 étapes avec les libellés des réponses, sans profil', () => {
    afficher();
    const etapes = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(etapes).toEqual([
      'Situation financière',
      'Connaissances et expérience',
      'Objectifs',
      'Horizon et risque',
      'Préférences de durabilité',
    ]);
    const situation = screen.getByRole('region', { name: 'Situation financière' }).textContent;
    expect(situation).toContain('Revenus annuels nets du foyer');
    expect(situation).toContain('30 à 60 k€');
    expect(situation).toMatch(/15\s000\s€/);
    expect(screen.getByRole('region', { name: 'Objectifs' }).textContent).toContain(
      'Revenus complémentaires, Préparation de la retraite',
    );
    // ISR non affichée (ESG = non)
    expect(texte()).not.toContain('labellisées ISR');
    expect(texte()).not.toContain('Prudent');
  });

  it('« Modifier mes réponses » : retour au questionnaire', () => {
    const { modifier } = afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier mes réponses' }));
    expect(modifier).toHaveBeenCalled();
  });

  it('certification obligatoire : « Valider » désactivé tant qu’elle n’est pas cochée', async () => {
    const { valider } = afficher();
    const bouton = screen.getByRole('button', { name: 'Valider' });
    expect(bouton.disabled).toBe(true);
    // Envoi du formulaire sans certification : rien ne part
    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: 'Récapitulatif' }));
    });
    expect(valider).not.toHaveBeenCalled();
    fireEvent.click(certification());
    expect(bouton.disabled).toBe(false);
  });

  it('validation : profil et avertissements affichés, pas de redirection automatique', async () => {
    vi.useFakeTimers();
    try {
      const { valider, allerA } = afficher();
      fireEvent.click(certification());
      await cliquer('Valider');
      expect(valider).toHaveBeenCalled();
      expect(texte()).toContain('Votre profil investisseur');
      expect(texte()).toContain('Prudent');
      expect(texte()).toContain('La durée de placement recommandée');
      expect(texte()).not.toContain('Votre profil est enregistré.');
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(allerA).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('« Accéder au Catalogue » : le Catalogue s’ouvre au clic', async () => {
    const { allerA } = afficher();
    fireEvent.click(certification());
    await cliquer('Valider');
    await cliquer('Accéder au Catalogue');
    expect(allerA).toHaveBeenCalledWith('/catalogue');
  });

  it('mise à jour refusée par le backend (409) : son message, on reste sur le récapitulatif', async () => {
    const message = 'Votre profil a été validé il y a moins de 24 heures. Réessayez plus tard.';
    const valider = vi.fn().mockRejectedValue(new ErreurApi(409, message));
    afficher({ valider });
    fireEvent.click(certification());
    await cliquer('Valider');
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.getByRole('form', { name: 'Récapitulatif' })).toBeDefined();
  });

  it('échec de la validation : message, réponses conservées, nouvel essai possible', async () => {
    const valider = vi
      .fn()
      .mockRejectedValueOnce(new ErreurApi(503, 'Indisponible'))
      .mockResolvedValueOnce({ profil: 'equilibre', avertissements: [] });
    afficher({ valider });
    fireEvent.click(certification());
    await cliquer('Valider');
    expect(screen.getByRole('alert').textContent).toBe(
      'La validation de votre profil n’a pas pu être enregistrée. Veuillez réessayer.',
    );
    expect(screen.getByRole('region', { name: 'Situation financière' })).toBeDefined();
    // Décocher puis recocher efface le message ; nouvel essai réussi
    fireEvent.click(certification());
    fireEvent.click(certification());
    expect(screen.queryByRole('alert')).toBeNull();
    await cliquer('Valider');
    expect(texte()).toContain('Équilibré');
  });
});
