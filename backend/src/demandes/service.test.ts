import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import {
  DEMANDE_INTROUVABLE,
  ERREUR_SAISIE,
  KYC_NON_VALIDE,
  PARTS_INVALIDES,
  PRIX_INCONNU,
  SCPI_INTROUVABLE,
  TYPE_INVALIDE,
  creerDemandesService,
  entierStrictementPositif,
  euros,
  messageMinimum,
  numeroDossier,
  verifier,
  type ConditionsScpi,
  type DepotDemandes,
  type LigneDossier,
} from './service.js';

// SCPI du critère d'acceptation : part à 200 €, minimum 1 000 €
const SCPI: ConditionsScpi = { id: 7, nom: 'SCPI Exemple', prixPart: 200, minimum: 1000 };
const DATE = new Date('2026-11-24T10:00:00Z');

function ligne(partiel: Partial<LigneDossier> = {}): LigneDossier {
  return {
    id: 42,
    scpiId: 7,
    scpiNom: 'SCPI Exemple',
    gerant: 'Gestion Exemple',
    nombreParts: 5,
    prixPart: 200,
    montant: 1000,
    type: 'pleine_propriete',
    statut: 'demande_envoyee',
    demandeLe: DATE,
    accuseReceptionLe: null,
    motifRefus: null,
    ibanPaiement: null,
    bicPaiement: null,
    referenceVirement: null,
    jouissanceLe: null,
    ...partiel,
  };
}

// Dossier attendu à l'écran pour la ligne() par défaut
const DOSSIER_ENVOYE = {
  id: 42,
  numero: 'D-42',
  scpiId: 7,
  scpiNom: 'SCPI Exemple',
  gerant: 'Gestion Exemple',
  nombreParts: 5,
  prixPart: 200,
  montant: 1000,
  type: 'pleine_propriete',
  statut: 'demande_envoyee',
  demandeLe: '2026-11-24T10:00:00.000Z',
  accuseReceptionLe: null,
  motifRefus: null,
  paiement: null,
  jouissanceLe: null,
};

// Informations de suivi toutes remplies, pour vérifier le filtrage par statut (US-16)
const SUIVI_COMPLET: Partial<LigneDossier> = {
  accuseReceptionLe: new Date('2026-11-13T09:30:00Z'),
  motifRefus: 'Dossier KYC incomplet',
  ibanPaiement: 'FR76 3000 6000 0112 3456 7890 189',
  bicPaiement: 'AGRIFRPP',
  referenceVirement: 'SIP-COME-20261113-4HX8QA',
  jouissanceLe: '2027-01-01',
};

function depot(
  conditions: ConditionsScpi | null = SCPI,
  lu: LigneDossier | null = ligne(),
  kycComplet = true,
) {
  return {
    kycComplet: vi.fn().mockResolvedValue(kycComplet),
    conditions: vi.fn().mockResolvedValue(conditions),
    creer: vi.fn().mockResolvedValue(42),
    lire: vi.fn().mockResolvedValue(lu),
  } satisfies DepotDemandes;
}

