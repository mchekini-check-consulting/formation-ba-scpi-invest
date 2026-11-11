import { describe, expect, it, vi } from 'vitest';
import { EmailDejaUtilise } from '../auth/fournisseur.js';
import { KYC_COMPLET, PDF } from '../kyc/exemple.js';
import { HttpError } from '../logging/http-error.js';
import { type Justificatif, creerInformationsService } from './service.js';

const LE = new Date('2026-11-11T10:00:00.000Z');
const EMAIL = 'claire.martin@exemple.fr';
const PIECE: Justificatif = {
  id: 7,
  nomFichier: 'quittance.pdf',
  format: 'application/pdf',
  taille: 16,
  cle: 'informations/u1/abc',
};
const VERSO: Justificatif = {
  ...PIECE,
  id: 8,
  nomFichier: 'verso.pdf',
  cle: 'informations/u1/def',
};

function preparer({
  statut = 'complete',
  justificatifs = [PIECE, VERSO],
  motDePasseValide = true,
}: { statut?: string; justificatifs?: Justificatif[]; motDePasseValide?: boolean } = {}) {
  const depot = {
    lireKyc: vi.fn().mockResolvedValue({ statut, reponses: { ...KYC_COMPLET } }),
    pieces: vi.fn().mockResolvedValue([{ type: 'identite', nomFichier: 'cni.pdf' }]),
    enregistrerJustificatif: vi.fn().mockResolvedValue({ ...PIECE, id: 12 }),
    lireJustificatif: vi.fn(
      async (_u: string, id: number) => justificatifs.find((j) => j.id === id) ?? null,
    ),
    appliquer: vi.fn().mockResolvedValue(undefined),
    historique: vi.fn().mockResolvedValue([]),
  };
  const stockage = { deposer: vi.fn().mockResolvedValue(undefined), supprimer: vi.fn() };
  const compte = {
    verifierMotDePasse: vi.fn().mockResolvedValue(motDePasseValide),
    changerEmail: vi.fn().mockResolvedValue(undefined),
  };
  const service = creerInformationsService(depot, stockage, compte, () => LE);
  return { service, depot, stockage, compte };
}

async function erreurDe(promesse: Promise<unknown>): Promise<HttpError> {
  const err = await promesse.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  return err as HttpError;
}

const ADRESSE = {
  adresse: '24 avenue Jean Jaurès',
  codePostal: '75019',
  ville: 'Paris',
  pays: 'France',
};
const SITUATION = {
  nom: 'Martin',
  situationFamiliale: 'Célibataire',
  profession: 'Ingénieure',
  categorie: 'Cadre, profession intellectuelle supérieure',
  secteur: 'Industrie',
};

