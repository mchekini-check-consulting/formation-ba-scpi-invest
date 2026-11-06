import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import ImportCatalogue from './ImportCatalogue.jsx';

const MAINTENANT = new Date('2026-11-06T13:40:00Z');

const ETAT = {
  serveur: {
    heure: '2026-11-06T13:40:00.000Z',
    demarreLe: '2026-11-06T08:00:00.000Z',
    pod: 'backend-7d9f',
    fuseau: 'UTC',
  },
  stockage: {
    configure: true,
    endpoint: 'https://compte.r2.cloudflarestorage.com',
    bucket: 'scpi',
    cle: 'scpi.csv',
    supprimerSource: false,
  },
  fichier: {
    present: true,
    taille: 49152,
    modifieLe: '2026-11-06T13:32:00.000Z',
    etag: '"e1"',
    typeContenu: 'text/csv',
  },
  planification: {
    horaire: '0 2 * * *',
    fuseau: 'Europe/Paris',
    prochain: '2026-11-07T01:00:00.000Z',
  },
};

const REUSSI = {
  id: 12,
  debut: '2026-11-06T13:33:00.000Z',
  fin: '2026-11-06T13:33:01.250Z',
  fichier: 'scpi.csv',
  statut: 'reussi',
  lues: 15,
  ajoutees: 4,
  mises_a_jour: 6,
  inchangees: 2,
  supprimees: 0,
  rejetees: 3,
  rejets: [
    { ligne: 7, nom: 'Ancienne Voie', motif: 'taux de distribution non numérique' },
    { ligne: 15, nom: null, motif: 'nom de la SCPI manquant' },
    { ligne: 22, nom: 'Horizon', motif: 'doublon : déjà présente ligne 3' },
  ],
  erreur: null,
};

const ECHEC = {
  ...REUSSI,
  id: 11,
  debut: '2026-11-05T15:10:00.000Z',
  fin: null,
  statut: 'echec',
  lues: 0,
  ajoutees: 0,
  mises_a_jour: 0,
  rejetees: 0,
  rejets: [],
  erreur: 'encodage invalide (UTF-8 attendu)',
};

// Fichier refusé, motif en blocs (erreur_detail, backend/src/csv/erreurs.ts)
const REFUS = {
  ...ECHEC,
  id: 13,
  fin: '2026-11-06T13:45:00.272Z',
  erreur: 'Ligne 3 : 21 valeurs au lieu de 20. Cause probable : virgule sans guillemets',
  erreur_detail: {
    ligne: 3,
    constat: '21 valeurs au lieu de 20',
    cause: 'une valeur contient une virgule sans être entourée de guillemets',
    action: 'Corriger cette ligne : elle doit compter 20 valeurs',
    technique: 'Invalid Record Length: columns length is 20, got 21 on line 3',
  },
};

const SCPI = {
  id: 1,
  nom: 'Horizon Santé',
  gerant: 'Gestion Alpha',
  minimum_souscription: 1000,
  capitalisation: 150000000,
  frais_souscription: 10,
  frais_gestion: 12,
  delai_jouissance: 4,
  frequence: 'Trimestrielle',
  iban: 'FR7630001007941234567890185',
  bic: 'BNPAFRPPXXX',
  demembrement: true,
  cashback: null,
  versement_programme: false,
  publicite: 'Texte',
  mise_a_jour: '2026-11-06T13:33:01.000Z',
  empreinte: 'abcdef0123456789',
  taux_distribution: [
    { annee: 2024, taux: '4.9' },
    { annee: 2025, taux: '5.1' },
  ],
  prix_part: [{ annee: 2025, prix: '200' }],
  valeur_reconstitution: [],
  localisation: [{ pays: 'France', pourcentage: '100' }],
  secteurs: [
    { secteur: 'Bureaux', pourcentage: '60' },
    { secteur: 'Santé', pourcentage: '40' },
  ],
  decote_demembrement: [{ duree: 5, decote: 80 }],
};

