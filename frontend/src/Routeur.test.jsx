import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Routeur from './Routeur.jsx';

afterEach(cleanup);

function afficher(chemin, recherche = '') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Routeur chemin={chemin} recherche={recherche} />
    </QueryClientProvider>,
  );
}

const titre = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('Routeur', () => {
  it('/ : landing page', () => {
    afficher('/');
    expect(titre()).toContain('Choisissez vos SCPI en confiance');
  });

  it('/inscription : création de compte, email transmis par l’adresse', () => {
    afficher('/inscription/', '?email=jean%40exemple.fr');
    expect(titre()).toBe('Créer mon compte');
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('jean@exemple.fr');
  });

  it('/inscription sans email : champ vide', () => {
    afficher('/inscription');
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('');
  });

  it('/kyc : écran qui suit la création de compte', () => {
    afficher('/kyc');
    expect(titre()).toBe('Votre compte est créé');
  });

  it('/indicateurs : définitions des indicateurs', () => {
    afficher('/indicateurs');
    expect(titre()).toBe('Les indicateurs des SCPI, expliqués simplement.');
  });

  it('pages des autres US : bientôt disponibles', () => {
    afficher('/cgu');
    expect(titre()).toBe('Conditions générales d’utilisation');
    expect(document.body.textContent).toContain('bientôt disponible');
  });

  it('adresse inconnue : landing page', () => {
    afficher('/nimporte-quoi');
    expect(titre()).toContain('Choisissez vos SCPI en confiance');
  });
});
