import { randomUUID } from 'node:crypto';
import { EmailDejaUtilise } from '../auth/fournisseur.js';
import type { ReponsesKyc } from '../db/schema.js';
import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';
import {
  MESSAGE_FORMAT,
  TAILLE_MAX,
  formatDuFichier,
  nomFichierAffiche,
  type FormatPiece,
  type TypePiece,
} from '../kyc/pieces.js';
import type { FichierRecu, StockagePieces } from '../kyc/pieces-service.js';

// US-06 (SCPI-235), variante « prise en compte directe » : l'investisseur modifie ses
// informations personnelles depuis la page Mon profil, un bloc à la fois. Pas de code par
// SMS ni e-mail : la modification est appliquée dès l'enregistrement ; les justificatifs
// restent obligatoires (contrôle a posteriori) et chaque champ modifié est historisé.
//   coordonnees : téléphone, e-mail (identifiant de connexion) ; mot de passe exigé
//   adresse     : adresse, code postal, ville, pays ; justificatif de domicile exigé
//   situation   : nom, situation familiale, profession, catégorie, secteur ; pièce d'état
//                 civil exigée si le nom change
//   identite    : nouvelle pièce d'identité ; verso facultatif (comme au KYC : recto et
//                 verso peuvent être dans un seul fichier)
// Le RIB n'est pas modifiable dans cette version. Valeurs et fichiers : jamais dans les logs.

export type Bloc = 'coordonnees' | 'adresse' | 'situation' | 'identite';

export type LigneHistorique = {
  bloc: Bloc;
  champ: string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  modifieLe: Date;
};

export type Justificatif = {
  id: number;
  nomFichier: string;
  format: FormatPiece;
  taille: number;
  cle: string;
};

export type Modification = {
  // Champs du KYC à remplacer
  reponses: ReponsesKyc;
  historique: Omit<LigneHistorique, 'modifieLe'>[];
  justificatifId: number | null;
  // Pièces du KYC remplacées par un justificatif (statut « en cours de vérification »)
  pieces: { type: TypePiece; justificatif: Justificatif }[];
};

export type DepotInformations = {
  // KYC de l'utilisateur ; null s'il n'existe pas
  lireKyc(utilisateurId: string): Promise<{ statut: string; reponses: ReponsesKyc } | null>;
  pieces(utilisateurId: string): Promise<{ type: TypePiece; nomFichier: string }[]>;
  enregistrerJustificatif(
    utilisateurId: string,
    justificatif: Omit<Justificatif, 'id'>,
    le: Date,
  ): Promise<Justificatif>;
  // Justificatif déposé par cet utilisateur ; null sinon
  lireJustificatif(utilisateurId: string, id: number): Promise<Justificatif | null>;
  // KYC, historique et pièces mis à jour ensemble (une seule transaction)
  appliquer(utilisateurId: string, modification: Modification, le: Date): Promise<void>;
  historique(utilisateurId: string): Promise<LigneHistorique[]>;
};

// Fournisseur d'identité : mot de passe et e-mail du compte (src/auth/)
export type CompteIdentite = {
  verifierMotDePasse(utilisateurId: string, motDePasse: string): Promise<boolean>;
  changerEmail(utilisateurId: string, email: string): Promise<void>;
};

export type Informations = {
  email: string;
  reponses: ReponsesKyc;
  historique: LigneHistorique[];
};

// Justificatifs : mêmes règles que les pièces du KYC (PDF, JPG ou PNG, 10 Mo maximum)
export const TAILLE_MAX_JUSTIFICATIF = TAILLE_MAX;
export const MESSAGE_FICHIER = MESSAGE_FORMAT;
export const MESSAGE_JUSTIFICATIF = 'Cette pièce est obligatoire : déposez un fichier.';
export const MESSAGE_KYC = 'Votre KYC doit être validé avant de modifier vos informations.';
export const MESSAGE_OBLIGATOIRE = 'Merci de renseigner tous les champs.';
export const MESSAGE_AUCUNE = 'Aucune modification à enregistrer.';
export const MESSAGE_MOT_DE_PASSE = 'Mot de passe incorrect.';
export const MESSAGE_EMAIL = 'Merci de saisir une adresse e-mail valide.';
export const MESSAGE_EMAIL_UTILISE = 'Cette adresse e-mail est déjà utilisée.';
export const MESSAGE_TELEPHONE = 'Merci de saisir un numéro de téléphone valide.';

