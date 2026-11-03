import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Connexion from './Connexion.jsx';
import { destinationApresConnexion } from './destination.js';

afterEach(cleanup);

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
    render(<Connexion connecter={connecter} allerA={allerA} />);
    saisir('Adresse e-mail', ' jean@exemple.fr ');
    saisir('Mot de passe', MDP);

    await envoyer();

    expect(connecter).toHaveBeenCalledWith({ email: 'jean@exemple.fr', motDePasse: MDP });
    expect(allerA).toHaveBeenCalledWith('/kyc');
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
    expect(destinationApresConnexion({ id: 'u1', email: 'jean@exemple.fr' })).toBe('/kyc');
  });
});
