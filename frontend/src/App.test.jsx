import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

describe('Landing page', () => {
  it('présente SCPI Invest+ avec son accroche', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "Toutes vos SCPI.Un seul point d'entrée.",
    );
    expect(screen.getByRole('link', { name: /SCPI Invest\+/ }).getAttribute('href')).toBe('#top');
  });

  it('propose une navigation vers chaque section', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    const liens = within(nav)
      .getAllByRole('link')
      .map((lien) => lien.getAttribute('href'));
    expect(liens).toEqual(['#top', '#fonctionnalites', '#simulateur', '#etapes', '#faq', '#inscription']);
    for (const id of ['fonctionnalites', 'simulateur', 'etapes', 'faq', 'inscription']) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('présente les quatre outils', () => {
    render(<App />);
    const outils = screen.getAllByRole('heading', { level: 3 }).map((titre) => titre.textContent);
    expect(outils.slice(0, 4)).toEqual(['Rechercher', 'Comparer', 'Simuler', 'Suivre']);
  });

  it('numérote les trois étapes', () => {
    render(<App />);
    const etapes = within(document.getElementById('etapes')).getAllByRole('listitem');
    expect(etapes.map((etape) => etape.firstChild.textContent)).toEqual(['01', '02', '03']);
  });

  it('liste les critères de comparaison et les questions fréquentes', () => {
    render(<App />);
    expect(screen.getByText("Taux d'occupation financier")).toBeTruthy();
    expect(screen.getByText('Quels sont les risques ?').tagName).toBe('SUMMARY');
  });

  it('rappelle les risques de l’investissement en SCPI', () => {
    render(<App />);
    expect(screen.getByRole('contentinfo').textContent).toContain('perte en capital');
  });

  it("garde l'utilisateur sur la page quand il envoie son e-mail", () => {
    render(<App />);
    const champ = screen.getByLabelText('Adresse e-mail');
    const envoi = fireEvent.submit(champ.closest('form'));
    expect(envoi).toBe(false); // envoi bloqué : pas encore de backend d'inscription
  });

  it('affiche le simulateur avec ses valeurs de départ', () => {
    render(<App />);
    expect(screen.getByLabelText('Montant investi').value).toBe('20000');
    expect(screen.getByText('Revenus cumulés sur 10 ans')).toBeTruthy();
  });
});
