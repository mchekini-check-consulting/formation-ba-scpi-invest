import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import FormulaireInvestisseur from './FormulaireInvestisseur.jsx';

afterEach(cleanup);

const ETAPE_1 = { revenus: '30-60k', patrimoine: '50-150k', charges: '<20', epargne: 15000 };

// Affiche le formulaire et attend la lecture de l'avancement
async function afficher({
  avancement = { etapeCourante: 1, reponses: {} },
  lire = vi.fn().mockResolvedValue(avancement),
  enregistrer = vi.fn().mockResolvedValue({}),
  effacer = vi.fn().mockResolvedValue({}),
  calculerProfil = vi.fn().mockResolvedValue({ profil: 'equilibre', avertissements: [] }),
  valider = vi.fn().mockResolvedValue({ profil: 'equilibre', avertissements: [] }),
  allerA = vi.fn(),
  seDeconnecter = vi.fn().mockResolvedValue(undefined),
} = {}) {
  await act(async () => {
    render(
      <FormulaireInvestisseur
        lire={lire}
        enregistrer={enregistrer}
        effacer={effacer}
        calculerProfil={calculerProfil}
        valider={valider}
        allerA={allerA}
        seDeconnecter={seDeconnecter}
      />,
    );
  });
  return { enregistrer, effacer, calculerProfil, valider, allerA, seDeconnecter };
}

const texte = () => document.body.textContent;
// Numéro de l'étape courante dans la progression (pastille aria-current="step")
const etapesProgression = () =>
  within(screen.getByRole('navigation', { name: 'Progression du formulaire' })).getAllByRole(
    'listitem',
  );
const progression = () =>
  String(etapesProgression().findIndex((li) => li.getAttribute('aria-current') === 'step') + 1);
const choisir = (nom) => fireEvent.click(screen.getByRole('radio', { name: nom }));
const cocher = (nom) => fireEvent.click(screen.getByRole('checkbox', { name: nom }));

async function cliquer(nom) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: nom }));
  });
}

function remplirEtape1(epargne = '15000') {
  choisir('30 à 60 k€');
  choisir('50 à 150 k€');
  choisir('Moins de 20 %');
  fireEvent.change(screen.getByLabelText('Épargne disponible à investir'), {
    target: { value: epargne },
  });
}

