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
  accuseReceptionLe: null,
  motifRefus: null,
  paiement: null,
  jouissanceLe: null,
};

// Étapes de la frise : [libellé, état affiché]
const frise = () =>
  [...document.querySelectorAll('.investir__etape')].map((li) => [
    li.querySelector('.investir__etape-libelle').textContent,
    li.querySelector('.investir__etape-etat').textContent,
  ]);

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
    // Écran simple, sans frise ni cartes, juste après la validation
    expect(frise()).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Prochaine étape' })).toBeNull();
  });

  it('juste après la validation, même pour un statut plus avancé : écran simple', async () => {
    await afficher({ transmise: true, lire: vi.fn().mockResolvedValue(ACCEPTE) });
    expect(frise()).toEqual([]);
    expect(screen.queryByRole('button', { name: /Copier/ })).toBeNull();
  });

  it('rouvert plus tard : écran simple avec la frise et le message vert', async () => {
    await afficher();
    expect(screen.getByRole('status').textContent).toBe(MESSAGE_TRANSMISE);
    expect(frise()).toHaveLength(4);
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

const ACCEPTE = {
  ...DOSSIER,
  id: 1015,
  numero: 'D-1015',
  statut: 'acceptee_attente_paiement',
  accuseReceptionLe: '2026-11-13T09:30:00.000Z',
  paiement: {
    iban: 'FR76 3000 6000 0112 3456 7890 189',
    bic: 'AGRIFRPP',
    montant: 1000,
    reference: 'SIP-COME-20261113-4HX8QA',
  },
};

const espaces = (t) => t.replace(/\s/g, ' ');
const titreCentre = () => document.getElementById('carte-statut').textContent;
const dates = () =>
  [...document.querySelectorAll('.investir__etape-date')].map((d) => d.textContent);

describe('suivre l’avancement de ma demande (US-16, SCPI-264, maquette F)', () => {
  it('demande envoyée : première étape en cours, rien à faire pour l’investisseur', async () => {
    await afficher();
    expect(frise()).toEqual([
      ['Demande envoyée', 'Étape en cours'],
      ['Demande reçue', 'À venir'],
      ['Acceptée, en attente de paiement', 'À venir'],
      ['Investissement actif', 'À venir'],
    ]);
    expect(document.querySelector('[aria-current="step"]').textContent).toContain(
      'Demande envoyée',
    );
    // Écran simple : message vert et dossier, pas de cartes
    expect(screen.getByRole('status').textContent).toBe(MESSAGE_TRANSMISE);
    expect(screen.queryByRole('heading', { name: 'Prochaine étape' })).toBeNull();
    expect(document.getElementById('carte-statut')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Votre dossier' })).toBeTruthy();
    expect(screen.queryByText('Accusé de réception', { selector: 'dt' })).toBeNull();
  });

  it('demande reçue : étape franchie datée, accusé de réception dans le dossier', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({
        ...DOSSIER,
        statut: 'demande_recue',
        accuseReceptionLe: '2026-11-13T09:30:00.000Z',
      }),
    });
    expect(frise()[0]).toEqual(['Demande envoyée', 'Franchie']);
    expect(frise()[1]).toEqual(['Demande reçue', 'Étape en cours']);
    expect(dates()).toEqual([' · 24/11/2026']);
    expect(ligne('Accusé de réception')).toBe('13/11/2026');
    expect(screen.getByRole('status').textContent).toBe(
      'La SCPI a bien reçu votre demande le 13/11/2026. Elle l’analyse et vous informera par mail de sa décision.',
    );
    expect(document.getElementById('carte-statut')).toBeNull();
  });

  it('statut inconnu de l’écran : écran simple, message de transmission', async () => {
    await afficher({ lire: vi.fn().mockResolvedValue({ ...DOSSIER, statut: 'autre' }) });
    expect(screen.getByRole('status').textContent).toBe(MESSAGE_TRANSMISE);
    expect(document.getElementById('carte-statut')).toBeNull();
  });

  it('demande reçue sans date d’accusé : message de transmission', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({ ...DOSSIER, statut: 'demande_recue' }),
    });
    expect(screen.getByRole('status').textContent).toBe(MESSAGE_TRANSMISE);
  });

  it('dossier accepté (D-1015) : étapes franchies, référence, IBAN et montant à virer', async () => {
    await afficher({ lire: vi.fn().mockResolvedValue(ACCEPTE) });
    expect(frise()).toEqual([
      ['Demande envoyée', 'Franchie'],
      ['Demande reçue', 'Franchie'],
      ['Acceptée, en attente de paiement', 'Étape en cours'],
      ['Investissement actif', 'À venir'],
    ]);
    expect(dates()).toEqual([' · 24/11/2026', ' · 13/11/2026']);
    expect(titreCentre()).toBe('Effectuez votre virement');
    expect(ligne('Référence à indiquer')).toBe('SIP-COME-20261113-4HX8QA');
    expect(ligne('IBAN')).toBe('FR76 3000 6000 0112 3456 7890 189');
    expect(ligne('BIC')).toBe('AGRIFRPP');
    expect(espaces(document.querySelector('.suivi__montant').textContent)).toBe(
      'Montant à virer1 000 €',
    );
    // Consignes numérotées dans « Prochaine étape »
    expect(document.querySelectorAll('.suivi__consignes li')).toHaveLength(3);
  });

  it('bouton « Copier » : copie la valeur et l’indique sur le bouton', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    await afficher({ lire: vi.fn().mockResolvedValue(ACCEPTE), copier });
    const bouton = screen.getByRole('button', { name: 'Copier l’IBAN' });
    await act(async () => bouton.click());
    expect(copier).toHaveBeenCalledWith('FR76 3000 6000 0112 3456 7890 189');
    expect(bouton.textContent).toBe('Copié');
    expect(screen.getByRole('button', { name: 'Copier le BIC' }).textContent).toBe('Copier');

    await act(async () => screen.getByRole('button', { name: 'Copier la référence' }).click());
    expect(copier).toHaveBeenLastCalledWith('SIP-COME-20261113-4HX8QA');
    expect(bouton.textContent).toBe('Copier');
  });

  it('copie refusée par le navigateur : le bouton reste « Copier »', async () => {
    const copier = vi.fn().mockRejectedValue(new Error('refus'));
    await afficher({ lire: vi.fn().mockResolvedValue(ACCEPTE), copier });
    const bouton = screen.getByRole('button', { name: 'Copier le BIC' });
    await act(async () => bouton.click());
    expect(bouton.textContent).toBe('Copier');
  });

  it('coordonnées de virement pas encore connues : « Non communiqué », pas de bouton', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({
        ...ACCEPTE,
        paiement: { iban: null, bic: null, montant: 1000, reference: null },
      }),
    });
    expect(ligne('IBAN')).not.toBe('');
    expect(ligne('IBAN')).toBe(ligne('Référence à indiquer'));
    expect(screen.queryByRole('button', { name: /Copier/ })).toBeNull();
  });

  it('dossier refusé (D-1002) : frise arrêtée à « Refusée » et motif affiché', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({
        ...DOSSIER,
        id: 1002,
        numero: 'D-1002',
        statut: 'refusee',
        motifRefus: 'Dossier KYC incomplet',
      }),
    });
    expect(frise()).toEqual([
      ['Demande envoyée', 'Franchie'],
      ['Demande reçue', 'Franchie'],
      ['Refusée', 'Étape en cours'],
    ]);
    expect(ligne('Statut')).toBe('Refusée');
    // Maquette K : écran simple, message rouge avec le motif et un lien vers le catalogue
    const message = screen.getByRole('status');
    expect(message.className).toContain('suivi__message--refus');
    expect(message.querySelector('p').textContent).toBe(
      'La SCPI n’a pas accepté votre demande. Motif : Dossier KYC incomplet.',
    );
    expect(screen.getByRole('link', { name: 'Choisir une autre SCPI →' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Prochaine étape' })).toBeNull();
    expect(screen.queryByText('IBAN')).toBeNull();
  });

  it('dossier refusé sans motif connu : « Non communiqué »', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({ ...DOSSIER, statut: 'refusee', motifRefus: null }),
    });
    expect(screen.getByRole('status').querySelector('strong').textContent).not.toBe('');
  });

  it('investissement actif : date de jouissance', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({
        ...DOSSIER,
        statut: 'investissement_actif',
        jouissanceLe: '2027-01-01',
      }),
    });
    expect(frise().map(([, etat]) => etat)).toEqual([
      'Franchie',
      'Franchie',
      'Franchie',
      'Étape en cours',
    ]);
    // Maquette M : écran simple, message vert avec la date de jouissance
    expect(screen.getByRole('status').textContent).toBe(
      'Votre investissement est actif : vos parts vous appartiennent. Date d’entrée en jouissance : 01/01/2027.',
    );
    expect(screen.queryByRole('heading', { name: 'Prochaine étape' })).toBeNull();
  });

  it('investissement actif sans date de jouissance : pas de date vide', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({ ...DOSSIER, statut: 'investissement_actif' }),
    });
    expect(screen.getByRole('status').textContent).toBe(
      'Votre investissement est actif : vos parts vous appartiennent.',
    );
  });
});
