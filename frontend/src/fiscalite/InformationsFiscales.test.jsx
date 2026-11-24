import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import InformationsFiscales from './InformationsFiscales.jsx';

afterEach(cleanup);

const IDENTITE = () =>
  Promise.resolve({ nomComplet: 'Marie Curie', email: 'm@x.fr', profil: null });
const ENREGISTREES = { revenuNetImposable: 40000, situationFamiliale: 'seul', nombreEnfants: 0 };

async function afficher(proprietes = {}) {
  const props = {
    lire: vi.fn().mockResolvedValue(null),
    enregistrer: vi.fn().mockImplementation((informations) => Promise.resolve(informations)),
    effacer: vi.fn().mockResolvedValue(null),
    seDeconnecter: vi.fn(),
    chargerIdentite: IDENTITE,
    ...proprietes,
  };
  await act(async () => {
    render(<InformationsFiscales {...props} />);
  });
  return props;
}

// Espaces de milliers (insécables) ramenés à des espaces simples
const texte = (element) => element.textContent.replace(/\s/g, ' ');
const revenu = () => screen.getByLabelText('Revenu net imposable du foyer');
const bouton = (nom) => screen.getByRole('button', { name: nom });
const enfants = () =>
  within(screen.getByRole('group', { name: 'Enfants à charge' })).getByText(/^\d+$/);
const erreurDe = (element) => document.getElementById(element.getAttribute('aria-describedby'));
const recap = () => screen.getByRole('complementary', { name: 'Votre foyer fiscal' });
const valeurRecap = (libelle) => texte(within(recap()).getByText(libelle).nextElementSibling);

function saisir(valeur) {
  fireEvent.change(revenu(), { target: { value: valeur } });
}

async function cliquer(nom) {
  await act(async () => {
    fireEvent.click(bouton(nom));
  });
}

