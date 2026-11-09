import { describe, expect, it, vi } from 'vitest';
import { EmailDejaUtilise, type FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import {
  DUREE_BLOCAGE_MS,
  ECHECS_AVANT_BLOCAGE,
  IDENTIFIANTS_INCORRECTS,
  TROP_DE_TENTATIVES,
  VERSION_CGU,
  creerCompteService,
  empreinte,
} from './service.js';

const DEMANDE = {
  email: ' Jean@Exemple.fr ',
  motDePasse: 'Tr0pBien!Choisi',
  confirmation: 'Tr0pBien!Choisi',
  cguAcceptees: true,
};
const LE = new Date('2026-11-02T10:00:00Z');

function preparer(creerCompte = vi.fn(), connecter = vi.fn(), identifiantDe = vi.fn()) {
  const fournisseur: FournisseurIdentite = {
    creerCompte,
    connecter,
    utilisateurConnecte: vi.fn(),
    identifiantDe,
  };
  const cgu = { enregistrer: vi.fn().mockResolvedValue(undefined) };
  const tentatives = {
    reserverEssai: vi.fn().mockResolvedValue(null),
    enregistrerEchec: vi.fn().mockResolvedValue(null),
    effacer: vi.fn().mockResolvedValue(undefined),
  };
  const { log, lignes } = captureLogs();
  const service = creerCompteService(fournisseur, { cgu, tentatives, maintenant: () => LE, log });
  return { service, creerCompte, connecter, cgu, tentatives, lignes };
}

async function erreurDe(promesse: Promise<unknown>): Promise<HttpError> {
  const err = await promesse.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

describe('CompteService.creer', () => {
  it('crée le compte, enregistre la version et la date des CGU', async () => {
    const compte = { utilisateur: { id: 'u1', email: 'jean@exemple.fr' }, jeton: 'jeton' };
    const { service, creerCompte, cgu } = preparer(vi.fn().mockResolvedValue(compte));

    expect(await service.creer(DEMANDE)).toEqual(compte);
    expect(creerCompte).toHaveBeenCalledWith('jean@exemple.fr', 'Tr0pBien!Choisi');
    expect(cgu.enregistrer).toHaveBeenCalledWith('u1', VERSION_CGU, LE);
  });

  it('email au format invalide : 400', async () => {
    const { service, creerCompte } = preparer();
    const err = await erreurDe(service.creer({ ...DEMANDE, email: 'jean.exemple.fr' }));
    expect([err.status, err.message]).toEqual([400, 'Format d’email invalide']);
    expect(creerCompte).not.toHaveBeenCalled();
  });

  it('champs absents ou d’un autre type : 400', async () => {
    const { service } = preparer();
    expect((await erreurDe(service.creer({}))).status).toBe(400);
    expect((await erreurDe(service.creer({ ...DEMANDE, motDePasse: 42 }))).status).toBe(400);
  });

  it('CGU non acceptées : 400', async () => {
    const { service } = preparer();
    const err = await erreurDe(service.creer({ ...DEMANDE, cguAcceptees: 'oui' }));
    expect(err.message).toBe(
      'Vous devez accepter les CGU et la politique de confidentialité pour créer votre compte',
    );
  });

  it('mot de passe non conforme : 400 avec les règles non respectées', async () => {
    const { service } = preparer();
    const err = await erreurDe(
      service.creer({ ...DEMANDE, motDePasse: 'Azerty123456!', confirmation: 'Azerty123456!' }),
    );
    expect([err.status, err.message]).toEqual([
      400,
      'Ce mot de passe est trop courant, choisissez-en un autre',
    ]);
  });

  it('confirmation différente : 400', async () => {
    const { service } = preparer();
    const err = await erreurDe(service.creer({ ...DEMANDE, confirmation: 'Autre!Chose123' }));
    expect(err.message).toBe('Les mots de passe ne correspondent pas');
  });

  it('email déjà utilisé : 409, aucune acceptation enregistrée', async () => {
    const { service, cgu } = preparer(vi.fn().mockRejectedValue(new EmailDejaUtilise()));
    const err = await erreurDe(service.creer(DEMANDE));
    expect([err.status, err.message]).toEqual([409, 'Un compte existe déjà avec cet email']);
    expect(cgu.enregistrer).not.toHaveBeenCalled();
  });

  it('autre erreur du fournisseur : relancée telle quelle', async () => {
    const panne = new Error('base indisponible');
    const { service } = preparer(vi.fn().mockRejectedValue(panne));
    await expect(service.creer(DEMANDE)).rejects.toBe(panne);
  });
});

describe('CompteService.connecter (US-03a)', () => {
  const compte = { utilisateur: { id: 'u1', email: 'jean@exemple.fr' }, jeton: 'jeton' };

  it('identifiants corrects : session ouverte, email normalisé', async () => {
    const { service, connecter } = preparer(vi.fn(), vi.fn().mockResolvedValue(compte));
    expect(
      await service.connecter({ email: ' Jean@Exemple.fr ', motDePasse: 'Tr0pBien!Choisi' }),
    ).toEqual(compte);
    expect(connecter).toHaveBeenCalledWith('jean@exemple.fr', 'Tr0pBien!Choisi');
  });

  it('identifiants refusés par le fournisseur : 401, message unique', async () => {
    const { service } = preparer(vi.fn(), vi.fn().mockResolvedValue(null));
    const err = await erreurDe(service.connecter({ email: 'jean@exemple.fr', motDePasse: 'x' }));
    expect([err.status, err.message]).toEqual([401, IDENTIFIANTS_INCORRECTS]);
    expect(IDENTIFIANTS_INCORRECTS).toBe('Email ou mot de passe incorrect');
  });

  it('champs vides ou d’un autre type : 401 sans interroger le fournisseur', async () => {
    const { service, connecter } = preparer();
    expect((await erreurDe(service.connecter({}))).status).toBe(401);
    expect((await erreurDe(service.connecter({ email: 'a@b.fr', motDePasse: 42 }))).status).toBe(
      401,
    );
    expect(connecter).not.toHaveBeenCalled();
  });

  it('autre erreur du fournisseur : relancée telle quelle', async () => {
    const panne = new Error('base indisponible');
    const { service } = preparer(vi.fn(), vi.fn().mockRejectedValue(panne));
    await expect(service.connecter({ email: 'a@b.fr', motDePasse: 'x' })).rejects.toBe(panne);
  });
});

describe('CompteService.connecter : blocage après 5 échecs (US-03b)', () => {
  const compte = { utilisateur: { id: 'u1', email: 'jean@exemple.fr' }, jeton: 'jeton' };
  const FIN = new Date(LE.getTime() + DUREE_BLOCAGE_MS);
  const CLE = empreinte('jean@exemple.fr');
  const REGLE = { echecsAvantBlocage: 5, dureeMs: 600_000 };

  it('5 échecs, 10 minutes ; clé = empreinte de l’email, jamais l’email', () => {
    expect([ECHECS_AVANT_BLOCAGE, DUREE_BLOCAGE_MS]).toEqual([5, 600_000]);
    expect(CLE).toMatch(/^[0-9a-f]{64}$/);
    expect(CLE).not.toContain('jean');
  });

  it('connexion réussie : compteur effacé', async () => {
    const { service, tentatives } = preparer(vi.fn(), vi.fn().mockResolvedValue(compte));
    await service.connecter({ email: ' Jean@Exemple.fr ', motDePasse: 'Tr0pBien!Choisi' });
    expect(tentatives.reserverEssai).toHaveBeenCalledWith(CLE, LE, REGLE);
    expect(tentatives.effacer).toHaveBeenCalledWith(CLE);
    expect(tentatives.enregistrerEchec).not.toHaveBeenCalled();
  });

  it('échec sans blocage : échec compté, 401', async () => {
    const { service, tentatives } = preparer(vi.fn(), vi.fn().mockResolvedValue(null));
    const err = await erreurDe(service.connecter({ email: 'jean@exemple.fr', motDePasse: 'x' }));
    expect(err.status).toBe(401);
    expect(tentatives.reserverEssai).toHaveBeenCalledWith(CLE, LE, REGLE);
    expect(tentatives.enregistrerEchec).toHaveBeenCalledWith(CLE, LE, REGLE);
    expect(tentatives.effacer).not.toHaveBeenCalled();
  });

  it('échec qui bloque : 429 avec l’heure de déblocage, log avec l’identifiant', async () => {
    const { service, tentatives, lignes } = preparer(
      vi.fn(),
      vi.fn().mockResolvedValue(null),
      vi.fn().mockResolvedValue('u1'),
    );
    tentatives.enregistrerEchec.mockResolvedValue(FIN);
    const err = await erreurDe(service.connecter({ email: 'jean@exemple.fr', motDePasse: 'x' }));
    expect([err.status, err.message, err.details]).toEqual([
      429,
      TROP_DE_TENTATIVES,
      { debloqueA: FIN.toISOString() },
    ]);
    const blocage = lignes.find((l) => l.msg === 'compte bloqué après 5 échecs');
    expect(blocage).toMatchObject({ level: 'WARN', layer: 'service', userId: 'u1' });
    expect(JSON.stringify(lignes)).not.toContain('jean@exemple.fr');
  });

  it('email sans compte : bloqué de la même façon, log « compte inconnu »', async () => {
    const { service, tentatives, lignes } = preparer(
      vi.fn(),
      vi.fn().mockResolvedValue(null),
      vi.fn().mockResolvedValue(null),
    );
    tentatives.enregistrerEchec.mockResolvedValue(FIN);
    const err = await erreurDe(service.connecter({ email: 'inconnu@exemple.fr', motDePasse: 'x' }));
    expect(err.status).toBe(429);
    const blocage = lignes.find((l) => l.msg === 'compte bloqué après 5 échecs');
    expect(blocage).toMatchObject({ compteInconnu: true });
    expect(blocage?.userId).toBeUndefined();
  });

  it('essai refusé (blocage, essais simultanés) : 429 sans vérifier le mot de passe', async () => {
    const { service, connecter, tentatives } = preparer(vi.fn(), vi.fn().mockResolvedValue(compte));
    tentatives.reserverEssai.mockResolvedValue(FIN);
    const err = await erreurDe(
      service.connecter({ email: 'jean@exemple.fr', motDePasse: 'Tr0pBien!Choisi' }),
    );
    expect([err.status, err.details]).toEqual([429, { debloqueA: FIN.toISOString() }]);
    expect(connecter).not.toHaveBeenCalled();
    expect(tentatives.enregistrerEchec).not.toHaveBeenCalled();
  });

  it('champs vides : non comptés', async () => {
    const { service, tentatives } = preparer();
    await erreurDe(service.connecter({ email: 'jean@exemple.fr', motDePasse: '' }));
    expect(tentatives.reserverEssai).not.toHaveBeenCalled();
    expect(tentatives.enregistrerEchec).not.toHaveBeenCalled();
  });
});
