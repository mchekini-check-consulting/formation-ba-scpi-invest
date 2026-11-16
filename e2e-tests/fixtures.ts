import { test as base, expect, type APIRequestContext } from '@playwright/test';
// Données d'exemple des tests du backend : déjà conformes à ses règles de validation
import { REPONSES_EXEMPLE } from '../backend/src/investisseur/reponses-exemple';
import { KYC_COMPLET, PDF } from '../backend/src/kyc/exemple';

// Raccourci vers les écrans réservés aux investisseurs (catalogue...) : un compte « prêt »
// (inscrit, KYC et formulaire investisseur validés) créé par des appels directs au
// backend, en moins d'une seconde, au lieu de remplir les écrans (déjà testés par
// parcours-investisseur.spec.ts). Un compte par processus de test (worker), partagé par
// ses tests.

// Clé de la session dans le navigateur (frontend/src/auth.js)
const CLE_JETON = 'scpi-invest.session';

// Factice, comme dans parcours-investisseur.spec.ts
const MOT_DE_PASSE = 'Factice-Playwright-1!';

async function appeler(
  api: APIRequestContext,
  methode: 'put' | 'post',
  chemin: string,
  options: Parameters<APIRequestContext['post']>[1],
) {
  const reponse = await api[methode](`/api${chemin}`, options);
  expect(reponse.ok(), `${methode.toUpperCase()} ${chemin} : ${await reponse.text()}`).toBe(true);
  return reponse;
}

async function creerCompteInvestisseur(api: APIRequestContext): Promise<string> {
  const email = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const compte = await appeler(api, 'post', '/comptes', {
    data: { email, motDePasse: MOT_DE_PASSE, confirmation: MOT_DE_PASSE, cguAcceptees: true },
  });
  const { jeton } = await compte.json();
  const headers = { Authorization: `Bearer ${jeton}` };

  // KYC : réponses, pièces obligatoires, validation
  await appeler(api, 'put', '/connaissance-client', {
    headers,
    data: { etape: 5, reponses: KYC_COMPLET },
  });
  for (const piece of ['identite', 'domicile', 'rib']) {
    await appeler(api, 'put', `/connaissance-client/pieces/${piece}?nom=${piece}.pdf`, {
      headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      data: PDF,
    });
  }
  await appeler(api, 'post', '/connaissance-client/validation', { headers });

  // Formulaire investisseur : 5 étapes, puis validation
  for (const etape of [1, 2, 3, 4, 5]) {
    await appeler(api, 'put', `/formulaire-investisseur/etapes/${etape}`, {
      headers,
      data: REPONSES_EXEMPLE[etape],
    });
  }
  await appeler(api, 'post', '/formulaire-investisseur/validation', {
    headers,
    data: { certification: true },
  });

  return jeton;
}

export const test = base.extend<object, { jeton: string }>({
  // Créé une fois par worker
  jeton: [
    async ({ playwright }, use, workerInfo) => {
      const api = await playwright.request.newContext({
        baseURL: workerInfo.project.use.baseURL,
      });
      await use(await creerCompteInvestisseur(api));
      await api.dispose();
    },
    { scope: 'worker' },
  ],

  // Page déjà connectée : le jeton est posé dans le navigateur avant le chargement de
  // chaque page, comme après une connexion
  page: async ({ page, jeton }, use) => {
    await page.addInitScript(
      ([cle, valeur]) => sessionStorage.setItem(cle, valeur),
      [CLE_JETON, jeton],
    );
    await use(page);
  },
});

export { expect };