describe('FormulaireInvestisseur (US-05a)', () => {
  it('scénario 1 : s’affiche à l’étape 1, barre « Étape 1/5 »', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Formulaire investisseur');
    expect(document.title).toBe('SCPI Invest+ · Formulaire investisseur');
    expect(texte()).toContain('Étape 1/5 — Situation financière');
    expect(progression()).toBe('1');
    expect(screen.queryByRole('button', { name: 'Précédent' })).toBeNull();
  });

  it('progression : une pastille par étape, ✓ pour les faites, étape courante signalée', async () => {
    await afficher({ avancement: { etapeCourante: 3, reponses: {} } });
    const etapes = etapesProgression();

    expect(etapes.map((li) => li.textContent)).toEqual([
      '✓Situation financière (terminée)',
      '✓Connaissances et expérience (terminée)',
      '3Objectifs',
      '4Horizon et risque',
      '5Préférences de durabilité',
    ]);
    expect(etapes.map((li) => li.className.split('--')[1])).toEqual([
      'faite',
      'faite',
      'courante',
      'a-venir',
      'a-venir',
    ]);
    expect(etapes.filter((li) => li.getAttribute('aria-current') === 'step')).toHaveLength(1);
  });

  it('scénario 2 : « Suivant » enregistre, avance ; « Précédent » garde les réponses', async () => {
    const { enregistrer } = await afficher();
    remplirEtape1();
    await cliquer('Suivant');

    expect(enregistrer).toHaveBeenCalledWith(1, ETAPE_1);
    expect(texte()).toContain('Étape 2/5 — Connaissances et expérience');
    expect(progression()).toBe('2');

    await cliquer('Précédent');
    expect(texte()).toContain('Étape 1/5');
    expect(screen.getByRole('radio', { name: '30 à 60 k€' }).checked).toBe(true);
    expect(screen.getByLabelText('Épargne disponible à investir').value).toBe('15000');
  });

  it('scénario 3 : question sans réponse -> message sous la question, reste sur l’étape', async () => {
    const { enregistrer } = await afficher({ avancement: { etapeCourante: 4, reponses: {} } });
    choisir('Moins de 3 ans');
    await cliquer('Suivant');

    expect(screen.getAllByText('Merci de répondre à cette question.')).toHaveLength(2);
    expect(texte()).toContain('Étape 4/5');
    expect(enregistrer).not.toHaveBeenCalled();

    // le message disparaît dès que la question a une réponse
    choisir('Attendriez');
    expect(screen.getAllByText('Merci de répondre à cette question.')).toHaveLength(1);
  });

  it('scénario 4 : montant invalide -> message du montant, reste à l’étape 1', async () => {
    const { enregistrer } = await afficher();
    remplirEtape1('0');
    await cliquer('Suivant');
    expect(texte()).toContain('Merci de saisir un montant en euros supérieur à 0.');
    expect(texte()).toContain('Étape 1/5');
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('montant : lettres et autres caractères bloqués, seuls les chiffres sont saisis', async () => {
    await afficher();
    const epargne = screen.getByLabelText('Épargne disponible à investir');
    fireEvent.change(epargne, { target: { value: 'abc' } });
    expect(epargne.value).toBe('');
    fireEvent.change(epargne, { target: { value: '-1 5e0,0€0' } });
    expect(epargne.value).toBe('15000');
  });

  it('montant : 9 chiffres au plus (frappe ou collage)', async () => {
    await afficher();
    const epargne = screen.getByLabelText('Épargne disponible à investir');
    expect(epargne.maxLength).toBe(9);
    fireEvent.change(epargne, { target: { value: '12 345 678 901' } });
    expect(epargne.value).toBe('123456789');
  });

  it('scénario 5 : « Aucun » décoche et désactive les autres placements', async () => {
    await afficher({ avancement: { etapeCourante: 2, reponses: {} } });
    cocher('Livrets');
    cocher('Actions ou fonds');
    cocher('Aucun');
    expect(screen.getByRole('checkbox', { name: 'Livrets' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Livrets' }).disabled).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Aucun' }).checked).toBe(true);

    cocher('Aucun');
    expect(screen.getByRole('checkbox', { name: 'Livrets' }).disabled).toBe(false);
  });

  it('scénario 6 : question ISR affichée seulement si ESG = Oui', async () => {
    const { enregistrer } = await afficher({ avancement: { etapeCourante: 5, reponses: {} } });
    const isr = () => screen.queryByText(/labellisées ISR/);
    expect(isr()).toBeNull();
    choisir('Sans préférence');
    expect(isr()).toBeNull();
    const esg = () => within(screen.getByRole('group', { name: /critères ESG/ }));
    fireEvent.click(esg().getByRole('radio', { name: 'Oui' }));
    expect(isr()).not.toBeNull();
    fireEvent.click(esg().getByRole('radio', { name: 'Non' }));
    expect(isr()).toBeNull();

    await cliquer('Suivant');
    expect(enregistrer).toHaveBeenCalledWith(5, { esg: 'non' });
    expect(screen.getByRole('form', { name: 'Récapitulatif' })).toBeDefined();
  });

  it('scénario 7 : reprise à la première étape non complétée, réponses conservées', async () => {
    await afficher({ avancement: { etapeCourante: 3, reponses: { 1: ETAPE_1 } } });
    expect(texte()).toContain('Étape 3/5 — Objectifs');
    await cliquer('Précédent');
    await cliquer('Précédent');
    expect(screen.getByLabelText('Épargne disponible à investir').value).toBe('15000');
  });

  it.each([1, 2, 3, 4, 5])('« Réinitialiser » présent à l’étape %i', async (etape) => {
    await afficher({ avancement: { etapeCourante: etape, reponses: {} } });
    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeDefined();
  });

  it('« Réinitialiser » efface l’étape en base, vide ses champs et ses messages', async () => {
    const { enregistrer, effacer } = await afficher();
    remplirEtape1('0');
    await cliquer('Suivant');
    expect(texte()).toContain('Merci de saisir un montant en euros supérieur à 0.');

    await cliquer('Réinitialiser');
    expect(screen.getByRole('radio', { name: '30 à 60 k€' }).checked).toBe(false);
    expect(screen.getByLabelText('Épargne disponible à investir').value).toBe('');
    expect(texte()).not.toContain('Merci de saisir un montant');
    expect(texte()).toContain('Étape 1/5');
    expect(effacer).toHaveBeenCalledWith(1);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('« Réinitialiser » en échec : message, les saisies restent à l’écran', async () => {
    const effacer = vi.fn().mockRejectedValue(new ErreurApi(503, 'indisponible'));
    await afficher({ effacer });
    remplirEtape1();
    await cliquer('Réinitialiser');
    expect(texte()).toContain('Vos réponses n’ont pas pu être réinitialisées. Veuillez réessayer.');
    expect(screen.getByRole('radio', { name: '30 à 60 k€' }).checked).toBe(true);
  });

  it('« Réinitialiser » ne touche pas aux réponses des autres étapes', async () => {
    await afficher({ avancement: { etapeCourante: 2, reponses: { 1: ETAPE_1 } } });
    cocher('Livrets');
    await cliquer('Réinitialiser');
    expect(screen.getByRole('checkbox', { name: 'Livrets' }).checked).toBe(false);

    await cliquer('Précédent');
    expect(screen.getByRole('radio', { name: '30 à 60 k€' }).checked).toBe(true);
    expect(screen.getByLabelText('Épargne disponible à investir').value).toBe('15000');
  });

  it('scénario 9 : échec d’enregistrement -> message, reste sur l’étape avec ses saisies', async () => {
    const enregistrer = vi.fn().mockRejectedValue(new ErreurApi(503, 'indisponible'));
    await afficher({ enregistrer });
    remplirEtape1();
    await cliquer('Suivant');

    expect(texte()).toContain('Vos réponses n’ont pas pu être enregistrées. Veuillez réessayer.');
    expect(texte()).toContain('Étape 1/5');
    expect(screen.getByRole('radio', { name: '30 à 60 k€' }).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Suivant' }).disabled).toBe(false);
  });

  it('US-05b : les 5 étapes complétées -> récapitulatif des réponses, sans profil ni score', async () => {
    await afficher({ avancement: { etapeCourante: 6, reponses: { 1: ETAPE_1 } } });
    const situation = screen.getByRole('region', { name: 'Situation financière' });
    expect(situation.textContent).toContain('30 à 60 k€');
    expect(situation.textContent).toMatch(/15\s000\s€/);
    expect(texte()).not.toContain('Équilibré');
    expect(texte()).not.toMatch(/score|\/8/i);
  });

  it('US-05b scénario 7 : « Modifier mes réponses » -> étape 1, réponses conservées, récapitulatif à la fin', async () => {
    const toutes = {
      1: ETAPE_1,
      2: {
        revente: 'vrai',
        capitalGaranti: 'faux',
        frais: 'vrai',
        revenusGarantis: 'faux',
        placements: ['livrets'],
        dejaScpi: 'non',
      },
      3: { objectifs: ['retraite'] },
      4: { horizon: '8-15', reactionBaisse: 'attendre', perteAcceptee: '<10' },
      5: { esg: 'non' },
    };
    const { enregistrer } = await afficher({
      avancement: { etapeCourante: 6, reponses: toutes },
    });

    await cliquer('Modifier mes réponses');
    expect(texte()).toContain('Étape 1/5');
    expect(screen.getByLabelText('Épargne disponible à investir').value).toBe('15000');

    // repasser les 5 étapes (réponses conservées) : le profil est recalculé à la fin
    for (let etape = 1; etape <= 5; etape += 1) {
      await cliquer('Suivant');
    }
    expect(enregistrer).toHaveBeenCalledTimes(5);
    expect(enregistrer).toHaveBeenCalledWith(1, ETAPE_1);
    expect(screen.getByRole('form', { name: 'Récapitulatif' })).toBeDefined();
  });

  it('US-05b scénario 9 : validation -> profil affiché, puis Catalogue', async () => {
    const { valider, allerA } = await afficher({ avancement: { etapeCourante: 6, reponses: {} } });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Je certifie l’exactitude de mes réponses' }),
    );
    await cliquer('Valider');
    expect(valider).toHaveBeenCalled();
    expect(texte()).toContain('Équilibré');
    await cliquer('Continuer maintenant');
    expect(allerA).toHaveBeenCalledWith('/catalogue');
  });

  it('US-05b scénario 11 : formulaire déjà validé -> plus proposé, Catalogue', async () => {
    const { allerA } = await afficher({
      avancement: { etapeCourante: 6, reponses: {}, valide: true },
    });
    expect(allerA).toHaveBeenCalledWith('/catalogue');
  });

  it('pendant l’enregistrement : bouton désactivé « Enregistrement… »', async () => {
    await afficher({ enregistrer: () => new Promise(() => {}) });
    remplirEtape1();
    await cliquer('Suivant');
    expect(screen.getByRole('button', { name: 'Enregistrement…' }).disabled).toBe(true);
  });

  it('sans session : renvoi vers la connexion', async () => {
    const { allerA } = await afficher({
      lire: vi.fn().mockRejectedValue(new ErreurApi(401, 'connexion requise')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('service indisponible au chargement : message d’erreur', async () => {
    await afficher({
      lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Le service est indisponible.')),
    });
    expect(screen.getByRole('alert').textContent).toBe('Le service est indisponible.');
  });

  it('déconnexion toujours possible', async () => {
    const { seDeconnecter, allerA } = await afficher();
    await cliquer('Se déconnecter');
    expect(seDeconnecter).not.toHaveBeenCalled(); // confirmation demandée d'abord
    await cliquer('Oui');
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
