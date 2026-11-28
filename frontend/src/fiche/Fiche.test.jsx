import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import { chargerMonde } from './carte.js';
import Fiche from './Fiche.jsx';

afterEach(cleanup);

const monde = await chargerMonde();

const PIERVAL = {
  id: 12,
  nom: 'Pierval Santé',
  gerant: 'Euryale AM',
  capitalisation: 3_200_000_000,
  minimum: 1020,
  minimumParts: 5,
  fraisSouscription: 10.51,
  fraisGestion: 8.4,
  delaiJouissance: 4,
  frequence: 'Trimestrielle',
  cashback: 3,
  versementProgramme: false,
  publicite: null,
  prixPart: { annee: 2026, valeur: 202 },
  tauxDistribution: { annee: 2025, valeur: 5.1 },
  valeurReconstitution: null,
  historiquePrix: [
    { annee: 2024, valeur: 200 },
    { annee: 2025, valeur: 202 },
    { annee: 2026, valeur: 202 },
  ],
  historiqueTaux: [
    { annee: 2024, valeur: 5.35 },
    { annee: 2025, valeur: 5.1 },
  ],
  repartitionGeographique: [
    { libelle: 'France', part: 70 },
    { libelle: 'GdeBretagne', part: 30 },
  ],
  repartitionSectorielle: [
    { libelle: 'Santé', part: 91 },
    { libelle: 'Bureaux', part: 9 },
  ],
};

const IROKO = {
  ...PIERVAL,
  id: 1,
  nom: 'Iroko Zen',
  gerant: null,
  versementProgramme: true,
  cashback: 0,
  tauxDistribution: null,
  publicite:
    'SCPI diversifiée sur plusieurs pays et plusieurs secteurs. Son taux de distribution a dépassé 8 % sur chacune des trois dernières années.',
  historiquePrix: [{ annee: 2026, valeur: 202 }],
  historiqueTaux: [],
  repartitionGeographique: [],
  repartitionSectorielle: [],
};

function Adresse() {
  const { pathname, search } = useLocation();
  return <p data-testid="adresse">{pathname + search}</p>;
}

