import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi, sessionExpiree } from '../auth.js';
import Connexion from './Connexion.jsx';
import { MESSAGE_SESSION_EXPIREE, messageErreur } from './messages.js';
import { destinationApresConnexion } from './destination.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const MDP = 'Tr0pBien!Choisi';

function saisir(libelle, valeur) {
  fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
}

const bouton = () => screen.getByRole('button', { name: 'Se connecter' });
const motDePasse = () => screen.getByLabelText('Mot de passe');

async function envoyer() {
  await act(async () => {
    fireEvent.submit(screen.getByRole('form', { name: 'Connexion' }));
  });
}

describe('Connexion', () => {
  it('affiche l’email, le mot de passe masqué et le lien vers l’inscription', () => {
    render(<Connexion />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Se connecter');
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('');
    expect(motDePasse().getAttribute('type')).toBe('password');
    expect(screen.getByRole('link', { name: 'Créer mon compte' }).getAttribute('href')).toBe(
      '/inscription',
    );
  });

  it('bouton désactivé tant que l’email et le mot de passe ne sont pas saisis', async () => {
    const connecter = vi.fn();
    render(<Connexion connecter={connecter} />);
    expect(bouton().disabled).toBe(true);
    saisir('Adresse e-mail', 'jean@exemple.fr');
    expect(bouton().disabled).toBe(true);
    await envoyer();
    expect(connecter).not.toHaveBeenCalled();
    saisir('Mot de passe', MDP);
    expect(bouton().disabled).toBe(false);
  });

  it('scénario 1 : identifiants corrects, redirection vers le formulaire KYC', async () => {
    const connecter = vi.fn().mockResolvedValue({ id: 'u1', email: 'jean@exemple.fr' });
    const allerA = vi.fn();
    const lireAvancement = vi.fn().mockResolvedValue({ etapeCourante: 1, valide: false });
    render(<Connexion connecter={connecter} allerA={allerA} lireAvancement={lireAvancement} />);
    saisir('Adresse e-mail', ' jean@exemple.fr ');
    saisir('Mot de passe', MDP);

    await envoyer();

    expect(connecter).toHaveBeenCalledWith({ email: 'jean@exemple.fr', motDePasse: MDP });
    expect(allerA).toHaveBeenCalledWith('/connaissance-client');
  });

  it('US-03b scénario 1 : compte bloqué, heure de déblocage à l’heure du poste', async () => {
    const debloqueA = new Date(2026, 10, 9, 14, 32).toISOString(); // 14 h 32 heure locale
    const connecter = vi
      .fn()
      .mockRejectedValue(
        new ErreurApi(429, 'Trop de tentatives : votre compte est bloqué.', debloqueA),
      );
    render(<Connexion connecter={connecter} allerA={vi.fn()} />);
    saisir('Adresse e-mail', 'jean@exemple.fr');
    saisir('Mot de passe', 'mauvais');

    await envoyer();

    expect(screen.getByRole('alert').textContent).toBe(
      'Trop de tentatives : votre compte est bloqué. Réessayez à 14 h 32.',
    );
  });

  it('messageErreur : heure de déblocage arrondie à la minute supérieure', () => {
    // espaces insécables de l'heure remplacés par des espaces, pour la lisibilité du test
    const bloque = (h, m, s, ms = 0) =>
      messageErreur(
        new ErreurApi(429, 'Bloqué.', new Date(2026, 10, 9, h, m, s, ms).toISOString()),
      ).replaceAll(' ', ' ');
    expect(bloque(14, 31, 40)).toBe('Bloqué. Réessayez à 14 h 32.');
    expect(bloque(14, 31, 0, 1)).toBe('Bloqué. Réessayez à 14 h 32.');
    expect(bloque(14, 32, 0)).toBe('Bloqué. Réessayez à 14 h 32.'); // minute pile : inchangée
    expect(bloque(23, 59, 30)).toBe('Bloqué. Réessayez à 00 h 00.');
  });

  it('messageErreur : heure absente ou illisible -> message seul', () => {
    expect(messageErreur(new ErreurApi(429, 'Bloqué.'))).toBe('Bloqué.');
    expect(messageErreur(new ErreurApi(429, 'Bloqué.', 'pas une date'))).toBe('Bloqué.');
    expect(messageErreur(new ErreurApi(401, 'Refusé', '2026-11-09T13:32:00Z'))).toBe('Refusé');
  });

  it('US-03b scénario 2 : arrivée après une session expirée, message puis oublié', () => {
    sessionStorage.setItem('scpi-invest.session-expiree', '1');
    render(<Connexion />);
    expect(screen.getByRole('status').textContent).toBe(MESSAGE_SESSION_EXPIREE);
    expect(MESSAGE_SESSION_EXPIREE).toBe(
      'Votre session a expiré. Reconnectez-vous pour continuer.',
    );
    expect(sessionExpiree()).toBe(false); // pas de message à la visite suivante
  });

  it('arrivée normale : pas de message de session expirée', () => {
    render(<Connexion sessionExpiree={() => false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('scénario 4 : identifiants incorrects, message sans préciser le champ faux', async () => {
    const connecter = vi
      .fn()
      .mockRejectedValue(new ErreurApi(401, 'Email ou mot de passe incorrect'));
    const allerA = vi.fn();
    render(<Connexion connecter={connecter} allerA={allerA} />);
    saisir('Adresse e-mail', 'jean@exemple.fr');
    saisir('Mot de passe', 'mauvais');

    await envoyer();

    expect(screen.getByRole('alert').textContent).toBe('Email ou mot de passe incorrect');
    expect(allerA).not.toHaveBeenCalled();
    expect(bouton().disabled).toBe(false);

    // le message disparaît dès que l'utilisateur corrige sa saisie
    saisir('Mot de passe', MDP);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pendant l’envoi : bouton désactivé, libellé « Connexion en cours… »', async () => {
    render(<Connexion connecter={() => new Promise(() => {})} allerA={vi.fn()} />);
    saisir('Adresse e-mail', 'jean@exemple.fr');
    saisir('Mot de passe', MDP);
    await envoyer();
    const enCours = screen.getByRole('button', { name: 'Connexion en cours…' });
    expect(enCours.disabled).toBe(true);
  });

  it('scénario 5 : l’œil affiche le mot de passe en clair, puis le masque', () => {
    render(<Connexion />);
    saisir('Mot de passe', MDP);
    fireEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(motDePasse().getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(motDePasse().getAttribute('type')).toBe('password');
  });

  it('email transmis par l’adresse : champ prérempli', () => {
    render(<Connexion emailInitial="jean@exemple.fr" />);
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('jean@exemple.fr');
  });

  it('destination après connexion : formulaire KYC tant que le KYC n’existe pas', () => {
    expect(destinationApresConnexion({ etapeCourante: 3, valide: false })).toBe(
      '/connaissance-client',
    );
    expect(destinationApresConnexion(null)).toBe('/connaissance-client');
    expect(destinationApresConnexion({ etapeCourante: 6, valide: true })).toBe('/catalogue');
  });

  it('reconnexion : retour sur le dernier écran ouvert (formulaire investisseur)', async () => {
    localStorage.setItem('scpi-invest.derniere-page', '/formulaire-investisseur');
    const allerA = vi.fn();
    render(
      <Connexion
        connecter={vi.fn().mockResolvedValue({ id: 'u1' })}
        lireAvancement={vi.fn().mockResolvedValue({ etapeCourante: 6, valide: false })}
        allerA={allerA}
      />,
    );
    saisir('Adresse e-mail', 'jean@exemple.fr');
    saisir('Mot de passe', MDP);
    await envoyer();
    expect(allerA).toHaveBeenCalledWith('/formulaire-investisseur');
  });

  it('US-05b scénario 11 : profil investisseur validé -> directement le Catalogue', async () => {
    const allerA = vi.fn();
    render(
      <Connexion
        connecter={vi.fn().mockResolvedValue({ id: 'u1' })}
        lireAvancement={vi.fn().mockResolvedValue({ etapeCourante: 6, valide: true })}
        allerA={allerA}
      />,
    );
    saisir('Adresse e-mail', 'jean@exemple.fr');
    saisir('Mot de passe', MDP);
    await envoyer();
    expect(allerA).toHaveBeenCalledWith('/catalogue');
  });

  it('avancement indisponible : parcours par défaut (/connaissance-client)', async () => {
    const allerA = vi.fn();
    render(
      <Connexion
        connecter={vi.fn().mockResolvedValue({ id: 'u1' })}
        lireAvancement={vi.fn().mockRejectedValue(new Error('panne'))}
        allerA={allerA}
      />,
    );
    saisir('Adresse e-mail', 'jean@exemple.fr');
    saisir('Mot de passe', MDP);
    await envoyer();
    expect(allerA).toHaveBeenCalledWith('/connaissance-client');
  });
});
