import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import { KYC_COMPLET } from './exemple.js';
import {
  KYC_DEJA_VALIDE,
  KYC_INCOMPLET,
  KYC_NON_RESIDENT,
  KYC_US_PERSON,
  PIECES_MANQUANTES,
  creerKycService,
  type DepotKyc,
  type EtatKyc,
} from './service.js';

const LE = new Date(2026, 10, 4, 10, 0);

const PIECES_DE_BASE = ['identite', 'domicile', 'rib'];

function preparer(
  etat: EtatKyc | null = null,
  ecritureAcceptee = true,
  piecesDeposees = PIECES_DE_BASE,
) {
  const depot = {
    lire: vi.fn().mockResolvedValue(etat),
    enregistrer: vi.fn().mockResolvedValue(ecritureAcceptee),
    valider: vi.fn().mockResolvedValue(ecritureAcceptee),
    typesPiecesDeposees: vi.fn().mockResolvedValue(piecesDeposees),
  } satisfies DepotKyc;
  return { service: creerKycService(depot, () => LE), depot };
}

async function erreurDe(promesse: Promise<unknown>): Promise<HttpError> {
  const err = await promesse.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

const EN_COURS: EtatKyc = { statut: 'en_cours', etape: 6, reponses: KYC_COMPLET, valideLe: null };

describe('KycService.lire', () => {
  it('nouvel utilisateur : KYC en cours, étape 1, sans réponse', async () => {
    const { service } = preparer();
    expect(await service.lire('u1')).toEqual({
      statut: 'en_cours',
      etape: 1,
      reponses: {},
      valideLe: null,
    });
  });

  it('KYC commencé : reprise à l’étape atteinte avec les réponses', async () => {
    const etat: EtatKyc = {
      statut: 'en_cours',
      etape: 3,
      reponses: { nom: 'Martin' },
      valideLe: null,
    };
    const { service, depot } = preparer(etat);
    expect(await service.lire('u1')).toEqual(etat);
    expect(depot.lire).toHaveBeenCalledWith('u1');
  });
});

describe('KycService.enregistrer', () => {
  it('enregistre l’étape atteinte et les réponses nettoyées', async () => {
    const { service, depot } = preparer();
    const etat = await service.enregistrer('u1', {
      etape: 3,
      reponses: { nom: 'Martin', email: 'jean@exemple.fr' },
    });
    expect(depot.enregistrer).toHaveBeenCalledWith('u1', 3, { nom: 'Martin' }, LE);
    expect(etat).toEqual({
      statut: 'en_cours',
      etape: 3,
      reponses: { nom: 'Martin' },
      valideLe: null,
    });
  });

  it.each([0, 7, 2.5, '3', undefined])('étape invalide (%s) : 400', async (etape) => {
    const { service, depot } = preparer();
    const err = await erreurDe(service.enregistrer('u1', { etape, reponses: {} }));
    expect(err.status).toBe(400);
    expect(depot.enregistrer).not.toHaveBeenCalled();
  });

  it('KYC déjà validé : 409, rien n’est modifié', async () => {
    const { service } = preparer(null, false);
    const err = await erreurDe(service.enregistrer('u1', { etape: 2, reponses: {} }));
    expect(err.status).toBe(409);
    expect(err.message).toBe(KYC_DEJA_VALIDE);
  });
});

describe('KycService.valider', () => {
  it('KYC complet : statut complété avec la date de validation', async () => {
    const { service, depot } = preparer(EN_COURS);
    expect(await service.valider('u1')).toEqual({
      statut: 'complete',
      etape: 6,
      reponses: KYC_COMPLET,
      valideLe: LE,
    });
    expect(depot.valider).toHaveBeenCalledWith('u1', LE);
  });

  it('KYC incomplet ou jamais commencé : 400', async () => {
    const incomplet = { ...EN_COURS, reponses: { ...KYC_COMPLET, telephone: '' } };
    for (const etat of [null, incomplet]) {
      const { service, depot } = preparer(etat);
      const err = await erreurDe(service.valider('u1'));
      expect(err.status).toBe(400);
      expect(err.message).toBe(KYC_INCOMPLET);
      expect(depot.valider).not.toHaveBeenCalled();
    }
  });

  it('résident hors de France (adresse ou résidence fiscale) : 400, KYC non validé', async () => {
    for (const autre of [{ residenceFiscale: 'Autre pays' }, { pays: 'Belgique' }]) {
      const { service, depot } = preparer({ ...EN_COURS, reponses: { ...KYC_COMPLET, ...autre } });
      const err = await erreurDe(service.valider('u1'));
      expect(err.status).toBe(400);
      expect(err.message).toBe(KYC_NON_RESIDENT);
      expect(depot.valider).not.toHaveBeenCalled();
    }
  });

  it('US Person, même résidente en France : 400, KYC non validé', async () => {
    const { service, depot } = preparer({
      ...EN_COURS,
      reponses: { ...KYC_COMPLET, usPerson: 'Oui' },
    });
    const err = await erreurDe(service.valider('u1'));
    expect(err.status).toBe(400);
    expect(err.message).toBe(KYC_US_PERSON);
    expect(depot.valider).not.toHaveBeenCalled();
  });

  it('pièce obligatoire manquante (US-04c) : 400, KYC non validé', async () => {
    const { service, depot } = preparer(EN_COURS, true, ['identite', 'rib']);
    const err = await erreurDe(service.valider('u1'));
    expect(err.status).toBe(400);
    expect(err.message).toBe(PIECES_MANQUANTES);
    expect(depot.valider).not.toHaveBeenCalled();
  });

  it('KYC déjà validé : 409', async () => {
    const { service, depot } = preparer({ ...EN_COURS, statut: 'complete', valideLe: LE });
    expect((await erreurDe(service.valider('u1'))).status).toBe(409);
    expect(depot.valider).not.toHaveBeenCalled();
  });

  it('validé entre-temps (deux onglets) : 409', async () => {
    const { service } = preparer(EN_COURS, false);
    expect((await erreurDe(service.valider('u1'))).status).toBe(409);
  });
});
