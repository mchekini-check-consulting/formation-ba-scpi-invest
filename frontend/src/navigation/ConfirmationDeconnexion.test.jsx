import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar.jsx';

afterEach(cleanup);

const SANS_IDENTITE = () => Promise.resolve({ nomComplet: '', email: '', profil: null });

async function ouvrir() {
  const seDeconnecter = vi.fn();
  await act(async () => {
    render(
      <Sidebar actif="catalogue" seDeconnecter={seDeconnecter} chargerIdentite={SANS_IDENTITE} />,
    );
  });
  const bouton = screen.getByRole('button', { name: 'Se déconnecter' });
  fireEvent.click(bouton);
  return { seDeconnecter, bouton, fenetre: screen.getByRole('alertdialog') };
}

describe('Confirmation de la déconnexion', () => {
  it('clic sur « Se déconnecter » : fenêtre « Oui » / « Non », sans déconnecter', async () => {
    const { seDeconnecter, fenetre } = await ouvrir();
    expect(fenetre.getAttribute('aria-modal')).toBe('true');
    expect(within(fenetre).getByRole('heading').textContent).toBe('Se déconnecter ?');
    expect(fenetre.textContent).toContain('Voulez-vous vraiment vous déconnecter ?');
    expect(
      within(fenetre)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Non', 'Oui']);
    // Focus sur « Non », le choix sans risque
    expect(document.activeElement.textContent).toBe('Non');
    expect(seDeconnecter).not.toHaveBeenCalled();
  });

  it('« Oui » : déconnexion, fenêtre fermée', async () => {
    const { seDeconnecter } = await ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
    expect(seDeconnecter).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('« Non » : fenêtre fermée, toujours connecté, focus rendu au bouton', async () => {
    const { seDeconnecter, bouton } = await ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Non' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(seDeconnecter).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(bouton);
  });

  it('Échap ou clic à côté de la fenêtre : comme « Non »', async () => {
    const { seDeconnecter, fenetre } = await ouvrir();
    fireEvent.keyDown(fenetre, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    const voile = screen.getByRole('alertdialog').parentElement;
    fireEvent.mouseDown(screen.getByRole('alertdialog')); // clic dans la fenêtre : reste ouverte
    expect(screen.getByRole('alertdialog')).toBeDefined();
    fireEvent.mouseDown(voile);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(seDeconnecter).not.toHaveBeenCalled();
  });

  it('Tab et Maj+Tab restent dans la fenêtre', async () => {
    const { fenetre } = await ouvrir();
    fireEvent.keyDown(fenetre, { key: 'Tab' });
    expect(document.activeElement.textContent).toBe('Oui');
    fireEvent.keyDown(fenetre, { key: 'Tab', shiftKey: true });
    expect(document.activeElement.textContent).toBe('Non');
    fireEvent.keyDown(fenetre, { key: 'Enter' }); // autre touche : rien de particulier
    expect(screen.getByRole('alertdialog')).toBeDefined();
  });
});
