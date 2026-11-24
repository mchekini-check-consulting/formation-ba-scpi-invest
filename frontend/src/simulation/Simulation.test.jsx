import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Simulation, { MENTION } from './Simulation.jsx';

afterEach(cleanup);

const TRANSITIONS = {
  id: 1,
  nom: 'Transitions Europe',
  prixPart: 200,
  tauxDistribution: 8.35,
  minimum: 200,
  delaiJouissance: 5,
  demembrement: false,
  decotes: [],
};
const IROKO = {
  id: 2,
  nom: 'Iroko Zen',
  prixPart: 202,
  tauxDistribution: 7.12,
  minimum: 202,
  delaiJouissance: 6,
  demembrement: false,
  decotes: [],
};
const CHERE = { ...TRANSITIONS, id: 3, nom: 'Chère', prixPart: 250, minimum: 2500 };
const DEMEMBREE = {
  ...TRANSITIONS,
  id: 4,
  nom: 'Démembrée',
  delaiJouissance: 0,
  demembrement: true,
  decotes: [
    { duree: 5, decote: 20 },
    { duree: 10, decote: 30 },
  ],
};

async function afficher(adresse = '/simulation', options = {}) {
  const props = {
    lire: vi.fn().mockResolvedValue([CHERE, DEMEMBREE, IROKO, TRANSITIONS]),
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: () => Promise.resolve({ nomComplet: '', email: '', profil: null }),
    ...options,
  };
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[adresse]}>
        <Simulation {...props} />
      </MemoryRouter>,
    );
  });
  return props;
}

const espaces = (texte) => texte.replace(/\s/g, ' ');
const chiffre = (libelle) =>
  espaces(screen.getByText(libelle, { selector: 'dt' }).nextElementSibling.textContent);
const lignes = () => [...document.querySelectorAll('.simulation__ligne')];
const champ = (n, nom) => within(lignes()[n - 1]).getByLabelText(nom, { exact: false });

function choisirScpi(n, nom) {
  fireEvent.click(champ(n, 'SCPI de la ligne'));
  fireEvent.click(screen.getByRole('option', { name: nom }));
}
const saisirParts = (n, parts) =>
  fireEvent.change(champ(n, 'Nombre de parts'), { target: { value: parts } });
const ajouter = () => fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une SCPI' }));

