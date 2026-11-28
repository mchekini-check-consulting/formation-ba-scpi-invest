import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MaFiscalite, {
  MESSAGE_AVEC_INFORMATIONS,
  MESSAGE_SANS_INFORMATIONS,
} from './MaFiscalite.jsx';

afterEach(cleanup);

const SANS = { avecInformations: false, tauxProposes: [0, 11, 30, 41, 45], tauxParDefaut: 30 };

function afficher(estimation, taux = null) {
  const choisirTaux = vi.fn();
  render(
    <MemoryRouter>
      <MaFiscalite estimation={estimation} taux={taux} choisirTaux={choisirTaux} />
    </MemoryRouter>,
  );
  return choisirTaux;
}

describe('Cadre « Ma fiscalité » de la simulation', () => {
  it('estimation pas encore reçue : rien', () => {
    afficher(null);
    expect(document.body.textContent).toBe('');
  });

  it('sans informations fiscales : message, taux 30 % par défaut, bouton vers /fiscalite', () => {
    const choisirTaux = afficher(SANS);
    expect(screen.getByRole('heading', { name: 'Ma fiscalité' })).toBeDefined();
    expect(screen.getByText(MESSAGE_SANS_INFORMATIONS)).toBeDefined();
    const liste = screen.getByLabelText('Taux d’imposition estimé');
    expect(liste.value).toBe('30');
    fireEvent.change(liste, { target: { value: '11' } });
    expect(choisirTaux).toHaveBeenCalledWith(11);
    const lien = screen.getByRole('link', { name: 'Renseigner mes informations fiscales' });
    expect(lien.getAttribute('href')).toBe('/fiscalite');
    expect(lien.className).toBe('simulation__bouton');
  });

  it('taux déjà choisi : présélectionné', () => {
    afficher(SANS, 41);
    expect(screen.getByLabelText('Taux d’imposition estimé').value).toBe('41');
  });

  it('avec informations fiscales : rappel, pas de liste, lien pour les modifier', () => {
    afficher({ avecInformations: true });
    expect(screen.getByText(MESSAGE_AVEC_INFORMATIONS)).toBeDefined();
    expect(screen.queryByLabelText('Taux d’imposition estimé')).toBeNull();
    const lien = screen.getByRole('link', { name: 'Modifier mes informations fiscales' });
    expect(lien.getAttribute('href')).toBe('/fiscalite');
    expect(lien.className).toContain('simulation__bouton--secondaire');
  });
});
