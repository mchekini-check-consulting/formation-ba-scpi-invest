import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import {
  CHAMP_OBLIGATOIRE,
  ENTIER_INVALIDE,
  ERREUR_SAISIE,
  SITUATION_INVALIDE,
  creerFiscaliteService,
  verifier,
  type DepotFiscalite,
} from './service.js';

const SAISIE = { revenuNetImposable: 40000, situationFamiliale: 'seul', nombreEnfants: 0 };

function depot(lu: Awaited<ReturnType<DepotFiscalite['lire']>> = null) {
  return {
    lire: vi.fn().mockResolvedValue(lu),
    enregistrer: vi.fn().mockResolvedValue(undefined),
    effacer: vi.fn().mockResolvedValue(undefined),
  } satisfies DepotFiscalite;
}

describe('verifier : règles de saisie (US-06, SCPI-255)', () => {
  it('trois champs valides : valeurs gardées', () => {
    expect(verifier(SAISIE)).toEqual({ informations: SAISIE });
  });

  it('nombres envoyés en texte, espaces autour : convertis', () => {
    expect(
      verifier({ revenuNetImposable: ' 90000 ', situationFamiliale: 'couple', nombreEnfants: '3' }),
    ).toEqual({
      informations: { revenuNetImposable: 90000, situationFamiliale: 'couple', nombreEnfants: 3 },
    });
  });

  it('zéro accepté, pas de plafond sur le revenu', () => {
    expect(verifier({ ...SAISIE, revenuNetImposable: 0 })).toHaveProperty('informations');
    expect(verifier({ ...SAISIE, revenuNetImposable: 12_000_000_000 })).toEqual({
      informations: { ...SAISIE, revenuNetImposable: 12_000_000_000 },
    });
  });

  it('champs manquants : « Ce champ est obligatoire. » sous chacun', () => {
    expect(verifier({})).toEqual({
      erreurs: {
        revenuNetImposable: CHAMP_OBLIGATOIRE,
        situationFamiliale: CHAMP_OBLIGATOIRE,
        nombreEnfants: CHAMP_OBLIGATOIRE,
      },
    });
    expect(verifier({ ...SAISIE, revenuNetImposable: '' })).toEqual({
      erreurs: { revenuNetImposable: CHAMP_OBLIGATOIRE },
    });
    expect(verifier({ ...SAISIE, nombreEnfants: null })).toEqual({
      erreurs: { nombreEnfants: CHAMP_OBLIGATOIRE },
    });
  });

  it.each([-1, 1.5, '12,5', '1e3', 'abc', '-3', Number.NaN, true])(
    'nombre invalide (%s) : entier positif ou nul exigé',
    (valeur) => {
      expect(verifier({ ...SAISIE, revenuNetImposable: valeur, nombreEnfants: valeur })).toEqual({
        erreurs: { revenuNetImposable: ENTIER_INVALIDE, nombreEnfants: ENTIER_INVALIDE },
      });
    },
  );

  it('situation familiale autre que seul / couple refusée (valeurs du KYC comprises)', () => {
    expect(verifier({ ...SAISIE, situationFamiliale: 'Marié(e)' })).toEqual({
      erreurs: { situationFamiliale: SITUATION_INVALIDE },
    });
  });
});

describe('service des informations fiscales', () => {
  it('lire : informations de l’utilisateur, null s’il n’en a pas', async () => {
    const avec = depot(SAISIE as never);
    expect(await creerFiscaliteService(avec).lire('u1')).toEqual(SAISIE);
    expect(avec.lire).toHaveBeenCalledWith('u1');
    expect(await creerFiscaliteService(depot()).lire('u1')).toBeNull();
  });

  it('enregistrer : valeurs vérifiées enregistrées et renvoyées', async () => {
    const d = depot();
    const service = creerFiscaliteService(d);
    expect(await service.enregistrer('u1', { ...SAISIE, nombreEnfants: '2' })).toEqual({
      ...SAISIE,
      nombreEnfants: 2,
    });
    expect(d.enregistrer).toHaveBeenCalledWith('u1', { ...SAISIE, nombreEnfants: 2 });
  });

  it('enregistrer sans revenu : 400 avec l’erreur du champ, rien enregistré', async () => {
    const d = depot();
    const erreur = await creerFiscaliteService(d)
      .enregistrer('u1', { ...SAISIE, revenuNetImposable: '' })
      .catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(HttpError);
    expect(erreur).toMatchObject({
      status: 400,
      message: ERREUR_SAISIE,
      details: { erreurs: { revenuNetImposable: CHAMP_OBLIGATOIRE } },
    });
    expect(d.enregistrer).not.toHaveBeenCalled();
  });

  it('effacer : supprime les informations de l’utilisateur', async () => {
    const d = depot();
    await creerFiscaliteService(d).effacer('u1');
    expect(d.effacer).toHaveBeenCalledWith('u1');
  });
});
