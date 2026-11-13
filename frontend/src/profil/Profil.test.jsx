import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Profil from './Profil.jsx';

afterEach(cleanup);

const IDENTITE = () =>
  Promise.resolve({ nomComplet: 'Marie Curie', email: 'm@x.fr', profil: null });

const DONNEES = {
  utilisateur: { email: 'm@x.fr' },
  kyc: {
    statut: 'complete',
    valideLe: '2026-11-02T10:00:00.000Z',
    reponses: {
      civilite: 'Madame',
      prenom: 'Marie',
      nom: 'Curie',
      nationalite: 'Française',
      origineFonds: ['Épargne issue de mes revenus'],
    },
  },
  pieces: [
    {
      type: 'identite',
      nomFichier: 'cni.pdf',
      statut: 'deposee',
      deposeLe: '2026-11-02T10:00:00Z',
    },
    {
      type: 'domicile',
      nomFichier: 'edf.jpg',
      statut: 'deposee',
      deposeLe: '2026-11-02T10:00:00Z',
    },
    { type: 'rib', nomFichier: 'rib.pdf', statut: 'validee', deposeLe: '2026-11-02T10:00:00Z' },
  ],
  profil: { profil: 'equilibre', avertissements: [], valideLe: '2026-11-04T09:30:00.000Z' },
};

async function afficher(proprietes = {}) {
  const props = {
    charger: vi.fn().mockResolvedValue(DONNEES),
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: IDENTITE,
    ...proprietes,
  };
  await act(async () => {
    render(<Profil {...props} />);
  });
  return props;
}

const carte = () => screen.getByRole('complementary', { name: 'Votre identité' });

