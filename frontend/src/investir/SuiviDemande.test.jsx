import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import { AUCUNE_ACTION } from './demande.js';
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

const lire = (dossier) => vi.fn().mockResolvedValue(dossier);
const texte = () => document.body.textContent.replace(/[  ]/g, ' ');
const espaces = (t) => t.replace(/\s/g, ' ');
const ligne = (libelle) =>
  screen.getByText(libelle, { selector: 'dt' }).closest('div').querySelector('dd').textContent;
const titreCentre = () => document.getElementById('carte-statut').textContent;
const dates = () =>
  [...document.querySelectorAll('.investir__etape-date')].map((d) => d.textContent);
const consignes = () =>
  [...document.querySelectorAll('.suivi__consignes li')].map((li) => li.textContent);
const montant = () => espaces(document.querySelector('.suivi__montant').textContent);
const pastille = () => document.querySelector('.investir__statut');

// Les trois cartes de l'écran unique sont là, quel que soit le statut
function attendreEcranComplet() {
  expect(screen.getByRole('heading', { name: 'Avancement de ma demande' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Prochaine étape' })).toBeTruthy();
  expect(document.getElementById('carte-statut')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Votre dossier' })).toBeTruthy();
}

describe('suivi d’une demande : chargement et erreurs', () => {
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

describe('un seul écran pour toutes les étapes (correction de l’US-16)', () => {
  it('juste après « Valider ma demande » : le même écran complet', async () => {
    const props = await afficher({ transmise: true });
    expect(props.lire).toHaveBeenCalledWith('42');
    attendreEcranComplet();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Suivi de ma demande · SCPI Exemple' }),
    ).toBeTruthy();
    expect(texte()).toContain('Société de gestion · Gestion Exemple');
    expect(titreCentre()).toBe('Votre demande a été transmise');
  });

  it('dossier (règle 1) : ordre choisi par le BA, accusé de réception s’il est connu', async () => {
    await afficher();
    expect([...document.querySelectorAll('.suivi__ligne dt')].map((dt) => dt.textContent)).toEqual([
      'Numéro de dossier',
      'Prix de part',
      'Date de la demande',
      'SCPI',
      'Type d’investissement',
      'Statut',
      'Nombre de parts',
      'Montant',
    ]);
    expect(ligne('Numéro de dossier')).toBe('D-42');
    expect(ligne('Nombre de parts')).toBe('5');
    expect(ligne('Type d’investissement')).toBe('Pleine propriété');
    expect(ligne('Date de la demande')).toBe('24/11/2026');
    expect(ligne('Statut')).toBe('Demande envoyée');
    expect(texte()).toContain('1 000 €');
    expect(screen.queryByText('Accusé de réception', { selector: '.suivi__ligne dt' })).toBeNull();
  });

  it('demande envoyée : transmise, accusé de réception en attente, rien à faire', async () => {
    await afficher();
    attendreEcranComplet();
    expect(frise()).toEqual([
      ['Demande envoyée', 'Étape en cours'],
      ['Demande reçue', 'À venir'],
      ['Acceptée, en attente de paiement', 'À venir'],
      ['Investissement actif', 'À venir'],
    ]);
    expect(document.querySelector('[aria-current="step"]').textContent).toContain(
      'Demande envoyée',
    );
    expect(pastille().className).toContain('investir__statut--demande_envoyee');
    expect(titreCentre()).toBe('Votre demande a été transmise');
    expect(montant()).toBe('Montant demandé1 000 €');
    expect(ligne('Envoyée à la SCPI')).toBe('24/11/2026');
    expect(ligne('Accusé de réception')).toBe('En attente');
    expect(texte()).toContain(AUCUNE_ACTION);
    expect(consignes()).toEqual([
      '1La SCPI confirme la réception de votre demande.',
      '2Elle étudie votre dossier.',
      '3Vous recevez sa décision par mail.',
    ]);
  });

  it('demande reçue : dates d’envoi et de réception, décision en cours d’étude', async () => {
    await afficher({
      lire: lire({
        ...DOSSIER,
        statut: 'demande_recue',
        accuseReceptionLe: '2026-11-13T09:30:00.000Z',
      }),
    });
    attendreEcranComplet();
    expect(frise()[0]).toEqual(['Demande envoyée', 'Franchie']);
    expect(frise()[1]).toEqual(['Demande reçue', 'Étape en cours']);
    expect(dates()).toEqual([' · 24/11/2026']);
    expect(titreCentre()).toBe('La SCPI étudie votre demande');
    expect(ligne('Reçue par la SCPI')).toBe('13/11/2026');
    expect(ligne('Décision de la SCPI')).toBe('En cours d’étude');
    expect(ligne('Accusé de réception')).toBe('13/11/2026');
    // Le texte de la carte de gauche ne répète pas les faits de la carte du centre
    expect(document.querySelector('.suivi__texte').textContent).toBe(
      'Vous serez informé par mail de la décision de la SCPI.',
    );
  });

  it('demande reçue sans date d’accusé : « Non communiqué »', async () => {
    await afficher({ lire: lire({ ...DOSSIER, statut: 'demande_recue' }) });
    expect(ligne('Reçue par la SCPI')).not.toBe('');
    expect(ligne('Reçue par la SCPI')).not.toContain('/');
  });

  it('dossier accepté (D-1015) : référence, IBAN, BIC et montant à virer', async () => {
    await afficher({ lire: lire(ACCEPTE) });
    attendreEcranComplet();
    expect(frise()).toEqual([
      ['Demande envoyée', 'Franchie'],
      ['Demande reçue', 'Franchie'],
      ['Acceptée, en attente de paiement', 'Étape en cours'],
      ['Investissement actif', 'À venir'],
    ]);
    expect(dates()).toEqual([' · 24/11/2026', ' · 13/11/2026']);
    expect(pastille().className).toContain('investir__statut--acceptee_attente_paiement');
    expect(titreCentre()).toBe('Effectuez votre virement');
    expect(ligne('Référence à indiquer')).toBe('SIP-COME-20261113-4HX8QA');
    expect(ligne('IBAN')).toBe('FR76 3000 6000 0112 3456 7890 189');
    expect(ligne('BIC')).toBe('AGRIFRPP');
    expect(montant()).toBe('Montant à virer1 000 €');
    expect(consignes()).toHaveLength(3);
    expect(document.querySelector('.suivi__note')).toBeNull();
  });

  it('bouton « Copier » : copie la valeur et l’indique sur le bouton', async () => {
    const copier = vi.fn().mockResolvedValue(undefined);
    await afficher({ lire: lire(ACCEPTE), copier });
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
    await afficher({ lire: lire(ACCEPTE), copier });
    const bouton = screen.getByRole('button', { name: 'Copier le BIC' });
    await act(async () => bouton.click());
    expect(bouton.textContent).toBe('Copier');
  });

  it('coordonnées de virement pas encore connues : « Non communiqué », pas de bouton', async () => {
    await afficher({
      lire: lire({
        ...ACCEPTE,
        paiement: { iban: null, bic: null, montant: 1000, reference: null },
      }),
    });
    expect(ligne('IBAN')).not.toBe('');
    expect(ligne('IBAN')).toBe(ligne('Référence à indiquer'));
    expect(screen.queryByRole('button', { name: /Copier/ })).toBeNull();
  });

  it('dossier accepté sans paiement renvoyé : montant du dossier, coordonnées inconnues', async () => {
    await afficher({ lire: lire({ ...ACCEPTE, paiement: null }) });
    expect(montant()).toBe('Montant à virer1 000 €');
    expect(screen.queryByRole('button', { name: /Copier/ })).toBeNull();
  });

  it('dossier refusé (D-1002) : frise arrêtée à « Refusée », motif et lien vers le catalogue', async () => {
    await afficher({
      lire: lire({
        ...DOSSIER,
        id: 1002,
        numero: 'D-1002',
        statut: 'refusee',
        motifRefus: 'Dossier KYC incomplet',
      }),
    });
    attendreEcranComplet();
    expect(frise()).toEqual([
      ['Demande envoyée', 'Franchie'],
      ['Demande reçue', 'Franchie'],
      ['Refusée', 'Étape en cours'],
    ]);
    expect(ligne('Statut')).toBe('Refusée');
    expect(pastille().className).toContain('investir__statut--refusee');
    expect(titreCentre()).toBe('Votre demande n’a pas été acceptée');
    expect(document.querySelector('.suivi__motif strong').textContent).toBe(
      'Dossier KYC incomplet',
    );
    expect(ligne('Virement à faire')).toBe('Aucun');
    expect(
      screen.getByRole('link', { name: 'Choisir une autre SCPI →' }).getAttribute('href'),
    ).toBe('/catalogue');
    expect(screen.queryByText('IBAN')).toBeNull();
  });

  it('dossier refusé sans motif connu : « Non communiqué »', async () => {
    await afficher({ lire: lire({ ...DOSSIER, statut: 'refusee', motifRefus: null }) });
    expect(document.querySelector('.suivi__motif strong').textContent).not.toBe('');
  });

  it('investissement actif : montant investi, date de jouissance et parts détenues', async () => {
    await afficher({
      lire: lire({ ...DOSSIER, statut: 'investissement_actif', jouissanceLe: '2027-01-01' }),
    });
    attendreEcranComplet();
    expect(frise().map(([, etat]) => etat)).toEqual([
      'Franchie',
      'Franchie',
      'Franchie',
      'Étape en cours',
    ]);
    expect(titreCentre()).toBe('Votre investissement est actif');
    expect(montant()).toBe('Montant investi1 000 €');
    expect(ligne('Paiement reçu par la SCPI')).toBe('Oui');
    expect(ligne('Date d’entrée en jouissance')).toBe('01/01/2027');
    expect(ligne('Parts détenues')).toBe('5');
    expect(consignes()).toHaveLength(2);
  });

  it('investissement actif sans date de jouissance : « Non communiqué », pas de date vide', async () => {
    await afficher({ lire: lire({ ...DOSSIER, statut: 'investissement_actif' }) });
    expect(ligne('Date d’entrée en jouissance')).not.toBe('');
    expect(ligne('Date d’entrée en jouissance')).not.toContain('/');
  });

  it('statut inconnu de l’écran : écran complet, rien de plus affirmé que le montant', async () => {
    await afficher({ lire: lire({ ...DOSSIER, statut: 'autre' }) });
    attendreEcranComplet();
    expect(titreCentre()).toBe('autre');
    expect(montant()).toBe('Montant demandé1 000 €');
    expect(document.querySelector('.suivi__faits')).toBeNull();
    expect(consignes()).toEqual([]);
  });
});
