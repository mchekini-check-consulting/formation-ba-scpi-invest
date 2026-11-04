import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import FormulaireKyc from './FormulaireKyc.jsx';

afterEach(cleanup);

const AUJOURDHUI = new Date(2026, 10, 4);

function afficher() {
  return render(<FormulaireKyc email="jean@exemple.fr" aujourdhui={AUJOURDHUI} />);
}

const saisir = (libelle, valeur) =>
  fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
const cocher = (libelle) => fireEvent.click(screen.getByLabelText(libelle));
const cliquer = (nom) => fireEvent.click(screen.getByRole('button', { name: nom }));
const titreEtape = () => screen.getByRole('heading', { level: 2 }).textContent;
const progression = () => Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));

function remplirIdentite() {
  cocher('Madame');
  saisir('Nom', 'Martin');
  saisir('Prénom', 'Claire');
  saisir('Date de naissance', '1980-01-15');
  saisir('Lieu de naissance', 'Lyon, France');
  saisir('Nationalité', 'Française');
}

function remplirCoordonnees() {
  saisir('Adresse postale', '12 rue des Lilas');
  saisir('Code postal', '69003');
  saisir('Ville', 'Lyon');
  saisir('Pays', 'France');
  saisir('Téléphone', '06 12 34 56 78');
}

function remplirSituation() {
  saisir('Situation familiale', 'Marié(e)');
  saisir('Profession', 'Ingénieure');
  saisir('Catégorie socio-professionnelle', 'Cadre, profession intellectuelle supérieure');
  saisir('Secteur d’activité', 'Industrie');
}

describe('Formulaire KYC en 4 étapes (US-04a)', () => {
  it('commence à l’étape 1 « Identité », barre de progression à 1/4', () => {
    afficher();
    expect(titreEtape()).toBe('Identité');
    expect(screen.getByText('Étape 1/4')).toBeDefined();
    expect(progression()).toBe(1);
    expect(screen.queryByRole('button', { name: 'Précédent' })).toBeNull();
  });

  it('scénario 2 : étape remplie, « Suivant » affiche l’étape suivante et la barre avance', () => {
    afficher();
    remplirIdentite();
    cliquer('Suivant');
    expect(titreEtape()).toBe('Coordonnées');
    expect(screen.getByText('Étape 2/4')).toBeDefined();
    expect(progression()).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('scénario 3 : champ obligatoire manquant signalé en rouge avec un message, on reste sur l’étape', () => {
    afficher();
    remplirIdentite();
    saisir('Prénom', '');
    cliquer('Suivant');
    expect(titreEtape()).toBe('Identité');
    expect(progression()).toBe(1);
    const prenom = screen.getByLabelText('Prénom');
    expect(prenom.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('kyc-prenom-erreur').textContent).toBe(
      'Ce champ est obligatoire.',
    );
    expect(screen.getByRole('alert').textContent).toContain('Un champ est à compléter');
    expect(document.activeElement).toBe(prenom);
    // le message disparaît dès que le champ est corrigé
    saisir('Prénom', 'Claire');
    expect(document.getElementById('kyc-prenom-erreur')).toBeNull();
    expect(screen.getByLabelText('Prénom').getAttribute('aria-invalid')).toBeNull();
  });

  it('scénario 3 : choix non fait (civilité) signalé, autres erreurs comptées', () => {
    afficher();
    cliquer('Suivant');
    expect(document.getElementById('kyc-civilite-erreur').textContent).toBe(
      'Ce champ est obligatoire.',
    );
    expect(screen.getByLabelText('Madame').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('6 champs sont à compléter');
    // nom de naissance facultatif : jamais signalé
    expect(document.getElementById('kyc-nomNaissance-erreur')).toBeNull();
  });

  it('refuse un utilisateur mineur', () => {
    afficher();
    remplirIdentite();
    saisir('Date de naissance', '2010-05-01');
    cliquer('Suivant');
    expect(titreEtape()).toBe('Identité');
    expect(document.getElementById('kyc-dateNaissance-erreur').textContent).toBe(
      'Vous devez être majeur pour ouvrir un compte.',
    );
  });

  it('étape 2 : email du compte prérempli et non modifiable', () => {
    afficher();
    remplirIdentite();
    cliquer('Suivant');
    const email = screen.getByLabelText('Adresse e-mail');
    expect(email.value).toBe('jean@exemple.fr');
    expect(email.readOnly).toBe(true);
  });

  it('scénario 4 : « Précédent » revient à l’étape précédente avec les réponses conservées', () => {
    afficher();
    remplirIdentite();
    cliquer('Suivant');
    saisir('Ville', 'Lyon');
    cliquer('Précédent');
    expect(titreEtape()).toBe('Identité');
    expect(progression()).toBe(1);
    expect(screen.getByLabelText('Nom').value).toBe('Martin');
    expect(screen.getByLabelText('Madame').checked).toBe(true);
    expect(screen.getByLabelText('Date de naissance').value).toBe('1980-01-15');
    cliquer('Suivant');
    expect(screen.getByLabelText('Ville').value).toBe('Lyon');
  });

  it('parcours complet : les 4 étapes jusqu’à « Terminer », puis retour au formulaire', () => {
    afficher();
    remplirIdentite();
    cliquer('Suivant');
    remplirCoordonnees();
    cliquer('Suivant');
    expect(titreEtape()).toBe('Situation personnelle et professionnelle');
    remplirSituation();
    cliquer('Suivant');
    expect(titreEtape()).toBe('Déclarations réglementaires');
    expect(screen.getByText('Étape 4/4')).toBeDefined();

    // étape 4 : pays demandé seulement pour une résidence fiscale hors de France
    cocher('Épargne issue de mes revenus');
    cocher('Donation');
    cocher('Donation'); // décocher
    fireEvent.click(document.querySelector('input[name="ppe"][value="Non"]'));
    expect(screen.queryByLabelText('Pays de résidence fiscale')).toBeNull();
    cocher('Autre pays');
    cliquer('Terminer');
    expect(document.getElementById('kyc-paysResidenceFiscale-erreur').textContent).toBe(
      'Ce champ est obligatoire.',
    );
    expect(document.getElementById('kyc-usPerson-erreur')).not.toBeNull();
    saisir('Pays de résidence fiscale', 'Belgique');
    fireEvent.click(document.querySelector('input[name="usPerson"][value="Non"]'));
    cliquer('Terminer');

    expect(titreEtape()).toBe('Vos réponses sont complètes');
    cliquer('Revenir au formulaire');
    expect(titreEtape()).toBe('Déclarations réglementaires');
    expect(screen.getByLabelText('Épargne issue de mes revenus').checked).toBe(true);
    expect(screen.getByLabelText('Donation').checked).toBe(false);
    expect(screen.getByLabelText('Pays de résidence fiscale').value).toBe('Belgique');
  });
});