describe('Simulation (US-08)', () => {
  it('arrivée par le menu : une ligne vide, durée 10 ans, résultat à zéro, mention', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Simuler');
    expect(lignes()).toHaveLength(1);
    expect(champ(1, 'SCPI de la ligne').value).toBe('');
    expect(screen.getByLabelText('Durée de placement').value).toBe('10');
    expect(screen.getByLabelText('Durée de placement').options).toHaveLength(30);
    expect(chiffre('Montant simulé')).toBe('0 €');
    expect(screen.getByText(/Choisissez une SCPI/)).toBeDefined();
    expect(screen.getByText(MENTION)).toBeDefined();
  });

  it('scénarios une SCPI puis deux SCPI', async () => {
    await afficher();
    choisirScpi(1, 'Transitions Europe');
    saisirParts(1, '250');
    expect(chiffre('Montant simulé')).toBe('50 000 €');
    expect(chiffre('Revenus annuels bruts')).toBe('4 175,00 €');
    expect(chiffre('Revenus mensuels bruts')).toBe('347,92 €');
    expect(chiffre('Revenus bruts cumulés sur 10 ans')).toBe('40 010,42 €');
    expect(within(lignes()[0]).getByText('Premiers revenus dans 5 mois')).toBeDefined();

    ajouter();
    choisirScpi(2, 'Iroko Zen');
    saisirParts(2, '250');
    expect(chiffre('Montant simulé')).toBe('100 500 €');
    expect(chiffre('Revenus annuels bruts')).toBe('7 770,60 €');
    expect(chiffre('Revenus bruts cumulés sur 10 ans')).toBe('74 168,62 €');

    // Durée de placement changée : cumul recalculé (4 175 ÷ 12 × 7 + 3 595,60 ÷ 12 × 6)
    fireEvent.change(screen.getByLabelText('Durée de placement'), { target: { value: '1' } });
    expect(chiffre('Revenus bruts cumulés sur 1 an')).toBe('4 233,22 €');
  });

  it('scénario sous le minimum : avertissement, ligne jamais prise en compte', async () => {
    await afficher('/simulation?scpi=1:250,2:250');
    ajouter();
    choisirScpi(3, 'Chère');
    saisirParts(3, '4');
    expect(within(lignes()[2]).getByRole('status').textContent.replace(/\s/g, ' ')).toBe(
      'En dessous du minimum de souscription (2 500 €)',
    );
    expect(chiffre('Montant simulé')).toBe('100 500 €');
    expect(chiffre('Revenus annuels bruts')).toBe('7 770,60 €');
  });

  it('scénario nue-propriété ; usufruit', async () => {
    await afficher('/simulation?scpi=4:100');
    const type = champ(1, 'Type d’investissement');
    expect([...type.options].map((o) => o.textContent)).toEqual([
      'Pleine propriété',
      'Nue-propriété',
      'Usufruit',
    ]);
    fireEvent.change(type, { target: { value: 'nue-propriete' } });
    const duree = champ(1, 'Durée du démembrement');
    expect([...duree.options].map((o) => espaces(o.textContent))).toEqual([
      '5 ans · décote 20,00 %',
      '10 ans · décote 30,00 %',
    ]);
    expect(
      within(lignes()[0]).getByText('80,00 % du prix de la part', { normalizer: espaces }),
    ).toBeDefined();
    expect(
      within(lignes()[0]).getByText('Montant : 16 000 €', { normalizer: espaces }),
    ).toBeDefined();
    expect(within(lignes()[0]).getByText('Aucun revenu pendant 5 ans')).toBeDefined();
    // Nue-propriété : le délai de jouissance ne joue pas, il n'est pas rappelé
    expect(within(lignes()[0]).queryByText('Délai de jouissance retenu')).toBeNull();
    expect(chiffre('Revenus annuels bruts')).toBe('0,00 €');
    expect(chiffre('Revenus bruts cumulés sur 10 ans')).toBe('8 350,00 €');

    fireEvent.change(champ(1, 'Type d’investissement'), { target: { value: 'usufruit' } });
    expect(
      [...champ(1, 'Durée du démembrement').options].map((o) => espaces(o.textContent)),
    ).toEqual(['5 ans · décote 80,00 %', '10 ans · décote 70,00 %']);
    // Usufruit de 5 ans pour un placement de 10 ans : avertissement
    const avertissement =
      'La durée de placement (10 ans) dépasse la durée de l’usufruit (5 ans) : vous ne ' +
      'recevrez plus aucun revenu après la fin du démembrement.';
    expect(within(lignes()[0]).getByText(avertissement, { normalizer: espaces })).toBeDefined();
    expect(within(lignes()[0]).getByText('Délai de jouissance retenu')).toBeDefined();
    fireEvent.change(champ(1, 'Durée du démembrement'), { target: { value: '10' } });
    expect(within(lignes()[0]).queryByText(/dépasse la durée de l’usufruit/)).toBeNull();
    expect(chiffre('Montant simulé')).toBe('6 000 €');
    expect(
      within(lignes()[0]).getByText('30,00 % du prix de la part', { normalizer: espaces }),
    ).toBeDefined();
    expect(within(lignes()[0]).getByText('Revenus pendant 10 ans seulement')).toBeDefined();

    // Retour en pleine propriété : plus de durée de démembrement
    fireEvent.change(champ(1, 'Type d’investissement'), {
      target: { value: 'pleine-propriete' },
    });
    expect(within(lignes()[0]).queryByLabelText('Durée du démembrement')).toBeNull();
    expect(within(lignes()[0]).queryByText('Vous payez')).toBeNull();
    expect(chiffre('Montant simulé')).toBe('20 000 €');
  });

  it('repères de la SCPI choisie : prix de part, minimum en parts, délai retenu', async () => {
    await afficher('/simulation?scpi=3:4');
    const repere = (libelle) =>
      espaces(within(lignes()[0]).getByText(libelle).nextElementSibling.textContent);
    expect(repere('Prix de la part')).toBe('250 €');
    expect(repere('Minimum à investir')).toBe('2 500 € (soit 10 parts)');
    expect(repere('Délai de jouissance retenu')).toBe('5 mois');
    // Ligne vide : pas de repères
    ajouter();
    expect(within(lignes()[1]).queryByText('Prix de la part')).toBeNull();
  });

  it('repères : donnée absente du référentiel', async () => {
    await afficher('/simulation?scpi=1:1', {
      lire: vi
        .fn()
        .mockResolvedValue([
          { ...TRANSITIONS, prixPart: null, minimum: 1000, delaiJouissance: null },
        ]),
    });
    const repere = (libelle) =>
      espaces(within(lignes()[0]).getByText(libelle).nextElementSibling.textContent);
    expect(repere('Prix de la part')).toBe('Non communiqué');
    expect(repere('Minimum à investir')).toBe('1 000 €');
    expect(repere('Délai de jouissance retenu')).toBe('0 mois (non communiqué)');
    cleanup();
    await afficher('/simulation?scpi=1:1', {
      lire: vi.fn().mockResolvedValue([{ ...TRANSITIONS, minimum: null }]),
    });
    expect(
      espaces(within(lignes()[0]).getByText('Minimum à investir').nextElementSibling.textContent),
    ).toBe('Non communiqué');
  });

  it('scénario démembrement non autorisé : pleine propriété seulement', async () => {
    await afficher('/simulation?scpi=1:10');
    const options = [...champ(1, 'Type d’investissement').options].map((o) => o.textContent);
    expect(options).toEqual(['Pleine propriété']);
  });

  it('scénario ouverture pré-remplie : /simulation?scpi=3:10', async () => {
    await afficher('/simulation?scpi=3:10');
    expect(lignes()).toHaveLength(1);
    expect(champ(1, 'SCPI de la ligne').value).toBe('Chère');
    expect(champ(1, 'Nombre de parts').value).toBe('10');
    expect(champ(1, 'Type d’investissement').value).toBe('pleine-propriete');
  });

  it('retirer une ligne ; parts invalides ; SCPI changée : retour en pleine propriété', async () => {
    await afficher('/simulation?scpi=1:250,4:100');
    fireEvent.change(champ(2, 'Type d’investissement'), { target: { value: 'usufruit' } });
    choisirScpi(2, 'Iroko Zen');
    expect(champ(2, 'Type d’investissement').value).toBe('pleine-propriete');
    saisirParts(2, '');
    expect(within(lignes()[1]).getByRole('status').textContent).toBe(
      'Saisissez un nombre entier de parts, au moins 1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la ligne 2' }));
    expect(lignes()).toHaveLength(1);
    expect(chiffre('Montant simulé')).toBe('50 000 €');
  });

  it('prix ou taux non communiqué : ligne non prise en compte', async () => {
    await afficher('/simulation?scpi=1:10', {
      lire: vi.fn().mockResolvedValue([{ ...TRANSITIONS, tauxDistribution: null }]),
    });
    expect(within(lignes()[0]).getByRole('status').textContent).toMatch(/non communiqué/);
    expect(chiffre('Montant simulé')).toBe('0 €');
  });

  it('erreur du backend : message ; session expirée : connexion', async () => {
    await afficher('/simulation', {
      lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Service indisponible')),
    });
    expect(screen.getByRole('alert').textContent).toBe('Service indisponible');
    cleanup();
    const { allerA } = await afficher('/simulation', {
      lire: vi.fn().mockRejectedValue(new ErreurApi(401, 'Session expirée')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });
});