async function erreurDe(promesse: Promise<unknown>): Promise<HttpError> {
  const err = await promesse.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

describe('règles de saisie (US-11, SCPI-259)', () => {
  it('saisie valide : valeurs nettoyées (nombres reçus en texte acceptés)', () => {
    expect(verifier({ scpiId: '7', nombreParts: ' 5 ', type: 'usufruit' })).toEqual({
      saisie: { scpiId: 7, nombreParts: 5, type: 'usufruit' },
    });
  });

  it.each([0, -1, 2.5, '2,5', '2.5', '1e3', 'abc', '', null, undefined, true, 2_147_483_648])(
    'nombre de parts invalide (%s) : « Saisissez un nombre entier… »',
    (nombreParts) => {
      expect(verifier({ scpiId: 7, nombreParts, type: 'pleine_propriete' })).toEqual({
        erreurs: { nombreParts: PARTS_INVALIDES },
      });
    },
  );

  it('type et SCPI invalides : un message par champ', () => {
    expect(verifier({ scpiId: 'x', nombreParts: 5, type: 'viager' })).toEqual({
      erreurs: { scpiId: SCPI_INTROUVABLE, type: TYPE_INVALIDE },
    });
  });

  it('entier strictement positif, avec plafond', () => {
    expect(entierStrictementPositif(3)).toBe(3);
    expect(entierStrictementPositif(11, 10)).toBeNull();
  });

  it('montants affichés à la française', () => {
    expect(euros(1000)).toBe('1 000 €');
    expect(euros(1234.5)).toBe('1 234,50 €');
    expect(messageMinimum(1000, 200)).toBe(
      'Le minimum à investir pour cette SCPI est de 1 000 €, soit 5 parts.',
    );
    // Minimum pas multiple du prix : arrondi à la part supérieure
    expect(messageMinimum(1000, 300)).toContain('soit 4 parts');
  });
});

describe('créer une demande', () => {
  it('KYC non validé : 403, rien n’est lu ni créé', async () => {
    const d = depot(SCPI, ligne(), false);
    const err = await erreurDe(
      creerDemandesService(d).creer('u1', { scpiId: 7, nombreParts: 5, type: 'pleine_propriete' }),
    );

    expect(err.status).toBe(403);
    expect(err.message).toBe(KYC_NON_VALIDE);
    expect(d.kycComplet).toHaveBeenCalledWith('u1');
    expect(d.conditions).not.toHaveBeenCalled();
    expect(d.creer).not.toHaveBeenCalled();
  });

  it('demande valide : 5 parts à 200 € -> dossier de 1 000 € « Demande envoyée »', async () => {
    const d = depot();
    const dossier = await creerDemandesService(d).creer('u1', {
      scpiId: 7,
      nombreParts: 5,
      type: 'pleine_propriete',
    });

    expect(d.creer).toHaveBeenCalledWith({
      utilisateurId: 'u1',
      scpiId: 7,
      scpiNom: 'SCPI Exemple',
      nombreParts: 5,
      prixPart: 200,
      montant: 1000,
      type: 'pleine_propriete',
    });
    expect(d.lire).toHaveBeenCalledWith('u1', 42);
    expect(dossier).toEqual(DOSSIER_ENVOYE);
  });

  it('montant calculé avec le prix de la SCPI, jamais celui envoyé par l’écran', async () => {
    const d = depot({ ...SCPI, prixPart: 210.15 });
    await creerDemandesService(d).creer('u1', {
      scpiId: 7,
      nombreParts: 7,
      type: 'nue_propriete',
      montant: 1,
      prixPart: 1,
    });
    expect(d.creer).toHaveBeenCalledWith(
      expect.objectContaining({ prixPart: 210.15, montant: 1471.05 }),
    );
  });

  it('minimum non atteint : 4 parts -> 400 avec le message de la story, rien créé', async () => {
    const d = depot();
    const err = await erreurDe(
      creerDemandesService(d).creer('u1', { scpiId: 7, nombreParts: 4, type: 'pleine_propriete' }),
    );
    const message = 'Le minimum à investir pour cette SCPI est de 1 000 €, soit 5 parts.';
    expect(err.status).toBe(400);
    expect(err.message).toBe(message);
    expect(err.details).toEqual({ erreurs: { nombreParts: message } });
    expect(d.creer).not.toHaveBeenCalled();
  });

  it('SCPI sans minimum renseigné : pas de contrôle de minimum', async () => {
    const d = depot({ ...SCPI, minimum: null });
    await creerDemandesService(d).creer('u1', { scpiId: 7, nombreParts: 1, type: 'usufruit' });
    expect(d.creer).toHaveBeenCalledWith(expect.objectContaining({ montant: 200 }));
  });

  it('saisie invalide : 400 avec les erreurs par champ, SCPI non lue', async () => {
    const d = depot();
    const err = await erreurDe(creerDemandesService(d).creer('u1', { scpiId: 7, nombreParts: 0 }));
    expect(err.status).toBe(400);
    expect(err.message).toBe(ERREUR_SAISIE);
    expect(err.details).toEqual({
      erreurs: { nombreParts: PARTS_INVALIDES, type: TYPE_INVALIDE },
    });
    expect(d.conditions).not.toHaveBeenCalled();
  });

  it('SCPI absente du catalogue : 404', async () => {
    const err = await erreurDe(
      creerDemandesService(depot(null)).creer('u1', {
        scpiId: 99,
        nombreParts: 5,
        type: 'usufruit',
      }),
    );
    expect(err.status).toBe(404);
    expect(err.message).toBe(SCPI_INTROUVABLE);
  });

  it.each([null, 0])('prix de part inconnu (%s) : 422, rien créé', async (prixPart) => {
    const d = depot({ ...SCPI, prixPart });
    const err = await erreurDe(
      creerDemandesService(d).creer('u1', { scpiId: 7, nombreParts: 5, type: 'usufruit' }),
    );
    expect(err.status).toBe(422);
    expect(err.message).toBe(PRIX_INCONNU);
    expect(d.creer).not.toHaveBeenCalled();
  });

  it('dossier introuvable juste après sa création : erreur technique', async () => {
    await expect(
      creerDemandesService(depot(SCPI, null)).creer('u1', {
        scpiId: 7,
        nombreParts: 5,
        type: 'usufruit',
      }),
    ).rejects.toThrow('Dossier créé introuvable');
  });
});

describe('numéro de dossier', () => {
  it('D- suivi de l’identifiant (US-12 : idDossier)', () => {
    expect(numeroDossier(1041)).toBe('D-1041');
  });
});

describe('lire une demande', () => {
  it('dossier de l’investisseur : renvoyé avec son numéro', async () => {
    const d = depot();
    const dossier = await creerDemandesService(d).lire('u1', '42');
    expect(d.lire).toHaveBeenCalledWith('u1', 42);
    expect(dossier.numero).toBe('D-42');
  });

  it('US-16 : demande envoyée, rien d’autre à afficher', async () => {
    const dossier = await creerDemandesService(depot(SCPI, ligne(SUIVI_COMPLET))).lire('u1', '42');
    expect(dossier).toEqual({ ...DOSSIER_ENVOYE, accuseReceptionLe: '2026-11-13T09:30:00.000Z' });
  });

  it('US-16 : dossier accepté -> IBAN, BIC, montant à virer et référence', async () => {
    const lu = ligne({ ...SUIVI_COMPLET, id: 1015, statut: 'acceptee_attente_paiement' });
    const dossier = await creerDemandesService(depot(SCPI, lu)).lire('u1', '1015');
    expect(dossier.paiement).toEqual({
      iban: 'FR76 3000 6000 0112 3456 7890 189',
      bic: 'AGRIFRPP',
      montant: 1000,
      reference: 'SIP-COME-20261113-4HX8QA',
    });
    expect(dossier.motifRefus).toBeNull();
    expect(dossier.jouissanceLe).toBeNull();
  });

  it('US-16 : dossier refusé -> motif du refus, pas de coordonnées de paiement', async () => {
    const lu = ligne({ ...SUIVI_COMPLET, id: 1002, statut: 'refusee' });
    const dossier = await creerDemandesService(depot(SCPI, lu)).lire('u1', '1002');
    expect(dossier.motifRefus).toBe('Dossier KYC incomplet');
    expect(dossier.paiement).toBeNull();
    expect(dossier.jouissanceLe).toBeNull();
  });

  it('US-16 : investissement actif -> date d’entrée en jouissance', async () => {
    const lu = ligne({ ...SUIVI_COMPLET, statut: 'investissement_actif' });
    const dossier = await creerDemandesService(depot(SCPI, lu)).lire('u1', '42');
    expect(dossier.jouissanceLe).toBe('2027-01-01');
    expect(dossier.paiement).toBeNull();
    expect(dossier.motifRefus).toBeNull();
  });

  it('dossier absent ou d’un autre investisseur : « Cette demande est introuvable. »', async () => {
    const err = await erreurDe(creerDemandesService(depot(SCPI, null)).lire('u2', '42'));
    expect(err.status).toBe(404);
    expect(err.message).toBe(DEMANDE_INTROUVABLE);
  });

  it.each(['abc', '0', '-1', 'D-42'])(
    'numéro invalide (%s) : 404 sans lire la base',
    async (id) => {
      const d = depot();
      const err = await erreurDe(creerDemandesService(d).lire('u1', id));
      expect(err.status).toBe(404);
      expect(d.lire).not.toHaveBeenCalled();
    },
  );
});
