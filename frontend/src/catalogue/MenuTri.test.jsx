import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MenuTri from './MenuTri.jsx';

afterEach(cleanup);

function afficher(tri = 'taux-desc') {
  const onChange = vi.fn();
  render(
    <>
      <MenuTri tri={tri} onChange={onChange} />
      <p>À côté</p>
    </>,
  );
  return onChange;
}

const bouton = () => screen.getByRole('button', { name: /^Trier par/ });
const liste = () => screen.queryByRole('listbox', { name: 'Trier par' });
const actif = () => document.getElementById(liste().getAttribute('aria-activedescendant'));

describe('Menu « Trier par » sur mesure (US-11)', () => {
  it('bouton : tri actif affiché, liste fermée', () => {
    afficher('nom-asc');
    expect(bouton().getAttribute('aria-label')).toBe('Trier par : Nom A → Z');
    expect(bouton().textContent).toBe('Trier parNom A → Z');
    expect(bouton().getAttribute('aria-expanded')).toBe('false');
    expect(liste()).toBeNull();
  });

  it('clic : 6 groupes de 2 choix, tri actif coché et mis en avant', () => {
    afficher('capitalisation-asc');
    fireEvent.click(bouton());
    expect(bouton().getAttribute('aria-expanded')).toBe('true');
    expect(bouton().getAttribute('aria-controls')).toBe(liste().id);
    expect(document.activeElement).toBe(liste());
    const groupes = within(liste()).getAllByRole('group');
    // Chaque groupe porte le nom de son critère, et propose ses deux sens
    expect(groupes.map((g) => document.getElementById(g.getAttribute('aria-labelledby')))).toEqual(
      groupes.map((g) => g.firstChild),
    );
    expect(groupes.map((g) => g.firstChild.textContent)).toEqual([
      'Taux de distribution',
      'Capitalisation',
      'Zone géographique',
      'Catégorie',
      'Société de gestion',
      'Nom',
    ]);
    expect(groupes.map((g) => within(g).getAllByRole('option').length)).toEqual([2, 2, 2, 2, 2, 2]);
    const choisi = screen.getByRole('option', { selected: true });
    expect(choisi.getAttribute('aria-label')).toBe('Capitalisation — croissant');
    expect(choisi.textContent).toBe('Croissant');
    expect(actif()).toBe(choisi);
  });

  it('clic sur un autre choix : envoyé, liste fermée, focus rendu au bouton', () => {
    const onChange = afficher();
    fireEvent.click(bouton());
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Catégorie Z → A' }));
    expect(actif().getAttribute('aria-label')).toBe('Catégorie Z → A');
    fireEvent.click(screen.getByRole('option', { name: 'Catégorie Z → A' }));
    expect(onChange).toHaveBeenCalledWith('secteur-desc');
    expect(liste()).toBeNull();
    expect(document.activeElement).toBe(bouton());
  });

  it('même choix que le tri actif : rien n’est relancé', () => {
    const onChange = afficher();
    fireEvent.click(bouton());
    fireEvent.click(screen.getByRole('option', { name: 'Taux de distribution — décroissant' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(liste()).toBeNull();
  });

  it('clavier : flèches, Début, Fin, Entrée ; flèche bas sur le bouton pour ouvrir', () => {
    const onChange = afficher();
    fireEvent.keyDown(bouton(), { key: 'ArrowDown' });
    expect(liste()).not.toBeNull();
    fireEvent.keyDown(liste(), { key: 'ArrowUp' }); // déjà en haut : reste sur le premier
    expect(actif().getAttribute('aria-label')).toBe('Taux de distribution — décroissant');
    fireEvent.keyDown(liste(), { key: 'ArrowDown' });
    fireEvent.keyDown(liste(), { key: 'ArrowDown' });
    expect(actif().getAttribute('aria-label')).toBe('Capitalisation — décroissant');
    fireEvent.keyDown(liste(), { key: 'End' });
    fireEvent.keyDown(liste(), { key: 'ArrowDown' }); // déjà en bas : reste sur le dernier
    expect(actif().getAttribute('aria-label')).toBe('Nom Z → A');
    fireEvent.keyDown(liste(), { key: 'Home' });
    fireEvent.keyDown(liste(), { key: 'ArrowDown' });
    fireEvent.keyDown(liste(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('taux-asc');
    expect(document.activeElement).toBe(bouton());

    fireEvent.keyDown(bouton(), { key: 'ArrowUp' });
    fireEvent.keyDown(liste(), { key: 'End' });
    fireEvent.keyDown(liste(), { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith('nom-desc');
  });

  it('fermeture sans choisir : Échap, second clic, Tab, clic en dehors', () => {
    const onChange = afficher();
    fireEvent.click(bouton());
    fireEvent.keyDown(liste(), { key: 'Escape' });
    expect(liste()).toBeNull();
    expect(document.activeElement).toBe(bouton());

    fireEvent.click(bouton());
    fireEvent.click(bouton());
    expect(liste()).toBeNull();

    fireEvent.click(bouton());
    fireEvent.keyDown(liste(), { key: 'Tab' });
    expect(liste()).toBeNull();

    fireEvent.click(bouton());
    fireEvent.keyDown(liste(), { key: 'a' }); // touche sans effet
    fireEvent.mouseDown(liste());
    expect(liste()).not.toBeNull();
    fireEvent.mouseDown(screen.getByText('À côté'));
    expect(liste()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('autre touche sur le bouton : la liste reste fermée', () => {
    afficher();
    fireEvent.keyDown(bouton(), { key: 'a' });
    expect(liste()).toBeNull();
  });
});
