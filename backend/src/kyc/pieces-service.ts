import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';
import {
  MESSAGE_FORMAT,
  TAILLE_MAX,
  clePiece,
  formatDuFichier,
  nomFichierAffiche,
  piecesAttendues,
  typePiece,
  type FormatPiece,
  type TypePiece,
} from './pieces.js';
import type { DepotKyc } from './service.js';

export type StatutPiece = 'deposee' | 'en_verification' | 'validee' | 'refusee';

// Pièce telle que renvoyée à l'écran (sans la clé R2 ni le contenu)
export type PieceKyc = {
  type: TypePiece;
  nomFichier: string;
  format: string;
  taille: number;
  statut: StatutPiece;
  deposeLe: Date;
};

export type NouvellePiece = {
  type: TypePiece;
  nomFichier: string;
  format: FormatPiece;
  taille: number;
  cle: string;
};

export type DepotPieces = {
  lister(utilisateurId: string): Promise<PieceKyc[]>;
  // Crée la pièce ou remplace celle du même type (statut remis à « déposée »)
  enregistrer(utilisateurId: string, piece: NouvellePiece, le: Date): Promise<PieceKyc>;
  supprimer(utilisateurId: string, type: TypePiece): Promise<void>;
};

// Fichiers des pièces (Cloudflare R2, src/kyc/stockage.ts)
export type StockagePieces = {
  deposer(cle: string, contenu: Buffer, format: FormatPiece): Promise<void>;
  supprimer(cle: string): Promise<void>;
};

export type FichierRecu = { nom: unknown; contenu: unknown };

export const PIECE_INCONNUE = 'Pièce justificative inconnue.';
export const PIECE_NON_DEMANDEE = 'Cette pièce n’est pas demandée pour votre dossier.';
export const PIECE_ABSENTE = 'Aucun fichier n’a été déposé pour cette pièce.';
export const PIECES_FIGEES =
  'Votre KYC est validé : les pièces déposées ne peuvent plus être modifiées.';

// Couche service des pièces justificatives (US-04c) : dépôt, remplacement et suppression
// tant que le KYC n'est pas validé. La vérification des pièces est faite plus tard par un
// agent asynchrone, hors de ce backend. Noms et contenus des fichiers : jamais dans les logs.
export function creerPiecesService(
  depotKyc: Pick<DepotKyc, 'lire'>,
  depot: DepotPieces,
  stockage: StockagePieces,
  maintenant: () => Date = () => new Date(),
) {
  function typeConnu(valeur: unknown): TypePiece {
    const type = typePiece(valeur);
    if (!type) throw new HttpError(404, PIECE_INCONNUE);
    return type;
  }

  // Réponses du KYC en cours ; 409 s'il est déjà validé
  async function reponsesModifiables(utilisateurId: string) {
    const etat = await depotKyc.lire(utilisateurId);
    if (etat?.statut === 'complete') throw new HttpError(409, PIECES_FIGEES);
    return etat?.reponses ?? {};
  }

  async function lister(utilisateurId: string): Promise<PieceKyc[]> {
    return depot.lister(utilisateurId);
  }

  async function deposer(
    utilisateurId: string,
    typeDemande: unknown,
    fichier: FichierRecu,
  ): Promise<PieceKyc> {
    const type = typeConnu(typeDemande);
    const reponses = await reponsesModifiables(utilisateurId);
    if (!piecesAttendues(reponses).some((piece) => piece.type === type)) {
      throw new HttpError(400, PIECE_NON_DEMANDEE);
    }
    const contenu = Buffer.isBuffer(fichier.contenu) ? fichier.contenu : Buffer.alloc(0);
    const format = contenu.length <= TAILLE_MAX ? formatDuFichier(contenu) : null;
    if (!format) throw new HttpError(400, MESSAGE_FORMAT);

    const cle = clePiece(utilisateurId, type);
    await stockage.deposer(cle, contenu, format);
    const nomFichier = nomFichierAffiche(fichier.nom, type, format);
    return depot.enregistrer(
      utilisateurId,
      { type, nomFichier, format, taille: contenu.length, cle },
      maintenant(),
    );
  }

  async function supprimer(utilisateurId: string, typeDemande: unknown): Promise<void> {
    const type = typeConnu(typeDemande);
    await reponsesModifiables(utilisateurId);
    const deposees = await depot.lister(utilisateurId);
    if (!deposees.some((piece) => piece.type === type)) {
      throw new HttpError(404, PIECE_ABSENTE);
    }
    // Fichier d'abord : jamais de document personnel laissé dans R2 sans ligne en base
    await stockage.supprimer(clePiece(utilisateurId, type));
    await depot.supprimer(utilisateurId, type);
  }

  return loggable('PiecesKycService', { lister, deposer, supprimer });
}

export type PiecesKycService = ReturnType<typeof creerPiecesService>;
