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
  allerA = vi.fn(),
  seDeconnecter = vi.fn().mockResolvedValue(undefined),
} = {}) {
  await act(async () => {
    render(
      <FormulaireInvestisseur
        lire={lire}
        enregistrer={enregistrer}
        allerA={allerA}
        seDeconnecter={seDeconnecter}
      />,
    );
  });
  return { enregistrer, allerA, seDeconnecter };
}

const texte = () => document.body.textContent;
const progression = () => screen.getByRole('progressbar').getAttribute('aria-valuenow');
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
    expect(texte()).toContain('Étape 1/5 — Situation financière');
    expect(progression()).toBe('1');
    expect(screen.queryByRole('button', { name: 'Précédent' })).toBeNull();
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
    remplirEtape1('-200');
    await cliquer('Suivant');
    expect(texte()).toContain('Merci de saisir un montant en euros supérieur à 0.');
    expect(texte()).toContain('Étape 1/5');
    expect(enregistrer).not.toHaveBeenCalled();
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
    expect(texte()).toContain('vos réponses aux 5 étapes sont enregistrées');
  });

  it('scénario 7 : reprise à la première étape non complétée, réponses conservées', async () => {
    await afficher({ avancement: { etapeCourante: 3, reponses: { 1: ETAPE_1 } } });
    expect(texte()).toContain('Étape 3/5 — Objectifs');
    await cliquer('Précédent');
    await cliquer('Précédent');
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

  it('questionnaire déjà complété : confirmation, puis « Revoir mes réponses »', async () => {
    await afficher({ avancement: { etapeCourante: 6, reponses: { 1: ETAPE_1 } } });
    expect(texte()).toContain('vos réponses aux 5 étapes sont enregistrées');
    await cliquer('Revoir mes réponses');
    expect(texte()).toContain('Étape 1/5');
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
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