describe('Mes informations fiscales (US-06, SCPI-255)', () => {
  it('titre de l’écran et entrée « Infos fiscales » du menu sélectionnée', async () => {
    await afficher();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mes informations fiscales' }),
    ).toBeTruthy();
    const entree = screen.getByRole('link', { name: 'Infos fiscales' });
    expect(entree.getAttribute('aria-current')).toBe('page');
  });

  it('jamais renseignées : formulaire vide, récapitulatif sans valeur, pas de « Effacer »', async () => {
    await afficher();
    expect(revenu().value).toBe('');
    expect(bouton('Seul').getAttribute('aria-pressed')).toBe('false');
    expect(bouton('En couple').getAttribute('aria-pressed')).toBe('false');
    expect(enfants().textContent).toBe('0');
    expect(bouton('Un enfant de moins').disabled).toBe(true);
    expect(valeurRecap('Revenu net imposable')).toBe('—');
    expect(valeurRecap('Situation')).toBe('—');
    expect(screen.queryByRole('button', { name: 'Effacer mes informations' })).toBeNull();
  });

  it('enregistrer : 40 000 €, Seul, 0 enfant -> message de confirmation', async () => {
    const { enregistrer } = await afficher();
    saisir('40 000');
    await cliquer('Seul');
    await cliquer('Enregistrer');

    expect(enregistrer).toHaveBeenCalledWith(ENREGISTREES);
    expect(
      screen.getByText('Vos informations fiscales sont enregistrées.').getAttribute('role'),
    ).toBe('status');
    expect(bouton('Effacer mes informations')).toBeTruthy();
  });

  it('valeurs enregistrées ré-affichées en rouvrant l’écran', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue({
        revenuNetImposable: 90000,
        situationFamiliale: 'couple',
        nombreEnfants: 3,
      }),
    });
    expect(revenu().value.replace(/\s/g, ' ')).toBe('90 000');
    expect(bouton('En couple').getAttribute('aria-pressed')).toBe('true');
    expect(enfants().textContent).toBe('3');
    expect(bouton('Effacer mes informations')).toBeTruthy();
  });

  it('récapitulatif mis à jour pendant la saisie : revenu, situation, parts', async () => {
    await afficher();
    saisir('90000');
    fireEvent.blur(revenu());
    expect(revenu().value.replace(/\s/g, ' ')).toBe('90 000');
    expect(valeurRecap('Revenu net imposable')).toBe('90 000 €');

    await cliquer('Seul');
    expect(within(recap()).getByText('part de quotient familial')).toBeTruthy();

    await cliquer('En couple');
    for (let i = 0; i < 3; i++) await cliquer('Un enfant de plus');
    expect(enfants().textContent).toBe('3');
    expect(valeurRecap('Situation')).toBe('En couple');
    expect(valeurRecap('Enfants à charge')).toBe('3');
    expect(within(recap()).getByText('4')).toBeTruthy();
    expect(within(recap()).getByText('parts de quotient familial')).toBeTruthy();

    await cliquer('Un enfant de moins');
    expect(enfants().textContent).toBe('2');
  });

  it('sans revenu : « Ce champ est obligatoire. » sous le revenu, rien enregistré', async () => {
    const { enregistrer } = await afficher();
    await cliquer('Seul');
    await cliquer('Enregistrer');

    expect(enregistrer).not.toHaveBeenCalled();
    expect(revenu().getAttribute('aria-invalid')).toBe('true');
    expect(erreurDe(revenu()).textContent).toBe('Ce champ est obligatoire.');

    // Quitter le champ ne retire pas l'erreur ; la corriger, si
    fireEvent.blur(revenu());
    expect(erreurDe(revenu()).textContent).toBe('Ce champ est obligatoire.');
    saisir('12');
    expect(erreurDe(revenu()).textContent).toBe('');
    expect(revenu().getAttribute('aria-invalid')).toBeNull();
  });

  it('sans situation familiale : message sous les deux choix', async () => {
    const { enregistrer } = await afficher();
    saisir('1');
    await cliquer('Enregistrer');
    expect(enregistrer).not.toHaveBeenCalled();
    const groupe = screen.getByRole('group', { name: 'Situation familiale' });
    expect(erreurDe(groupe).textContent).toBe('Ce champ est obligatoire.');
  });

  it('revenu invalide : message dédié', async () => {
    await afficher();
    saisir('12,5');
    await cliquer('Seul');
    await cliquer('Enregistrer');
    expect(erreurDe(revenu()).textContent).toBe('Saisissez un nombre entier positif ou nul.');
  });

  it('enregistrement refusé par le serveur : message affiché', async () => {
    await afficher({
      enregistrer: vi.fn().mockRejectedValue(new ErreurApi(503, 'Service indisponible.')),
    });
    saisir('1');
    await cliquer('Seul');
    await cliquer('Enregistrer');
    expect(screen.getByRole('alert').textContent).toBe('Service indisponible.');
  });

  it('effacer après confirmation : formulaire vide, bouton retiré', async () => {
    const { effacer } = await afficher({ lire: vi.fn().mockResolvedValue(ENREGISTREES) });
    await cliquer('Effacer mes informations');

    const fenetre = screen.getByRole('alertdialog', {
      name: 'Effacer vos informations fiscales ?',
    });
    expect(effacer).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(fenetre).getByRole('button', { name: 'Effacer' }));
    });

    expect(effacer).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(revenu().value).toBe('');
    expect(bouton('Seul').getAttribute('aria-pressed')).toBe('false');
    expect(enfants().textContent).toBe('0');
    expect(screen.queryByRole('button', { name: 'Effacer mes informations' })).toBeNull();
    expect(screen.getByText('Vos informations fiscales sont effacées.').getAttribute('role')).toBe(
      'status',
    );
  });

  it('effacer puis « Annuler » : rien n’est supprimé', async () => {
    const { effacer } = await afficher({ lire: vi.fn().mockResolvedValue(ENREGISTREES) });
    await cliquer('Effacer mes informations');
    await cliquer('Annuler');
    expect(effacer).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(revenu().value.replace(/\s/g, ' ')).toBe('40 000');
  });

  it('effacement en échec : message affiché, valeurs gardées', async () => {
    await afficher({
      lire: vi.fn().mockResolvedValue(ENREGISTREES),
      effacer: vi.fn().mockRejectedValue(new ErreurApi(503, 'Service indisponible.')),
    });
    await cliquer('Effacer mes informations');
    await cliquer('Effacer');
    expect(screen.getByRole('alert').textContent).toBe('Service indisponible.');
    expect(revenu().value.replace(/\s/g, ' ')).toBe('40 000');
  });

  it('chargement impossible : message, pas de formulaire', async () => {
    await afficher({ lire: vi.fn().mockRejectedValue(new Error('réseau')) });
    expect(screen.getByRole('alert').textContent).toContain('n’ont pas pu être chargées');
    expect(screen.queryByRole('form')).toBeNull();
  });
});
