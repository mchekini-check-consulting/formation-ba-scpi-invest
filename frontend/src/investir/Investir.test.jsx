import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Investir from './Investir.jsx';

afterEach(cleanup);

// SCPI du critère d'acceptation : part à 200 €, minimum 1 000 € (5 parts)
const FICHE = {
  id: 7,
  nom: 'SCPI Exemple',
  gerant: 'Gestion Exemple',
  minimum: 1000,
  minimumParts: 5,
  fraisSouscription: 10,
  prixPart: { annee: 2026, valeur: 200 },
};

function Arrivee() {
  const { pathname, state } = useLocation();
  return <p data-testid="arrivee">{`${pathname} ${state?.transmise ? 'transmise' : ''}`}</p>;
}

async function afficher(options = {}) {
  const props = {
    lire: vi.fn().mockResolvedValue(FICHE),
    creer: vi.fn().mockResolvedValue({ id: 42 }),
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: () => Promise.resolve({ nomComplet: '', email: '', profil: null }),
    ...options,
  };
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/investir/7']}>
        <Routes>
          <Route path="/investir/:id" element={<Investir {...props} />} />
          <Route path="*" element={<Arrivee />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return props;
}

const texte = () => document.body.textContent.replace(/[  ]/g, ' ');
const champ = () => screen.getByLabelText('Nombre de parts');
const bouton = () => screen.getByRole('button', { name: /Valider ma demande/ });
const saisir = (valeur) => fireEvent.change(champ(), { target: { value: valeur } });
// Ligne du récapitulatif (les frais figurent aussi dans les chiffres clés)
const ligne = (libelle) =>
  within(screen.getByRole('region', { name: 'Récapitulatif' }))
    .getByText(libelle, { selector: 'dt' })
    .closest('div')
    .querySelector('dd').textContent;

describe('écran Investir (US-11)', () => {
  it('règle 1 : rappelle la SCPI, sa société de gestion, son prix et son minimum', async () => {
    const { lire } = await afficher();
    expect(lire).toHaveBeenCalledWith('7');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Investir dans SCPI Exemple' }),
    ).toBeTruthy();
    for (const attendu of [
      'Société de gestion · Gestion Exemple',
      '200 €',
      'en 2026',
      '1 000 €',
      'soit 5 parts',
      '10,00 %',
    ]) {
      expect(texte()).toContain(attendu);
    }
  });

  it('ouverture : minimum proposé, pleine propriété par défaut, récapitulatif rempli', async () => {
    await afficher();
    expect(champ().value).toBe('5');
    expect(screen.getByRole('radio', { name: /Pleine propriété/ }).checked).toBe(true);
    expect(ligne('Nombre de parts')).toBe('5');
    expect(ligne('Type d’investissement')).toBe('Pleine propriété');
    expect(ligne('Frais de souscription').replace(/\s/g, ' ')).toBe('10,00 %');
    expect(texte()).toContain('Atteint');
    expect(bouton().disabled).toBe(false);
  });

  it('scénario « saisie d’un nombre non entier impossible » : la virgule n’est pas saisie', async () => {
    await afficher();
    saisir('2,5');
    expect(champ().value).toBe('25');
    expect(texte()).toContain('5 000 €');
  });

  it('scénario « minimum non atteint » : message et bouton inactif', async () => {
    await afficher();
    saisir('4');
    expect(screen.getByRole('alert').textContent.replace(/[  ]/g, ' ')).toBe(
      'Le minimum à investir pour cette SCPI est de 1 000 €, soit 5 parts.',
    );
    expect(texte()).toContain('Non atteint');
    expect(texte()).toContain('800 €');
    expect(champ().getAttribute('aria-invalid')).toBe('true');
    expect(bouton().disabled).toBe(true);
  });

  it('scénario « nombre de parts à zéro » : message et bouton inactif', async () => {
    await afficher();
    saisir('0');
    expect(screen.getByRole('alert').textContent).toBe(
      'Saisissez un nombre entier de parts supérieur à 0.',
    );
    expect(ligne('Nombre de parts')).toBe('—');
    expect(bouton().disabled).toBe(true);
  });

  it('règle 5 : le récapitulatif suit le type choisi', async () => {
    await afficher();
    fireEvent.click(screen.getByRole('radio', { name: /Usufruit/ }));
    expect(ligne('Type d’investissement')).toBe('Usufruit');
  });

  it('scénario « demande valide » : dossier créé puis suivi ouvert avec le message', async () => {
    const { creer } = await afficher();
    saisir('6');
    fireEvent.click(screen.getByRole('radio', { name: /Nue-propriété/ }));
    await act(async () => fireEvent.click(bouton()));
    expect(creer).toHaveBeenCalledWith({ scpiId: 7, nombreParts: 6, type: 'nue_propriete' });
    expect(screen.getByTestId('arrivee').textContent).toBe('/demandes/42 transmise');
  });

  it('demande refusée par le backend : message affiché, nouvelle tentative possible', async () => {
    const creer = vi.fn().mockRejectedValue(new ErreurApi(400, 'Refus du backend'));
    await afficher({ creer });
    await act(async () => fireEvent.click(bouton()));
    expect(screen.getByRole('alert').textContent).toBe('Refus du backend');
    expect(bouton().disabled).toBe(false);
    saisir('7');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('KYC non validé (403) : message dédié et lien vers le formulaire KYC', async () => {
    const creer = vi.fn().mockRejectedValue(new ErreurApi(403, 'Refus du backend'));
    await afficher({ creer });
    await act(async () => fireEvent.click(bouton()));
    expect(screen.getByRole('alert').textContent).toBe(
      'Votre KYC doit être validé avant de pouvoir investir. Complétez-le pour envoyer votre demande.',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Compléter mon KYC' }));
    expect(screen.getByTestId('arrivee').textContent).toBe('/connaissance-client ');
  });

  it('SCPI absente du catalogue : message et lien vers le Catalogue', async () => {
    await afficher({
      lire: vi.fn().mockRejectedValue(new ErreurApi(404, 'Cette SCPI n’est pas disponible')),
    });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cette SCPI n’est pas disponible' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour au catalogue' }).getAttribute('href')).toBe(
      '/catalogue',
    );
  });

  it('service indisponible : message d’erreur', async () => {
    await afficher({ lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible')) });
    expect(screen.getByRole('alert').textContent).toBe('Indisponible');
  });

  it('session expirée : retour à la connexion', async () => {
    const { allerA } = await afficher({ lire: vi.fn().mockRejectedValue(new ErreurApi(401, '')) });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('chargement en cours : message d’attente', async () => {
    await afficher({ lire: vi.fn(() => new Promise(() => {})) });
    expect(texte()).toContain('Chargement…');
  });

  it('« Retour à la fiche » ramène à la fiche de la SCPI', async () => {
    await afficher();
    expect(screen.getByRole('link', { name: /Retour à la fiche/ }).getAttribute('href')).toBe(
      '/catalogue/7',
    );
  });
});
