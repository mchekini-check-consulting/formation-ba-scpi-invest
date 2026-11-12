import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChampVille from './ChampVille.jsx';

afterEach(cleanup);

// Ville contrôlée par un état, comme dans les formulaires
function Ville({ initiale = '', codePostal, actif = true, chercher, surChangement = () => {} }) {
  const [ville, setVille] = useState(initiale);
  return (
    <>
      <label htmlFor="ville">Ville</label>
      <ChampVille
        id="ville"
        valeur={ville}
        changer={(v) => {
          setVille(v);
          surChangement(v);
        }}
        codePostal={codePostal}
        actif={actif}
        chercher={chercher}
      />
    </>
  );
}

async function afficher(proprietes) {
  await act(async () => {
    render(<Ville {...proprietes} />);
  });
  return screen.getByRole('combobox', { name: 'Ville' });
}

describe('ChampVille : ville proposée d’après le code postal', () => {
  it('une seule commune : ville remplie automatiquement', async () => {
    const chercher = vi.fn().mockResolvedValue(['Lyon']);
    const champ = await afficher({ codePostal: '69003', chercher });
    expect(chercher).toHaveBeenCalledWith('69003');
    expect(champ.value).toBe('Lyon');
  });

  it('une seule commune, ville déjà juste : rien ne change', async () => {
    const surChangement = vi.fn();
    const champ = await afficher({
      initiale: 'Lyon',
      codePostal: '69003',
      chercher: vi.fn().mockResolvedValue(['Lyon']),
      surChangement,
    });
    expect(champ.value).toBe('Lyon');
    expect(surChangement).not.toHaveBeenCalled();
  });

  it('plusieurs communes : liste proposée, choix au clic ou au clavier', async () => {
    const chercher = vi.fn().mockResolvedValue(['Argentré', 'Louvigné', 'Soulgé-sur-Ouette']);
    const champ = await afficher({ codePostal: '53210', chercher });
    expect(champ.value).toBe('');
    fireEvent.focus(champ);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Argentré',
      'Louvigné',
      'Soulgé-sur-Ouette',
    ]);
    fireEvent.mouseEnter(options[2]);
    fireEvent.mouseDown(options[2]);
    fireEvent.click(options[2]);
    expect(champ.value).toBe('Soulgé-sur-Ouette');
    expect(screen.queryByRole('listbox')).toBeNull();

    // Clavier : flèche bas rouvre la liste, flèches pour parcourir, Entrée pour choisir
    fireEvent.keyDown(champ, { key: 'ArrowDown' });
    fireEvent.keyDown(champ, { key: 'ArrowDown' });
    fireEvent.keyDown(champ, { key: 'ArrowUp' });
    fireEvent.keyDown(champ, { key: 'ArrowDown' });
    fireEvent.keyDown(champ, { key: 'Enter' });
    expect(champ.value).toBe('Louvigné');

    // Échap ferme ; une autre touche ne fait rien ; la frappe reste libre
    fireEvent.focus(champ);
    fireEvent.keyDown(champ, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(champ, { key: 'a' });
    fireEvent.change(champ, { target: { value: 'Argen' } });
    expect(champ.value).toBe('Argen');
    fireEvent.blur(champ);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('code postal incomplet, hors France ou service en panne : saisie libre', async () => {
    const chercher = vi.fn().mockResolvedValue(['Lyon']);
    await afficher({ codePostal: '690', chercher });
    cleanup();
    await afficher({ codePostal: '69003', actif: false, chercher });
    expect(chercher).not.toHaveBeenCalled();
    cleanup();
    const champ = await afficher({
      codePostal: '69003',
      chercher: vi.fn().mockRejectedValue(new Error('panne')),
    });
    fireEvent.focus(champ);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(champ.value).toBe('');
  });

  it('réponse arrivée après un autre code postal : ignorée', async () => {
    let premiere;
    const chercher = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resoudre) => (premiere = resoudre)))
      .mockResolvedValueOnce(['Paris']);
    let rendu;
    await act(async () => {
      rendu = render(<Ville codePostal="69003" chercher={chercher} />);
    });
    await act(async () => {
      rendu.rerender(<Ville codePostal="75001" chercher={chercher} />);
    });
    await act(async () => {
      premiere(['Lyon']);
    });
    expect(screen.getByRole('combobox', { name: 'Ville' }).value).toBe('Paris');
  });
});
