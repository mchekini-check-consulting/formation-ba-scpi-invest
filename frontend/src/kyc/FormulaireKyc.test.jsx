import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FormulaireKyc, { MESSAGE_ENREGISTREMENT, MESSAGE_VALIDATION } from './FormulaireKyc.jsx';
import { MESSAGE_RESIDENCE, MESSAGE_US_PERSON } from './etapes.js';

afterEach(cleanup);

const AUJOURDHUI = new Date(2026, 10, 4);

function afficher(props = {}) {
  const enregistrer = props.enregistrer ?? vi.fn().mockResolvedValue({});
  const valider = props.valider ?? vi.fn().mockResolvedValue({});
  const apresValidation = vi.fn();
  render(
    <FormulaireKyc
      email="jean@exemple.fr"
      aujourdhui={AUJOURDHUI}
      {...props}
      enregistrer={enregistrer}
      valider={valider}
      apresValidation={apresValidation}
    />,
  );
  return { enregistrer, valider, apresValidation };
}

const saisir = (libelle, valeur) =>
  fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
const cocher = (libelle) => fireEvent.click(screen.getByLabelText(libelle));
const cliquer = async (nom) => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: nom })));
};
const titreEtape = () => screen.getByRole('heading', { level: 2 }).textContent;
const progression = () => Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
const choisir = (nom, valeur) =>
  fireEvent.click(document.querySelector(`input[name="${nom}"][value="${valeur}"]`));

const IDENTITE = {
  civilite: 'Madame',
  nom: 'Martin',
  prenom: 'Claire',
  dateNaissance: '1980-01-15',
  lieuNaissance: 'Lyon, France',
  nationalite: 'France',
};
const COMPLET = {
  ...IDENTITE,
  adresse: '12 rue des Lilas',
  codePostal: '69003',
  ville: 'Lyon',
  pays: 'France',
  telephone: '06 12 34 56 78',
  situationFamiliale: 'Marié(e)',
  profession: 'Ingénieure',
  categorie: 'Cadre, profession intellectuelle supérieure',
  secteur: 'Industrie',
  origineFonds: ['Épargne issue de mes revenus', 'Donation'],
  ppe: 'Non',
  residenceFiscale: 'France',
  usPerson: 'Non',
};

const piece = (type, nomFichier) => ({
  type,
  nomFichier,
  format: 'application/pdf',
  taille: 1000,
  statut: 'deposee',
  deposeLe: '2026-11-05T10:00:00.000Z',
});
// Pièces obligatoires pour COMPLET (France, non PPE, donation déclarée)
const PIECES = [
  piece('identite', 'cni.pdf'),
  piece('domicile', 'facture.pdf'),
  piece('rib', 'rib.pdf'),
  piece('origine_fonds', 'donation.pdf'),
];

function remplirIdentite() {
  cocher('Madame');
  saisir('Nom', 'Martin');
  saisir('Prénom', 'Claire');
  saisir('Date de naissance', '15/01/1980');
  saisir('Lieu de naissance', 'Lyon, France');
  saisir('Nationalité', 'fran');
  fireEvent.click(screen.getByRole('option', { name: 'France' }));
}

