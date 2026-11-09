import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChampAdresse from './ChampAdresse.jsx';

afterEach(cleanup);

const LILAS = {
  libelle: '12 Rue des Lilas 69008 Lyon',
  adresse: '12 Rue des Lilas',
  codePostal: '69008',
  ville: 'Lyon',
};
const ROSES = {
  libelle: '12 Rue des Roses 75012 Paris',
  adresse: '12 Rue des Roses',
  codePostal: '75012',
  ville: 'Paris',
};

function Exemple({ chercher, actif = true, choisir = vi.fn() }) {
  const [valeur, setValeur] = useState('');
  return (
    <>
      <label htmlFor="adresse">Adresse postale</label>
      <ChampAdresse
        id="adresse"
        valeur={valeur}
        changer={setValeur}
        choisir={(s) => {
          setValeur(s.adresse);
          choisir(s);
        }}
        actif={actif}
        chercher={chercher}
        delai={0}
      />
    </>
  );
}

const champ = () => screen.getByRole('combobox', { name: 'Adresse postale' });
const options = () => screen.queryAllByRole('option').map((o) => o.textContent);
const touche = (key) => fireEvent.keyDown(champ(), { key });
async function taper(texte) {
  fireEvent.change(champ(), { target: { value: texte } });
  await act(async () => {
    await new Promise((fin) => setTimeout(fin, 0));
  });
}

describe('adresse avec suggestions', () => {
  it('à partir de 3 caractères : suggestions, un clic remplit l’adresse', async () => {
    const chercher = vi.fn().mockResolvedValue([LILAS, ROSES]);
    const choisir = vi.fn();
    render(<Exemple chercher={chercher} choisir={choisir} />);
    await taper('12');
    expect(chercher).not.toHaveBeenCalled();
    await taper(' 12 rue ');
    expect(chercher).toHaveBeenCalledWith('12 rue');
    expect(options()).toEqual([LILAS.libelle, ROSES.libelle]);
    fireEvent.mouseEnter(screen.getAllByRole('option')[1]);
    fireEvent.click(screen.getByRole('option', { name: LILAS.libelle }));
    expect(choisir).toHaveBeenCalledWith(LILAS);
    expect(champ().value).toBe('12 Rue des Lilas');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clavier : flèches pour parcourir, Entrée pour choisir, Échap pour fermer', async () => {
    const chercher = vi.fn().mockResolvedValue([LILAS, ROSES]);
    const choisir = vi.fn();
    render(<Exemple chercher={chercher} choisir={choisir} />);
    await taper('12 rue');
    touche('ArrowDown');
    touche('ArrowDown'); // reste sur la dernière
    expect(champ().getAttribute('aria-activedescendant')).toMatch(/-1$/);
    touche('ArrowUp');
    touche('Enter');
    expect(choisir).toHaveBeenCalledWith(LILAS);
    await taper('12 rue des');
    touche('Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    touche('Enter'); // liste fermée : rien ne se passe
    expect(choisir).toHaveBeenCalledTimes(1);
  });

  it('sortie du champ : la liste se ferme, la saisie reste', async () => {
    render(<Exemple chercher={vi.fn().mockResolvedValue([LILAS])} />);
    await taper('3 chemin du moulin');
    fireEvent.blur(champ());
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(champ().value).toBe('3 chemin du moulin');
  });

  it('hors France ou service en panne : saisie libre, sans suggestion', async () => {
    const chercher = vi.fn().mockResolvedValue([LILAS]);
    const { unmount } = render(<Exemple chercher={chercher} actif={false} />);
    await taper('12 rue des lilas');
    expect(chercher).not.toHaveBeenCalled();
    expect(champ().getAttribute('autocomplete')).toBeNull();
    unmount();
    render(<Exemple chercher={vi.fn().mockRejectedValue(new Error('panne'))} />);
    await taper('12 rue des lilas');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(champ().value).toBe('12 rue des lilas');
  });
});
