import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChoixPays from './ChoixPays.jsx';

afterEach(cleanup);

function Exemple({ initial = '', changer = () => {} }) {
  const [valeur, setValeur] = useState(initial);
  return (
    <>
      <label htmlFor="pays">Nationalité</label>
      <ChoixPays
        id="pays"
        valeur={valeur}
        changer={(v) => {
          setValeur(v);
          changer(v);
        }}
      />
    </>
  );
}

const champ = () => screen.getByRole('combobox', { name: 'Nationalité' });
const options = () => screen.queryAllByRole('option').map((o) => o.textContent);
const touche = (key) => fireEvent.keyDown(champ(), { key });

describe('liste de pays avec drapeau', () => {
  it('on tape pour filtrer, un clic choisit le pays, son drapeau s’affiche', () => {
    const changer = vi.fn();
    render(<Exemple changer={changer} />);
    fireEvent.change(champ(), { target: { value: 'ital' } });
    expect(options()).toEqual(['Italie']);
    expect(document.querySelector('[role="option"] .fi-it')).not.toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'Italie' }));
    expect(changer).toHaveBeenCalledWith('IT');
    expect(champ().value).toBe('Italie');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.querySelector('.choix-pays__saisie .fi-it')).not.toBeNull();
  });

  it('clavier : flèches pour parcourir, Entrée pour choisir, Échap pour fermer', () => {
    const changer = vi.fn();
    render(<Exemple initial="FR" changer={changer} />);
    touche('ArrowDown'); // ouvre sur le pays choisi
    expect(champ().getAttribute('aria-expanded')).toBe('true');
    const actif = () => document.getElementById(champ().getAttribute('aria-activedescendant'));
    expect(actif().textContent).toBe('France');
    touche('ArrowDown');
    touche('ArrowDown');
    touche('ArrowUp');
    touche('Enter');
    expect(changer).toHaveBeenLastCalledWith('AF'); // France en tête, puis Afghanistan
    touche('ArrowDown');
    touche('Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('nom tapé en entier puis sortie du champ : choisi ; texte inconnu : pays précédent', () => {
    const changer = vi.fn();
    render(<Exemple initial="FR" changer={changer} />);
    fireEvent.change(champ(), { target: { value: 'belgique' } });
    fireEvent.blur(champ());
    expect(changer).toHaveBeenLastCalledWith('BE');
    fireEvent.change(champ(), { target: { value: 'xyz' } });
    expect(screen.getByText('Aucun pays trouvé')).toBeDefined();
    fireEvent.blur(champ());
    expect(champ().value).toBe('Belgique');
  });

  it('champ vidé : plus de pays ; clic : ouvre puis ferme la liste', () => {
    const changer = vi.fn();
    render(<Exemple initial="FR" changer={changer} />);
    fireEvent.change(champ(), { target: { value: '' } });
    expect(changer).toHaveBeenLastCalledWith('');
    fireEvent.blur(champ());
    fireEvent.click(champ());
    expect(screen.getByRole('listbox')).toBeDefined();
    fireEvent.mouseEnter(screen.getAllByRole('option')[2]);
    fireEvent.click(champ());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('entrée dans le champ : le pays affiché est sélectionné, la frappe le remplace', () => {
    render(<Exemple initial="MA" />);
    fireEvent.focus(champ());
    expect([champ().selectionStart, champ().selectionEnd]).toEqual([0, 5]);
    fireEvent.click(champ());
    expect(champ().selectionEnd).toBe(5);
  });

  it('valeur = code pays ; ancienne saisie libre (« Française ») : affichée telle quelle, sans drapeau', () => {
    render(<Exemple initial="Française" />);
    expect(champ().value).toBe('Française');
    expect(document.querySelector('.fi')).toBeNull();
  });
});
