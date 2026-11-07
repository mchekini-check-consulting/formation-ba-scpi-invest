import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Inscription from './Inscription.jsx';

afterEach(cleanup);

const MDP = 'Tr0pBien!Choisi';

function saisir(libelle, valeur) {
  fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
}

function remplir({ email = 'jean@exemple.fr', mdp = MDP, confirmation = MDP, cgu = true } = {}) {
  saisir('Adresse e-mail', email);
  fireEvent.blur(screen.getByLabelText('Adresse e-mail'));
  saisir('Mot de passe', mdp);
  saisir('Confirmation du mot de passe', confirmation);
  if (cgu) fireEvent.click(screen.getByRole('checkbox'));
}

const bouton = () => screen.getByRole('button', { name: 'Créer mon compte' });
const texte = () => document.body.textContent;

describe('Inscription', () => {
  it('affiche les champs obligatoires et les liens vers les CGU et la politique', () => {
    render(<Inscription />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Créer mon compte');
    expect(screen.getByLabelText('Adresse e-mail')).toBeDefined();
    expect(screen.getByLabelText('Mot de passe').getAttribute('type')).toBe('password');
    expect(screen.getByLabelText('Confirmation du mot de passe')).toBeDefined();
    expect(screen.getByRole('link', { name: 'CGU' }).getAttribute('href')).toBe('/cgu');
    expect(
      screen.getByRole('link', { name: 'politique de confidentialité' }).getAttribute('href'),
    ).toBe('/confidentialite');
    expect(bouton().disabled).toBe(true);
  });

  it('scénario 1 : compte créé, redirection vers le formulaire KYC', async () => {
    const creer = vi.fn().mockResolvedValue({ id: 'u1', email: 'jean@exemple.fr' });
    const allerA = vi.fn();
    render(<Inscription creer={creer} allerA={allerA} />);
    remplir({ email: ' jean@exemple.fr ' });
    expect(bouton().disabled).toBe(false);

    await act(async () => fireEvent.click(bouton()));

    expect(creer).toHaveBeenCalledWith({
      email: 'jean@exemple.fr',
      motDePasse: MDP,
      confirmation: MDP,
      cguAcceptees: true,
    });
    expect(allerA).toHaveBeenCalledWith('/connaissance-client');
  });

  it('scénario 2 : email déjà utilisé, message du serveur affiché', async () => {
    const creer = vi
      .fn()
      .mockRejectedValue(new ErreurApi(409, 'Un compte existe déjà avec cet email'));
    const allerA = vi.fn();
    render(<Inscription creer={creer} allerA={allerA} />);
    remplir();

    await act(async () => fireEvent.submit(screen.getByRole('form')));

    expect(screen.getByText('Un compte existe déjà avec cet email')).toBeDefined();
    expect(allerA).not.toHaveBeenCalled();
    expect(bouton().disabled).toBe(false); // l'utilisateur peut corriger et réessayer

    saisir('Adresse e-mail', 'autre@exemple.fr');
    expect(texte()).not.toContain('Un compte existe déjà');
  });

  it('scénario 3 : email au format invalide, message sous le champ', () => {
    render(<Inscription />);
    saisir('Adresse e-mail', 'jean.exemple.fr');
    expect(texte()).not.toContain('Format d’email invalide'); // pas pendant la saisie
    fireEvent.blur(screen.getByLabelText('Adresse e-mail'));
    expect(texte()).toContain('Format d’email invalide');
    saisir('Adresse e-mail', 'jean@exemple');
    expect(texte()).toContain('Format d’email invalide');
  });

  it('scénario 4 : case CGU non cochée, bouton désactivé et message sous la case', () => {
    render(<Inscription />);
    const message =
      'Vous devez accepter les CGU et la politique de confidentialité pour créer votre compte';
    remplir({ cgu: false });
    expect(bouton().disabled).toBe(true);
    expect(texte()).toContain(message);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(texte()).not.toContain(message);
  });

  it('règles du mot de passe signalées sous le champ, bouton désactivé (US-02b)', () => {
    render(<Inscription />);
    remplir({ mdp: 'abc', confirmation: 'abc' });
    expect(bouton().disabled).toBe(true);
    const regles = screen.getByRole('list', { name: 'Règles du mot de passe' });
    expect(regles.textContent).toContain('Au moins 12 caractères : non respectée');
    expect(regles.textContent).toContain('Au moins une minuscule : respectée');
    const regle = (libelle) =>
      [...regles.querySelectorAll('li')].find((li) => li.textContent.includes(libelle));
    expect(regle('Au moins 12 caractères').className).toBe('regle regle--ko');
    expect(regle('Au moins une minuscule').className).toBe('regle regle--ok');

    saisir('Mot de passe', 'Tr0p Bien!Choisi');
    expect(texte()).toContain('Le mot de passe ne doit pas contenir d’espace');
    saisir('Mot de passe', 'Azerty123456!');
    expect(texte()).toContain('Ce mot de passe est trop courant, choisissez-en un autre');
    saisir('Mot de passe', 'Jean@exemple.fr1');
    expect(texte()).toContain('Le mot de passe ne doit pas contenir votre email ou votre nom');
  });

  it('confirmation différente : message et bouton désactivé', () => {
    render(<Inscription />);
    remplir({ confirmation: 'Autre!Chose123' });
    expect(texte()).toContain('Les mots de passe ne correspondent pas');
    expect(bouton().disabled).toBe(true);
  });

  it('icône œil : affiche puis masque le mot de passe', () => {
    render(<Inscription />);
    fireEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(screen.getByLabelText('Mot de passe').getAttribute('type')).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(screen.getByLabelText('Mot de passe').getAttribute('type')).toBe('password');
  });

  it('email transmis par la landing page : déjà saisi', () => {
    render(<Inscription emailInitial="jean@exemple.fr" />);
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('jean@exemple.fr');
  });

  it('formulaire incomplet : rien n’est envoyé', () => {
    const creer = vi.fn();
    render(<Inscription creer={creer} />);
    fireEvent.submit(screen.getByRole('form'));
    expect(creer).not.toHaveBeenCalled();
  });
});
