import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import Routeur from './Routeur.jsx';

afterEach(cleanup);

function afficher(chemin, recherche = '') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[chemin + recherche]}>
        <Routeur />
      </MemoryRouter>
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

  it('/connexion : écran de connexion (US-03a)', () => {
    afficher('/connexion', '?email=jean%40exemple.fr');
    expect(titre()).toBe('Se connecter');
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('jean@exemple.fr');
  });

  it('/connexion sans email : champ vide', () => {
    afficher('/connexion');
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('');
  });

  it('/kyc : écran qui suit la création de compte et la connexion', () => {
    afficher('/kyc');
    expect(titre()).toBe('Bienvenue dans votre espace');
  });

  it('/indicateurs : définitions des indicateurs', () => {
    afficher('/indicateurs');
    expect(titre()).toBe('Les indicateurs des SCPI, expliqués simplement.');
  });

  it.each([
    ['/mentions-legales', 'Mentions légales'],
    ['/confidentialite', 'Politique de confidentialité'],
    ['/cgu', 'Conditions générales d’utilisation'],
    ['/contact/', 'Contact'],
  ])('%s : page légale du pied de page (US-01b)', (chemin, attendu) => {
    afficher(chemin);
    expect(titre()).toBe(attendu);
    expect(document.body.textContent).not.toContain('bientôt disponible');
  });

  it('adresse inconnue : landing page', () => {
    afficher('/nimporte-quoi');
    expect(titre()).toContain('Choisissez vos SCPI en confiance');
  });
});
