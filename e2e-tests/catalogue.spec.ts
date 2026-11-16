import { expect, test } from './fixtures';

// Catalogue de test (e2e-tests/donnees/scpi_catalogue.csv) : 3 SCPI connues.
// Page déjà connectée avec un compte investisseur prêt (fixtures.ts).

test.beforeEach(async ({ page }) => {
  await page.goto('/catalogue');
  await expect(page.getByRole('heading', { level: 1, name: 'Catalogue SCPI' })).toBeVisible();
});

test('affiche les 3 SCPI, du meilleur au plus faible taux de distribution', async ({ page }) => {
  await expect(page.getByText('3 SCPI disponibles')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Gamma Patrimoine',
    'Alpha Bureaux',
    'Bêta Santé',
  ]);
});

test('recherche une SCPI par une partie de son nom', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Rechercher une SCPI par son nom' }).fill('santé');

  await expect(page.getByText('1 SCPI trouvée pour « santé »')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Bêta Santé']);
});

test('recherche lancée à partir de 2 caractères seulement', async ({ page }) => {
  const recherche = page.getByRole('searchbox', { name: 'Rechercher une SCPI par son nom' });

  // 1 caractère : aide affichée, pas de recherche, tout le catalogue reste affiché
  await recherche.fill('A');
  await expect(page.getByText('Saisissez au moins 2 caractères')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);

  // 2 caractères : l'aide disparaît, la recherche est lancée
  await recherche.fill('Al');
  await expect(page.getByText('Saisissez au moins 2 caractères')).toBeHidden();
  await expect(page.getByText('1 SCPI trouvée pour « Al »')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Alpha Bureaux']);
});

test('recherche sans résultat, puis effacée : tout le catalogue revient', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Rechercher une SCPI par son nom' }).fill('Logistique');

  await expect(page.getByText('Aucune SCPI ne correspond à « Logistique »')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);

  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(3);
});