describe('InformationsService (US-06)', () => {
  it('lire : e-mail du compte, réponses du KYC et historique', async () => {
    const { service, depot } = preparer();
    const ligne = {
      bloc: 'adresse',
      champ: 'ville',
      ancienneValeur: 'Lyon',
      nouvelleValeur: 'Paris',
      modifieLe: LE,
    };
    depot.historique.mockResolvedValue([ligne]);
    expect(await service.lire('u1', EMAIL)).toEqual({
      email: EMAIL,
      reponses: KYC_COMPLET,
      historique: [ligne],
    });
  });

  it('KYC pas encore validé : 409, rien n’est modifiable', async () => {
    const { service, depot } = preparer({ statut: 'en_cours' });
    const err = await erreurDe(service.lire('u1', EMAIL));
    expect([err.status, err.message]).toEqual([
      409,
      'Votre KYC doit être validé avant de modifier vos informations.',
    ]);
    expect((await erreurDe(service.modifierAdresse('u1', EMAIL, ADRESSE))).status).toBe(409);
    depot.lireKyc.mockResolvedValue(null);
    expect((await erreurDe(service.lire('u1', EMAIL))).status).toBe(409);
  });

  it('deposerJustificatif : fichier dans R2 sous une clé aléatoire, description en base', async () => {
    const { service, depot, stockage } = preparer();
    expect(await service.deposerJustificatif('u1', { nom: 'quittance.pdf', contenu: PDF })).toEqual(
      {
        id: 12,
        nomFichier: 'quittance.pdf',
      },
    );
    const [cle, contenu, format] = stockage.deposer.mock.calls[0];
    expect(cle).toMatch(/^informations\/u1\/[0-9a-f-]{36}$/);
    expect([contenu, format]).toEqual([PDF, 'application/pdf']);
    expect(depot.enregistrerJustificatif).toHaveBeenCalledWith(
      'u1',
      { nomFichier: 'quittance.pdf', format: 'application/pdf', taille: PDF.length, cle },
      LE,
    );
    // Sans nom : nom par défaut
    expect(
      (await service.deposerJustificatif('u1', { nom: undefined, contenu: PDF })).nomFichier,
    ).toBe('justificatif.pdf');
    expect(depot.enregistrerJustificatif.mock.calls[1][1].nomFichier).toBe('justificatif.pdf');
  });

  it('deposerJustificatif : mauvais format, trop gros ou vide -> 400 (scénario 11)', async () => {
    const { service, stockage } = preparer();
    const gros = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    for (const contenu of [Buffer.from('texte'), gros, 'pas un buffer']) {
      const err = await erreurDe(service.deposerJustificatif('u1', { nom: 'x', contenu }));
      expect([err.status, err.message]).toEqual([
        400,
        'Format non accepté ou fichier trop volumineux (PDF, JPG ou PNG, 10 Mo maximum)',
      ]);
    }
    expect(stockage.deposer).not.toHaveBeenCalled();
  });

  it('modifierAdresse : appliquée tout de suite, historisée, justificatif en pièce « domicile »', async () => {
    const { service, depot } = preparer();
    const resultat = await service.modifierAdresse('u1', EMAIL, { ...ADRESSE, justificatif: 7 });
    expect(depot.appliquer).toHaveBeenCalledWith(
      'u1',
      {
        reponses: ADRESSE,
        historique: [
          {
            bloc: 'adresse',
            champ: 'adresse',
            ancienneValeur: '12 rue des Lilas',
            nouvelleValeur: '24 avenue Jean Jaurès',
          },
          {
            bloc: 'adresse',
            champ: 'codePostal',
            ancienneValeur: '69003',
            nouvelleValeur: '75019',
          },
          { bloc: 'adresse', champ: 'ville', ancienneValeur: 'Lyon', nouvelleValeur: 'Paris' },
        ],
        justificatifId: 7,
        pieces: [{ type: 'domicile', justificatif: PIECE }],
      },
      LE,
    );
    expect(resultat.email).toBe(EMAIL);
  });

  it('modifierAdresse : sans justificatif, ou celui d’un autre -> 400, rien enregistré (scénario 5)', async () => {
    const { service, depot } = preparer();
    for (const justificatif of [undefined, 'abc', 99]) {
      const err = await erreurDe(
        service.modifierAdresse('u1', EMAIL, { ...ADRESSE, justificatif }),
      );
      expect([err.status, err.message]).toEqual([
        400,
        'Cette pièce est obligatoire : déposez un fichier.',
      ]);
    }
    expect(depot.appliquer).not.toHaveBeenCalled();
  });

  it('champ vide -> 400 ; aucune différence -> 400', async () => {
    const { service, depot } = preparer();
    const vide = await erreurDe(service.modifierAdresse('u1', EMAIL, { ...ADRESSE, ville: ' ' }));
    expect([vide.status, vide.message]).toEqual([400, 'Merci de renseigner tous les champs.']);
    const inchange = await erreurDe(
      service.modifierSituation('u1', EMAIL, {
        ...SITUATION,
        situationFamiliale: KYC_COMPLET.situationFamiliale,
      }),
    );
    expect([inchange.status, inchange.message]).toEqual([
      400,
      'Aucune modification à enregistrer.',
    ]);
    expect((await erreurDe(service.modifierAdresse('u1', EMAIL, null))).status).toBe(400);
    expect(depot.appliquer).not.toHaveBeenCalled();
  });

  it('modifierSituation : déclarative, sans justificatif (scénario 6)', async () => {
    const { service, depot } = preparer();
    await service.modifierSituation('u1', EMAIL, SITUATION);
    expect(depot.appliquer).toHaveBeenCalledWith(
      'u1',
      {
        reponses: SITUATION,
        historique: [
          {
            bloc: 'situation',
            champ: 'situationFamiliale',
            ancienneValeur: 'Marié(e)',
            nouvelleValeur: 'Célibataire',
          },
        ],
        justificatifId: null,
        pieces: [],
      },
      LE,
    );
  });

  it('modifierSituation : changement de nom sans pièce d’état civil -> 400 ; avec -> enregistré (scénario 7)', async () => {
    const { service, depot } = preparer();
    const demande = { ...SITUATION, nom: 'Durand' };
    const err = await erreurDe(service.modifierSituation('u1', EMAIL, demande));
    expect(err.message).toBe('Cette pièce est obligatoire : déposez un fichier.');
    expect(depot.appliquer).not.toHaveBeenCalled();
    await service.modifierSituation('u1', EMAIL, { ...demande, justificatif: '7' });
    expect(depot.appliquer.mock.calls[0][1]).toMatchObject({ justificatifId: 7, pieces: [] });
  });

  it('modifierCoordonnees : mot de passe exigé, téléphone et e-mail mis à jour', async () => {
    const { service, depot, compte } = preparer();
    const resultat = await service.modifierCoordonnees('u1', EMAIL, {
      telephone: '06 98 76 54 32',
      indicatif: 'France',
      email: 'Claire.Durand@Exemple.fr',
      motDePasse: 'secret',
    });
    expect(compte.verifierMotDePasse).toHaveBeenCalledWith('u1', 'secret');
    expect(compte.changerEmail).toHaveBeenCalledWith('u1', 'claire.durand@exemple.fr');
    expect(depot.appliquer.mock.calls[0][1].historique).toEqual([
      {
        bloc: 'coordonnees',
        champ: 'telephone',
        ancienneValeur: '06 12 34 56 78',
        nouvelleValeur: '06 98 76 54 32',
      },
      { bloc: 'coordonnees', champ: 'indicatif', ancienneValeur: null, nouvelleValeur: 'France' },
      {
        bloc: 'coordonnees',
        champ: 'email',
        ancienneValeur: EMAIL,
        nouvelleValeur: 'claire.durand@exemple.fr',
      },
    ]);
    expect(resultat.email).toBe('claire.durand@exemple.fr');
  });

  it('modifierCoordonnees : téléphone seul, e-mail inchangé', async () => {
    const { service, compte } = preparer();
    const resultat = await service.modifierCoordonnees('u1', EMAIL, {
      telephone: '+33 6 98 76 54 32',
      email: EMAIL,
      motDePasse: 'secret',
    });
    expect(compte.changerEmail).not.toHaveBeenCalled();
    expect(resultat.email).toBe(EMAIL);
  });

  it('modifierCoordonnees : mot de passe faux ou absent -> 403, rien modifié', async () => {
    const { service, depot, compte } = preparer({ motDePasseValide: false });
    const demande = { telephone: '06 98 76 54 32', email: EMAIL, motDePasse: 'faux' };
    const err = await erreurDe(service.modifierCoordonnees('u1', EMAIL, demande));
    expect([err.status, err.message]).toEqual([403, 'Mot de passe incorrect.']);
    const sans = await erreurDe(
      service.modifierCoordonnees('u1', EMAIL, { ...demande, motDePasse: undefined }),
    );
    expect(sans.status).toBe(403);
    expect(compte.verifierMotDePasse).toHaveBeenCalledTimes(1);
    expect(depot.appliquer).not.toHaveBeenCalled();
  });

  it('modifierCoordonnees : téléphone, e-mail invalides ; rien de changé -> 400', async () => {
    const { service, compte } = preparer();
    const base = { telephone: '06 98 76 54 32', email: EMAIL, motDePasse: 'secret' };
    const tel = await erreurDe(
      service.modifierCoordonnees('u1', EMAIL, { ...base, telephone: 'abc' }),
    );
    expect(tel.message).toBe('Merci de saisir un numéro de téléphone valide.');
    const mail = await erreurDe(
      service.modifierCoordonnees('u1', EMAIL, { ...base, email: 'claire' }),
    );
    expect(mail.message).toBe('Merci de saisir une adresse e-mail valide.');
    const rien = await erreurDe(
      service.modifierCoordonnees('u1', EMAIL, { ...base, telephone: KYC_COMPLET.telephone }),
    );
    expect(rien.message).toBe('Aucune modification à enregistrer.');
    expect(compte.verifierMotDePasse).not.toHaveBeenCalled();
  });

  it('modifierCoordonnees : e-mail d’un autre compte -> 409, autre erreur relancée', async () => {
    const { service, depot, compte } = preparer();
    const demande = {
      telephone: KYC_COMPLET.telephone,
      email: 'autre@exemple.fr',
      motDePasse: 's',
    };
    compte.changerEmail.mockRejectedValueOnce(new EmailDejaUtilise());
    const err = await erreurDe(service.modifierCoordonnees('u1', EMAIL, demande));
    expect([err.status, err.message]).toEqual([409, 'Cette adresse e-mail est déjà utilisée.']);
    compte.changerEmail.mockRejectedValueOnce(new Error('panne'));
    await expect(service.modifierCoordonnees('u1', EMAIL, demande)).rejects.toThrow('panne');
    expect(depot.appliquer).not.toHaveBeenCalled();
  });

  it('modifierIdentite : recto et verso remplacent les pièces, historisés', async () => {
    const { service, depot } = preparer();
    await service.modifierIdentite('u1', EMAIL, { recto: 7, verso: 8 });
    expect(depot.appliquer).toHaveBeenCalledWith(
      'u1',
      {
        reponses: {},
        historique: [
          {
            bloc: 'identite',
            champ: 'identite',
            ancienneValeur: 'cni.pdf',
            nouvelleValeur: 'quittance.pdf',
          },
          {
            bloc: 'identite',
            champ: 'identite_verso',
            ancienneValeur: null,
            nouvelleValeur: 'verso.pdf',
          },
        ],
        justificatifId: 7,
        pieces: [
          { type: 'identite', justificatif: PIECE },
          { type: 'identite_verso', justificatif: VERSO },
        ],
      },
      LE,
    );
  });

  it('modifierIdentite : verso facultatif ; recto manquant ou verso inconnu -> 400', async () => {
    const { service, depot } = preparer();
    await service.modifierIdentite('u1', EMAIL, { recto: 7 });
    expect(depot.appliquer.mock.calls[0][1]).toMatchObject({
      historique: [{ champ: 'identite', nouvelleValeur: 'quittance.pdf' }],
      pieces: [{ type: 'identite', justificatif: PIECE }],
    });
    expect(
      (await erreurDe(service.modifierIdentite('u1', EMAIL, { recto: 7, verso: 99 }))).status,
    ).toBe(400);
    expect((await erreurDe(service.modifierIdentite('u1', EMAIL, { verso: 8 }))).message).toBe(
      'Cette pièce est obligatoire : déposez un fichier.',
    );
    expect(depot.appliquer).toHaveBeenCalledTimes(1);
  });
});
