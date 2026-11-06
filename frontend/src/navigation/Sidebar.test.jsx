import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Routeur from '../Routeur.jsx';
import { CHEMINS_INACTIFS, ENTREES } from './entrees.js';
import { initiales, lireIdentite } from './identite.js';
import PageApplication from './PageApplication.jsx';
import Sidebar from './Sidebar.jsx';

afterEach(cleanup);

// Écran de test avec la sidebar ; l'adresse courante est affichée pour vérifier la navigation
function Adresse() {
  return <p data-testid="adresse">{useLocation().pathname}</p>;
}

const SANS_IDENTITE = () => Promise.resolve({ nomComplet: '', email: '', profil: null });

function afficher(chemin = '/catalogue') {
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Sidebar actif="catalogue" chargerIdentite={SANS_IDENTITE} />
              <Adresse />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const menu = () => screen.getByRole('navigation', { name: 'Menu de l’application' });
const liste = () => within(menu()).getByRole('list');
const adresse = () => screen.getByTestId('adresse').textContent;

describe('Sidebar de navigation (US-06)', () => {
  it('scénario 1 : 4 entrées avec icône et libellé, Catalogue sélectionné', () => {
    afficher();
    const entrees = within(liste()).getAllByRole('listitem');
    expect(entrees.map((e) => e.textContent.replace(' (bientôt disponible)', ''))).toEqual([
      'Catalogue',
      'Comparaison',
      'Simulation',
      'Portefeuille',
    ]);
    for (const entree of entrees) {
      expect(entree.querySelector('svg.sidebar__icone')).not.toBeNull();
    }
    const catalogue = within(menu()).getByRole('link', { name: 'Catalogue' });
    expect(catalogue.getAttribute('aria-current')).toBe('page');
  });

  it('scénario 2 : « Catalogue » mène à l’écran Catalogue', () => {
    afficher('/autre-ecran');
    fireEvent.click(within(menu()).getByRole('link', { name: 'Catalogue' }));
    expect(adresse()).toBe('/catalogue');
  });

  it('scénario 3 : entrées inactives, pas de lien, le clic ne change pas d’écran', () => {
    afficher();
    // le seul lien des entrées est le Catalogue
    expect(within(liste()).getAllByRole('link')).toHaveLength(1);
    for (const libelle of ['Comparaison', 'Simulation', 'Portefeuille']) {
      const entree = within(menu()).getByText(libelle).closest('.sidebar__entree');
      expect(entree.tagName).toBe('SPAN');
      expect(entree.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(entree);
      expect(adresse()).toBe('/catalogue');
    }
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('scénario 4 : entrées inactives grisées, infobulle « Bientôt disponible »', () => {
    afficher();
    const simulation = within(menu()).getByText('Simulation').closest('.sidebar__entree');
    expect(simulation.classList.contains('sidebar__entree--inactive')).toBe(true);
    expect(simulation.getAttribute('data-infobulle')).toBe('Bientôt disponible');
    // annoncée aux lecteurs d'écran
    expect(simulation.textContent).toContain('(bientôt disponible)');
  });

  it('écran actif autre que le Catalogue : aucune entrée sélectionnée', () => {
    render(<Sidebar actif="profil" chargerIdentite={SANS_IDENTITE} />);
    expect(screen.getByRole('link', { name: 'Catalogue' }).getAttribute('aria-current')).toBeNull();
  });

  it('logo vers l’accueil du catalogue', () => {
    afficher();
    fireEvent.click(within(menu()).getByRole('link', { name: 'SCPI Invest+ — catalogue' }));
    expect(adresse()).toBe('/catalogue');
  });

  it('flèche : déplie puis replie la barre', () => {
    afficher();
    const fleche = within(menu()).getByRole('button', { name: 'Déplier le menu' });
    expect(fleche.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(fleche);
    expect(menu().classList.contains('sidebar--deplie')).toBe(true);
    expect(fleche.getAttribute('aria-expanded')).toBe('true');
    expect(fleche.getAttribute('aria-label')).toBe('Replier le menu');
    fireEvent.click(fleche);
    expect(menu().classList.contains('sidebar--deplie')).toBe(false);
  });

  it('infobulle du libellé sur les entrées, barre repliée', () => {
    afficher();
    const catalogue = within(menu()).getByRole('link', { name: 'Catalogue' });
    expect(catalogue.getAttribute('data-infobulle')).toBe('Catalogue');
    const simulation = within(menu()).getByText('Simulation').closest('.sidebar__entree');
    expect(simulation.getAttribute('data-libelle')).toBe('Simulation');
  });

  it('initiales, nom et profil de l’investisseur en bas de la barre', async () => {
    const chargerIdentite = vi
      .fn()
      .mockResolvedValue({ nomComplet: 'Marie Curie', email: 'm@x.fr', profil: 'equilibre' });
    await act(async () => {
      render(<Sidebar actif="catalogue" chargerIdentite={chargerIdentite} />);
    });
    const profil = menu().querySelector('.sidebar__profil');
    expect(profil.querySelector('.sidebar__pastille').textContent).toBe('MC');
    expect(profil.textContent).toContain('Marie Curie');
    expect(profil.textContent).toContain('Profil équilibré');
    expect(profil.getAttribute('data-infobulle')).toBe('Marie Curie');
  });

  it('sans nom : initiale de l’email, sans profil', async () => {
    const chargerIdentite = vi
      .fn()
      .mockResolvedValue({ nomComplet: '', email: 'jean@x.fr', profil: null });
    await act(async () => {
      render(<Sidebar actif="catalogue" chargerIdentite={chargerIdentite} />);
    });
    const profil = menu().querySelector('.sidebar__profil');
    expect(profil.textContent).toBe('Jjean@x.fr');
  });

  it('identité inconnue ou indisponible : pas de pastille', async () => {
    await act(async () => {
      render(
        <Sidebar actif="catalogue" chargerIdentite={vi.fn().mockRejectedValue(new Error('x'))} />,
      );
    });
    expect(menu().querySelector('.sidebar__profil')).toBeNull();
  });

  it('sans action de déconnexion : pas de bouton', () => {
    afficher();
    expect(within(menu()).queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
  });

  it('entrées et adresses inactives cohérentes', () => {
    expect(ENTREES.filter((e) => !e.inactive).map((e) => e.id)).toEqual(['catalogue']);
    expect(CHEMINS_INACTIFS).toEqual(['/comparaison', '/simulation', '/portefeuille']);
  });
});

describe('Mise en page des écrans de l’application (US-06)', () => {
  it('sidebar avec déconnexion, titre et contenu', async () => {
    let deconnecte = false;
    render(
      <PageApplication
        titre="Catalogue des SCPI"
        actif="catalogue"
        chargerIdentite={SANS_IDENTITE}
        seDeconnecter={() => {
          deconnecte = true;
        }}
      >
        <p>Contenu de l’écran</p>
      </PageApplication>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Catalogue des SCPI');
    expect(screen.getByRole('navigation', { name: 'Menu de l’application' })).toBeDefined();
    expect(screen.getByRole('main').textContent).toContain('Contenu de l’écran');
    const menuApp = screen.getByRole('navigation', { name: 'Menu de l’application' });
    await act(async () =>
      fireEvent.click(within(menuApp).getByRole('button', { name: 'Se déconnecter' })),
    );
    expect(deconnecte).toBe(true);
  });
});

describe('Accès direct à un écran inactif (US-06, scénario 5)', () => {
  it.each(CHEMINS_INACTIFS)('%s : redirection vers le Catalogue', (chemin) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[chemin]}>
          <Routeur />
          <Adresse />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(adresse()).toBe('/catalogue');
  });
});

describe('Identité de la sidebar', () => {
  const lecteurs = (utilisateur, kyc, profil) => ({
    lireUtilisateur: () => utilisateur,
    lireLeKyc: () => kyc,
    lireLeProfil: () => profil,
  });

  it('nom du KYC, email et profil connu', async () => {
    const identite = await lireIdentite(
      lecteurs(
        Promise.resolve({ email: 'm@x.fr' }),
        Promise.resolve({ reponses: { prenom: ' Marie ', nom: 'Curie' } }),
        Promise.resolve({ profil: 'prudent' }),
      ),
    );
    expect(identite).toEqual({ nomComplet: 'Marie Curie', email: 'm@x.fr', profil: 'prudent' });
  });

  it('services indisponibles ou réponses incomplètes : valeurs vides', async () => {
    const erreur = Promise.reject(new Error('x'));
    erreur.catch(() => {});
    const identite = await lireIdentite(
      lecteurs(
        erreur,
        Promise.resolve({ reponses: { prenom: 3 } }),
        Promise.resolve({ profil: 'x' }),
      ),
    );
    expect(identite).toEqual({ nomComplet: '', email: '', profil: null });
  });

  it('initiales : prénom et nom, nom composé, email, rien', () => {
    expect(initiales({ nomComplet: 'marie curie', email: '' })).toBe('MC');
    expect(initiales({ nomComplet: 'Jean-Paul Martin', email: '' })).toBe('JM');
    expect(initiales({ nomComplet: 'Marie', email: '' })).toBe('M');
    expect(initiales({ nomComplet: '', email: 'zoe@x.fr' })).toBe('Z');
    expect(initiales({ nomComplet: '', email: '' })).toBe('');
  });
});
