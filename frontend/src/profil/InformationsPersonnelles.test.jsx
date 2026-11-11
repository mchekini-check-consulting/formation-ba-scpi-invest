import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Profil from './Profil.jsx';

afterEach(cleanup);

const IDENTITE = () =>
  Promise.resolve({ nomComplet: 'Marie Curie', email: 'm@x.fr', profil: null });

const REPONSES = {
  civilite: 'Madame',
  nom: 'Curie',
  prenom: 'Marie',
  dateNaissance: '1980-01-15',
  lieuNaissance: 'Varsovie, Pologne',
  nationalite: 'Française',
  pays: 'France',
  adresse: '8 rue des Lilas',
  codePostal: '69003',
  ville: 'Lyon',
  telephone: '0612345678',
  indicatif: 'France',
  situationFamiliale: 'Marié(e)',
  profession: 'Chercheuse',
  categorie: 'Cadre, profession intellectuelle supérieure',
  secteur: 'Enseignement',
  origineFonds: ['Épargne issue de mes revenus'],
  ppe: 'Non',
  residenceFiscale: 'France',
  usPerson: 'Non',
};

const INFORMATIONS = {
  email: 'm@x.fr',
  reponses: REPONSES,
  historique: [
    {
      bloc: 'adresse',
      champ: 'ville',
      ancienneValeur: 'Paris',
      nouvelleValeur: 'Lyon',
      modifieLe: '2026-11-11T09:42:00.000Z',
    },
  ],
};

const DONNEES = {
  utilisateur: { email: 'm@x.fr' },
  kyc: { statut: 'complete', valideLe: '2026-11-02T10:00:00.000Z', reponses: REPONSES },
  pieces: [
    { type: 'identite', nomFichier: 'cni.pdf', statut: 'validee', deposeLe: '2026-11-02' },
    { type: 'domicile', nomFichier: 'edf.pdf', statut: 'validee', deposeLe: '2026-11-02' },
    { type: 'rib', nomFichier: 'rib.pdf', statut: 'validee', deposeLe: '2026-11-02' },
  ],
  profil: null,
  informations: INFORMATIONS,
};

// Relecture après un enregistrement : en attente, l'affichage déjà à jour reste visible
const chargerUneFois = () =>
  vi
    .fn()
    .mockResolvedValueOnce(DONNEES)
    .mockImplementation(() => new Promise(() => {}));

const PDF = new File(['%PDF-1.7'], 'quittance.pdf', { type: 'application/pdf' });

async function afficher(proprietes = {}) {
  const props = {
    charger: vi.fn().mockResolvedValue(DONNEES),
    allerA: vi.fn(),
    seDeconnecter: vi.fn().mockResolvedValue(undefined),
    chargerIdentite: IDENTITE,
    enregistrer: vi.fn(async (bloc, demande) => ({
      ...INFORMATIONS,
      email: demande.email?.toLowerCase() ?? INFORMATIONS.email,
      reponses: { ...REPONSES, ...demande },
    })),
    deposer: vi.fn().mockResolvedValue({ id: 5, nomFichier: 'quittance.pdf' }),
    chercherAdresses: vi.fn().mockResolvedValue([]),
    ...proprietes,
  };
  await act(async () => {
    render(<Profil {...props} />);
  });
  return props;
}

const bloc = (nom) => screen.getByRole('region', { name: nom });
const modifier = (titre) => screen.getByRole('button', { name: `Modifier : ${titre}` });