const AUTRE = {
  ...SCPI,
  id: 2,
  nom: 'Atlantique Bureaux',
  gerant: null,
  minimum_souscription: null,
  capitalisation: null,
  frais_souscription: null,
  frais_gestion: null,
  delai_jouissance: null,
  frequence: null,
  iban: null,
  bic: null,
  publicite: null,
  empreinte: null,
  demembrement: null,
  taux_distribution: [{ annee: null, taux: '4' }],
  prix_part: [],
  localisation: [],
  secteurs: [],
  decote_demembrement: [],
};

function fauxApi(surcharge = {}) {
  return {
    lireEtat: vi.fn().mockResolvedValue(ETAT),
    lireRapports: vi.fn().mockResolvedValue([REUSSI, ECHEC]),
    lireCatalogue: vi.fn().mockResolvedValue([SCPI, AUTRE]),
    deposerCsv: vi.fn().mockResolvedValue({
      bucket: 'scpi',
      cle: 'scpi.csv',
      taille: 12,
      deposeLe: '2026-11-06T13:41:00.000Z',
    }),
    lancerImport: vi
      .fn()
      .mockResolvedValue({ issue: 'lance', erreur: null, dureeMs: 1250, rapport: REUSSI }),
    ...surcharge,
  };
}

function afficher(api = fauxApi(), props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ImportCatalogue api={api} maintenant={() => MAINTENANT} {...props} />
    </QueryClientProvider>,
  );
  return api;
}

afterEach(cleanup);

// Valeur d'une ligne « libellé / valeur » d'un message
function valeur(bloc, libelle) {
  return within(bloc).getByText(libelle, { selector: 'dt' }).nextSibling.textContent;
}

