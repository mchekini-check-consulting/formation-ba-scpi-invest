import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Db } from './index.js';
import { ETAPE_RECAPITULATIF } from '../kyc/champs.js';
import type { DepotPieces, PieceKyc } from '../kyc/pieces-service.js';
import type { DepotKyc, EtatKyc } from '../kyc/service.js';
import { acceptationCgu, kyc, kycPiece, parametre } from './schema.js';

// Accès aux données (testé par test/*.e2e-test.ts sur une vraie base)

// Clé de signature des sessions Better-Auth : BETTER_AUTH_SECRET si la plateforme la
// fournit, sinon générée au premier démarrage et gardée en base (identique pour tous
// les réplicas, aucune valeur secrète dans le dépôt ni dans helm.yaml).
export async function secretDesSessions(
  db: Db,
  depuisEnvironnement = process.env.BETTER_AUTH_SECRET,
): Promise<string> {
  if (depuisEnvironnement) {
    return depuisEnvironnement;
  }
  const cle = 'better_auth_secret';
  await db
    .insert(parametre)
    .values({ cle, valeur: randomBytes(32).toString('base64url') })
    .onConflictDoNothing();
  const [ligne] = await db.select().from(parametre).where(eq(parametre.cle, cle));
  return ligne.valeur;
}

export function depotAcceptationsCgu(db: Db) {
  return {
    async enregistrer(utilisateurId: string, versionCgu: string, accepteeLe: Date): Promise<void> {
      await db.insert(acceptationCgu).values({ utilisateurId, versionCgu, accepteeLe });
    },
  };
}

// US-04b : KYC de l'utilisateur. Les écritures ne touchent qu'un KYC en cours : une fois
// validé, il est figé (traçabilité LCB-FT).
export function depotKyc(db: Db): DepotKyc {
  return {
    async lire(utilisateurId: string): Promise<EtatKyc | null> {
      const [ligne] = await db
        .select({
          statut: kyc.statut,
          etape: kyc.etape,
          reponses: kyc.reponses,
          valideLe: kyc.valideLe,
        })
        .from(kyc)
        .where(eq(kyc.utilisateurId, utilisateurId));
      return ligne ?? null;
    },

    async enregistrer(utilisateurId, etape, reponses, le): Promise<boolean> {
      const lignes = await db
        .insert(kyc)
        .values({ utilisateurId, etape, reponses, creeLe: le, modifieLe: le })
        .onConflictDoUpdate({
          target: kyc.utilisateurId,
          set: { etape, reponses, modifieLe: le },
          setWhere: eq(kyc.statut, 'en_cours'),
        })
        .returning({ id: kyc.id });
      return lignes.length > 0;
    },

    // KYC et pièces dans la même transaction : jamais un KYC validé avec des pièces
    // encore modifiables
    async valider(utilisateurId, le): Promise<boolean> {
      return db.transaction(async (tx) => {
        const lignes = await tx
          .update(kyc)
          .set({ statut: 'complete', etape: ETAPE_RECAPITULATIF, valideLe: le, modifieLe: le })
          .where(and(eq(kyc.utilisateurId, utilisateurId), eq(kyc.statut, 'en_cours')))
          .returning({ id: kyc.id });
        if (lignes.length === 0) return false;
        await tx
          .update(kycPiece)
          .set({ statut: 'en_verification', modifieLe: le })
          .where(eq(kycPiece.utilisateurId, utilisateurId));
        return true;
      });
    },

    async typesPiecesDeposees(utilisateurId: string): Promise<string[]> {
      const lignes = await db
        .select({ type: kycPiece.type })
        .from(kycPiece)
        .where(eq(kycPiece.utilisateurId, utilisateurId));
      return lignes.map((ligne) => ligne.type);
    },
  };
}

// US-04c : pièces justificatives (métadonnées ; les fichiers sont dans R2)
const colonnesPiece = {
  type: kycPiece.type,
  nomFichier: kycPiece.nomFichier,
  format: kycPiece.format,
  taille: kycPiece.taille,
  statut: kycPiece.statut,
  deposeLe: kycPiece.deposeLe,
};

export function depotPieces(db: Db): DepotPieces {
  return {
    async lister(utilisateurId: string): Promise<PieceKyc[]> {
      return db
        .select(colonnesPiece)
        .from(kycPiece)
        .where(eq(kycPiece.utilisateurId, utilisateurId))
        .orderBy(kycPiece.id);
    },

    async enregistrer(utilisateurId, piece, le): Promise<PieceKyc> {
      const valeurs = { ...piece, statut: 'deposee' as const, deposeLe: le, modifieLe: le };
      const [ligne] = await db
        .insert(kycPiece)
        .values({ utilisateurId, ...valeurs })
        .onConflictDoUpdate({ target: [kycPiece.utilisateurId, kycPiece.type], set: valeurs })
        .returning(colonnesPiece);
      return ligne;
    },

    async supprimer(utilisateurId, type): Promise<void> {
      await db
        .delete(kycPiece)
        .where(and(eq(kycPiece.utilisateurId, utilisateurId), eq(kycPiece.type, type)));
    },
  };
}
