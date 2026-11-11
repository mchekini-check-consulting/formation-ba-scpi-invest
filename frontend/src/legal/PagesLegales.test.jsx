import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Cgu from './Cgu.jsx';
import Confidentialite from './Confidentialite.jsx';
import Contact from './Contact.jsx';
import MentionsLegales from './MentionsLegales.jsx';

afterEach(cleanup);

const titresSections = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
// Liens du contenu de la page (le pied de page a aussi ses liens légaux)
const lien = (nom) =>
  within(screen.getByRole('main')).getByRole('link', { name: nom }).getAttribute('href');

describe('Pages légales (US-01b)', () => {
  it('Mentions légales : 10 sections, titre d’onglet et date de mise à jour', () => {
    render(<MentionsLegales />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mentions légales');
    const sections = titresSections();
    expect(sections).toHaveLength(10);
    expect(sections[0]).toBe('1. Éditeur de la plateforme');
    expect(sections[9]).toBe('10. Droit applicable');
    expect(document.title).toBe('SCPI Invest+ · Mentions légales');
    expect(document.body.textContent).toContain('Dernière mise à jour : 2 novembre 2026');
  });

  it('Mentions légales : liens vers la politique, les e-mails et les sites officiels', () => {
    render(<MentionsLegales />);
    expect(lien('Politique de confidentialité')).toBe('/confidentialite');
    expect(lien('dpo@scpi-investplus.fr')).toBe('mailto:dpo@scpi-investplus.fr');
    const orias = screen.getByRole('link', { name: 'www.orias.fr' });
    expect(orias.getAttribute('href')).toBe('https://www.orias.fr');
    expect(orias.getAttribute('target')).toBe('_blank');
    expect(orias.getAttribute('rel')).toBe('noopener noreferrer');
    expect(lien('Retour à l’accueil')).toBe('/');
  });

  it('CGU : 12 articles, article 12 repérable pour le lien depuis Contact', () => {
    render(<Cgu />);
    const sections = titresSections();
    expect(sections).toHaveLength(12);
    expect(sections[11]).toBe('Article 12. Dispositions générales');
    expect(document.getElementById('article-12')).not.toBeNull();
    expect(lien('Politique de confidentialité')).toBe('/confidentialite');
    expect(lien('www.mediation-conso-services.fr')).toBe('https://www.mediation-conso-services.fr');
    expect(document.body.textContent).toContain('5 € TTC par mois');
  });

  it('CGU : comptes ouverts aux non-résidents, date de mise à jour du 4 novembre 2026', () => {
    render(<Cgu />);
    const article4 = document.getElementById('article-4').textContent;
    expect(article4).toContain('résidentes fiscales en France ou à l’étranger');
    expect(article4).toContain('contribuables américains (US Persons)');
    expect(document.body.textContent).toContain('Dernière mise à jour : 4 novembre 2026');
  });

  it('Politique de confidentialité : 8 sections et tableaux des finalités et des durées', () => {
    render(<Confidentialite />);
    expect(titresSections()).toHaveLength(8);
    const [finalites, durees] = screen.getAllByRole('table');
    expect(within(finalites).getAllByRole('row')).toHaveLength(11);
    expect(within(durees).getAllByRole('row')).toHaveLength(8);
    expect(within(durees).getByText('13 mois maximum')).toBeTruthy();
  });

  it('Contact : 2 sections, sans formulaire, contacts cliquables', () => {
    render(<Contact />);
    expect(titresSections()).toEqual(['1. Nous contacter', '2. Contacts spécifiques']);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(lien('contact@scpi-investplus.fr')).toBe('mailto:contact@scpi-investplus.fr');
    expect(lien('01 46 00 12 34')).toBe('tel:+33146001234');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
    expect(lien('Conditions générales d’utilisation (article 12)')).toBe('/cgu#article-12');
    // pas de date de mise à jour sur la page Contact
    expect(document.body.textContent).not.toContain('Dernière mise à jour');
  });
});
