import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DepotQuestionnaires } from '../investisseur/service.js';
import type { Db } from './index.js';
import { acceptationCgu, parametre, questionnaireInvestisseur } from './schema.js';

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

// US-05a : une ligne par utilisateur, créée à la première étape puis mise à jour
export function depotQuestionnaires(db: Db): DepotQuestionnaires {
  return {
    async lire(utilisateurId) {
      const [ligne] = await db
        .select({
          etapeCourante: questionnaireInvestisseur.etapeCourante,
          reponses: questionnaireInvestisseur.reponses,
        })
        .from(questionnaireInvestisseur)
        .where(eq(questionnaireInvestisseur.utilisateurId, utilisateurId));
      return ligne ?? null;
    },
    async enregistrer(utilisateurId, { etapeCourante, reponses }, versionQuestionnaire) {
      await db
        .insert(questionnaireInvestisseur)
        .values({ utilisateurId, etapeCourante, reponses, versionQuestionnaire })
        .onConflictDoUpdate({
          target: questionnaireInvestisseur.utilisateurId,
          set: { etapeCourante, reponses, versionQuestionnaire, misAJourLe: new Date() },
        });
    },
  };
}

export function depotAcceptationsCgu(db: Db) {
  return {
    async enregistrer(utilisateurId: string, versionCgu: string, accepteeLe: Date): Promise<void> {
      await db.insert(acceptationCgu).values({ utilisateurId, versionCgu, accepteeLe });
    },
  };
}