describe('Page Profil', () => {
  it('titre, entrée de la sidebar sélectionnée', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mon profil');
    expect(
      screen.getByRole('link', { name: 'Mon profil : Marie Curie' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('carte d’identité : initiales, nom, email, profil et état du dossier', async () => {
    await afficher();
    const c = within(carte());
    expect(carte().querySelector('.profil__pastille').textContent).toBe('MC');
    expect(c.getByRole('heading', { level: 2 }).textContent).toBe('Marie Curie');
    expect(c.getByText('m@x.fr')).toBeTruthy();
    expect(carte().querySelector('.profil__type').textContent).toBe('Équilibré');
    expect(carte().querySelector('.profil__curseur span').style.left).toBe('50%');
    expect(c.getByText('✓ Validée le 2 novembre 2026')).toBeTruthy();
    expect(c.getByText('✓ Validé le 4 novembre 2026')).toBeTruthy();
    expect(c.getByText('✓ 3 / 3 déposées')).toBeTruthy();
  });

  it('US-05d : bouton « Mettre à jour mon profil » sous le profil validé', async () => {
    await afficher();
    const lien = within(carte()).getByRole('link', { name: 'Mettre à jour mon profil' });
    expect(lien.getAttribute('href')).toBe('/profil-investisseur/mise-a-jour');
    expect(lien.className).toBe('profil__mise-a-jour');
    expect(carte().querySelector('.profil__rappel')).toBeNull();
  });

  it('US-05d : profil à mettre à jour -> rappel dans la carte, bouton bleu, statut', async () => {
    const profil = { ...DONNEES.profil, aMettreAJour: true };
    await afficher({ charger: vi.fn().mockResolvedValue({ ...DONNEES, profil }) });
    expect(carte().querySelector('.profil__rappel').textContent).toContain(
      'Mettez-le à jour pour qu’il reflète votre situation actuelle.',
    );
    const lien = within(carte()).getByRole('link', { name: 'Mettre à jour mon profil' });
    expect(lien.className).toContain('profil__mise-a-jour--rappel');
    expect(within(carte()).getByText('À mettre à jour · validé le 4 novembre 2026')).toBeTruthy();
  });

  it('une mise à jour par 24 heures : bouton grisé et date de la prochaine possible', async () => {
    const profil = { ...DONNEES.profil, miseAJourPossibleLe: '2026-11-14T14:30:00.000Z' };
    await afficher({ charger: vi.fn().mockResolvedValue({ ...DONNEES, profil }) });
    expect(within(carte()).queryByRole('link', { name: 'Mettre à jour mon profil' })).toBeNull();
    const bouton = within(carte()).getByRole('button', { name: 'Mettre à jour mon profil' });
    expect(bouton.disabled).toBe(true);
    expect(carte().textContent).toContain(
      'Votre profil a été validé il y a moins de 24 heures. Nouvelle mise à jour possible le 14 novembre 2026 à 15:30.',
    );
  });

  it('US-05d : pas de bouton tant que le profil n’est pas validé', async () => {
    await afficher({ charger: vi.fn().mockResolvedValue({ ...DONNEES, profil: null }) });
    expect(within(carte()).queryByRole('link', { name: 'Mettre à jour mon profil' })).toBeNull();
  });

  it('détail : rubriques du KYC et pièces justificatives', async () => {
    await afficher();
    const identite = screen.getByRole('region', { name: 'Identité' });
    expect(within(identite).getByText('Civilité').nextSibling.textContent).toBe('Madame');
    expect(screen.getByRole('region', { name: 'Déclarations réglementaires' })).toBeTruthy();
    const pieces = screen.getByRole('region', { name: 'Pièces justificatives' });
    expect(within(pieces).getAllByRole('listitem')).toHaveLength(3);
    expect(within(pieces).getByText('cni.pdf · déposée le 2 novembre 2026')).toBeTruthy();
    expect(within(pieces).getByText('Vérifiée')).toBeTruthy();
  });

  it('profil investisseur pas encore validé, pièces indisponibles', async () => {
    await afficher({
      charger: vi.fn().mockResolvedValue({ ...DONNEES, profil: null, pieces: null }),
    });
    const lien = within(carte()).getByRole('link', { name: 'Compléter mon profil investisseur' });
    expect(lien.getAttribute('href')).toBe('/formulaire-investisseur');
    expect(within(carte()).getByText('À compléter')).toBeTruthy();
    expect(within(carte()).queryByText(/déposées/)).toBeNull();
    expect(
      screen.getByText('La liste de vos pièces n’est pas disponible pour le moment.'),
    ).toBeTruthy();
  });

  it('pièce obligatoire manquante : signalée', async () => {
    await afficher({
      charger: vi.fn().mockResolvedValue({ ...DONNEES, pieces: DONNEES.pieces.slice(0, 2) }),
    });
    expect(within(carte()).getByText('2 / 3 déposées').className).toBe('profil__attente');
    expect(screen.getByText('Non fournie')).toBeTruthy();
  });

  it('KYC sans date de validation ni nom : « Validée », email en titre', async () => {
    await afficher({
      charger: vi.fn().mockResolvedValue({
        ...DONNEES,
        kyc: { statut: 'complete', reponses: {} },
      }),
    });
    expect(within(carte()).getByRole('heading', { level: 2 }).textContent).toBe('m@x.fr');
    expect(within(carte()).getByText('✓ Validée')).toBeTruthy();
  });

  it('chargement en cours', () => {
    render(<Profil charger={() => new Promise(() => {})} chargerIdentite={IDENTITE} />);
    expect(screen.getByText('Chargement…')).toBeTruthy();
  });

  it('erreur de chargement : message, sans détail technique', async () => {
    await afficher({ charger: vi.fn().mockRejectedValue(new ErreurApi(500, 'boom')) });
    expect(screen.getByRole('alert').textContent).toBe(
      'Votre profil n’a pas pu être chargé. Veuillez réessayer plus tard.',
    );
    expect(screen.queryByText('Chargement…')).toBeNull();
  });

  it('session expirée : écran de connexion', async () => {
    const { allerA } = await afficher({
      charger: vi.fn().mockRejectedValue(new ErreurApi(401, 'x')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('se déconnecter : retour à l’accueil', async () => {
    const { seDeconnecter, allerA } = await afficher();
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
    });
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
