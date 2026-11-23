import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Comparateur from './Comparateur.jsx';

afterEach(cleanup);

const SCPI = {
  minimum: 1000,
  capitalisation: 150000000,
  fraisGestion: 10,
  delaiJouissance: 3,
  anneeTaux: 2025,
  evolutionPrix: null,
  paysPrincipal: { libelle: 'France', part: 70 },
  secteurPrincipal: { libelle: 'Bureaux', part: 60 },
};

const IROKO = {
  ...SCPI,
  id: 1,
  nom: 'Iroko Zen',
  tauxDistribution: 7.12,
  prixPart: 200,
  fraisSouscription: 0,
  frequence: 'Mensuelle',
  demembrement: true,
  versementProgramme: true,
};

const COMETE = {
  ...SCPI,
  id: 3,
  nom: 'Comète',
  tauxDistribution: 8,
  prixPart: 250,
  minimum: 5000,
  fraisSouscription: 12,
  frequence: 'Trimestrielle',
  demembrement: false,
  versementProgramme: false,
  evolutionPrix: {
    debut: { annee: 2020, prix: 200 },
    fin: { annee: 2025, prix: 250 },
    variation: 25,
  },
};

const CORUM = {
  ...SCPI,
  id: 7,
  nom: 'Corum Origin',
  tauxDistribution: 6.05,
  prixPart: 1135,
  minimum: 1135,
  capitalisation: null,
  fraisSouscription: 12,
  frequence: 'Mensuelle',
  demembrement: null,
  versementProgramme: false,
};

function Adresse() {
  const { pathname, search } = useLocation();
  return <p data-testid="adresse">{pathname + search}</p>;
}

async function afficher(adresse = '/comparaison', options = {}) {
  const props = {
    lire: vi.fn().mockResolvedValue([COMETE, CORUM, IROKO]),
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: () => Promise.resolve({ nomComplet: '', email: '', profil: null }),
    ...options,
  };
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[adresse]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <Comparateur {...props} />
                <Adresse />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  });
  return props;
}

const texte = (element) => element.textContent.replace(/\s/g, ' ');
const emplacement = (i) => screen.getByRole('combobox', { name: `SCPI n° ${i}` });
const emplacements = () => [1, 2, 3].map((i) => emplacement(i).value);
const choisirScpi = (i, nom) => {
  fireEvent.click(emplacement(i));
  fireEvent.click(screen.getByRole('option', { name: nom }));
};
const cellules = (libelle) =>
  within(screen.getByRole('rowheader', { name: libelle }).closest('tr')).getAllByRole('cell');
const meilleures = (libelle) =>
  cellules(libelle)
    .filter((c) => c.classList.contains('comparateur__meilleur'))
    .map(texte);
const adresse = () => screen.getByTestId('adresse').textContent;
const champMontant = () => screen.getByLabelText('Montant à simuler');
const saisir = (montant) => fireEvent.change(champMontant(), { target: { value: montant } });