describe('outil d’import du catalogue (dev)', () => {
  it('hors dev : message, aucun appel au backend', () => {
    const api = afficher(fauxApi(), { visible: false });
    expect(
      screen.getByRole('heading', { name: 'Outil indisponible dans cet environnement' }),
    ).toBeTruthy();
    expect(api.lireEtat).not.toHaveBeenCalled();
    expect(api.lireRapports).not.toHaveBeenCalled();
    expect(document.title).toBe('SCPI Invest+ · Import du catalogue (dev)');
  });

  it('fichier sur R2, import automatique et backend, dates à la seconde', async () => {
    afficher();
    const r2 = await screen.findByRole('region', { name: 'Fichier sur R2' });
    await within(r2).findByText('scpi/scpi.csv');
    expect(r2.textContent).toContain('48 Ko');
    expect(r2.textContent).toContain('06/11/2026 14:32:00');
    expect(r2.textContent).toContain('il y a 8 min');
    expect(r2.textContent).toContain('"e1"');
    expect(r2.textContent).toContain('archivé, gardé en place');
    const planif = screen.getByRole('region', { name: 'Import automatique' });
    expect(planif.textContent).toContain('0 2 * * *');
    expect(planif.textContent).toContain('07/11/2026 02:00:00');
    const backend = screen.getByRole('region', { name: 'Backend' });
    expect(backend.textContent).toContain('backend-7d9f');
    expect(backend.textContent).toContain('/api');
    expect(screen.getByText('local')).toBeTruthy();
  });

  it('historique : tous les rapports, puis le détail complet du plus récent', async () => {
    afficher();
    const lignes = await screen.findAllByRole('row');
    const tableau = lignes[0].closest('table');
    const rangees = within(tableau).getAllByRole('row');
    expect(rangees).toHaveLength(3); // en-tête + 2 rapports
    expect(rangees[1].textContent).toContain('06/11/2026 14:33:00');
    expect(rangees[1].textContent).toContain('1,3 s');
    expect(rangees[1].textContent).toContain('Réussi');
    expect(rangees[2].textContent).toContain('pas terminé');
    expect(rangees[2].textContent).toContain('encodage invalide (UTF-8 attendu)');

    const detail = screen.getByRole('region', { name: 'Rapport n° 12' });
    expect(detail.textContent).toContain('06/11/2026 14:33:01');
    expect(
      within(detail).getByRole('table', { name: 'Lignes rejetées du rapport n° 12' }),
    ).toBeTruthy();
    expect(detail.textContent).toContain('doublon : déjà présente ligne 3');
    expect(detail.textContent).toContain('"id": 12');

    // Chiffres clés du dernier import
    expect(screen.getByText('ajoutées ou mises à jour').previousSibling.textContent).toBe('10');
  });

  it('choisir un autre rapport : son détail et ses lignes rejetées', async () => {
    afficher();
    const cellule = await screen.findByText('encodage invalide (UTF-8 attendu)', {
      selector: 'td',
    });
    fireEvent.click(cellule.closest('tr'));
    const detail = screen.getByRole('region', { name: 'Rapport n° 11' });
    expect(detail.textContent).toContain('Échec');
    expect(detail.textContent).toContain('Aucune ligne rejetée (rapport n° 11).');

    fireEvent.click(screen.getByRole('tab', { name: /Lignes rejetées/ }));
    expect(screen.getByText('Aucune ligne rejetée (rapport n° 11).')).toBeTruthy();
  });

  it('onglet des lignes rejetées : celles du dernier rapport', async () => {
    afficher();
    await screen.findByRole('tab', { name: 'Lignes rejetées (3)' });
    fireEvent.click(screen.getByRole('tab', { name: 'Lignes rejetées (3)' }));
    const tableau = screen.getByRole('table', { name: 'Lignes rejetées du rapport n° 12' });
    expect(within(tableau).getAllByRole('row')).toHaveLength(4);
    expect(tableau.textContent).toContain('nom de la SCPI manquant');
  });

  it('onglet SCPI : toutes les colonnes, recherche et données brutes', async () => {
    afficher();
    fireEvent.click(await screen.findByRole('tab', { name: 'SCPI en base (2)' }));
    const tableau = await screen.findByRole('table', { name: 'SCPI en base' });
    const horizon = within(tableau).getByText('Horizon Santé').closest('tr');
    expect(horizon.textContent).toContain('2025 : 5,1 % · 2024 : 4,9 %');
    expect(horizon.textContent).toContain('Bureaux 60 % · Santé 40 %');
    expect(horizon.textContent).toContain('5 ans : 80 %');
    expect(horizon.textContent).toContain('FR7630001007941234567890185');
    expect(horizon.textContent).toContain('4 mois');
    expect(horizon.textContent).toContain('abcdef0123…');
    const atlantique = within(tableau).getByText('Atlantique Bureaux').closest('tr');
    expect(atlantique.textContent).toContain('? : 4 %');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une SCPI' }), {
      target: { value: 'alpha' },
    });
    expect(within(tableau).queryByText('Atlantique Bureaux')).toBeNull();

    fireEvent.click(within(tableau).getByText('Horizon Santé').closest('tr'));
    expect(screen.getByText('Données brutes de Horizon Santé (JSON)')).toBeTruthy();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'introuvable' } });
    expect(screen.getByText('Aucune SCPI ne correspond.')).toBeTruthy();
  });

  it('catalogue vide, aucun rapport', async () => {
    afficher(
      fauxApi({
        lireCatalogue: vi.fn().mockResolvedValue([]),
        lireRapports: vi.fn().mockResolvedValue([]),
      }),
    );
    expect(await screen.findByText('Aucun import enregistré.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'SCPI en base (0)' }));
    expect(await screen.findByText('Aucune SCPI en base.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Lignes rejetées (0)' }));
    expect(screen.getByText('Aucune ligne rejetée.')).toBeTruthy();
  });

  it('déposer un CSV sur R2 puis lancer l’import : résultat et données rechargées', async () => {
    const api = afficher();
    await screen.findByText('scpi/scpi.csv');
    const envoyer = screen.getByRole('button', { name: 'Envoyer sur R2' });
    expect(envoyer.disabled).toBe(true);

    const fichier = new File(['Nom\nHorizon\n'], 'catalogue.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Fichier CSV'), { target: { files: [fichier] } });
    expect(screen.getByText('catalogue.csv')).toBeTruthy();
    fireEvent.click(envoyer);
    const envoye = await screen.findByRole('status');
    expect(envoye.textContent).toContain('✓ Fichier envoyé sur R2');
    expect(valeur(envoye, 'Emplacement')).toBe('scpi/scpi.csv');
    expect(valeur(envoye, 'Taille')).toBe('12 o');
    expect(valeur(envoye, 'Envoyé le')).toBe('06/11/2026 14:41:00');
    expect(envoye.textContent).toContain('Vous pouvez maintenant lancer l’import.');
    expect(api.deposerCsv.mock.calls[0][0]).toBe(fichier);

    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    await waitFor(() => expect(screen.getAllByRole('status')).toHaveLength(2));
    const resultat = screen.getAllByRole('status')[1];
    expect(resultat.textContent).toContain('✓ Catalogue importé');
    expect(
      ['Lignes lues', 'Ajoutées', 'Mises à jour', 'Inchangées', 'Supprimées', 'Rejetées'].map(
        (libelle) => valeur(resultat, libelle),
      ),
    ).toEqual(['15', '4', '6', '2', '0', '3']);
    expect(valeur(resultat, 'Durée')).toBe('1,3 s');
    expect(valeur(resultat, 'Rapport')).toBe('n° 12');
    expect(resultat.textContent).toContain('Détail dans l’onglet « Lignes rejetées ».');
    await waitFor(() => expect(api.lireRapports.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(api.lireEtat.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('fichier déposé par glisser-déposer ; envoi refusé : message du backend', async () => {
    afficher(
      fauxApi({
        deposerCsv: vi
          .fn()
          .mockRejectedValue(new ErreurApi(413, 'Fichier trop volumineux (10 Mo maximum).')),
      }),
    );
    const zone = screen.getByLabelText('Fichier CSV').closest('label');
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], 'gros.csv')] } });
    fireEvent.drop(zone, { dataTransfer: { files: [] } }); // rien de déposé : fichier gardé
    expect(screen.getByText('gros.csv')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer sur R2' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Fichier trop volumineux (10 Mo maximum). (HTTP 413)',
    );
  });

  it('import en échec : statut et motif affichés', async () => {
    afficher(
      fauxApi({
        lancerImport: vi.fn().mockResolvedValue({
          issue: 'lance',
          erreur: 'encodage invalide (UTF-8 attendu)',
          dureeMs: 40,
          rapport: ECHEC,
        }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    const resultat = await screen.findByRole('status');
    expect(resultat.textContent).toContain('✗ Import refusé : catalogue inchangé');
    expect(valeur(resultat, 'Motif')).toBe('encodage invalide (UTF-8 attendu)');
    expect(valeur(resultat, 'Durée')).toBe('40 ms');
    expect(valeur(resultat, 'Rapport')).toBe('n° 11');
    expect(resultat.textContent).not.toContain('Lignes lues');
  });

  it('fichier refusé : motif en blocs (où, constat, cause, à faire, détail technique)', async () => {
    afficher(
      fauxApi({
        lancerImport: vi.fn().mockResolvedValue({
          issue: 'lance',
          erreur: REFUS.erreur,
          dureeMs: 272,
          rapport: REFUS,
        }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    const resultat = await screen.findByRole('status');
    expect(resultat.textContent).toContain('✗ Import refusé : catalogue inchangé');
    const blocs = [...resultat.querySelectorAll('.motif__bloc')].map((b) => [
      b.querySelector('.motif__titre').textContent,
      b.querySelector('p').textContent,
    ]);
    expect(blocs).toEqual([
      ['Où', 'scpi.csv, ligne 3'],
      ['Constat', '21 valeurs au lieu de 20'],
      ['Cause probable', 'une valeur contient une virgule sans être entourée de guillemets'],
      ['À faire', 'Corriger cette ligne : elle doit compter 20 valeurs'],
    ]);
    const technique = within(resultat).getByText('Détail technique').closest('details');
    expect(technique.open).toBe(false);
    expect(technique.textContent).toContain('got 21 on line 3');
    expect(within(resultat).queryByText('Motif', { selector: 'dt' })).toBeNull();
    expect(valeur(resultat, 'Rapport')).toBe('n° 13');
  });

  it('motif du fichier entier, sans cause ni action ni nom de fichier', async () => {
    const rapport = {
      ...REFUS,
      fichier: null,
      erreur_detail: {
        ligne: null,
        constat: 'Fichier vide',
        cause: null,
        action: null,
        technique: null,
      },
    };
    afficher(
      fauxApi({
        lancerImport: vi
          .fn()
          .mockResolvedValue({ issue: 'lance', erreur: 'x', dureeMs: 1, rapport }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    const resultat = await screen.findByRole('status');
    expect([...resultat.querySelectorAll('.motif__bloc p')].map((p) => p.textContent)).toEqual([
      'fichier entier',
      'Fichier vide',
    ]);
    expect(within(resultat).queryByText('Détail technique')).toBeNull();
  });

  it('détail d’un rapport refusé : motif en blocs à la place de la ligne « Erreur »', async () => {
    afficher(fauxApi({ lireRapports: vi.fn().mockResolvedValue([REFUS, REUSSI]) }));
    const detail = await screen.findByRole('region', { name: 'Rapport n° 13' });
    const motif = within(detail).getByRole('region', { name: 'Motif du refus' });
    expect(motif.textContent).toContain('scpi.csv, ligne 3');
    expect(motif.textContent).toContain('Corriger cette ligne');
    expect(within(detail).queryByText('Erreur', { selector: 'dt' })).toBeNull();
  });

  it('import sans rapport renvoyé (base injoignable) : échec déduit de l’erreur', async () => {
    afficher(
      fauxApi({
        lancerImport: vi.fn().mockResolvedValue({
          issue: 'lance',
          erreur: 'base injoignable',
          dureeMs: 5,
          rapport: null,
        }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    const resultat = await screen.findByRole('status');
    expect(resultat.textContent).toContain('✗ Import refusé : catalogue inchangé');
    expect(valeur(resultat, 'Motif')).toBe('base injoignable');
    expect(resultat.textContent).not.toContain('Rapport');
  });

  it('import refusé (déjà en cours) : message du backend', async () => {
    afficher(
      fauxApi({
        lancerImport: vi.fn().mockRejectedValue(new ErreurApi(409, 'Un import est déjà en cours')),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Un import est déjà en cours (HTTP 409)',
    );
  });

  it('import réussi sans rapport ni erreur', async () => {
    afficher(
      fauxApi({
        lancerImport: vi
          .fn()
          .mockResolvedValue({ issue: 'lance', erreur: null, dureeMs: 5, rapport: null }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    const resultat = await screen.findByRole('status');
    expect(resultat.textContent).toContain('✓ Catalogue importé');
    expect(valeur(resultat, 'Durée')).toBe('5 ms');
    expect(resultat.textContent).not.toContain('Détail dans');
  });

  it.each([
    ['aucun_fichier', '✗ Aucun fichier à importer sur R2'],
    ['en_cours', '✗ Import interrompu avant la fin'],
    ['inconnu', '✗ inconnu'],
  ])('rapport au statut %s : %s', async (statut, titre) => {
    afficher(
      fauxApi({
        lancerImport: vi.fn().mockResolvedValue({
          issue: 'lance',
          erreur: null,
          dureeMs: 5,
          rapport: { ...ECHEC, statut, erreur: null },
        }),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    expect((await screen.findByRole('status')).textContent).toContain(titre);
  });

  it('R2 non configuré : la raison ; import automatique désactivé', async () => {
    afficher(
      fauxApi({
        lireEtat: vi.fn().mockResolvedValue({
          ...ETAT,
          stockage: { configure: false, raison: 'variables manquantes : S3_URL' },
          fichier: null,
          planification: null,
        }),
      }),
    );
    expect(await screen.findByText('variables manquantes : S3_URL')).toBeTruthy();
    expect(screen.getByText('Désactivé (variables R2 absentes).')).toBeTruthy();
  });

  it.each([
    [{ present: false }, 'Non, aucun fichier'],
    [{ present: null, erreur: 'AccessDenied' }, 'erreur : AccessDenied'],
  ])('fichier %o -> %s', async (fichier, attendu) => {
    afficher(
      fauxApi({
        lireEtat: vi.fn().mockResolvedValue({
          ...ETAT,
          fichier,
          stockage: { ...ETAT.stockage, supprimerSource: true },
        }),
      }),
    );
    expect(await screen.findByText(attendu)).toBeTruthy();
    expect(screen.getByText('archivé puis supprimé')).toBeTruthy();
  });

  it('backend injoignable : erreurs affichées', async () => {
    const panne = () =>
      vi.fn().mockRejectedValue(new ErreurApi(0, 'Le service est momentanément indisponible'));
    afficher(fauxApi({ lireEtat: panne(), lireRapports: panne() }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    expect(screen.getAllByRole('alert')[0].textContent).toContain('(HTTP injoignable)');
  });

  it('erreur sans code HTTP', async () => {
    afficher(fauxApi({ lireRapports: vi.fn().mockRejectedValue(new Error('réseau')) }));
    expect((await screen.findByRole('alert')).textContent).toBe('réseau');
  });

  it('chargement, puis « Actualiser » recharge tout', async () => {
    const api = afficher();
    expect(screen.getByText('Chargement…')).toBeTruthy();
    await screen.findByText('scpi/scpi.csv');
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(api.lireEtat).toHaveBeenCalledTimes(2));
    expect(api.lireCatalogue).toHaveBeenCalledTimes(2);
  });

  it('import en cours : bouton désactivé et barre de progression', async () => {
    let terminer;
    afficher(fauxApi({ lancerImport: vi.fn(() => new Promise((r) => (terminer = r))) }));
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’import maintenant' }));
    const bouton = await screen.findByRole('button', { name: 'Import en cours…' });
    expect(bouton.disabled).toBe(true);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    terminer({ issue: 'lance', erreur: null, dureeMs: 1, rapport: REUSSI });
    await screen.findByRole('button', { name: 'Lancer l’import maintenant' });
  });

  it('envoi en cours : progression', async () => {
    let terminer;
    const deposerCsv = vi.fn((_f, progression) => {
      progression(0.4);
      return new Promise((r) => (terminer = r));
    });
    afficher(fauxApi({ deposerCsv }));
    fireEvent.change(screen.getByLabelText('Fichier CSV'), {
      target: { files: [new File(['x'], 'a.csv')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer sur R2' }));
    const barre = await screen.findByRole('progressbar');
    expect(barre.getAttribute('aria-valuenow')).toBe('40');
    terminer({ bucket: 'scpi', cle: 'scpi.csv', taille: 1, deposeLe: null });
    await screen.findByRole('status');
  });

  it('aucun fichier choisi dans la fenêtre : rien ne change', () => {
    afficher();
    fireEvent.change(screen.getByLabelText('Fichier CSV'), { target: { files: [] } });
    expect(screen.getByText('Glissez un fichier .csv ou cliquez pour le choisir')).toBeTruthy();
  });
});
