import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import { oublierSimulation } from './memoire.js';
import Simulation, { MENTION, MESSAGE_SANS_INFORMATIONS } from './Simulation.jsx';

afterEach(() => {
  cleanup();
  oublierSimulation();
});

const TRANSITIONS = {
  id: 1,
  nom: 'Transitions Europe',
  prixPart: 200,
  tauxDistribution: 8.35,
  minimum: 200,
  delaiJouissance: 5,
  demembrement: false,
  decotes: [],
  pays: [{ libelle: 'France', part: 100 }],
  secteurs: [{ libelle: 'Bureaux', part: 100 }],
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
  pays: [
    { libelle: 'France', part: 50 },
    { libelle: 'Espagne', part: 50 },
  ],
  secteurs: [
    { libelle: 'Santé', part: 60 },
    { libelle: 'Bureaux', part: 40 },
  ],
};
const CHERE = {
  ...TRANSITIONS,
  id: 3,
  nom: 'Chère',
  prixPart: 250,
  minimum: 2500,
  pays: [],
  secteurs: [],
};

const arrondir = (n) => Math.round(n * 100) / 100;
// Estimation du backend sans informations fiscales : taux choisi, 30 % par défaut
// Impôt d'un groupe de revenus (lignes, période ou année) au taux t
const groupe = (lignes, t) => {
  const estimees = lignes.map((l) => ({ ...l, impot: arrondir((l.revenuAnnuel * t) / 100) }));
  const revenus = arrondir(lignes.reduce((s, l) => s + l.revenuAnnuel, 0));
  const impot = arrondir(estimees.reduce((s, l) => s + l.impot, 0));
  return { revenus, impot, net: arrondir(revenus - impot), lignes: estimees };
};
const SANS_INFORMATIONS = ({ lignes, periodes, annees }, taux) => {
  const t = taux ?? 30;
  const parAnnee = annees.map((a) => groupe(a, t));
  return Promise.resolve({
    avecInformations: false,
    foyer: null,
    avecScpi: null,
    tauxApplique: t,
    ...groupe(lignes, t),
    periodes: periodes.map((p) => groupe(p, t)),
    cumul: { net: arrondir(parAnnee.reduce((s, a) => s + a.net, 0)) },
    tauxProposes: [0, 11, 30, 41, 45],
    tauxParDefaut: 30,
  });
};
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
    estimer: vi.fn(SANS_INFORMATIONS),
    chargerMonde: vi.fn(() => new Promise(() => {})), // carte non chargée (tests rapides)
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
// Tableau « Bruts » / « Après fiscalité » (US-09) : cellule d'une ligne
const cellule = (ligne, colonne) => {
  const titre = screen.getByRole('rowheader', { name: ligne });
  const cellules = titre.parentElement.querySelectorAll('td');
  return espaces(cellules[colonne].textContent);
};
const brut = (ligne) => cellule(ligne, 0);
const net = (ligne) => cellule(ligne, 1);
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
  it('arrivée par le menu (écran d’accueil) : une ligne vide, champs grisés, résultat vide, mention', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Simuler');
    expect(
      screen.getByText('Estimez les revenus d’un investissement en SCPI, avant et après impôt.'),
    ).toBeDefined();
    expect(lignes()).toHaveLength(1);
    expect(champ(1, 'SCPI de la ligne').value).toBe('');
    expect(champ(1, 'SCPI de la ligne').placeholder).toBe('Rechercher une SCPI du catalogue…');
    // Nombre de parts et type bloqués tant que la SCPI n'est pas choisie
    expect(champ(1, 'Nombre de parts').disabled).toBe(true);
    expect(champ(1, 'Nombre de parts').value).toBe('');
    expect(champ(1, 'Type d’investissement').disabled).toBe(true);
    expect(
      screen.getByText(
        'Le nombre de parts et le type d’investissement se débloquent une fois la SCPI choisie.',
      ),
    ).toBeDefined();
    expect(screen.getByLabelText('Durée de placement').value).toBe('10');
    expect(screen.getByLabelText('Durée de placement').options).toHaveLength(30);
    // Ni croix de retrait ni « Ajouter » sur l'écran d'accueil
    expect(screen.queryByRole('button', { name: /Retirer la ligne/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Ajouter une SCPI' })).toBeNull();
    // Résultat vide : trois étapes
    expect(screen.getByText('Vos revenus s’afficheront ici')).toBeDefined();
    expect(
      [...document.querySelectorAll('.simulation__etape strong')].map((e) => e.textContent),
    ).toEqual(['Choisissez une SCPI', 'Indiquez le nombre de parts', 'Lisez vos revenus']);
    expect(screen.getByText(MENTION)).toBeDefined();
    // La SCPI choisie : parts débloquées (1 par défaut), croix et « Ajouter » visibles
    choisirScpi(1, 'Transitions Europe');
    expect(champ(1, 'Nombre de parts').disabled).toBe(false);
    expect(champ(1, 'Nombre de parts').value).toBe('1');
    expect(screen.getByRole('button', { name: 'Retirer la ligne 1' })).toBeDefined();
    expect(screen.getByRole('button', { name: '+ Ajouter une SCPI' })).toBeDefined();
    expect(screen.queryByText('Vos revenus s’afficheront ici')).toBeNull();
  });

  it('scénarios une SCPI puis deux SCPI', async () => {
    await afficher();
    choisirScpi(1, 'Transitions Europe');
    saisirParts(1, '250');
    expect(chiffre('Montant simulé')).toBe('50 000 €');
    expect(brut('Revenus annuels')).toBe('4 175,00 €');
    expect(brut('Revenus mensuels')).toBe('347,92 €');
    expect(brut('Revenus cumulés sur 10 ans')).toBe('40 010,42 €');
    expect(within(lignes()[0]).getByText('Premiers revenus dans 5 mois')).toBeDefined();

    ajouter();
    choisirScpi(2, 'Iroko Zen');
    saisirParts(2, '250');
    expect(chiffre('Montant simulé')).toBe('100 500 €');
    expect(brut('Revenus annuels')).toBe('7 770,60 €');
    expect(brut('Revenus cumulés sur 10 ans')).toBe('74 168,62 €');

    // Une durée par SCPI (US-09) : Transitions Europe 1 an, Iroko Zen 10 ans. Les revenus
    // changent après l'année 1 : un résultat par période
    fireEvent.change(champ(1, 'Durée de placement'), { target: { value: '1' } });
    const periode = (nom) => screen.getByRole('region', { name: nom });
    expect(within(periode('Année 1')).getByRole('rowheader', { name: 'Par an' })).toBeDefined();
    expect(espaces(periode('Année 1').querySelector('tbody td').textContent)).toBe('7 770,60 €');
    expect(espaces(periode('Années 2 à 10').querySelector('tbody td').textContent)).toBe(
      '3 595,60 €',
    );
    expect(
      screen.getByText('Fin du placement de Transitions Europe (année 1) : ses revenus s’arrêtent'),
    ).toBeDefined();
    // Cumul : 4 175 ÷ 12 × 7 + 3 595,60 ÷ 12 × 114
    expect(brut('Revenus cumulés sur 10 ans')).toBe('36 593,62 €');
    // Même durée pour les deux : un seul tableau (4 175 ÷ 12 × 7 + 3 595,60 ÷ 12 × 6)
    fireEvent.change(champ(2, 'Durée de placement'), { target: { value: '1' } });
    expect(screen.queryByRole('region', { name: 'Année 1' })).toBeNull();
    expect(brut('Revenus cumulés sur 1 an')).toBe('4 233,22 €');
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
    expect(brut('Revenus annuels')).toBe('7 770,60 €');
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
    // Nue-propriété : message en rouge, SCPI gardée dans le graphique, sans revenu
    expect(within(lignes()[0]).getByText('Aucun revenu pendant 5 ans').className).toBe(
      'simulation__sans-revenu',
    );
    // Graphique : revenu de la nue-propriété à partir de la fin du démembrement
    const barres = () =>
      espaces(screen.getByRole('list', { name: 'Revenus annuels par SCPI' }).textContent);
    expect(barres()).toContain(
      'Démembrée — Nue-propriété, de l’année 6 à l’année 10 (fin du démembrement : année 5) : 1 670,00 € brut',
    );
    const textesDessin = () => [...document.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(textesDessin()).toContain('Nue-propriété, de l’année 6 à l’année 10');
    expect(textesDessin()).toContain('(fin du démembrement : année 5)');
    // Démembrement jusqu'à la fin du placement : « Pas de revenu » à la place des barres
    fireEvent.change(screen.getByLabelText('Durée de placement'), { target: { value: '5' } });
    expect(barres()).toBe(
      'Démembrée — Nue-propriété, démembrement de 5 ans : pas de revenu pendant la durée de placement',
    );
    expect(textesDessin()).toContain('Pas de revenu');
    fireEvent.change(screen.getByLabelText('Durée de placement'), { target: { value: '10' } });
    // Nue-propriété : le délai de jouissance ne joue pas, il n'est pas rappelé
    expect(within(lignes()[0]).queryByText('Délai de jouissance retenu')).toBeNull();
    // Résultat par période : années 1 à 5 sans revenu, puis la nue-propriété rapporte
    const periode = (nom) => screen.getByRole('region', { name: nom });
    expect(within(periode('Années 1 à 5')).getByText('Aucun revenu pendant cette période'));
    expect(espaces(periode('Années 6 à 10').querySelector('tbody td').textContent)).toBe(
      '1 670,00 €',
    );
    expect(
      screen.getByText('Fin du démembrement de Démembrée (année 5) : ses revenus commencent'),
    ).toBeDefined();
    expect(brut('Revenus cumulés sur 10 ans')).toBe('8 350,00 €');

    fireEvent.change(champ(1, 'Type d’investissement'), { target: { value: 'usufruit' } });
    expect(
      [...champ(1, 'Durée du démembrement').options].map((o) => espaces(o.textContent)),
    ).toEqual(['5 ans · décote 80,00 %', '10 ans · décote 70,00 %']);
    // Usufruit : pas de durée de placement (aucun revenu après le démembrement), c'est
    // celle du démembrement
    expect(within(lignes()[0]).queryByLabelText('Durée de placement')).toBeNull();
    expect(brut('Revenus cumulés sur 5 ans')).toBeDefined();
    expect(within(lignes()[0]).getByText('Délai de jouissance retenu')).toBeDefined();
    expect(barres()).toContain(
      // placement arrêté avec l'usufruit : pas de « puis aucun revenu »
      'Démembrée — Usufruit, de l’année 1 à l’année 5 : 1 670,00 € brut',
    );
    // Une seule période (le placement finit avec l'usufruit) : pas d'événement « fin »
    expect(screen.queryByText(/Fin de l’usufruit de Démembrée/)).toBeNull();
    fireEvent.change(champ(1, 'Durée du démembrement'), { target: { value: '10' } });
    expect(brut('Revenus cumulés sur 10 ans')).toBeDefined();
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
    expect(repere('Dernier taux de distribution')).toBe('8,35 %');
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
    expect(screen.getByText('Vos revenus s’afficheront ici')).toBeDefined();
  });

  it('quitter l’écran (ex. saisir ses informations fiscales) puis revenir par le menu : sélection et taux gardés', async () => {
    await afficher('/simulation?scpi=1:25,4:1');
    await waitFor(() => expect(screen.getByLabelText('Taux d’imposition estimé')).toBeDefined());
    fireEvent.change(screen.getByLabelText('Taux d’imposition estimé'), {
      target: { value: '11' },
    });
    cleanup();
    await afficher('/simulation');
    expect(lignes()).toHaveLength(2);
    expect(champ(1, 'SCPI de la ligne').value).toBe('Transitions Europe');
    expect(champ(1, 'Nombre de parts').value).toBe('25');
    expect(champ(2, 'SCPI de la ligne').value).toBe('Démembrée');
    await waitFor(() => expect(screen.getByLabelText('Taux d’imposition estimé').value).toBe('11'));
  });

  it('retour arrière vers la même adresse : simulation reprise ; autre sélection : celle-ci', async () => {
    await afficher('/simulation?scpi=1:4');
    saisirParts(1, '7');
    cleanup();
    await afficher('/simulation?scpi=1:4');
    expect(champ(1, 'Nombre de parts').value).toBe('7');
    cleanup();
    // « Simuler » depuis une autre fiche : la nouvelle sélection remplace l'ancienne
    await afficher('/simulation?scpi=4:2');
    expect(lignes()).toHaveLength(1);
    expect(champ(1, 'SCPI de la ligne').value).toBe('Démembrée');
    expect(champ(1, 'Nombre de parts').value).toBe('2');
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

describe('Simulation : revenus après fiscalité et graphiques (US-09)', () => {
  it('scénario sans informations fiscales : 30 % présélectionné, message et lien', async () => {
    const { estimer } = await afficher('/simulation?scpi=1:250');
    expect(brut('Revenus annuels')).toBe('4 175,00 €');
    expect(brut('Revenus mensuels')).toBe('347,92 €');
    await waitFor(() => expect(net('Impôt estimé annuel')).toBe('1 252,50 €'));
    expect(net('Revenus annuels')).toBe('2 922,50 €');
    expect(net('Revenus mensuels')).toBe('243,54 €');
    expect(net('Revenus cumulés sur 10 ans')).toBe('28 007,29 €');
    // Lignes, période unique et années (année 1 : 7 mois après 5 mois de jouissance)
    const [demande, taux] = estimer.mock.lastCall;
    expect(taux).toBeNull();
    expect(demande.lignes).toEqual([{ scpiId: 1, revenuAnnuel: 4175 }]);
    expect(demande.periodes).toEqual([[{ scpiId: 1, revenuAnnuel: 4175 }]]);
    expect(demande.annees).toHaveLength(10);
    expect(demande.annees[0]).toEqual([{ scpiId: 1, revenuAnnuel: 2435.42 }]);
    const liste = screen.getByLabelText('Taux d’imposition estimé');
    expect(liste.value).toBe('30');
    expect([...liste.options].map((o) => espaces(o.textContent))).toEqual([
      '0 %',
      '11 %',
      '30 %',
      '41 %',
      '45 %',
    ]);
    expect(screen.getByText(MESSAGE_SANS_INFORMATIONS, { exact: false })).toBeDefined();
    expect(
      screen
        .getByRole('link', { name: 'Renseigner mes informations fiscales' })
        .getAttribute('href'),
    ).toBe('/fiscalite');
    expect(screen.getByText('Impôt estimé, à titre indicatif')).toBeDefined();
  });

  it('scénario changer de taux : 11 %', async () => {
    const { estimer } = await afficher('/simulation?scpi=1:250');
    await waitFor(() => expect(screen.getByLabelText('Taux d’imposition estimé')).toBeDefined());
    fireEvent.change(screen.getByLabelText('Taux d’imposition estimé'), {
      target: { value: '11' },
    });
    await waitFor(() => expect(net('Impôt estimé annuel')).toBe('459,25 €'));
    expect(net('Revenus annuels')).toBe('3 715,75 €');
    expect(net('Revenus mensuels')).toBe('309,65 €');
    expect(estimer.mock.lastCall[0].lignes).toEqual([{ scpiId: 1, revenuAnnuel: 4175 }]);
    expect(estimer.mock.lastCall[1]).toBe(11);
  });

  it('scénario avec informations fiscales : TMI et taux moyen, ni liste ni message', async () => {
    const ligne = { scpiId: 1, revenuAnnuel: 4175, impot: 1970.6 };
    const estimer = vi.fn().mockResolvedValue({
      avecInformations: true,
      foyer: { parts: 1, tmi: 30, impotFoyer: 5103.99, tauxMoyen: 12.76 },
      avecScpi: { tmi: 30, tauxMoyen: 13.43, depassement: null },
      tauxApplique: null,
      lignes: [ligne],
      periodes: [{ revenus: 4175, impot: 1970.6, net: 2204.4, lignes: [ligne] }],
      cumul: { net: 21143.31 },
      tauxProposes: [0, 11, 30, 41, 45],
      tauxParDefaut: 30,
    });
    await afficher('/simulation?scpi=1:250', { estimer });
    await waitFor(() => expect(net('Impôt estimé annuel')).toBe('1 970,60 €'));
    expect(chiffre('TMI retenue')).toBe('30 %');
    // Taux moyen avec les revenus SCPI (impôt du foyer avec SCPI ÷ revenu avec SCPI)
    expect(chiffre('Taux moyen retenu')).toBe('13,43 %');
    expect(net('Revenus cumulés sur 10 ans')).toBe('21 143,31 €');
    expect(screen.queryByLabelText('Taux d’imposition estimé')).toBeNull();
    expect(screen.queryByText(MESSAGE_SANS_INFORMATIONS, { exact: false })).toBeNull();
    expect(screen.getByText('Impôt estimé, à titre indicatif')).toBeDefined();
  });

  it('impôt indisponible : message ; session expirée : connexion', async () => {
    const estimer = vi.fn().mockRejectedValue(new ErreurApi(500, 'panne'));
    await afficher('/simulation?scpi=1:250', { estimer });
    await waitFor(() =>
      expect(screen.getByText('Impôt estimé indisponible pour le moment.')).toBeDefined(),
    );
    expect(net('Revenus annuels')).toBe('…');
    cleanup();
    const { allerA } = await afficher('/simulation?scpi=1:250', {
      estimer: vi.fn().mockRejectedValue(new ErreurApi(401, 'session')),
    });
    await waitFor(() => expect(allerA).toHaveBeenCalledWith('/connexion'));
  });

  it('graphiques : barres par SCPI, répartitions pondérées, SCPI sans répartition signalée', async () => {
    await afficher('/simulation?scpi=1:250,2:250,3:10');
    const liste = (nom) =>
      [...screen.getByRole('list', { name: nom }).querySelectorAll('li')].map((li) =>
        espaces(li.textContent),
      );
    // Une barre brut et une barre après fiscalité (30 % sans informations fiscales)
    await waitFor(() =>
      expect(liste('Revenus annuels par SCPI')).toEqual([
        'Transitions Europe — De l’année 1 à l’année 10 : 4 175,00 € brut, 2 922,50 € après fiscalité',
        'Iroko Zen — De l’année 1 à l’année 10 : 3 595,60 € brut, 2 516,92 € après fiscalité',
        'Chère — De l’année 1 à l’année 10 : 208,75 € brut, 146,12 € après fiscalité',
      ]),
    );
    // France : (50 000 + 50 500 × 50 %) ÷ 100 500 ; Chère exclue (sans répartition)
    expect(liste('Répartition géographique')).toEqual(['France74,88 %', 'Espagne25,12 %']);
    expect(screen.getByText('2 pays')).toBeDefined();
    expect(liste('Répartition sectorielle')).toEqual(['Bureaux69,85 %', 'Santé30,15 %']);
    expect(
      screen.getByText('Sans répartition géographique, non prise en compte : Chère'),
    ).toBeDefined();
  });

  it('aucune ligne prise en compte : pas de graphique', async () => {
    await afficher();
    expect(screen.queryByText('Répartition géographique')).toBeNull();
  });
});