async function cliquer(element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

function choisirFichier(libelle, fichier) {
  fireEvent.change(screen.getByLabelText(libelle), { target: { files: [fichier] } });
}

describe('Mon profil : mettre à jour mes informations (US-06)', () => {
  it('scénario 1 : blocs avec « Modifier », RIB bientôt modifiable, historique', async () => {
    await afficher();
    for (const titre of [
      'Coordonnées',
      'Adresse',
      'Situation professionnelle et familiale',
      'Pièce d’identité',
    ]) {
      expect(modifier(titre).disabled).toBe(false);
    }
    expect(within(bloc('Coordonnées')).getByText('m@x.fr')).toBeTruthy();
    expect(within(bloc('Adresse')).getByText('Lyon')).toBeTruthy();
    const rib = bloc('Coordonnées bancaires (RIB)');
    expect(within(rib).getByText('Bientôt modifiable')).toBeTruthy();
    expect(within(rib).queryByRole('button')).toBeNull();
    expect(within(bloc('Pièce d’identité')).getByText('cni.pdf')).toBeTruthy();
    const historique = bloc('Historique des modifications');
    expect(historique.textContent).toContain('11/11/2026 10:42');
    expect(historique.textContent).toContain('Ville : Paris → Lyon');
    // Identité et déclarations restent en lecture seule
    expect(screen.getByRole('region', { name: 'Identité' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Déclarations réglementaires' })).toBeTruthy();
  });

  it('informations indisponibles : blocs en lecture seule, sans historique', async () => {
    await afficher({ charger: vi.fn().mockResolvedValue({ ...DONNEES, informations: null }) });
    expect(screen.queryByRole('button', { name: /^Modifier/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Historique des modifications' })).toBeNull();
  });

  it('un bloc à la fois : les autres « Modifier » sont grisés ; Annuler referme', async () => {
    await afficher();
    await cliquer(modifier('Adresse'));
    expect(bloc('Adresse — modification')).toBeTruthy();
    expect(modifier('Coordonnées').disabled).toBe(true);
    await cliquer(screen.getByRole('button', { name: 'Annuler' }));
    expect(modifier('Coordonnées').disabled).toBe(false);
  });

  it('scénarios 4, 5, 11 : adresse avec justificatif obligatoire', async () => {
    const { enregistrer, deposer, charger } = await afficher({ charger: chargerUneFois() });
    await cliquer(modifier('Adresse'));
    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Paris' } });
    fireEvent.change(screen.getByLabelText(/Code postal/), { target: { value: '75019' } });

    // Sans justificatif : message, rien d'enregistré
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(bloc('Adresse — modification').textContent).toContain(
      'Cette pièce est obligatoire : déposez un fichier.',
    );
    // Mauvais format : message
    choisirFichier(/Justificatif de domicile/, new File(['x'], 'photo.gif', { type: 'image/gif' }));
    expect(bloc('Adresse — modification').textContent).toContain(
      'Format non accepté ou fichier trop volumineux (PDF, JPG ou PNG, 10 Mo maximum)',
    );
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(deposer).not.toHaveBeenCalled();
    expect(enregistrer).not.toHaveBeenCalled();

    // Avec un justificatif valide : appliquée, message de confirmation
    choisirFichier(/Justificatif de domicile/, PDF);
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(deposer).toHaveBeenCalledWith(PDF);
    expect(enregistrer).toHaveBeenCalledWith('adresse', {
      pays: 'France',
      adresse: '8 rue des Lilas',
      codePostal: '75019',
      ville: 'Paris',
      justificatif: 5,
    });
    const apres = bloc('Adresse');
    expect(within(apres).getByText('✓ Mise à jour')).toBeTruthy();
    expect(apres.textContent).toContain('Votre justificatif sera contrôlé par nos équipes.');
    expect(within(apres).getByText('Paris')).toBeTruthy();
    // Données relues (statut des pièces)
    expect(charger).toHaveBeenCalledTimes(2);
  });

  it('scénario 6 : situation déclarative, invitation à mettre à jour le profil investisseur', async () => {
    const { enregistrer, deposer } = await afficher();
    await cliquer(modifier('Situation professionnelle et familiale'));
    expect(screen.queryByLabelText(/état civil/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Situation familiale'), {
      target: { value: 'Célibataire' },
    });
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(deposer).not.toHaveBeenCalled();
    expect(enregistrer).toHaveBeenCalledWith('situation', {
      nom: 'Curie',
      situationFamiliale: 'Célibataire',
      profession: 'Chercheuse',
      categorie: 'Cadre, profession intellectuelle supérieure',
      secteur: 'Enseignement',
    });
    const lien = screen.getByRole('link', { name: 'Mettre à jour mon profil investisseur' });
    expect(lien.getAttribute('href')).toBe('/profil-investisseur/mise-a-jour');
  });

  it('scénario 7 : changement de nom -> pièce d’état civil obligatoire', async () => {
    const { enregistrer, deposer } = await afficher();
    await cliquer(modifier('Situation professionnelle et familiale'));
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Durand' } });
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Cette pièce est obligatoire : déposez un fichier.')).toBeTruthy();
    expect(enregistrer).not.toHaveBeenCalled();
    choisirFichier(/état civil/, PDF);
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(deposer).toHaveBeenCalledWith(PDF);
    expect(enregistrer.mock.calls[0][1]).toMatchObject({ nom: 'Durand', justificatif: 5 });
  });

  it('coordonnées : mot de passe exigé, nouvel e-mail affiché', async () => {
    const { enregistrer } = await afficher({ charger: chargerUneFois() });
    await cliquer(modifier('Coordonnées'));
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'marie.durand@exemple.fr' },
    });
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Merci de saisir votre mot de passe.')).toBeTruthy();
    expect(enregistrer).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Mot de passe de votre compte'), {
      target: { value: 'Tr0pBien!Choisi' },
    });
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(enregistrer).toHaveBeenCalledWith('coordonnees', {
      telephone: '0612345678',
      email: 'marie.durand@exemple.fr',
      indicatif: 'France',
      motDePasse: 'Tr0pBien!Choisi',
    });
    expect(within(bloc('Coordonnées')).getByText('marie.durand@exemple.fr')).toBeTruthy();
  });

  it('coordonnées : e-mail invalide signalé', async () => {
    await afficher();
    await cliquer(modifier('Coordonnées'));
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: 'marie' } });
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Merci de saisir une adresse e-mail valide.')).toBeTruthy();
  });

  it('mot de passe faux : tentatives restantes, annulation au 3e essai', async () => {
    const enregistrer = vi.fn().mockRejectedValue(new ErreurApi(403, 'Mot de passe incorrect.'));
    await afficher({ enregistrer });
    await cliquer(modifier('Coordonnées'));
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'autre@exemple.fr' },
    });
    for (const reste of [2, 1]) {
      fireEvent.change(screen.getByLabelText('Mot de passe de votre compte'), {
        target: { value: 'faux' },
      });
      await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
      expect(
        screen.getByText(`Mot de passe incorrect. Il vous reste ${reste} tentative(s).`),
      ).toBeTruthy();
    }
    fireEvent.change(screen.getByLabelText('Mot de passe de votre compte'), {
      target: { value: 'faux' },
    });
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText(/Modification annulée : mot de passe incorrect 3 fois/)).toBeTruthy();
    expect(within(bloc('Coordonnées')).getByText('m@x.fr')).toBeTruthy();
  });

  it('erreur du backend : son message (400, 409) ou un message général', async () => {
    const enregistrer = vi
      .fn()
      .mockRejectedValueOnce(new ErreurApi(409, 'Cette adresse e-mail est déjà utilisée.'))
      .mockRejectedValueOnce(new ErreurApi(500, 'panne'));
    await afficher({ enregistrer });
    await cliquer(modifier('Coordonnées'));
    fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
      target: { value: 'pris@exemple.fr' },
    });
    fireEvent.change(screen.getByLabelText('Mot de passe de votre compte'), {
      target: { value: 'secret' },
    });
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Cette adresse e-mail est déjà utilisée.')).toBeTruthy();
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(
      screen.getByText('Vos modifications n’ont pas pu être enregistrées. Veuillez réessayer.'),
    ).toBeTruthy();
  });

  it('pièce d’identité : recto seul (verso facultatif, comme au KYC)', async () => {
    const { enregistrer, deposer } = await afficher();
    await cliquer(modifier('Pièce d’identité'));
    choisirFichier('Recto', PDF);
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(deposer).toHaveBeenCalledTimes(1);
    expect(enregistrer).toHaveBeenCalledWith('identite', { recto: 5 });
  });

  it('pièce d’identité : recto obligatoire ; recto et verso déposés puis enregistrés', async () => {
    const deposer = vi
      .fn()
      .mockResolvedValueOnce({ id: 11, nomFichier: 'recto.pdf' })
      .mockResolvedValueOnce({ id: 12, nomFichier: 'verso.pdf' });
    const { enregistrer } = await afficher({ deposer });
    await cliquer(modifier('Pièce d’identité'));
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getAllByText('Cette pièce est obligatoire : déposez un fichier.')).toHaveLength(
      1,
    );
    choisirFichier('Recto', PDF);
    choisirFichier(/Verso/, PDF);
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(deposer).toHaveBeenCalledTimes(2);
    expect(enregistrer).toHaveBeenCalledWith('identite', { recto: 11, verso: 12 });
    expect(bloc('Pièce d’identité').textContent).toContain('sera contrôlée par nos équipes');
  });

  it('pièce d’identité : fichier refusé ou échec d’envoi signalés', async () => {
    const deposer = vi.fn().mockRejectedValue(new ErreurApi(400, 'Formats acceptés : PDF.'));
    await afficher({ deposer });
    await cliquer(modifier('Pièce d’identité'));
    choisirFichier('Recto', new File([''], 'vide.pdf', { type: 'application/pdf' }));
    expect(bloc('Pièce d’identité — modification').textContent).toContain('10 Mo maximum');
    choisirFichier('Recto', PDF);
    choisirFichier(/Verso/, new File(['x'], 'verso.gif', { type: 'image/gif' }));
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(deposer).not.toHaveBeenCalled();
    choisirFichier(/Verso/, PDF);
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Formats acceptés : PDF.')).toBeTruthy();
    await cliquer(screen.getByRole('button', { name: 'Annuler' }));
    expect(modifier('Pièce d’identité').disabled).toBe(false);
  });
});
