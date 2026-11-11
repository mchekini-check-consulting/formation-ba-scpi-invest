import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageApplication from './PageApplication.jsx';
import { fermerRappel, oublierRappelFerme, rappelFerme } from './rappel.js';

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const identite = (aMettreAJour) => () =>
  Promise.resolve({
    nomComplet: 'Marie Curie',
    email: 'm@x.fr',
    profil: 'equilibre',
    aMettreAJour,
  });

async function afficher(aMettreAJour, proprietes = {}) {
  await act(async () => {
    render(
      <PageApplication
        titre="Catalogue SCPI"
        chargerIdentite={identite(aMettreAJour)}
        {...proprietes}
      >
        <p>Contenu</p>
      </PageApplication>,
    );
  });
}

const bandeau = () => screen.queryByRole('complementary', { name: 'Rappel' });

describe('Rappel de mise à jour du profil investisseur (US-05d)', () => {
  it('scénarios 5 et 7 : bandeau non bloquant, lien vers la mise à jour', async () => {
    await afficher(true);
    expect(bandeau().textContent).toContain('Votre profil investisseur doit être mis à jour');
    expect(screen.getByRole('link', { name: 'Mettre à jour' }).getAttribute('href')).toBe(
      '/profil-investisseur/mise-a-jour',
    );
    // L'écran reste affiché et utilisable
    expect(screen.getByText('Contenu')).toBeDefined();
  });

  it('scénario 6 : profil récent -> aucun bandeau', async () => {
    await afficher(false);
    expect(bandeau()).toBeNull();
  });

  it('fermé : ne revient pas avant la prochaine connexion', async () => {
    await afficher(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fermer le rappel' }));
    });
    expect(bandeau()).toBeNull();
    expect(rappelFerme()).toBe(true);
    cleanup();
    await afficher(true);
    expect(bandeau()).toBeNull();
    // Déconnexion : de nouveau affiché à la connexion suivante
    oublierRappelFerme();
    cleanup();
    await afficher(true);
    expect(bandeau()).not.toBeNull();
  });

  it('écran de la mise à jour (sansRappel) : pas de bandeau', async () => {
    await afficher(true, { sansRappel: true });
    expect(bandeau()).toBeNull();
  });

  it('stockage indisponible : aucune erreur, rappel considéré comme ouvert', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqué');
    });
    expect(rappelFerme()).toBe(false);
    expect(() => fermerRappel()).not.toThrow();
    expect(() => oublierRappelFerme()).not.toThrow();
  });
});