async function afficher(adresse = '/catalogue/12', options = {}) {
  const props = {
    lire: vi.fn((id) => (id === '1' ? Promise.resolve(IROKO) : Promise.resolve(PIERVAL))),
    chargerMonde: vi.fn(() => new Promise(() => {})), // carte non chargée (tests rapides)
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: () => Promise.resolve({ nomComplet: '', email: '', profil: null }),
    ...options,
  };
  await act(async () => {
    // Suspense : remplace l'écran tant que la fiche n'est pas chargée (Routeur.jsx)
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[adresse]}>
          <Suspense fallback={<p>Chargement…</p>}>
            <Routes>
              <Route path="/catalogue/:id" element={<Fiche {...props} />} />
              <Route path="*" element={<Adresse />} />
            </Routes>
          </Suspense>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return props;
}

const texte = () => document.body.textContent.replace(/[  ]/g, ' ');
const condition = (libelle) =>
  screen.getByText(libelle, { selector: 'dt' }).closest('div').querySelector('dd').textContent;

describe('Fiche SCPI (US-02)', () => {
  it('scénario « ouvrir la fiche » : données de la règle 2, sans IBAN ni BIC', async () => {
    const { lire } = await afficher();
    expect(lire).toHaveBeenCalledWith('12');
    expect(screen.getByRole('heading', { level: 1, name: 'Pierval Santé' })).toBeTruthy();
    const t = texte();
    for (const attendu of [
      'Société de gestion · Euryale AM',
      'Taux de distribution 2025',
      '5,10 %',
      '202 €',
      'en 2026',
      '1 020 €',
      'soit 5 parts',
      '3,20 Md€',
      '4 mois',
      '10,51 %',
      '8,40 %',
      'Trimestrielle',
      'Revenus trimestriels',
      'Diversifiée · 2 pays',
    ]) {
      expect(t.replace(/1020/, '1 020')).toContain(attendu);
    }
    expect(condition('Cashback').replace(/\s/g, ' ')).toBe('3 %');
    expect(t).not.toMatch(/IBAN|BIC/);
  });

  it('scénario « donnée absente » : valeur de reconstitution « Non communiqué »', async () => {
    await afficher();
    expect(condition('Valeur de reconstitution')).toBe('Non communiqué');
  });

  it('pas de versement programmé : texte de la règle 3, pas de bouton', async () => {
    await afficher();
    expect(condition('Versement programmé')).toBe('Versements programmés non disponibles');
    expect(screen.queryByRole('link', { name: 'Programmer un versement' })).toBeNull();
  });

  it('scénario « versement programmé » : « dès 202 € » et le bouton', async () => {
    await afficher('/catalogue/1');
    expect(condition('Versement programmé').replace(/\s/g, ' ')).toBe('dès 202 €');
    expect(screen.getByRole('link', { name: 'Programmer un versement' }).getAttribute('href')).toBe(
      '/versements/nouveau?scpi=1',
    );
    expect(condition('Cashback')).toBe('Aucun');
    expect(texte()).toContain('Société de gestion · Non communiqué');
  });

  it('scénario « bouton Simuler » et autres boutons (règle 6)', async () => {
    await afficher();
    const actions = within(screen.getByRole('navigation', { name: 'Actions sur la SCPI' }));
    expect(actions.getByRole('link', { name: 'Investir →' }).getAttribute('href')).toBe(
      '/investir/12',
    );
    expect(actions.getByRole('link', { name: 'Comparer' }).getAttribute('href')).toBe(
      '/comparaison?scpi=12',
    );
    await act(async () => {
      fireEvent.click(actions.getByRole('link', { name: 'Simuler' }));
    });
    expect(screen.getByTestId('adresse').textContent).toBe('/simulation?scpi=12:1');
  });

  it('scénario « retour au catalogue » : lien vers le Catalogue', async () => {
    await afficher();
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Retour au catalogue' }));
    });
    expect(screen.getByTestId('adresse').textContent).toBe('/catalogue');
  });

  it('scénario « historique du prix de part » : trois années et trois valeurs', async () => {
    await afficher();
    const prix = screen
      .getByText('Prix de part', { selector: 'figcaption strong' })
      .closest('figure');
    expect(prix.textContent).toContain('2024 – 2026');
    const lues = [...prix.querySelectorAll('.sr-only li')].map((li) =>
      li.textContent.replace(/[  ]/g, ' '),
    );
    expect(lues).toEqual(['2024 : 200 €', '2025 : 202 €', '2026 : 202 €']);
    const taux = screen
      .getByText('Taux de distribution', { selector: 'figcaption strong' })
      .closest('figure');
    expect(taux.querySelectorAll('.sr-only li')).toHaveLength(2);
    expect(taux.querySelector('svg')).toBeTruthy();
  });

  it('règle 12 : une seule valeur sans graphique ; aucune : « Données non disponibles »', async () => {
    await afficher('/catalogue/1');
    const prix = screen
      .getByText('Prix de part', { selector: 'figcaption strong' })
      .closest('figure');
    expect(prix.querySelector('.fiche__valeur-seule').textContent.replace(/\s/g, ' ')).toBe(
      '202 € en 2026',
    );
    expect(prix.querySelector('svg')).toBeNull();
    const taux = screen
      .getByText('Taux de distribution', { selector: 'figcaption strong' })
      .closest('figure');
    expect(taux.textContent).toContain('Données non disponibles');
    expect(texte()).toContain('Taux de distributionNon communiqué');
  });

  it('règle 11 : répartitions de la plus forte à la plus faible, secteurs en camembert', async () => {
    await afficher();
    const pays = screen.getByRole('list', { name: 'Part de chaque pays' });
    expect(
      [...pays.querySelectorAll('li')].map((li) => li.textContent.replace(/\s/g, ' ')),
    ).toEqual(['France70 %', 'Royaume-Uni30 %']);
    const secteurs = screen.getByRole('list', { name: 'Part de chaque secteur' });
    expect(secteurs.textContent.replace(/\s/g, ' ')).toBe('Santé91 %Bureaux9 %');
    expect(document.querySelector('.fiche__camembert svg')).toBeTruthy();
  });

  it('scénario « répartition absente » : « Données non disponibles »', async () => {
    await afficher('/catalogue/1');
    const geo = screen.getByRole('region', { name: 'Répartition géographique' });
    expect(geo.textContent).toContain('Données non disponibles');
    const secteurs = screen.getByRole('region', { name: 'Répartition sectorielle' });
    expect(secteurs.textContent).toContain('Données non disponibles');
  });

  it('carte des pays dessinée une fois les contours chargés', async () => {
    await afficher('/catalogue/12', { chargerMonde: () => Promise.resolve(monde) });
    const carte = document.querySelector('.fiche__carte');
    expect(carte).toBeTruthy();
    expect(carte.textContent.replace(/[  ]/g, ' ')).toContain('Royaume-Uni30 %');
  });

  it('contours indisponibles : pas de carte, la liste reste', async () => {
    await afficher('/catalogue/12', {
      chargerMonde: vi.fn().mockRejectedValue(new Error('réseau')),
    });
    expect(document.querySelector('.fiche__carte')).toBeNull();
    expect(screen.getByRole('list', { name: 'Part de chaque pays' })).toBeTruthy();
  });

  it('scénarios « texte publicitaire » et « pas de texte publicitaire » (règle 4)', async () => {
    await afficher('/catalogue/1');
    const bloc = screen.getByRole('complementary', {
      name: 'Communication à caractère promotionnel',
    });
    expect(bloc.textContent).toContain(IROKO.publicite);
    // Placé sous le bandeau, avant les chiffres clés
    expect(bloc.nextElementSibling).toBe(screen.getByLabelText('Chiffres clés'));
    cleanup();
    await afficher('/catalogue/12');
    expect(screen.queryByText('Communication à caractère promotionnel')).toBeNull();
  });

  it('scénarios « SCPI supprimée » et « introuvable » : message du backend et lien vers le Catalogue', async () => {
    const lire = vi.fn().mockRejectedValue(new ErreurApi(404, 'Cette SCPI n’est plus disponible'));
    await afficher('/catalogue/40', { lire });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cette SCPI n’est plus disponible' }),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Retour au catalogue' }));
    });
    expect(screen.getByTestId('adresse').textContent).toBe('/catalogue');
  });

  it('session expirée : connexion ; autre erreur : message affiché', async () => {
    const { allerA } = await afficher('/catalogue/12', {
      lire: vi.fn().mockRejectedValue(new ErreurApi(401, 'Session expirée')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
    cleanup();
    await afficher('/catalogue/12', {
      lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Service indisponible')),
    });
    expect(screen.getByRole('alert').textContent).toBe('Service indisponible');
  });

  it('chargement en cours : rien de la fiche affiché (pas d’écran vide « Fiche SCPI »)', async () => {
    await afficher('/catalogue/12', { lire: vi.fn(() => new Promise(() => {})) });
    expect(texte()).toContain('Chargement…');
    expect(screen.queryByText('Fiche SCPI')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Menu de l’application' })).toBeNull();
  });

  it('déconnexion depuis le menu', async () => {
    const props = await afficher('/catalogue/12');
    const menu = screen.getByRole('navigation', { name: 'Menu de l’application' });
    await act(async () =>
      fireEvent.click(within(menu).getByRole('button', { name: 'Se déconnecter' })),
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Oui' })));
    expect(props.seDeconnecter).toHaveBeenCalled();
    expect(props.allerA).toHaveBeenCalledWith('/');
  });
});
