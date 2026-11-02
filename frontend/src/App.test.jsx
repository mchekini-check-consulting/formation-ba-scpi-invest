import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(cleanup);

describe('App', () => {
  it('présente SCPI Invest+', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Choisissez vos SCPI en confiance. Suivez-les toutes au même endroit.',
    );
    expect(screen.getByRole('link', { name: 'SCPI Invest+ — accueil' }).textContent).toBe(
      'SCPI INVEST+',
    );
  });

  it('donne accès à l’inscription', () => {
    render(<App />);
    const liens = screen.getAllByRole('link', { name: /Créer mon compte/ });
    expect(liens.length).toBeGreaterThan(0);
    liens.forEach((lien) => expect(lien.getAttribute('href')).toBe('/inscription'));
    expect(screen.getByRole('form', { name: 'Inscription' })).toBeDefined();
  });

  it('donne accès à la connexion', () => {
    render(<App />);
    const liens = [
      ...screen.getAllByRole('link', { name: 'Se connecter' }),
      screen.getByRole('link', { name: 'J’ai déjà un compte' }),
    ];
    liens.forEach((lien) => expect(lien.getAttribute('href')).toBe('/connexion'));
  });

  it('donne accès aux définitions des indicateurs', () => {
    render(<App />);
    const lien = screen.getByRole('link', { name: /Voir les définitions des indicateurs/ });
    expect(lien.getAttribute('href')).toBe('/indicateurs');
  });

  // Le pied de page cite le statut réglementaire du partenaire (« conseiller en
  // investissements financiers ») : seul le contenu de la page est vérifié
  it('ne parle pas d’accompagnement', () => {
    render(<App />);
    expect(document.querySelector('main').textContent).not.toMatch(/accompagn|conseiller/i);
  });

  it('pied de page : liens légaux et statut réglementaire', () => {
    render(<App />);
    const liens = screen.getByRole('navigation', { name: 'Liens légaux' }).querySelectorAll('a');
    expect([...liens].map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Mentions légales', '/mentions-legales'],
      ['Politique de confidentialité', '/confidentialite'],
      ['CGU', '/cgu'],
      ['Contact', '/contact'],
    ]);
    const pied = document.querySelector('footer').textContent;
    expect(pied).toContain('immatriculé à l’ORIAS sous le numéro 08066027');
    expect(pied).not.toContain('[STATUT');
  });

  it('ne mentionne aucune offre', () => {
    render(<App />);
    expect(document.body.textContent).not.toMatch(/offre|gratuit|premium|essentiel/i);
  });

  it('décrit le parcours en 4 étapes et 5 avantages distincts', () => {
    render(<App />);
    const titres = (id) =>
      [...document.querySelectorAll(`#${id} h3`)].map((titre) => titre.textContent);
    expect(titres('fonctionnement')).toEqual(['Recherchez', 'Comparez', 'Souscrivez', 'Suivez']);
    expect(titres('avantages')).toEqual([
      'La santé des SCPI, pas seulement leur rendement',
      'Une commission identique pour toutes',
      'Indicateurs expliqués',
      'Import automatique des relevés',
      'Votre argent reste chez vous',
    ]);
  });

  it('répond aux questions fréquentes', () => {
    render(<App />);
    const questions = [...document.querySelectorAll('summary')].map((q) => q.textContent);
    expect(questions).toEqual([
      'Pourquoi investir en SCPI ?',
      'Quels sont les avantages et les risques ?',
      'Puis-je suivre des SCPI achetées ailleurs ?',
      'Comment s’assurer que la plateforme est neutre ?',
    ]);
  });

  it('le formulaire du bas ouvre la création de compte, email déjà saisi', () => {
    const allerA = vi.fn();
    render(<App allerA={allerA} />);
    const formulaire = screen.getByRole('form', { name: 'Inscription' });
    const envoi = new Event('submit', { bubbles: true, cancelable: true });
    fireEvent(formulaire, envoi);
    expect(envoi.defaultPrevented).toBe(true);
    expect(allerA).toHaveBeenLastCalledWith('/inscription');

    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: ' jean+scpi@exemple.fr ' },
    });
    fireEvent.submit(formulaire);
    expect(allerA).toHaveBeenLastCalledWith('/inscription?email=jean%2Bscpi%40exemple.fr');
  });
});