const LONGUEUR_MAX = 300;
const CHAMPS_ADRESSE = ['adresse', 'codePostal', 'ville', 'pays'];
const CHAMPS_SITUATION = ['nom', 'situationFamiliale', 'profession', 'categorie', 'secteur'];

function objet(valeur: unknown): Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : {};
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, LONGUEUR_MAX) : '';
}

function actuel(reponses: ReponsesKyc, champ: string): string {
  const valeur = reponses[champ];
  return typeof valeur === 'string' ? valeur : '';
}

// Champs obligatoires lus dans la demande ; 400 si l'un est vide
function champsRemplis(demande: Record<string, unknown>, champs: string[]): ReponsesKyc {
  const valeurs: ReponsesKyc = {};
  for (const champ of champs) {
    const valeur = texte(demande[champ]);
    if (!valeur) throw new HttpError(400, MESSAGE_OBLIGATOIRE);
    valeurs[champ] = valeur;
  }
  return valeurs;
}

// Lignes d'historique des champs qui changent vraiment
function changements(bloc: Bloc, avant: ReponsesKyc, apres: ReponsesKyc) {
  return Object.entries(apres)
    .filter(([champ, valeur]) => actuel(avant, champ) !== valeur)
    .map(([champ, valeur]) => ({
      bloc,
      champ,
      ancienneValeur: actuel(avant, champ) || null,
      nouvelleValeur: typeof valeur === 'string' ? valeur : null,
    }));
}

