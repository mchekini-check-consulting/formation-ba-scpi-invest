import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import { MESSAGE_TRANSMISE } from './demande.js';
import SuiviDemande from './SuiviDemande.jsx';

afterEach(cleanup);

const DOSSIER = {
  id: 42,
  numero: 'D-42',
  scpiId: 7,
  scpiNom: 'SCPI Exemple',
  gerant: 'Gestion Exemple',
  nombreParts: 5,
  prixPart: 200,
  montant: 1000,
  type: 'pleine_propriete',
  statut: 'demande_envoyee',
  demandeLe: '2026-11-24T10:00:00.000Z',
};

async function afficher({ transmise = false, ...options } = {}) {
  const props = {
    lire: vi.fn().mockResolvedValue(DOSSIER),
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: () => Promise.resolve({ nomComplet: '', email: '', profil: null }),
    ...options,
  };
  await act(async () => {
    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/demandes/42', state: transmise ? { transmise } : null }]}
      >
        <Routes>
          <Route path="/demandes/:id" element={<SuiviDemande {...props} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return props;
}

const texte = () => document.body.textContent.replace(/[  ]/g, ' ');
const ligne = (libelle) =>
  screen.getByText(libelle, { selector: 'dt' }).closest('div').querySelector('dd').textContent;

describe('suivi d’une demande (US-11, version courte)', () => {
  it('juste après la validation : message de transmission et dossier', async () => {
    const { lire } = await afficher({ transmise: true });
    expect(lire).toHaveBeenCalledWith('42');
    expect(screen.getByRole('status').textContent).toBe(MESSAGE_TRANSMISE);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Suivi de ma demande · SCPI Exemple' }),
    ).toBeTruthy();
    expect(ligne('Numéro de dossier')).toBe('D-42');
    expect(ligne('Nombre de parts')).toBe('5');
    expect(ligne('Type d’investissement')).toBe('Pleine propriété');
    expect(ligne('Date de la demande')).toBe('24/11/2026');
    expect(ligne('Statut')).toBe('Demande envoyée');
    expect(texte()).toContain('1 000 €');
    expect(texte()).toContain('Société de gestion · Gestion Exemple');
  });

  it('rouvert plus tard : pas de message de transmission', async () => {
    await afficher();
    expect(screen.queryByRole('status')).toBeNull();
    expect(ligne('Statut')).toBe('Demande envoyée');
  });

  it('dossier introuvable ou d’un autre investisseur : message de l’US-16', async () => {
    await afficher({
      lire: vi.fn().mockRejectedValue(new ErreurApi(404, 'Cette demande est introuvable.')),
    });
    expect(screen.getByRole('alert').textContent).toBe('Cette demande est introuvable.');
    expect(screen.getByRole('link', { name: 'Retour au catalogue' })).toBeTruthy();
  });

  it('session expirée : retour à la connexion', async () => {
    const { allerA } = await afficher({ lire: vi.fn().mockRejectedValue(new ErreurApi(401, '')) });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('chargement en cours : message d’attente', async () => {
    await afficher({ lire: vi.fn(() => new Promise(() => {})) });
    expect(texte()).toContain('Chargement…');
  });
});
