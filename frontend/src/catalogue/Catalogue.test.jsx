import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Catalogue from './Catalogue.jsx';

afterEach(cleanup);

async function afficher({
  lire = vi.fn().mockResolvedValue({ etapeCourante: 6, reponses: {}, valide: true }),
  seDeconnecter = vi.fn().mockResolvedValue(undefined),
  allerA = vi.fn(),
} = {}) {
  await act(async () => {
    render(<Catalogue lire={lire} seDeconnecter={seDeconnecter} allerA={allerA} />);
  });
  return { seDeconnecter, allerA };
}

const texte = () => document.body.textContent;

describe('Catalogue (accès après validation du profil, US-05b)', () => {
  it('profil validé : catalogue affiché', async () => {
    const { allerA } = await afficher();
    expect(texte()).toContain('Votre profil investisseur est validé.');
    expect(allerA).not.toHaveBeenCalled();
  });

  it('profil non validé (certification non cochée) : formulaire investisseur', async () => {
    const { allerA } = await afficher({
      lire: vi.fn().mockResolvedValue({ etapeCourante: 6, reponses: {}, valide: false }),
    });
    expect(allerA).toHaveBeenCalledWith('/formulaire-investisseur');
    expect(texte()).not.toContain('Votre profil investisseur est validé.');
  });

  it('sans session : connexion', async () => {
    const { allerA } = await afficher({
      lire: vi.fn().mockRejectedValue(new ErreurApi(401, 'connexion requise')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('service indisponible : message d’erreur', async () => {
    await afficher({ lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible.')) });
    expect(screen.getByRole('alert').textContent).toBe('Indisponible.');
  });

  it('pendant la vérification : message d’attente', () => {
    render(<Catalogue lire={() => new Promise(() => {})} allerA={vi.fn()} />);
    expect(texte()).toContain('Chargement…');
  });

  it('déconnexion depuis l’en-tête', async () => {
    const { seDeconnecter, allerA } = await afficher();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    });
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
