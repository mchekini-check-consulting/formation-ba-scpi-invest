import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import { photoScpi } from '../catalogue/photos.js';
import { AUCUN_INVESTISSEMENT } from './investissements.js';
import Portefeuille, { ERREUR_CHARGEMENT } from './Portefeuille.jsx';

afterEach(cleanup);

const dossier = (valeurs) => ({
  mode: 'ponctuel',
  type: 'pleine_propriete',
  jouissanceLe: null,
  referenceVirement: null,
  motifRefus: null,
  ...valeurs,
});

// Critère d'acceptation : 3 dossiers « Transitions Europe » (5 000 € actif, 2 000 € actif,
// 1 000 € refusé), plus une SCPI sans investissement actif
const PORTEFEUILLE = {
  scpis: [
    {
      scpiId: 7,
      scpiNom: 'Transitions Europe',
      gerant: 'Arkéa REIM',
      nombreDossiers: 3,
      montantInvesti: 7000,
      nombreParts: 35,
      revenusMensuels: 42,
      dossiers: [
        dossier({
          id: 103,
          numero: 'D-103',
          demandeLe: '2026-11-10T10:00:00.000Z',
          nombreParts: 5,
          montant: 1000,
          statut: 'refusee',
          motifRefus: 'Dossier incomplet',
        }),
        dossier({
          id: 102,
          numero: 'D-102',
          demandeLe: '2026-10-10T10:00:00.000Z',
          mode: 'programme',
          type: 'usufruit',
          nombreParts: 10,
          montant: 2000,
          statut: 'investissement_actif',
          jouissanceLe: '2026-12-01',
        }),
        dossier({
          id: 101,
          numero: 'D-101',
          demandeLe: '2026-09-10T10:00:00.000Z',
          nombreParts: 25,
          montant: 5000,
          statut: 'investissement_actif',
          jouissanceLe: '2026-11-01',
        }),
      ],
    },
    {
      scpiId: 8,
      scpiNom: 'Iroko Zen',
      gerant: null,
      nombreDossiers: 1,
      montantInvesti: 0,
      nombreParts: 0,
      revenusMensuels: 0,
      dossiers: [
        dossier({
          id: 104,
          numero: 'D-104',
          demandeLe: '2026-11-20T10:00:00.000Z',
          nombreParts: 1,
          montant: 202,
          statut: 'acceptee_attente_paiement',
          referenceVirement: 'SIP-IROK-4HX8QA',
        }),
      ],
    },
  ],
};

async function afficher(options = {}) {
  const props = {
    lister: vi.fn().mockResolvedValue(PORTEFEUILLE),
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: () => Promise.resolve({ nomComplet: '', email: '', profil: null }),
    ...options,
  };
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/portefeuille']}>
        <Portefeuille {...props} />
      </MemoryRouter>,
    );
  });
  return props;
}

const ligneScpi = (nom) => screen.getByRole('button', { name: new RegExp(nom) });

// Chiffres d'une carte SCPI : { libellé: valeur }
const chiffres = (bouton) =>
  Object.fromEntries(
    [...bouton.querySelectorAll('.portefeuille__chiffre-texte')].map((c) => [
      c.querySelector('span').textContent,
      c.querySelector('strong').textContent.replace(/\s/g, ' '),
    ]),
  );

