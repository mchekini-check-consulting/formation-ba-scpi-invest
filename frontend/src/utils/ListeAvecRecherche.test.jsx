import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ListeAvecRecherche from './ListeAvecRecherche.jsx';

afterEach(cleanup);

const OPTIONS = [
  { cle: 1, libelle: 'Comète' },
  { cle: 2, libelle: 'Corum Origin' },
  { cle: 3, libelle: 'Iroko Zen', desactivee: true },
  { cle: 4, libelle: 'Épargne Pierre' },
];

function Exemple({ initial = null, changer = () => {} }) {
  const [valeur, setValeur] = useState(initial);
  return (
    <>
      <label htmlFor="scpi">SCPI</label>
      <ListeAvecRecherche
        id="scpi"
        options={OPTIONS}
        valeur={valeur}
        placeholder="Choisir une SCPI"
        changer={(v) => {
          setValeur(v);
          changer(v);
        }}
      />
    </>
  );
}

const champ = () => screen.getByRole('combobox', { name: 'SCPI' });
const options = () => screen.queryAllByRole('option').map((o) => o.textContent);
const touche = (key) => fireEvent.keyDown(champ(), { key });
const actif = () => document.getElementById(champ().getAttribute('aria-activedescendant'));

describe('liste déroulante avec recherche', () => {
  it('on tape pour filtrer, accents ignorés, début du libellé en premier', () => {
    render(<Exemple />);
    fireEvent.change(champ(), { target: { value: 'e' } });
    expect(options()).toEqual(['Épargne Pierre', 'Comète', 'Iroko Zen']);
    fireEvent.change(champ(), { target: { value: 'xyz' } });
    expect(screen.getByText('Aucun résultat')).toBeDefined();
  });

  it('clic : ouvre sur l’option choisie, puis ferme ; un clic sur une option la choisit', () => {
    const changer = vi.fn();
    render(<Exemple initial={2} changer={changer} />);
    fireEvent.click(champ());
    expect(actif().textContent).toBe('Corum Origin');
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Comète' }));
    fireEvent.click(screen.getByRole('option', { name: 'Comète' }));
    expect(changer).toHaveBeenCalledWith(1);
    expect(champ().value).toBe('Comète');
    fireEvent.click(champ());
    fireEvent.click(champ());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clavier : flèches, Entrée pour choisir, option désactivée ignorée, Échap ferme', () => {
    const changer = vi.fn();
    render(<Exemple changer={changer} />);
    touche('ArrowDown'); // ouvre
    touche('ArrowDown');
    touche('ArrowDown');
    expect(actif().textContent).toBe('Iroko Zen');
    touche('Enter');
    expect(changer).not.toHaveBeenCalled();
    touche('ArrowUp');
    touche('Enter');
    expect(changer).toHaveBeenLastCalledWith(2);
    touche('ArrowDown');
    touche('Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('libellé tapé en entier puis sortie : choisi ; texte inconnu : option précédente', () => {
    const changer = vi.fn();
    render(<Exemple initial={1} changer={changer} />);
    fireEvent.change(champ(), { target: { value: 'corum origin' } });
    fireEvent.blur(champ());
    expect(changer).toHaveBeenLastCalledWith(2);
    fireEvent.change(champ(), { target: { value: 'xyz' } });
    fireEvent.blur(champ());
    expect(champ().value).toBe('Corum Origin');
  });

  it('flèche : ouvre puis ferme la liste', () => {
    render(<Exemple />);
    const fleche = document.querySelector('.liste-recherche__fleche');
    fireEvent.mouseDown(fleche);
    expect(screen.getByRole('listbox')).toBeDefined();
    expect(document.activeElement).toBe(champ());
    fireEvent.mouseDown(fleche);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('champ vidé : plus d’option choisie', () => {
    const changer = vi.fn();
    render(<Exemple initial={1} changer={changer} />);
    fireEvent.change(champ(), { target: { value: '' } });
    expect(changer).toHaveBeenLastCalledWith(null);
    fireEvent.blur(champ());
    expect(champ().value).toBe('');
  });
});