describe('Formulaire KYC en 4 étapes (US-04a)', () => {
  it('commence à l’étape 1 « Identité », barre de progression à 1/5', () => {
    afficher();
    expect(titreEtape()).toBe('Identité');
    expect(screen.getByText('Étape 1/5')).toBeDefined();
    expect(progression()).toBe(1);
    expect(screen.queryByRole('button', { name: 'Précédent' })).toBeNull();
  });

  it('scénario 2 : étape remplie, « Suivant » affiche l’étape suivante et la barre avance', async () => {
    afficher();
    remplirIdentite();
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Coordonnées');
    expect(screen.getByText('Étape 2/5')).toBeDefined();
    expect(progression()).toBe(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('scénario 3 : champ obligatoire manquant signalé en rouge avec un message, on reste sur l’étape', async () => {
    const { enregistrer } = afficher();
    remplirIdentite();
    saisir('Prénom', '');
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Identité');
    expect(progression()).toBe(1);
    expect(enregistrer).not.toHaveBeenCalled();
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

  it('scénario 3 : choix non fait (civilité) signalé, autres erreurs comptées', async () => {
    afficher();
    await cliquer('Suivant');
    expect(document.getElementById('kyc-civilite-erreur').textContent).toBe(
      'Ce champ est obligatoire.',
    );
    expect(screen.getByLabelText('Madame').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('6 champs sont à compléter');
    // nom de naissance facultatif : jamais signalé
    expect(document.getElementById('kyc-nomNaissance-erreur')).toBeNull();
  });

  it('refuse un utilisateur mineur', async () => {
    afficher();
    remplirIdentite();
    saisir('Date de naissance', '01/05/2010');
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Identité');
    expect(document.getElementById('kyc-dateNaissance-erreur').textContent).toBe(
      'Vous devez être majeur pour ouvrir un compte.',
    );
  });

  it('étape 2 : email du compte prérempli et non modifiable', async () => {
    afficher();
    remplirIdentite();
    await cliquer('Suivant');
    const email = screen.getByLabelText('Adresse e-mail');
    expect(email.value).toBe('jean@exemple.fr');
    expect(email.readOnly).toBe(true);
  });

  it('scénario 4 : « Précédent » revient à l’étape précédente avec les réponses conservées', async () => {
    afficher();
    remplirIdentite();
    await cliquer('Suivant');
    saisir('Ville', 'Lyon');
    await cliquer('Précédent');
    expect(titreEtape()).toBe('Identité');
    expect(progression()).toBe(1);
    expect(screen.getByLabelText('Nom').value).toBe('Martin');
    expect(screen.getByLabelText('Madame').checked).toBe(true);
    expect(screen.getByLabelText('Date de naissance').value).toBe('15/01/1980');
    await cliquer('Suivant');
    expect(screen.getByLabelText('Ville').value).toBe('Lyon');
  });

  it('étape 4 : résidence fiscale hors de France refusée, on reste sur l’étape', async () => {
    const { enregistrer } = afficher({ etapeInitiale: 4, reponsesInitiales: COMPLET });
    expect(titreEtape()).toBe('Déclarations réglementaires');
    cocher('Autre pays');
    expect(screen.queryByLabelText('Pays de résidence fiscale')).toBeNull();
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Déclarations réglementaires');
    expect(enregistrer).not.toHaveBeenCalled();
    expect(document.getElementById('kyc-residenceFiscale-erreur').textContent).toBe(
      MESSAGE_RESIDENCE,
    );
    // résidence fiscale en France : le message disparaît
    cocher('France');
    expect(document.getElementById('kyc-residenceFiscale-erreur')).toBeNull();
    // choix multiple : cocher puis décocher
    cocher('Gains au jeu');
    cocher('Gains au jeu');
    expect(screen.getByLabelText('Gains au jeu').checked).toBe(false);
  });

  it('étape 4 : US Person refusée même résidente en France, on reste sur l’étape', async () => {
    const { enregistrer } = afficher({ etapeInitiale: 4, reponsesInitiales: COMPLET });
    choisir('usPerson', 'Oui');
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Déclarations réglementaires');
    expect(enregistrer).not.toHaveBeenCalled();
    expect(document.getElementById('kyc-usPerson-erreur').textContent).toBe(MESSAGE_US_PERSON);
    // « Non » : le message disparaît
    choisir('usPerson', 'Non');
    expect(document.getElementById('kyc-usPerson-erreur')).toBeNull();
  });
});

describe('Enregistrement à chaque étape (US-04b)', () => {
  it('« Suivant » enregistre l’étape atteinte et les réponses, sans l’email', async () => {
    const { enregistrer } = afficher();
    remplirIdentite();
    await cliquer('Suivant');
    expect(enregistrer).toHaveBeenCalledWith(2, { ...IDENTITE, pays: 'France' });
  });

  it('scénario 1 : reprise à l’étape atteinte avec les réponses déjà saisies', () => {
    afficher({ etapeInitiale: 3, reponsesInitiales: IDENTITE });
    expect(titreEtape()).toBe('Situation personnelle et professionnelle');
    expect(screen.getByText('Étape 3/5')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(screen.getByLabelText('Nom').value).toBe('Martin');
  });

  it('échec de l’enregistrement : message, on reste sur l’étape avec ses saisies', async () => {
    afficher({ enregistrer: vi.fn().mockRejectedValue(new Error('panne')) });
    remplirIdentite();
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Identité');
    expect(screen.getByRole('alert').textContent).toBe(MESSAGE_ENREGISTREMENT);
    expect(screen.getByLabelText('Nom').value).toBe('Martin');
    expect(screen.getByRole('button', { name: 'Suivant' }).disabled).toBe(false);
  });

  it('ancien pays de résidence fiscale : jamais enregistré', async () => {
    const { enregistrer } = afficher({
      etapeInitiale: 4,
      reponsesInitiales: {
        ...COMPLET,
        residenceFiscale: 'Autre pays',
        paysResidenceFiscale: 'Belgique',
      },
    });
    choisir('residenceFiscale', 'France');
    await cliquer('Suivant');
    expect(enregistrer.mock.calls[0][0]).toBe(5);
    expect(enregistrer.mock.calls[0][1]).not.toHaveProperty('paysResidenceFiscale');
  });
});

describe('Récapitulatif et validation (US-04b, scénario 3)', () => {
  it('après l’étape 5 : récapitulatif des 5 étapes avec les réponses et les pièces', async () => {
    afficher({ etapeInitiale: 5, reponsesInitiales: COMPLET, piecesInitiales: PIECES });
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Récapitulatif');
    expect(screen.getByText('Récapitulatif', { selector: 'p' })).toBeDefined();
    expect(progression()).toBe(5);
    const etapes = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(etapes).toEqual([
      '1. Identité',
      '2. Coordonnées',
      '3. Situation personnelle et professionnelle',
      '4. Déclarations réglementaires',
      '5. Pièces justificatives',
    ]);
    const texte = document.body.textContent;
    expect(texte).toContain('donation.pdf');
    expect(texte).toContain('Non fourni'); // verso de la carte, facultatif
    expect(texte).toContain('15/01/1980');
    expect(texte).toContain('Épargne issue de mes revenus, Donation');
    expect(texte).toContain('jean@exemple.fr');
    expect(texte).toContain('Non renseigné'); // nom de naissance facultatif
  });

  it('« Modifier » ramène à l’étape choisie avec les réponses', async () => {
    afficher({ etapeInitiale: 6, reponsesInitiales: COMPLET });
    await cliquer('Modifier l’étape Coordonnées');
    expect(titreEtape()).toBe('Coordonnées');
    expect(screen.getByLabelText('Ville').value).toBe('Lyon');
  });

  it('« Précédent » ramène à l’étape 5, avec les pièces déposées', async () => {
    afficher({ etapeInitiale: 6, reponsesInitiales: COMPLET, piecesInitiales: PIECES });
    await cliquer('Précédent');
    expect(titreEtape()).toBe('Pièces justificatives');
    expect(screen.getByText('rib.pdf')).toBeDefined();
  });

  it('« Valider » : KYC validé, puis direction l’écran suivant', async () => {
    const { valider, apresValidation } = afficher({
      etapeInitiale: 6,
      reponsesInitiales: COMPLET,
    });
    await cliquer('Valider');
    expect(valider).toHaveBeenCalledOnce();
    expect(apresValidation).toHaveBeenCalledOnce();
  });

  it('échec de la validation : message, on reste sur le récapitulatif', async () => {
    const { apresValidation } = afficher({
      etapeInitiale: 6,
      reponsesInitiales: COMPLET,
      valider: vi.fn().mockRejectedValue(new Error('panne')),
    });
    await cliquer('Valider');
    expect(screen.getByRole('alert').textContent).toBe(MESSAGE_VALIDATION);
    expect(titreEtape()).toBe('Récapitulatif');
    expect(apresValidation).not.toHaveBeenCalled();
  });

  it('validation refusée par le backend (incomplet) : son message', async () => {
    const refus = Object.assign(new Error('Le formulaire KYC est incomplet'), { status: 400 });
    afficher({
      etapeInitiale: 6,
      reponsesInitiales: COMPLET,
      valider: vi.fn().mockRejectedValue(refus),
    });
    await cliquer('Valider');
    expect(screen.getByRole('alert').textContent).toBe('Le formulaire KYC est incomplet');
  });
});

describe('Coordonnées : pays, adresse avec suggestions, code postal et téléphone', () => {
  const LILAS = {
    libelle: '12 Rue des Lilas 69008 Lyon',
    adresse: '12 Rue des Lilas',
    codePostal: '69008',
    ville: 'Lyon',
  };

  it('pays en premier, toujours France et non modifiable (résidents en France)', () => {
    afficher({ etapeInitiale: 2, reponsesInitiales: { ...IDENTITE, pays: 'Belgique' } });
    const champs = [...document.querySelectorAll('.kyc__champs label')].map((l) => l.textContent);
    expect(champs[0]).toBe('Pays');
    const pays = screen.getByLabelText('Pays');
    expect(pays.value).toBe('France');
    expect(pays.readOnly).toBe(true);
  });

  it('France : une suggestion d’adresse remplit adresse, code postal et ville', async () => {
    const chercherAdresses = vi.fn().mockResolvedValue([LILAS]);
    afficher({ etapeInitiale: 2, reponsesInitiales: IDENTITE, chercherAdresses });
    saisir('Adresse postale', '12 rue des li');
    await act(async () => {
      await new Promise((fin) => setTimeout(fin, 300));
    });
    expect(chercherAdresses).toHaveBeenCalledWith('12 rue des li');
    fireEvent.click(screen.getByRole('option', { name: LILAS.libelle }));
    expect(screen.getByLabelText('Adresse postale').value).toBe('12 Rue des Lilas');
    expect(screen.getByLabelText('Code postal').value).toBe('69008');
    expect(screen.getByLabelText('Ville').value).toBe('Lyon');
  });

  it('code postal : chiffres seuls (France)', () => {
    afficher({ etapeInitiale: 2, reponsesInitiales: IDENTITE });
    saisir('Code postal', '69a0035');
    expect(screen.getByLabelText('Code postal').value).toBe('69003');
    expect(screen.getByLabelText('Code postal').getAttribute('inputmode')).toBe('numeric');
  });

  it('téléphone : indicatif +33 non modifiable, chiffres seuls', async () => {
    const { enregistrer } = afficher({ etapeInitiale: 2, reponsesInitiales: IDENTITE });
    const indicatif = screen.getByLabelText('Indicatif du téléphone');
    expect(indicatif.value).toBe('+33');
    expect(indicatif.readOnly).toBe(true);
    expect(screen.queryByRole('combobox', { name: /indicatif/i })).toBeNull();
    saisir('Téléphone', '06.12.34.ab56.78');
    expect(screen.getByLabelText('Téléphone').value).toBe('0612345678');
    saisir('Adresse postale', '12 rue des Lilas');
    saisir('Code postal', '69003');
    saisir('Ville', 'Lyon');
    // fixe belge à 8 chiffres : refusé (un numéro français a 9 chiffres après le 0)
    saisir('Téléphone', '02 123 45 67');
    await cliquer('Suivant');
    expect(document.getElementById('kyc-telephone-erreur').textContent).toContain(
      'Numéro de téléphone invalide',
    );
    saisir('Téléphone', '06 12 34 56 78');
    await cliquer('Suivant');
    expect(enregistrer).toHaveBeenCalledWith(3, {
      ...IDENTITE,
      pays: 'France',
      adresse: '12 rue des Lilas',
      codePostal: '69003',
      ville: 'Lyon',
      telephone: '06 12 34 56 78',
      indicatif: 'France',
    });
  });
});