describe('Mon portefeuille : Mes investissements (US-20, SCPI-267)', () => {
  it('bandeau : titre, nombre de SCPI et de dossiers, lien vers le catalogue', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mon portefeuille');
    const resume = screen.getByRole('list', { name: 'Résumé' });
    expect(
      within(resume)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['2 SCPI', '4 dossiers']);
    expect(screen.getByRole('link', { name: 'Investir dans une SCPI' }).getAttribute('href')).toBe(
      '/catalogue',
    );
    // Titre du bloc pour les lecteurs d'écran
    expect(screen.getByRole('heading', { name: 'Mes investissements' })).toBeTruthy();
  });

  it('règle 1 : une carte par SCPI avec ses chiffres, dans l’ordre reçu (règle 2)', async () => {
    await afficher();
    const cartes = [...document.querySelectorAll('.portefeuille__entete-scpi')];
    expect(cartes.every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(cartes.map((b) => b.querySelector('.portefeuille__nom strong').textContent)).toEqual([
      'Transitions Europe',
      'Iroko Zen',
    ]);
    const te = ligneScpi('Transitions Europe');
    expect(te.textContent).toContain('Arkéa REIM');
    expect(chiffres(te)).toEqual({
      Dossiers: '3',
      'Montant investi': '7 000 €',
      Parts: '35',
      'Revenus / mois': '42,00 €',
    });
    // Société de gestion inconnue (SCPI retirée du catalogue)
    expect(ligneScpi('Iroko Zen').textContent).toContain('Non communiqué');
    expect(chiffres(ligneScpi('Iroko Zen'))['Revenus / mois']).toBe('0,00 €');
  });

  it('photo de chaque SCPI : la même que sur sa carte du Catalogue', async () => {
    await afficher();
    const photos = [...document.querySelectorAll('.portefeuille__photo')];
    expect(photos).toHaveLength(2);
    expect(photos[0].getAttribute('src')).toBe(photoScpi(7, 'Transitions Europe'));
    expect(photos[1].getAttribute('src')).toBe(photoScpi(8, 'Iroko Zen'));
    expect(photos[0].getAttribute('alt')).toBe('');
  });

  it('règle 3 : déplier une carte affiche le tableau de ses dossiers, le refusé avec son motif', async () => {
    await afficher();
    const te = ligneScpi('Transitions Europe');
    expect(screen.queryByRole('table', { name: 'Dossiers Transitions Europe' })).toBeNull();

    fireEvent.click(te);
    expect(te.getAttribute('aria-expanded')).toBe('true');
    const tableau = screen.getByRole('table', { name: 'Dossiers Transitions Europe' });
    expect(
      within(tableau)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual([
      'Dossier',
      'Demande du',
      'Mode',
      'Type',
      'Parts',
      'Montant',
      'Statut',
      'Information',
    ]);
    const lignes = within(tableau)
      .getAllByRole('row')
      .slice(1)
      .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.replace(/\s/g, ' ')));
    expect(lignes).toEqual([
      [
        'D-103',
        '10/11/2026',
        'Ponctuelle',
        'Pleine propriété',
        '5',
        '1 000 €',
        'Refusée',
        'Motif : Dossier incomplet',
      ],
      [
        'D-102',
        '10/10/2026',
        'Programmé',
        'Usufruit',
        '10',
        '2 000 €',
        'Actif',
        'Jouissance le 01/12/2026',
      ],
      [
        'D-101',
        '10/09/2026',
        'Ponctuelle',
        'Pleine propriété',
        '25',
        '5 000 €',
        'Actif',
        'Jouissance le 01/11/2026',
      ],
    ]);

    // Replier
    fireEvent.click(te);
    expect(screen.queryByRole('table', { name: 'Dossiers Transitions Europe' })).toBeNull();
  });

  it('règle 3 : référence de virement d’un dossier accepté en attente de paiement', async () => {
    await afficher();
    fireEvent.click(ligneScpi('Iroko Zen'));
    const tableau = screen.getByRole('table', { name: 'Dossiers Iroko Zen' });
    expect(tableau.textContent).toContain('En attente de paiement');
    expect(tableau.textContent).toContain('Réf. virement : SIP-IROK-4HX8QA');
  });

  it('règle 4 : chaque dossier mène à son suivi', async () => {
    await afficher();
    fireEvent.click(ligneScpi('Transitions Europe'));
    const lien = screen.getByRole('link', { name: 'D-103' });
    expect(lien.getAttribute('href')).toBe('/demandes/103');
  });

  it('aucun dossier : message et lien vers le catalogue, sans pastilles dans le bandeau', async () => {
    await afficher({ lister: vi.fn().mockResolvedValue({ scpis: [] }) });
    expect(screen.getByText(AUCUN_INVESTISSEMENT)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Découvrir le catalogue' }).getAttribute('href')).toBe(
      '/catalogue',
    );
    expect(screen.queryByRole('list', { name: 'Résumé' })).toBeNull();
  });

  it('chargement en cours : bandeau sans pastilles', async () => {
    await afficher({ lister: () => new Promise(() => {}) });
    expect(screen.getByText('Chargement…')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mon portefeuille');
    expect(screen.queryByRole('list', { name: 'Résumé' })).toBeNull();
  });

  it('erreur du backend : message compréhensible', async () => {
    await afficher({ lister: vi.fn().mockRejectedValue(new ErreurApi(503, 'indisponible')) });
    expect(screen.getByRole('alert').textContent).toBe(ERREUR_CHARGEMENT);
  });

  it('session expirée : renvoi vers la connexion', async () => {
    const { allerA } = await afficher({
      lister: vi.fn().mockRejectedValue(new ErreurApi(401, 'Session expirée')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('se déconnecter : retour à l’accueil', async () => {
    const { seDeconnecter, allerA } = await afficher();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Se déconnecter/ })[0]);
    });
    const oui = screen.queryByRole('button', { name: /^Oui/ });
    if (oui) {
      await act(async () => {
        fireEvent.click(oui);
      });
    }
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
