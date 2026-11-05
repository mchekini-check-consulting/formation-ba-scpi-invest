import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FormulaireKyc from './FormulaireKyc.jsx';
import {
  MESSAGE_ENVOI,
  MESSAGE_FORMAT,
  MESSAGE_PIECE_MANQUANTE,
  MESSAGE_SUPPRESSION,
} from './pieces.js';

afterEach(cleanup);

const REPONSES = {
  nationalite: 'Française',
  origineFonds: ['Épargne issue de mes revenus'],
  ppe: 'Non',
};

const deposee = (type, nomFichier, statut = 'deposee') => ({
  type,
  nomFichier,
  format: 'application/pdf',
  taille: 1000,
  statut,
  deposeLe: '2026-11-05T10:00:00.000Z',
});

function afficher(props = {}) {
  const enregistrer = vi.fn().mockResolvedValue({});
  const deposerPiece =
    props.deposerPiece ??
    vi.fn().mockImplementation(async (type, fichier) => deposee(type, fichier.name));
  const supprimerPiece = props.supprimerPiece ?? vi.fn().mockResolvedValue(null);
  render(
    <FormulaireKyc
      email="jean@exemple.fr"
      etapeInitiale={5}
      reponsesInitiales={REPONSES}
      piecesInitiales={[]}
      {...props}
      enregistrer={enregistrer}
      deposerPiece={deposerPiece}
      supprimerPiece={supprimerPiece}
    />,
  );
  return { enregistrer, deposerPiece, supprimerPiece };
}

const pdf = (nom = 'cni.pdf', taille = 1000) => {
  const fichier = new File(['%PDF-'], nom, { type: 'application/pdf' });
  Object.defineProperty(fichier, 'size', { value: taille });
  return fichier;
};
const choisirFichier = async (libelle, fichier) => {
  await act(async () =>
    fireEvent.change(screen.getByLabelText(libelle), { target: { files: [fichier] } }),
  );
};
const cliquer = async (nom) => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: nom })));
};
const titreEtape = () => screen.getByRole('heading', { level: 2 }).textContent;

