import { describe, expect, it, vi } from 'vitest';
import { EmailDejaUtilise, type FournisseurIdentite } from '../auth/fournisseur.js';
import { HttpError } from '../logging/http-error.js';
import { IDENTIFIANTS_INCORRECTS, VERSION_CGU, creerCompteService } from './service.js';

const DEMANDE = {
  email: ' Jean@Exemple.fr ',
  motDePasse: 'Tr0pBien!Choisi',
  confirmation: 'Tr0pBien!Choisi',
  cguAcceptees: true,
};
const LE = new Date('2026-11-02T10:00:00Z');

function preparer(creerCompte = vi.fn(), connecter = vi.fn()) {
  const fournisseur: FournisseurIdentite = {
    creerCompte,
    connecter,
    utilisateurConnecte: vi.fn(),
  };
  const cgu = { enregistrer: vi.fn().mockResolvedValue(undefined) };
  return { service: creerCompteService(fournisseur, cgu, () => LE), creerCompte, connecter, cgu };
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