describe('Comparateur (US-04)', () => {
  it('arrivée par le menu : emplacements vides, au moins 2 SCPI demandées', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Comparer');
    expect(emplacements()).toEqual(['', '', '']);
    expect(screen.getByText('Choisissez au moins 2 SCPI pour les comparer.')).toBeDefined();
  });

  it('listes triées par nom, comme reçues du backend, avec recherche', async () => {
    await afficher();
    fireEvent.click(emplacement(1));
    const noms = screen.getAllByRole('option').map((o) => o.textContent);
    expect(noms).toEqual(['Comète', 'Corum Origin', 'Iroko Zen']);
    fireEvent.change(emplacement(1), { target: { value: 'iro' } });
    fireEvent.click(screen.getByRole('option', { name: 'Iroko Zen' }));
    expect(emplacements()).toEqual(['Iroko Zen', '', '']);
  });

  it('scénario : comparer deux SCPI', async () => {
    await afficher('/comparaison?scpi=1,3');
    expect(screen.queryByText('Choisissez au moins 2 SCPI pour les comparer.')).toBeNull();
    expect(meilleures('Taux de distribution')).toEqual(['8,00 % (meilleure valeur)en 2025']);
    expect(meilleures('Frais de souscription')).toEqual(['0,00 % (meilleure valeur)']);
    expect(texte(cellules('Taux de distribution')[0])).toBe('7,12 %en 2025');
  });

  it('scénario : SCPI déjà choisie', async () => {
    await afficher();
    choisirScpi(1, 'Iroko Zen');
    fireEvent.click(emplacement(2));
    const option = screen.getByRole('option', { name: 'Iroko Zen (déjà choisie)' });
    expect(option.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(option);
    expect(emplacements()).toEqual(['Iroko Zen', '', '']);
  });

  it('l’adresse suit la sélection, virgules non encodées (C1)', async () => {
    await afficher();
    choisirScpi(1, 'Iroko Zen');
    choisirScpi(3, 'Corum Origin');
    expect(adresse()).toBe('/comparaison?scpi=1,7');
  });

  it('poubelle : retire la SCPI de son emplacement et de l’adresse', async () => {
    await afficher('/comparaison?scpi=3,7');
    fireEvent.click(screen.getByRole('button', { name: 'Retirer Comète de la comparaison' }));
    expect(emplacements()).toEqual(['', 'Corum Origin', '']);
    expect(adresse()).toBe('/comparaison?scpi=7');
    expect(screen.getAllByRole('button', { name: /^Retirer/ })).toHaveLength(1);
  });

  it('scénario : ouverture pré-remplie', async () => {
    await afficher('/comparaison?scpi=3,7');
    expect(emplacements()).toEqual(['Comète', 'Corum Origin', '']);
  });

  it('scénario : fréquence, démembrement et versement programmé', async () => {
    await afficher('/comparaison?scpi=1,3');
    const valeurs = (libelle) => cellules(libelle).slice(0, 2).map(texte);
    expect(valeurs('Fréquence des loyers')).toEqual(['Mensuelle', 'Trimestrielle']);
    expect(valeurs('Démembrement')).toEqual(['Oui', 'Non']);
    expect(valeurs('Versement programmé')).toEqual(['Oui', 'Non']);
    for (const libelle of ['Fréquence des loyers', 'Démembrement', 'Versement programmé']) {
      expect(meilleures(libelle)).toEqual([]);
    }
  });

  it('scénario : donnée absente', async () => {
    await afficher('/comparaison?scpi=3,7');
    expect(texte(cellules('Capitalisation')[1])).toBe('Non communiqué');
    expect(texte(cellules('Démembrement')[1])).toBe('Non communiqué');
    expect(meilleures('Capitalisation')).toEqual([]);
  });

  it('scénario : revenu brut pour un montant', async () => {
    await afficher('/comparaison?scpi=3,7');
    saisir('10000');
    const [comete, corum] = cellules('Revenu annuel brut estimé').map(texte);
    expect(comete).toBe(
      '800,00 € par an (meilleure valeur)40 parts · 10 000 € investis · 66,67 € par mois',
    );
    expect(corum).toBe('549,34 € par an8 parts · 9 080 € investis · 45,78 € par mois');
  });

  it('scénario : montant sous le minimum', async () => {
    await afficher('/comparaison?scpi=3,7');
    saisir('3000');
    const [comete] = cellules('Revenu annuel brut estimé');
    expect(texte(comete)).toBe('—Montant inférieur au minimum à investir (5 000 €)');
    expect(meilleures('Revenu annuel brut estimé')).toEqual([]);
  });

  it('clic sur « Montant inférieur au minimum » : montant accepté par toutes les SCPI', async () => {
    await afficher('/comparaison?scpi=3,7');
    saisir('3000');
    fireEvent.click(screen.getByRole('button', { name: /Montant inférieur au minimum/ }));
    expect(champMontant().value).toBe('5000');
    expect(screen.queryByRole('button', { name: /Montant inférieur au minimum/ })).toBeNull();
  });

  it('scénario : pas de montant', async () => {
    await afficher('/comparaison?scpi=3,7');
    const [comete, corum, vide] = cellules('Revenu annuel brut estimé').map(texte);
    expect([comete, corum]).toEqual(['—Saisissez un montant', '—Saisissez un montant']);
    expect(vide).toBe('—');
  });

  it('montant : chiffres seulement', async () => {
    await afficher();
    saisir('10 000 €');
    expect(champMontant().value).toBe('10000');
  });

  it('croix : efface le montant ; sans montant, pas de croix', async () => {
    await afficher();
    expect(screen.queryByRole('button', { name: 'Effacer le montant' })).toBeNull();
    saisir('10000');
    fireEvent.click(screen.getByRole('button', { name: 'Effacer le montant' }));
    expect(champMontant().value).toBe('');
    expect(document.activeElement).toBe(champMontant());
    expect(screen.queryByRole('button', { name: 'Effacer le montant' })).toBeNull();
  });

  it('évolution du prix sur 5 ans, pays et secteur principaux', async () => {
    await afficher('/comparaison?scpi=3,7');
    expect(texte(cellules('Évolution du prix de part sur 5 ans')[0])).toBe(
      '200 € → 250 € (+25,00 %)de 2020 à 2025',
    );
    expect(texte(cellules('Évolution du prix de part sur 5 ans')[1])).toBe('Non communiqué');
    expect(texte(cellules('Pays principal')[0])).toBe('France (70,00 %)');
    expect(texte(cellules('Secteur principal')[0])).toBe('Bureaux (60,00 %)');
  });

  it('liens Simuler et Investir sous chaque SCPI', async () => {
    await afficher('/comparaison?scpi=3');
    expect(screen.getByRole('link', { name: 'Simuler' }).getAttribute('href')).toBe(
      '/simulation?scpi=3:1',
    );
    expect(screen.getByRole('link', { name: 'Investir' }).getAttribute('href')).toBe('/investir/3');
  });

  it('« Vider la sélection » vide les 3 emplacements et l’adresse', async () => {
    await afficher('/comparaison?scpi=3,7');
    fireEvent.click(screen.getByRole('button', { name: 'Vider la sélection' }));
    expect(emplacements()).toEqual(['', '', '']);
    expect(adresse()).toBe('/comparaison');
  });

  it('erreur du backend : message affiché ; session expirée : connexion', async () => {
    await afficher('/comparaison', {
      lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible.')),
    });
    expect(screen.getByRole('alert').textContent).toBe('Indisponible.');
    cleanup();

    const { allerA } = await afficher('/comparaison', {
      lire: vi.fn().mockRejectedValue(new ErreurApi(401, 'connexion requise')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('déconnexion : retour à l’accueil', async () => {
    const { seDeconnecter, allerA } = await afficher();
    const menu = screen.getByRole('navigation', { name: 'Menu de l’application' });
    await act(async () =>
      fireEvent.click(within(menu).getByRole('button', { name: 'Se déconnecter' })),
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Oui' })));
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
