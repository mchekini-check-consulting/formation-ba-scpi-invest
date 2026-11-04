import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Db } from './index.js';
import type { DepotKyc, EtatKyc } from '../kyc/service.js';
import { acceptationCgu, kyc, parametre } from './schema.js';

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

    async valider(utilisateurId, le): Promise<boolean> {
      const lignes = await db
        .update(kyc)
        .set({ statut: 'complete', etape: 5, valideLe: le, modifieLe: le })
        .where(and(eq(kyc.utilisateurId, utilisateurId), eq(kyc.statut, 'en_cours')))
        .returning({ id: kyc.id });
      return lignes.length > 0;
    },
  };
}
