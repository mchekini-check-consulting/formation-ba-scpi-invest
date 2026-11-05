import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import { AVERTISSEMENTS, PROFILS } from './profils.js';
import ResultatProfil from './ResultatProfil.jsx';

afterEach(cleanup);

async function afficher({
  resultat = { profil: 'prudent', avertissements: [] },
  lireProfil = vi.fn().mockResolvedValue(resultat),
  valider = vi.fn().mockResolvedValue(resultat),
  modifier = vi.fn(),
  apresValidation = vi.fn(),
} = {}) {
  await act(async () => {
    render(
      <ResultatProfil
        lireProfil={lireProfil}
        valider={valider}
        modifier={modifier}
        apresValidation={apresValidation}
      />,
    );
  });
  return { valider, modifier, apresValidation };
}

const texte = () => document.body.textContent;
const certification = () =>
  screen.getByRole('checkbox', { name: 'Je certifie l’exactitude de mes réponses' });
const bouton = () => screen.getByRole('button', { name: 'Valider' });

async function validerProfil() {
  await act(async () => {
    fireEvent.click(bouton());
  });
}

describe('ResultatProfil (US-05b)', () => {
  it.each([
    ['prudent', 'Prudent'],
    ['equilibre', 'Équilibré'],
    ['dynamique', 'Dynamique'],
  ])('scénario 1 : profil %s affiché avec son explication', async (profil, nom) => {
    await afficher({ resultat: { profil, avertissements: [] } });
    expect(screen.getByText(nom)).toBeDefined();
    expect(texte()).toContain(PROFILS[profil].explication);
  });

  it('textes repris de l’US, sans recommandation de produit', () => {
    expect(PROFILS.prudent.explication).toBe(
      'Vous privilégiez la préservation de votre capital et acceptez peu de variations de la valeur de vos placements.',
    );
    expect(AVERTISSEMENTS.horizon).toBe(
      'La durée de placement recommandée pour une SCPI est d’au moins 8 ans.',
    );
    expect(JSON.stringify(PROFILS)).not.toMatch(/recommand|conseill/i);
  });

  it('scénarios 3 à 5 : avertissements affichés avec le profil', async () => {
    await afficher({
      resultat: { profil: 'prudent', avertissements: ['connaissances', 'horizon'] },
    });
    expect(texte()).toContain(AVERTISSEMENTS.connaissances);
    expect(texte()).toContain(AVERTISSEMENTS.horizon);
  });

  it('sans avertissement : aucun message', async () => {
    await afficher();
    expect(texte()).not.toContain(AVERTISSEMENTS.connaissances);
    expect(texte()).not.toContain(AVERTISSEMENTS.horizon);
  });

  it('scénario 7 : « Modifier mes réponses »', async () => {
    const { modifier } = await afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier mes réponses' }));
    expect(modifier).toHaveBeenCalled();
  });

  it('scénario 8 : certification non cochée -> « Valider » désactivé', async () => {
    const { valider } = await afficher();
    expect(certification().checked).toBe(false);
    expect(bouton().disabled).toBe(true);
    await validerProfil();
    expect(valider).not.toHaveBeenCalled();
    fireEvent.click(certification());
    expect(bouton().disabled).toBe(false);
  });

  it('scénario 9 : certification cochée + « Valider » -> enregistré, suite du parcours', async () => {
    const { valider, apresValidation } = await afficher();
    fireEvent.click(certification());
    await validerProfil();
    expect(valider).toHaveBeenCalled();
    expect(apresValidation).toHaveBeenCalled();
  });

  it('scénario 10 : échec de la validation -> message, reste sur le profil', async () => {
    const { apresValidation } = await afficher({
      valider: vi.fn().mockRejectedValue(new ErreurApi(503, 'indisponible')),
    });
    fireEvent.click(certification());
    await validerProfil();
    expect(screen.getByRole('alert').textContent).toBe(
      'La validation de votre profil n’a pas pu être enregistrée. Veuillez réessayer.',
    );
    expect(apresValidation).not.toHaveBeenCalled();
    expect(texte()).toContain('Prudent');
    expect(certification().checked).toBe(true);
    expect(bouton().disabled).toBe(false);

    // le message disparaît quand on modifie la certification
    fireEvent.click(certification());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pendant la validation : bouton désactivé « Validation en cours… »', async () => {
    await afficher({ valider: () => new Promise(() => {}) });
    fireEvent.click(certification());
    await validerProfil();
    expect(screen.getByRole('button', { name: 'Validation en cours…' }).disabled).toBe(true);
  });

  it('profil impossible à calculer : message d’erreur', async () => {
    await afficher({
      lireProfil: vi.fn().mockRejectedValue(new ErreurApi(503, 'Le service est indisponible.')),
    });
    expect(screen.getByRole('alert').textContent).toBe('Le service est indisponible.');
  });

  it('pendant le calcul : message d’attente', () => {
    render(
      <ResultatProfil
        lireProfil={() => new Promise(() => {})}
        valider={vi.fn()}
        modifier={vi.fn()}
        apresValidation={vi.fn()}
      />,
    );
    expect(texte()).toContain('Calcul de votre profil…');
  });
});
