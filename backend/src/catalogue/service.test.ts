import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { AUCUN_FILTRE } from './filtres.js';
import { type ScpiCatalogue, TAILLE_PAGE, creerCatalogueService } from './service.js';

const SCPI: ScpiCatalogue = {
  id: 1,
  nom: 'Pierre Plus',
  gerant: 'Gestion & Co',
  tauxDistribution: 5.1,
  capitalisation: 289000000,
  categorie: 'Bureaux',
  zoneGeographique: 'France',
};

const VALEURS = {
  categories: ['Bureaux', 'Santé'],
  pays: ['Espagne', 'France'],
  gerants: ['Gestion & Co'],
  taux: { min: 2.26, max: 8.35 },
  prix: { min: 168, max: 1664 },
  frais: { min: 0, max: 12 },
  minimum: { min: 180, max: 10200 },
};

const MAJ = new Date('2026-11-05T02:00:00Z');

function preparer(total = 30, scpis = [SCPI], misAJourLe: Date | null = MAJ) {
  const depot = {
    compter: vi.fn().mockResolvedValue(total),
    lister: vi.fn().mockResolvedValue(scpis),
    dateDernierImport: vi.fn().mockResolvedValue(misAJourLe),
    valeursFiltres: vi.fn().mockResolvedValue(VALEURS),
  };
  const service = creerCatalogueService(depot, () => new Date('2026-11-06T10:00:00Z'));
  return { service, depot };
}

async function erreurDe(promesse: Promise<unknown>): Promise<HttpError> {
  const err = await promesse.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

describe('CatalogueService (US-08)', () => {
  it('scénario 1 : première page de 12 SCPI, taux N-1, total et date de mise à jour', async () => {
    const { service, depot } = preparer();
    expect(await service.lister()).toEqual({
      scpis: [SCPI],
      total: 30,
      page: 1,
      taillePage: 12,
      nombrePages: 3,
      anneeTaux: 2025,
      misAJourLe: MAJ,
    });
    expect(TAILLE_PAGE).toBe(12);
    expect(depot.lister).toHaveBeenCalledWith(2025, 12, 0, AUCUN_FILTRE);
    expect(depot.compter).toHaveBeenCalledWith(2025, AUCUN_FILTRE);
  });

  it('page demandée (texte de l’URL) : décalage de 12 par page', async () => {
    const { service, depot } = preparer();
    expect((await service.lister('3')).page).toBe(3);
    expect(depot.lister).toHaveBeenCalledWith(2025, 12, 24, AUCUN_FILTRE);
  });

  it('page vide dans l’URL : première page', async () => {
    const { service, depot } = preparer();
    await service.lister('');
    expect(depot.lister).toHaveBeenCalledWith(2025, 12, 0, AUCUN_FILTRE);
  });

  it('catalogue vide, aucun import réussi : 1 page, date non renseignée', async () => {
    const { service } = preparer(0, [], null);
    expect(await service.lister(1)).toMatchObject({
      scpis: [],
      total: 0,
      nombrePages: 1,
      misAJourLe: null,
    });
  });

  it.each(['0', '-1', '1.5', 'abc'])('page %s invalide -> 400', async (page) => {
    const { service, depot } = preparer();
    expect((await erreurDe(service.lister(page))).status).toBe(400);
    expect(depot.lister).not.toHaveBeenCalled();
  });

  it('année N-1 calculée par défaut sur la date du jour', async () => {
    const depot = {
      compter: vi.fn().mockResolvedValue(0),
      lister: vi.fn().mockResolvedValue([]),
      dateDernierImport: vi.fn().mockResolvedValue(null),
      valeursFiltres: vi.fn(),
    };
    const { anneeTaux } = await creerCatalogueService(depot).lister();
    expect(anneeTaux).toBe(new Date().getFullYear() - 1);
  });

  it('US-10 : filtres de l’URL transmis au comptage et à la liste', async () => {
    const { service, depot } = preparer(3);
    const page = await service.lister('1', {
      categorie: ['Santé', 'Bureaux'],
      pays: 'France',
      tauxMin: '4',
      tauxMax: '6',
    });
    const attendus = {
      ...AUCUN_FILTRE,
      categories: ['Santé', 'Bureaux'],
      pays: ['France'],
      taux: { min: 4, max: 6 },
    };
    expect(depot.compter).toHaveBeenCalledWith(2025, attendus);
    expect(depot.lister).toHaveBeenCalledWith(2025, 12, 0, attendus);
    expect(page).toMatchObject({ total: 3, nombrePages: 1 });
  });

  it('US-10 : filtre invalide -> 400, la base n’est pas lue', async () => {
    const { service, depot } = preparer();
    const err = await erreurDe(service.lister('1', { prixMin: 'abc' }));
    expect(err.status).toBe(400);
    expect(err.message).toBe('Filtre invalide');
    expect(depot.lister).not.toHaveBeenCalled();
  });

  it('US-10 : valeurs du panneau des filtres, tranches de capitalisation et année N-1', async () => {
    const { service, depot } = preparer();
    const options = await service.filtres();
    expect(depot.valeursFiltres).toHaveBeenCalledWith(2025);
    expect(options).toMatchObject({ ...VALEURS, anneeTaux: 2025 });
    expect(options.capitalisations.map((t) => t.libelle)).toEqual([
      'Moins de 100 M€',
      '100 à 500 M€',
      '500 M€ à 1 Md€',
      '1 à 3 Md€',
      'Plus de 3 Md€',
    ]);
    expect(options.capitalisations[0]).toEqual({ code: 'moins-100m', libelle: 'Moins de 100 M€' });
  });
});
