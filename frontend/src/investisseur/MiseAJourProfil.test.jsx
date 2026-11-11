import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import MiseAJourProfil from './MiseAJourProfil.jsx';

afterEach(cleanup);

// Réponses actuelles (profil validé) : celles qui pré-remplissent le formulaire
const REPONSES = {
  1: { revenus: '30-60k', patrimoine: '50-150k', charges: '<20', epargne: 15000 },
  2: {
    revente: 'vrai',
    capitalGaranti: 'faux',
    frais: 'vrai',
    revenusGarantis: 'faux',
    placements: ['livrets', 'actions'],
    dejaScpi: 'non',
  },
  3: { objectifs: ['revenus', 'retraite'] },
  4: { horizon: '8-15', reactionBaisse: 'attendre', perteAcceptee: '<10' },
  5: { esg: 'oui', isr: 'oui' },
};

const IDENTITE = () =>
  Promise.resolve({
    nomComplet: 'Marie Curie',
    email: 'm@x.fr',
    profil: 'equilibre',
    aMettreAJour: true,
  });

async function afficher({
  avancement = { etapeCourante: 6, reponses: REPONSES, valide: true },
  lire = vi.fn().mockResolvedValue(avancement),
  calculer = vi.fn().mockResolvedValue({ profil: 'prudent', avertissements: ['horizon'] }),
  valider = vi.fn().mockResolvedValue({ profil: 'prudent', avertissements: ['horizon'] }),
  allerA = vi.fn(),
  seDeconnecter = vi.fn().mockResolvedValue(undefined),
} = {}) {
  await act(async () => {
    render(
      <MiseAJourProfil
        lire={lire}
        calculer={calculer}
        valider={valider}
        allerA={allerA}
        seDeconnecter={seDeconnecter}
        chargerIdentite={IDENTITE}
      />,
    );
  });
  return { lire, calculer, valider, allerA, seDeconnecter };
}

const texte = () => document.body.textContent;

async function cliquer(nom) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nom }));
  });
}

async function allerALaFin() {
  for (let i = 0; i < 5; i += 1) await cliquer('Suivant');
}

describe('Mise à jour du profil investisseur (US-05d)', () => {
  it('scénario 1 : formulaire à l’étape 1, pré-rempli avec les réponses actuelles', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Mettre à jour mon profil investisseur',
    );
    expect(texte()).toContain('Étape 1/5 — Situation financière');
    expect(screen.getByRole('radio', { name: '30 à 60 k€' }).checked).toBe(true);
    expect(screen.getByLabelText('Épargne disponible à investir').value).toBe('15000');
    expect(texte()).toContain('Votre profil actuel reste actif');
    // Pas de bandeau de rappel sur l'écran de la mise à jour elle-même
    expect(screen.queryByRole('complementary', { name: 'Rappel' })).toBeNull();
  });

  it('mêmes règles de saisie : réponse manquante -> message, on reste sur l’étape', async () => {
    await afficher();
    fireEvent.change(screen.getByLabelText('Épargne disponible à investir'), {
      target: { value: '' },
    });
    await cliquer('Suivant');
    expect(texte()).toContain('Merci de saisir un montant en euros supérieur à 0.');
    expect(texte()).toContain('Étape 1/5');
  });

  it('navigation : Suivant / Précédent sans rien enregistrer, réponses gardées', async () => {
    const { calculer, valider } = await afficher();
    fireEvent.click(screen.getByRole('radio', { name: 'Plus de 200 k€' }));
    await cliquer('Suivant');
    expect(texte()).toContain('Étape 2/5');
    await cliquer('Précédent');
    expect(screen.getByRole('radio', { name: 'Plus de 200 k€' }).checked).toBe(true);
    expect(calculer).not.toHaveBeenCalled();
    expect(valider).not.toHaveBeenCalled();
  });

  it('scénario 2 : nouveau profil calculé puis validé, retour à la page Profil', async () => {
    const { calculer, valider, allerA } = await afficher();
    fireEvent.click(screen.getByRole('radio', { name: 'Plus de 200 k€' }));
    await allerALaFin();
    const envoyees = { ...REPONSES, 1: { ...REPONSES[1], revenus: '>200k' } };
    expect(calculer).toHaveBeenCalledWith(envoyees);
    expect(texte()).toContain('Votre nouveau profil investisseur');
    expect(texte()).toContain('Prudent');
    expect(texte()).toContain('La durée de placement recommandée');

    const bouton = screen.getByRole('button', { name: 'Valider' });
    expect(bouton.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Je certifie/ }));
    await cliquer('Valider');
    expect(valider).toHaveBeenCalledWith(envoyees);
    expect(allerA).toHaveBeenCalledWith('/profil');
  });

  it('« Modifier mes réponses » : retour à l’étape 1, réponses conservées', async () => {
    await afficher();
    await allerALaFin();
    await cliquer('Modifier mes réponses');
    expect(texte()).toContain('Étape 1/5');
    expect(screen.getByRole('radio', { name: '30 à 60 k€' }).checked).toBe(true);
  });

  it('échec de la validation : message, on reste sur le nouveau profil', async () => {
    const valider = vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible'));
    const { allerA } = await afficher({ valider });
    await allerALaFin();
    fireEvent.click(screen.getByRole('checkbox', { name: /Je certifie/ }));
    await cliquer('Valider');
    expect(screen.getByRole('alert').textContent).not.toBe('');
    expect(allerA).not.toHaveBeenCalledWith('/profil');
  });

  it('scénario 3 : abandon -> page Profil, rien n’est envoyé', async () => {
    const { calculer, valider, allerA } = await afficher();
    await cliquer('Suivant');
    await cliquer('Abandonner la mise à jour');
    expect(allerA).toHaveBeenCalledWith('/profil');
    expect(calculer).not.toHaveBeenCalled();
    expect(valider).not.toHaveBeenCalled();
  });

  it('scénario 4 : application accessible (sidebar affichée pendant la mise à jour)', async () => {
    await afficher();
    expect(screen.getByRole('link', { name: 'Mon profil : Marie Curie' })).toBeDefined();
  });

  it('profil pas encore validé : redirigé vers le premier questionnaire', async () => {
    const { allerA } = await afficher({
      avancement: { etapeCourante: 2, reponses: {}, valide: false },
    });
    expect(allerA).toHaveBeenCalledWith('/formulaire-investisseur');
  });

  it('session expirée : connexion ; autre erreur : message', async () => {
    const { allerA } = await afficher({
      lire: vi.fn().mockRejectedValue(new ErreurApi(401, 'Session expirée')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
    cleanup();
    await afficher({ lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Service indisponible')) });
    expect(screen.getByRole('alert').textContent).toBe('Service indisponible');
  });

  it('se déconnecter : déconnexion puis accueil', async () => {
    const { seDeconnecter, allerA } = await afficher();
    await cliquer('Se déconnecter');
    await cliquer('Oui');
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