function identifiant(valeur: unknown): number | null {
  const nombre = typeof valeur === 'number' ? valeur : Number(valeur);
  return Number.isSafeInteger(nombre) && nombre > 0 ? nombre : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEPHONE = /^\+?[0-9 .()-]{6,20}$/;

// Couche service des informations personnelles (US-06)
export function creerInformationsService(
  depot: DepotInformations,
  stockage: StockagePieces,
  compte: CompteIdentite,
  maintenant: () => Date = () => new Date(),
) {
  // Réponses du KYC validé ; 409 tant que le KYC n'est pas validé
  async function kycValide(utilisateurId: string): Promise<ReponsesKyc> {
    const etat = await depot.lireKyc(utilisateurId);
    if (etat?.statut !== 'complete') throw new HttpError(409, MESSAGE_KYC);
    return etat.reponses;
  }

  // Justificatif exigé, déposé par cet utilisateur
  async function justificatifExige(utilisateurId: string, valeur: unknown): Promise<Justificatif> {
    const id = identifiant(valeur);
    const trouve = id === null ? null : await depot.lireJustificatif(utilisateurId, id);
    if (!trouve) throw new HttpError(400, MESSAGE_JUSTIFICATIF);
    return trouve;
  }

  async function lire(utilisateurId: string, email: string): Promise<Informations> {
    const [reponses, historique] = await Promise.all([
      kycValide(utilisateurId),
      depot.historique(utilisateurId),
    ]);
    return { email, reponses, historique };
  }

  // Dépôt d'un justificatif (PDF, JPG ou PNG, 5 Mo maximum), utilisé ensuite par une
  // modification ; le fichier va dans R2, sa description en base
  async function deposerJustificatif(
    utilisateurId: string,
    fichier: FichierRecu,
  ): Promise<{ id: number; nomFichier: string }> {
    await kycValide(utilisateurId);
    const contenu = Buffer.isBuffer(fichier.contenu) ? fichier.contenu : Buffer.alloc(0);
    const format = contenu.length <= TAILLE_MAX_JUSTIFICATIF ? formatDuFichier(contenu) : null;
    if (!format) throw new HttpError(400, MESSAGE_FICHIER);
    const cle = `informations/${utilisateurId}/${randomUUID()}`;
    await stockage.deposer(cle, contenu, format);
    const nomFichier = nomFichierAffiche(fichier.nom, 'domicile', format).replace(
      /^domicile\./,
      'justificatif.',
    );
    const { id } = await depot.enregistrerJustificatif(
      utilisateurId,
      { nomFichier, format, taille: contenu.length, cle },
      maintenant(),
    );
    return { id, nomFichier };
  }

  async function enregistrer(utilisateurId: string, email: string, modification: Modification) {
    if (modification.historique.length === 0) throw new HttpError(400, MESSAGE_AUCUNE);
    await depot.appliquer(utilisateurId, modification, maintenant());
    return lire(utilisateurId, email);
  }

  // Adresse : justificatif de domicile obligatoire ; il remplace la pièce « domicile »
  async function modifierAdresse(utilisateurId: string, email: string, demande: unknown) {
    const avant = await kycValide(utilisateurId);
    const corps = objet(demande);
    const apres = champsRemplis(corps, CHAMPS_ADRESSE);
    const justificatif = await justificatifExige(utilisateurId, corps.justificatif);
    return enregistrer(utilisateurId, email, {
      reponses: apres,
      historique: changements('adresse', avant, apres),
      justificatifId: justificatif.id,
      pieces: [{ type: 'domicile', justificatif }],
    });
  }

  // Situation : déclarative ; un changement de nom exige une pièce d'état civil
  async function modifierSituation(utilisateurId: string, email: string, demande: unknown) {
    const avant = await kycValide(utilisateurId);
    const corps = objet(demande);
    const apres = champsRemplis(corps, CHAMPS_SITUATION);
    const nomChange = apres.nom !== actuel(avant, 'nom');
    const justificatif = nomChange
      ? await justificatifExige(utilisateurId, corps.justificatif)
      : null;
    return enregistrer(utilisateurId, email, {
      reponses: apres,
      historique: changements('situation', avant, apres),
      justificatifId: justificatif?.id ?? null,
      pieces: [],
    });
  }

  // Coordonnées : mot de passe du compte exigé. Le nouvel e-mail devient l'identifiant de
  // connexion (il n'est pas dans le KYC).
  async function modifierCoordonnees(utilisateurId: string, email: string, demande: unknown) {
    const avant = await kycValide(utilisateurId);
    const corps = objet(demande);
    const telephone = texte(corps.telephone);
    const nouvelEmail = texte(corps.email).toLowerCase();
    if (!TELEPHONE.test(telephone)) throw new HttpError(400, MESSAGE_TELEPHONE);
    if (!EMAIL.test(nouvelEmail)) throw new HttpError(400, MESSAGE_EMAIL);
    const apres: ReponsesKyc = { telephone };
    const indicatif = texte(corps.indicatif);
    if (indicatif) apres.indicatif = indicatif;

    const historique = changements('coordonnees', avant, apres);
    const emailChange = nouvelEmail !== email.toLowerCase();
    if (emailChange) {
      historique.push({
        bloc: 'coordonnees',
        champ: 'email',
        ancienneValeur: email,
        nouvelleValeur: nouvelEmail,
      });
    }
    if (historique.length === 0) throw new HttpError(400, MESSAGE_AUCUNE);

    const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';
    if (!motDePasse || !(await compte.verifierMotDePasse(utilisateurId, motDePasse))) {
      throw new HttpError(403, MESSAGE_MOT_DE_PASSE);
    }
    if (emailChange) {
      try {
        await compte.changerEmail(utilisateurId, nouvelEmail);
      } catch (err) {
        if (err instanceof EmailDejaUtilise) throw new HttpError(409, MESSAGE_EMAIL_UTILISE);
        throw err;
      }
    }
    return enregistrer(utilisateurId, emailChange ? nouvelEmail : email, {
      reponses: apres,
      historique,
      justificatifId: null,
      pieces: [],
    });
  }

  // Pièce d'identité : recto obligatoire, verso facultatif (comme au KYC) ; ils remplacent
  // les pièces du KYC
  async function modifierIdentite(utilisateurId: string, email: string, demande: unknown) {
    await kycValide(utilisateurId);
    const corps = objet(demande);
    const recto = await justificatifExige(utilisateurId, corps.recto);
    const verso =
      corps.verso === undefined || corps.verso === null
        ? null
        : await justificatifExige(utilisateurId, corps.verso);
    const anciennes = await depot.pieces(utilisateurId);
    const ancien = (type: TypePiece) =>
      anciennes.find((piece) => piece.type === type)?.nomFichier ?? null;
    const fichiers: [TypePiece, Justificatif][] = [['identite', recto]];
    if (verso) fichiers.push(['identite_verso', verso]);
    return enregistrer(utilisateurId, email, {
      reponses: {},
      historique: fichiers.map(([type, fichier]) => ({
        bloc: 'identite',
        champ: type,
        ancienneValeur: ancien(type),
        nouvelleValeur: fichier.nomFichier,
      })),
      justificatifId: recto.id,
      pieces: fichiers.map(([type, justificatif]) => ({ type, justificatif })),
    });
  }

  return loggable('InformationsService', {
    lire,
    deposerJustificatif,
    modifierAdresse,
    modifierSituation,
    modifierCoordonnees,
    modifierIdentite,
  });
}

export type InformationsService = ReturnType<typeof creerInformationsService>;
