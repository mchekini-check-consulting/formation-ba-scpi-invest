import { test, expect } from '@playwright/test';

const PAGE_TITLE = 'SCPI Invest+';
// Factice, pour les comptes de test uniquement (respecte les règles : 12 caractères,
// majuscule, minuscule, chiffre, caractère spécial)
const MOT_DE_PASSE = 'Factice-Playwright-1!';
// Identifiant unique : chaque lancement crée un nouveau compte, même en parallèle
const EMAIL = `test-${crypto.randomUUID().slice(0, 8)}@example.com`;

test('Parcours investisseur', async ({ page }) => {
  await test.info().attach('email du compte de test', { body: EMAIL });

  // navigation sur la page d'accueil
  await test.step("Arrivée sur la page d'accueil", async () => {
    await page.goto('/');

    await expect(page).toHaveTitle(PAGE_TITLE);
  });

  // navigation sur "Créer mon compte"
  await test.step("Cliquer sur 'Créer un compte'", async () => {
    await page.getByRole('banner').getByRole('link', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL('/inscription');
    await expect(page.getByRole('heading', { level: 1, name: 'Créer mon compte' })).toBeVisible();
  });

  // Créer un compte
  await test.step('Créer un compte', async () => {
    await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(EMAIL);

    await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(MOT_DE_PASSE);

    await page.getByRole('textbox', { name: 'Confirmation du mot de passe' }).fill(MOT_DE_PASSE);

    const cgu = page.getByRole('checkbox', { name: 'J’accepte les CGU et je' });

    await cgu.check();
    await expect(cgu).toBeChecked();

    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page).toHaveURL('/connaissance-client');
    await expect(page.getByText(`Connecté avec l’adresse ${EMAIL}`)).toBeVisible();
  });

  // Formulaire KYC
  await test.step('Formulaire KYC - Étape 1/5', async () => {
    await page.getByRole('radio', { name: 'Madame' }).check();

    await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Curie');
    await page.getByRole('textbox', { name: 'Prénom' }).fill('Marie');
    await page.getByRole('textbox', { name: 'Nom de naissance' }).fill('Skłodowska');

    const date_de_naissance = page.getByRole('textbox', { name: 'Date de naissance' });
    await date_de_naissance.fill('04/07/1934');
    await expect(date_de_naissance).toHaveValue('04/07/1934');
    await page.getByRole('textbox', { name: 'Lieu de naissance' }).fill('Pologne');

    const nationalite = page.getByRole('combobox', { name: 'Nationalité' });
    await nationalite.fill('France');
    await nationalite.press('Enter');
    await expect(nationalite).toHaveValue('France');

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Étape 2/5')).toBeVisible();
  });

  await test.step('Formulaire KYC - Étape 2/5', async () => {
    await page
      .getByRole('combobox', { name: 'Adresse postale' })
      .fill('1 rue Pierre et Marie Curie');
    await page.getByRole('textbox', { name: 'Code postal' }).fill('75005');
    await page.getByRole('combobox', { name: 'Ville' }).fill('Paris');
    await page.getByRole('textbox', { name: 'Téléphone', exact: true }).fill('0612345678');

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Étape 3/5')).toBeVisible();
  });

  await test.step('Formulaire KYC - Étape 3/5', async () => {
    await page.getByRole('combobox', { name: 'Situation familiale' }).selectOption('Marié(e)');
    await page.getByRole('textbox', { name: 'Profession' }).fill('Chercheuse');
    await page
      .getByRole('combobox', { name: 'Catégorie socio-professionnelle' })
      .selectOption('Cadre, profession intellectuelle supérieure');
    await page.getByRole('combobox', { name: 'Secteur d’activité' }).selectOption('Enseignement');

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Étape 4/5')).toBeVisible();
  });

  await test.step('Formulaire KYC - Étape 4/5', async () => {
    await page.getByRole('checkbox', { name: 'Épargne issue de mes revenus' }).check();

    const ppe = page.getByRole('group', { name: 'personne politiquement exposée' });
    await ppe.getByRole('radio', { name: 'Non' }).check();

    await page.getByRole('radio', { name: 'France' }).check();

    const usPerson = page.getByRole('group', { name: 'US Person' });
    await usPerson.getByRole('radio', { name: 'Non' }).check();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByText('Étape 5/5')).toBeVisible();
  });

  await test.step('Formulaire KYC - Étape 5/5', async () => {
    // Faux PDF : le backend reconnaît un PDF à son début, « %PDF- »
    const pdf = (nom: string) => ({
      name: nom,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fichier de test'),
    });

    // Envoi terminé quand le bouton « Remplacer » apparaît (pendant l'envoi, le nom du
    // fichier est déjà affiché, avec la barre de progression)
    await page.getByLabel('Pièce d’identité').setInputFiles(pdf('identite.pdf'));
    await expect(page.getByRole('button', { name: 'Remplacer : Pièce d’identité' })).toBeVisible();

    await page.getByLabel('Justificatif de domicile').setInputFiles(pdf('domicile.pdf'));
    await expect(
      page.getByRole('button', { name: 'Remplacer : Justificatif de domicile' }),
    ).toBeVisible();

    await page.getByLabel('RIB').setInputFiles(pdf('rib.pdf'));
    await expect(page.getByRole('button', { name: 'Remplacer : RIB' })).toBeVisible();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('heading', { name: 'Récapitulatif' })).toBeVisible();
  });

  await test.step('Formulaire KYC - Récapitulatif', async () => {
    await page.getByRole('button', { name: 'Valider' }).click();

    await expect(page).toHaveURL('/formulaire-investisseur');
    await expect(page.getByRole('group', { name: 'Revenus annuels nets du foyer' })).toBeVisible();
  });

  await test.step('Formulaire investisseur - Étape 1/5', async () => {
    await page.getByRole('radio', { name: '60 à 100 k€' }).check();
    await page.getByRole('radio', { name: '150 à 500 k€' }).check();
    await page.getByRole('radio', { name: 'Moins de 20 %' }).check();
    await page.getByRole('textbox', { name: 'Épargne disponible à investir' }).fill('50000');

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(
      page.getByRole('group', { name: 'Avez-vous déjà investi en SCPI ?' }),
    ).toBeVisible();
  });

  await test.step('Formulaire investisseur - Étape 2/5', async () => {
    // Vrai / Faux reviennent à chaque question : on cherche le bouton dans sa question
    const revente = page.getByRole('group', { name: 'La revente des parts' });
    await revente.getByRole('radio', { name: 'Vrai' }).check();

    const capital = page.getByRole('group', { name: 'Le capital investi' });
    await capital.getByRole('radio', { name: 'Faux' }).check();

    const frais = page.getByRole('group', { name: 'Des frais de souscription' });
    await frais.getByRole('radio', { name: 'Vrai' }).check();

    const revenus = page.getByRole('group', { name: 'Les revenus versés' });
    await revenus.getByRole('radio', { name: 'Faux' }).check();

    await page.getByRole('checkbox', { name: 'Livrets' }).check();

    const dejaInvesti = page.getByRole('group', { name: 'Avez-vous déjà investi en SCPI ?' });
    await dejaInvesti.getByRole('radio', { name: 'Non' }).check();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('checkbox', { name: 'Revenus complémentaires' })).toBeVisible();
  });

  await test.step('Formulaire investisseur - Étape 3/5', async () => {
    await page.getByRole('checkbox', { name: 'Revenus complémentaires' }).check();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('group', { name: 'Horizon de placement' })).toBeVisible();
  });

  await test.step('Formulaire investisseur - Étape 4/5', async () => {
    await page.getByRole('radio', { name: '8 à 15 ans' }).check();
    await page.getByRole('radio', { name: 'Attendriez' }).check();
    await page.getByRole('radio', { name: '10 à 25 %' }).check();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('group', { name: 'critères ESG' })).toBeVisible();
  });

  await test.step('Formulaire investisseur - Étape 5/5', async () => {
    await page.getByRole('radio', { name: 'Sans préférence' }).check();

    await page.getByRole('button', { name: 'Suivant' }).click();
    await expect(page.getByRole('checkbox', { name: 'Je certifie l’exactitude' })).toBeVisible();
  });

  await test.step('Formulaire investisseur - Récapitulatif', async () => {
    const certification = page.getByRole('checkbox', { name: 'Je certifie l’exactitude' });
    await certification.check();
    await expect(certification).toBeChecked();

    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByRole('button', { name: 'Accéder au Catalogue' })).toBeVisible();
  });

  await test.step('Arrivée sur le catalogue', async () => {
    await page.getByRole('button', { name: 'Accéder au Catalogue' }).click();

    await expect(page).toHaveURL('/catalogue');
    await expect(page.getByRole('heading', { level: 1, name: 'Catalogue SCPI' })).toBeVisible();

    // Catalogue de test (e2e-tests/donnees/scpi_catalogue.csv) : exactement 3 SCPI,
    // du meilleur au plus faible taux de distribution
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Gamma Patrimoine',
      'Alpha Bureaux',
      'Bêta Santé',
    ]);
  });
});
