import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import type { Parametres } from './calcul.js';
import {
  DEMANDE_INVALIDE,
  GROUPES_MAX,
  LIGNES_MAX,
  SCPI_INCONNUE,
  TAUX_INVALIDE,
  creerEstimationService,
  lireDemande,
  type DepotEstimation,
} from './estimation.js';
import type { DepotFiscalite, InformationsFiscales } from './service.js';

const PARAMETRES: Parametres = {
  bareme: [
    { plafond: 11600, taux: 0 },
    { plafond: 29579, taux: 11 },
    { plafond: 84577, taux: 30 },
    { plafond: 181917, taux: 41 },
    { plafond: null, taux: 45 },
  ],
  prelevementsSociaux: 17.2,
  tauxForfaitaire: 30,
};

const SEUL_40000: InformationsFiscales = {
  revenuNetImposable: 40000,
  situationFamiliale: 'seul',
  nombreEnfants: 0,
};

function preparer(informations: InformationsFiscales | null = null) {
  const depot = {
    lireParametres: vi.fn().mockResolvedValue(PARAMETRES),
    partsFrance: vi.fn().mockResolvedValue(
      new Map<number, number | null>([
        [1, 100],
        [2, 20],
        [3, null],
      ]),
    ),
  } satisfies DepotEstimation;
  const fiscalite = {
    lire: vi.fn().mockResolvedValue(informations),
    enregistrer: vi.fn(),
    effacer: vi.fn(),
  } satisfies DepotFiscalite;
  return { depot, fiscalite, service: creerEstimationService(depot, fiscalite) };
}

async function erreur(promesse: Promise<unknown>) {
  const e = await promesse.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(HttpError);
  return e as HttpError;
}

describe('lireDemande', () => {
  it('lignes valides, taux facultatif', () => {
    expect(lireDemande({ lignes: [{ scpiId: 1, revenuAnnuel: 10, autre: 'x' }] })).toEqual({
      lignes: [{ scpiId: 1, revenuAnnuel: 10 }],
    });
    expect(lireDemande({ lignes: [], taux: 11 })).toEqual({ lignes: [], taux: 11 });
  });

  it.each([
    ['sans corps', undefined],
    ['lignes absentes', {}],
    ['identifiant invalide', { lignes: [{ scpiId: 0, revenuAnnuel: 1 }] }],
    ['identifiant décimal', { lignes: [{ scpiId: 1.5, revenuAnnuel: 1 }] }],
    ['revenu négatif', { lignes: [{ scpiId: 1, revenuAnnuel: -1 }] }],
    ['revenu en texte', { lignes: [{ scpiId: 1, revenuAnnuel: '1' }] }],
    ['ligne vide', { lignes: [null] }],
    ['taux en texte', { lignes: [], taux: '30' }],
    [
      'trop de lignes',
      { lignes: Array.from({ length: LIGNES_MAX + 1 }, () => ({ scpiId: 1, revenuAnnuel: 1 })) },
    ],
  ])('%s : invalide', (_cas, corps) => {
    expect(lireDemande(corps)).toBeNull();
  });
});

