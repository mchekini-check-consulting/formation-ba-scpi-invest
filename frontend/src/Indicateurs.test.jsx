import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { THEMES, filtrerIndicateurs } from './contenus/indicateurs';
import Indicateurs from './Indicateurs';

afterEach(cleanup);

const rechercher = (texte) =>
  fireEvent.change(screen.getByLabelText('Rechercher un indicateur'), {
    target: { value: texte },
  });

describe('Indicateurs', () => {
  it('affiche les 37 indicateurs répartis en 8 thèmes', () => {
    render(<Indicateurs />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Les indicateurs des SCPI, expliqués simplement.',
    );
    expect(screen.getAllByRole('article')).toHaveLength(37);
    expect(THEMES).toHaveLength(8);
    expect(screen.getByRole('heading', { name: 'Santé financière' })).toBeDefined();
    expect(screen.getByText('7 indicateurs')).toBeDefined();
    expect(document.title).toBe('SCPI Invest+ · Définitions des indicateurs');
  });

  it('affiche le sigle quand l’indicateur en a un', () => {
    render(<Indicateurs />);
    const tof = screen
      .getByRole('heading', { name: 'Taux d’occupation financier' })
      .closest('article');
    expect(within(tof).getByText('TOF')).toBeDefined();
    const prix = screen.getByRole('heading', { name: 'Prix de souscription' }).closest('article');
    expect(prix.querySelector('.ind-sigle')).toBeNull();
  });

  it('filtre par thème', () => {
    render(<Indicateurs />);
    const rendement = screen.getByRole('button', { name: 'Rendement' });
    fireEvent.click(rendement);
    expect(rendement.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Tous' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).toBe('Rendement');

    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
    expect(screen.getAllByRole('article')).toHaveLength(37);
  });

  it('recherche dans le nom, le sigle et la définition', () => {
    render(<Indicateurs />);
    rechercher('tri');
    expect(screen.getByRole('heading', { name: 'Taux de rendement interne' })).toBeDefined();

    rechercher('liquidité');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('1 indicateur')).toBeDefined();
  });

  it('affiche un message quand rien ne correspond', () => {
    render(<Indicateurs />);
    rechercher('zzzz');
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('Aucun indicateur ne correspond à votre recherche.')).toBeDefined();
  });
});

describe('Indicateurs : accès au compte', () => {
  it('le bouton « Se connecter » mène à la connexion', () => {
    render(<Indicateurs />);
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe(
      '/connexion',
    );
  });

  it('les boutons « Créer mon compte » mènent à l’inscription', () => {
    render(<Indicateurs />);
    const liens = screen.getAllByRole('link', { name: 'Créer mon compte' });
    expect(liens).toHaveLength(2);
    liens.forEach((lien) => expect(lien.getAttribute('href')).toBe('/inscription'));
  });
});

describe('filtrerIndicateurs', () => {
  it('ignore les majuscules, les accents et le type d’apostrophe', () => {
    const noms = (groupes) => groupes.flatMap((g) => g.indicateurs.map((i) => i.nom));
    expect(noms(filtrerIndicateurs("TAUX D'OCCUPATION", 'tous'))).toEqual([
      'Taux d’occupation financier',
      'Taux d’occupation physique',
    ]);
    expect(noms(filtrerIndicateurs('decote', 'tous'))).toContain('Surcote / décote');
  });

  it('combine recherche et thème', () => {
    expect(filtrerIndicateurs('frais', 'rendement').map((g) => g.id)).toEqual(['rendement']);
    expect(filtrerIndicateurs('frais', 'patrimoine')).toEqual([]);
  });
});
