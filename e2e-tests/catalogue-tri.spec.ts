import { expect, test } from './fixtures';

// Tri du catalogue : chaque option du menu « Trier par », sur le catalogue de test
// (e2e-tests/donnees/scpi_catalogue.csv). Valeurs choisies pour que chaque tri donne
// un ordre différent du tri par défaut :
//
//                     taux   capitalisation  zone (majoritaire)  catégorie (majoritaire)  société de gestion
//   Gamma Patrimoine  6,2 %  400 M€          Allemagne (70 %)    Bureaux (60 %)           Pierre Gestion
//   Alpha Bureaux     5,1 %  150 M€          France              Bureaux                  Atlas REIM
//   Bêta Santé        4,5 %  500 M€          Espagne             Santé                    Mistral Capital
//
// Égalité (catégorie Bureaux pour Alpha et Gamma) : ordre alphabétique du nom,
// quel que soit le sens.
const ALPHA = 'Alpha Bureaux';
const BETA = 'Bêta Santé';
const GAMMA = 'Gamma Patrimoine';

// Libellé de l'option dans le menu -> ordre attendu des SCPI
const TRIS: [string, string[]][] = [
  ['Taux de distribution — décroissant', [GAMMA, ALPHA, BETA]],
  ['Taux de distribution — croissant', [BETA, ALPHA, GAMMA]],
  ['Capitalisation — décroissant', [BETA, GAMMA, ALPHA]],
  ['Capitalisation — croissant', [ALPHA, GAMMA, BETA]],
  ['Zone géographique A → Z', [GAMMA, BETA, ALPHA]],
  ['Zone géographique Z → A', [ALPHA, BETA, GAMMA]],
  ['Catégorie A → Z', [ALPHA, GAMMA, BETA]],
  ['Catégorie Z → A', [BETA, ALPHA, GAMMA]],
  ['Société de gestion A → Z', [ALPHA, BETA, GAMMA]],
  ['Société de gestion Z → A', [GAMMA, BETA, ALPHA]],
  ['Nom A → Z', [ALPHA, BETA, GAMMA]],
  ['Nom Z → A', [GAMMA, BETA, ALPHA]],
];

test.beforeEach(async ({ page }) => {
  await page.goto('/catalogue');
  await expect(page.getByRole('heading', { level: 1, name: 'Catalogue SCPI' })).toBeVisible();
});

test('tri par défaut : taux de distribution décroissant', async ({ page }) => {
  await expect(
    page.getByRole('button', { name: 'Trier par : Taux de distribution — décroissant' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([GAMMA, ALPHA, BETA]);
});

for (const [libelle, ordre] of TRIS) {
  test(`tri : ${libelle}`, async ({ page }) => {
    await page.getByRole('button', { name: /^Trier par/ }).click();
    await page.getByRole('option', { name: libelle }).click();

    await expect(page.getByRole('button', { name: `Trier par : ${libelle}` })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(ordre);
  });
}