describe('EstimationFiscaleService (US-07 appliqué à la simulation, US-09)', () => {
  it('avec informations fiscales : TMI, taux moyen, impôt par ligne', async () => {
    const { service, fiscalite, depot } = preparer(SEUL_40000);
    const resultat = await service.estimerRevenus('u1', {
      lignes: [
        { scpiId: 1, revenuAnnuel: 1000 },
        { scpiId: 2, revenuAnnuel: 1000 },
      ],
    });
    expect(fiscalite.lire).toHaveBeenCalledWith('u1');
    expect(depot.partsFrance).toHaveBeenCalledWith([1, 2]);
    expect(resultat).toMatchObject({
      avecInformations: true,
      foyer: { parts: 1, tmi: 30, tauxMoyen: 12.76 },
      impot: 697.75,
      tauxProposes: [0, 11, 30, 41, 45],
      tauxParDefaut: 30,
    });
    // Ligne 2 (20 % France) : 60 € d'IR français + 131,35 € d'effet des revenus étrangers
    // (taux effectif sur les deux lignes) + 34,40 € de PS
    expect(resultat.lignes.map((l) => l.impot)).toEqual([472, 225.75]);
  });

  it('sans informations fiscales : taux par défaut, ou taux choisi', async () => {
    const { service } = preparer();
    const lignes = [{ scpiId: 3, revenuAnnuel: 4175 }];
    expect(await service.estimerRevenus('u1', { lignes })).toMatchObject({
      avecInformations: false,
      tauxApplique: 30,
      impot: 1252.5,
      net: 2922.5,
    });
    expect(await service.estimerRevenus('u1', { lignes, taux: 11 })).toMatchObject({
      tauxApplique: 11,
      impot: 459.25,
    });
  });

  it('même SCPI sur deux lignes : une seule lecture de sa répartition', async () => {
    const { service, depot } = preparer();
    await service.estimerRevenus('u1', {
      lignes: [
        { scpiId: 1, revenuAnnuel: 1 },
        { scpiId: 1, revenuAnnuel: 2 },
      ],
    });
    expect(depot.partsFrance).toHaveBeenCalledWith([1]);
  });

  it('demande invalide : 400', async () => {
    const { service } = preparer();
    const e = await erreur(service.estimerRevenus('u1', { lignes: 'x' }));
    expect([e.status, e.message]).toEqual([400, DEMANDE_INVALIDE]);
  });

  it('taux hors barème : 400', async () => {
    const { service } = preparer();
    const e = await erreur(service.estimerRevenus('u1', { lignes: [], taux: 25 }));
    expect([e.status, e.message]).toEqual([400, TAUX_INVALIDE]);
  });

  it('SCPI inconnue : 400', async () => {
    const { service } = preparer();
    const e = await erreur(
      service.estimerRevenus('u1', { lignes: [{ scpiId: 99, revenuAnnuel: 1 }] }),
    );
    expect([e.status, e.message]).toEqual([400, SCPI_INCONNUE]);
  });
});

describe('demande par période et par année (changement de TMI)', () => {
  it('périodes et années facultatives, lues comme les lignes', () => {
    const lignes = [{ scpiId: 1, revenuAnnuel: 1080 }];
    expect(lireDemande({ lignes, periodes: [lignes], annees: [lignes, []] })).toEqual({
      lignes,
      periodes: [lignes],
      annees: [lignes, []],
    });
  });

  it.each([
    ['périodes non tableau', { periodes: 'x' }],
    ['année invalide', { annees: [[{ scpiId: 1, revenuAnnuel: -1 }]] }],
    ['trop d’années', { annees: Array.from({ length: GROUPES_MAX + 1 }, () => []) }],
  ])('%s : invalide', (_, groupes) => {
    expect(lireDemande({ lignes: [], ...groupes })).toBeNull();
  });

  it('cas 1 : périodes, cumul et TMI avec SCPI ; répartition lue pour toutes les SCPI', async () => {
    const { service, depot } = preparer({
      revenuNetImposable: 28900,
      situationFamiliale: 'seul',
      nombreEnfants: 0,
    });
    const pleine = [{ scpiId: 1, revenuAnnuel: 1080 }];
    const resultat = await service.estimerRevenus('u1', {
      lignes: pleine,
      periodes: [pleine],
      annees: [[{ scpiId: 3, revenuAnnuel: 720 }], ...Array.from({ length: 9 }, () => pleine)],
    });
    expect(depot.partsFrance).toHaveBeenCalledWith([1, 3]);
    expect(resultat).toMatchObject({
      impot: 380.75,
      avecScpi: { tmi: 30, tauxMoyen: 7 },
      cumul: { net: 6802.42 },
    });
    expect(resultat.periodes[0].net).toBe(699.25);
  });
});
