import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App.jsx';
import Indicateurs from '../Indicateurs.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import PageCompte from '../PageCompte.jsx';
import LiensLegaux from './LiensLegaux.jsx';
import MentionsLegales from './MentionsLegales.jsx';

afterEach(cleanup);

const ATTENDUS = [
  ['Mentions légales', '/mentions-legales'],
  ['Politique de confidentialité', '/confidentialite'],
  ['CGU', '/cgu'],
  ['Contact', '/contact'],
];

const SANS_IDENTITE = () => Promise.resolve({ nomComplet: '', email: '', profil: null });

// Liens légaux du pied de page, dans l'ordre affiché
function liensDuPied() {
  const pied = document.querySelector('footer');
  const nav = within(pied).getByRole('navigation', { name: 'Liens légaux' });
  return within(nav)
    .getAllByRole('link')
    .map((l) => [l.textContent, l.getAttribute('href')]);
}

describe('Liens légaux du pied de page (US-01b)', () => {
  it('pied de page complet (accueil) : sans style compact', () => {
    render(<LiensLegaux />);
    expect(screen.getByRole('navigation').className).toBe('');
  });

  it('pied de page sans logo : style compact', () => {
    render(<LiensLegaux compact />);
    expect(screen.getByRole('navigation').className).toBe('pied__nav');
  });

  it.each([
    ['accueil', () => <App />],
    ['indicateurs', () => <Indicateurs />],
    [
      'écrans du compte (inscription, connexion, KYC…)',
      () => (
        <PageCompte titre="Connexion">
          <p>Contenu</p>
        </PageCompte>
      ),
    ],
    [
      'écrans de l’application (catalogue, profil…)',
      () => (
        <PageApplication
          titre="Catalogue des SCPI"
          actif="catalogue"
          chargerIdentite={SANS_IDENTITE}
        >
          <p>Contenu</p>
        </PageApplication>
      ),
    ],
    ['pages légales', () => <MentionsLegales />],
  ])('%s : les 4 liens légaux en pied de page', (_, ecran) => {
    render(ecran());
    expect(liensDuPied()).toEqual(ATTENDUS);
  });
});