describe('Étape « Pièces justificatives » (US-04c)', () => {
  it('scénario 1 : pièces adaptées aux réponses, facultative signalée, étape 5/5', () => {
    afficher({ reponsesInitiales: { ...REPONSES, nationalite: 'Marocaine', ppe: 'Oui' } });
    expect(titreEtape()).toBe('Pièces justificatives');
    expect(screen.getByText('Étape 5/5')).toBeDefined();
    const libelles = [...document.querySelectorAll('.kyc-piece__libelle')].map(
      (l) => l.textContent,
    );
    expect(libelles).toEqual([
      'Pièce d’identité',
      'Verso de la carte d’identité (facultatif)',
      'Titre de séjour',
      'Justificatif de domicile',
      'RIB',
      'Pièce justificative complémentaire',
    ]);
  });

  it('scénario 2 : dépôt réussi, nom du fichier affiché en face de la pièce', async () => {
    const { deposerPiece } = afficher();
    const fichier = pdf('carte-identite.pdf');
    await choisirFichier('Pièce d’identité', fichier);
    expect(deposerPiece).toHaveBeenCalledWith('identite', fichier, expect.any(Function));
    expect(screen.getByText('carte-identite.pdf')).toBeDefined();
    expect(screen.getByText('Déposée')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remplacer : Pièce d’identité' })).toBeDefined();
  });

  it('scénario 3 : format ou taille non acceptés, refusé sans envoi', async () => {
    const { deposerPiece } = afficher();
    await choisirFichier('RIB', new File(['x'], 'rib.gif', { type: 'image/gif' }));
    await choisirFichier('Justificatif de domicile', pdf('gros.pdf', 11 * 1024 * 1024));
    expect(deposerPiece).not.toHaveBeenCalled();
    expect(screen.getAllByText(MESSAGE_FORMAT)).toHaveLength(2);
  });

  it('scénario 3 : refus du backend, son message', async () => {
    const refus = Object.assign(new Error(MESSAGE_FORMAT), { status: 400 });
    afficher({ deposerPiece: vi.fn().mockRejectedValue(refus) });
    await choisirFichier('RIB', pdf('rib.pdf'));
    expect(screen.getByText(MESSAGE_FORMAT)).toBeDefined();
  });

  it('panne pendant l’envoi : message générique, la pièce reste à fournir', async () => {
    afficher({ deposerPiece: vi.fn().mockRejectedValue(new Error('réseau')) });
    await choisirFichier('RIB', pdf('rib.pdf'));
    expect(screen.getByText(MESSAGE_ENVOI)).toBeDefined();
    expect(screen.queryByText('rib.pdf')).toBeNull();
  });

  it('scénario 4 : pièce obligatoire manquante, signalée, on reste sur l’étape', async () => {
    const { enregistrer } = afficher({ piecesInitiales: [deposee('identite', 'cni.pdf')] });
    await cliquer('Suivant');
    expect(titreEtape()).toBe('Pièces justificatives');
    expect(screen.getAllByText(MESSAGE_PIECE_MANQUANTE)).toHaveLength(2); // domicile, RIB
    expect(screen.getByRole('alert').textContent).toContain('2 pièces');
    expect(document.activeElement).toBe(screen.getByLabelText('Justificatif de domicile'));
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('toutes les pièces obligatoires déposées : « Suivant » mène au récapitulatif', async () => {
    const { enregistrer } = afficher({
      piecesInitiales: [
        deposee('identite', 'cni.pdf'),
        deposee('domicile', 'facture.pdf'),
        deposee('rib', 'rib.pdf'),
      ],
    });
    await cliquer('Suivant');
    expect(enregistrer).toHaveBeenCalledWith(6, expect.any(Object));
    expect(titreEtape()).toBe('Récapitulatif');
  });

  it('scénario 5 : remplacer une pièce', async () => {
    const { deposerPiece } = afficher({ piecesInitiales: [deposee('rib', 'ancien-rib.pdf')] });
    const input = screen.getByLabelText('RIB');
    const clic = vi.spyOn(input, 'click');
    await cliquer('Remplacer : RIB');
    expect(clic).toHaveBeenCalled();
    await choisirFichier('RIB', pdf('nouveau-rib.pdf'));
    expect(deposerPiece).toHaveBeenCalledWith('rib', expect.any(File), expect.any(Function));
    expect(screen.getByText('nouveau-rib.pdf')).toBeDefined();
    expect(screen.queryByText('ancien-rib.pdf')).toBeNull();
  });

  it('scénario 5 : supprimer une pièce, elle redevient à fournir', async () => {
    const { supprimerPiece } = afficher({ piecesInitiales: [deposee('rib', 'rib.pdf')] });
    await cliquer('Supprimer : RIB');
    expect(supprimerPiece).toHaveBeenCalledWith('rib');
    expect(screen.queryByText('rib.pdf')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Supprimer : RIB' })).toBeNull();
  });

  it('échec de la suppression : message, la pièce reste', async () => {
    afficher({
      piecesInitiales: [deposee('rib', 'rib.pdf')],
      supprimerPiece: vi.fn().mockRejectedValue(new Error('panne')),
    });
    await cliquer('Supprimer : RIB');
    expect(screen.getByText(MESSAGE_SUPPRESSION)).toBeDefined();
    expect(screen.getByText('rib.pdf')).toBeDefined();
  });

  it('statut d’une pièce reprise : libellé lisible', () => {
    afficher({ piecesInitiales: [deposee('rib', 'rib.pdf', 'en_verification')] });
    expect(screen.getByText('En cours de vérification')).toBeDefined();
  });

  it('pendant l’envoi : barre de progression sous la pièce, « Suivant » désactivé', async () => {
    let terminer;
    let avancer;
    afficher({
      deposerPiece: vi.fn((_type, _fichier, progression) => {
        avancer = progression;
        return new Promise((r) => (terminer = r));
      }),
    });
    await choisirFichier('RIB', pdf('mon-rib.pdf'));
    const barre = () => screen.getByRole('progressbar', { name: /mon-rib\.pdf/ });
    expect(barre().getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByRole('button', { name: 'Suivant' }).disabled).toBe(true);
    await act(async () => avancer(0.42));
    expect(barre().getAttribute('aria-valuenow')).toBe('42');
    expect(screen.getByText('42 %')).toBeDefined();
    await act(async () => avancer(1));
    expect(screen.getByText('Finalisation…')).toBeDefined();
    await act(async () => terminer(deposee('rib', 'mon-rib.pdf')));
    expect(screen.queryByRole('progressbar', { name: /mon-rib/ })).toBeNull();
    expect(screen.getByText('Déposée')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Suivant' }).disabled).toBe(false);
  });

  it('pendant la suppression : « Suppression… » sous la pièce', async () => {
    let terminer;
    afficher({
      piecesInitiales: [deposee('rib', 'rib.pdf')],
      supprimerPiece: vi.fn(() => new Promise((r) => (terminer = r))),
    });
    await cliquer('Supprimer : RIB');
    expect(screen.getByRole('status').textContent).toBe('Suppression…');
    await act(async () => terminer(null));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
