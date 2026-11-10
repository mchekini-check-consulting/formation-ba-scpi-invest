import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { EVENEMENT_SESSION_EXPIREE } from './auth.js';
import Routeur from './Routeur.jsx';

afterEach(cleanup);

function Adresse() {
  return <output data-testid="adresse">{useLocation().pathname}</output>;
}

function afficher(chemin, recherche = '', passer = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[chemin + recherche]}>
        <Routeur passer={passer} />
        <Adresse />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const titre = () => screen.getByRole('heading', { level: 1 }).textContent;

describe('Routeur', () => {
  it('/outils/import-catalogue : outil de test de l’import (dev et poste)', () => {
    afficher('/outils/import-catalogue');
    expect(titre()).toBe('Import du catalogue');
  });

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

  it('/connaissance-client : écran qui suit la création de compte et la connexion', () => {
    afficher('/connaissance-client');
    expect(titre()).toBe('Connaissance client (KYC)');
  });

  it('/kyc (ancienne adresse) : redirigé vers /connaissance-client', () => {
    afficher('/kyc');
    expect(titre()).toBe('Connaissance client (KYC)');
    expect(localStorage.getItem('scpi-invest.derniere-page')).toBe('/connaissance-client');
  });

  it('/formulaire-investisseur : écran protégé, rien sans session ni KYC validé', () => {
    sessionStorage.clear();
    afficher('/formulaire-investisseur');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('/catalogue : écran protégé (KYC puis profil validés), dernier écran mémorisé', () => {
    sessionStorage.clear();
    afficher('/catalogue');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(localStorage.getItem('scpi-invest.derniere-page')).toBe('/catalogue');
  });

  it('/profil : écran protégé (KYC validé), hors parcours de reprise après connexion', () => {
    sessionStorage.clear();
    localStorage.clear();
    afficher('/profil');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByTestId('adresse').textContent).toBe('/profil');
    expect(localStorage.getItem('scpi-invest.derniere-page')).toBeNull();
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

describe('Raccourci de test du poste : formulaires passés', () => {
  it.each(['/connaissance-client', '/kyc', '/formulaire-investisseur'])(
    '%s -> Catalogue',
    async (chemin) => {
      afficher(chemin, '', true);
      expect((await screen.findByTestId('adresse')).textContent).toBe('/catalogue');
    },
  );

  it('sans le raccourci : le KYC reste affiché', () => {
    afficher('/connaissance-client');
    expect(screen.getByTestId('adresse').textContent).toBe('/connaissance-client');
  });

  it('US-03b : session expirée signalée par auth.js -> écran de connexion', () => {
    afficher('/mentions-legales');
    act(() => {
      window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
    });
    expect(screen.getByTestId('adresse').textContent).toBe('/connexion');
    expect(titre()).toBe('Se connecter');
  });
});
