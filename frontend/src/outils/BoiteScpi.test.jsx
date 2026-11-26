import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BoiteScpi from './BoiteScpi.jsx';
import { date, euros, masquer } from './boiteScpi.js';

afterEach(cleanup);

const dossier = (idDossier, idMessage, surcharge = {}) => ({
  idMessage,
  idDossier,
  codeSCPI: 'TREU',
  nombreParts: 5,
  prixPart: 200,
  montant: 1000,
  typeInvestissement: 'PLEINE_PROPRIETE',
  modeInvestissement: 'PONCTUELLE',
  dateDemande: '2026-11-26T10:00:00.000Z',
  investisseur: {
    email: 'claire@exemple.test',
    identite: { civilite: 'Madame', nom: 'Martin', prenom: 'Claire', nomNaissance: null },
    coordonnees: { ville: 'Lyon' },
    situation: { profession: 'Ingénieure' },
    declarations: { origineFonds: ['Épargne', 'Héritage'] },
    profil: {
      profil: 'Équilibré',
      score: 42,
      versionQuestionnaire: 'v1',
      valideLe: '2026-11-20T09:00:00.000Z',
    },
  },
  justificatifs: [{ type: 'identite', nomFichier: 'cni.pdf' }],
  ...surcharge,
});

const DONNEES = {
  kafka: {
    active: true,
    connecte: true,
    topic: 'scpi.souscription.dossier.v1',
    groupe: 'societe-gestion',
    erreur: null,
  },
  compteurs: { lus: 3, doublons: 1, invalides: 1 },
  messages: [
    {
      partition: 0,
      offset: '2',
      cle: 'D-1041',
      recuLe: '2026-11-26T11:00:00.000Z',
      doublon: true,
      invalide: false,
      message: dossier('D-1041', 'a'),
    },
    {
      partition: 0,
      offset: '1',
      cle: null,
      recuLe: null,
      doublon: false,
      invalide: true,
      message: null,
      brut: 'pas du json',
    },
    {
      partition: 0,
      offset: '0',
      cle: 'D-1042',
      recuLe: '2026-11-26T10:00:00.000Z',
      doublon: false,
      invalide: false,
      message: dossier('D-1042', 'b', {
        codeSCPI: 'IRZE',
        typeInvestissement: 'NUE_PROPRIETE',
        investisseur: { ...dossier('x', 'y').investisseur, profil: null },
      }),
    },
  ],
};

function afficher(lire = vi.fn().mockResolvedValue(DONNEES), visible = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BoiteScpi lire={lire} visible={visible} />
    </QueryClientProvider>,
  );
  return lire;
}

describe('boîte de réception de la SCPI (dev)', () => {
  it('hors dev : fermée, aucun appel', () => {
    const lire = afficher(vi.fn(), false);
    expect(screen.getByText('Outil indisponible dans cet environnement')).toBeTruthy();
    expect(lire).not.toHaveBeenCalled();
  });

  it('liste les messages, état Kafka et compteurs ; le plus récent est ouvert', async () => {
    afficher();
    const liste = await screen.findByRole('navigation', { name: 'Messages reçus' });
    expect(within(liste).getAllByRole('button')).toHaveLength(3);
    expect(within(liste).getByText('message illisible')).toBeTruthy();
    expect(within(liste).getByText('doublon')).toBeTruthy();
    expect(screen.getByText('Kafka connecté')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Demande D-1041 — SCPI TREU' })).toBeTruthy();
    expect(screen.getByText('doublon : même idMessage déjà reçu')).toBeTruthy();
  });

  it('Accusé, Accepter, Refuser : visibles mais inactifs, avec l’US à venir', async () => {
    afficher();
    for (const nom of ['Accusé de réception', 'Accepter', 'Refuser']) {
      const bouton = await screen.findByRole('button', { name: nom });
      expect(bouton.disabled).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Accepter' }).parentElement.dataset.info).toBe(
      'Disponible avec l’US-14',
    );
    expect(screen.getByRole('button', { name: 'Masquer les détails' }).disabled).toBe(false);
  });

  it('détails : données personnelles masquées par défaut, puis affichées sur demande', async () => {
    afficher();
    await screen.findByText('Identité');
    expect(screen.queryByText('Martin')).toBeNull();
    expect(screen.queryByText('claire@exemple.test')).toBeNull();
    expect(screen.getByText('Ingénieure')).toBeTruthy(); // situation : non masquée
    expect(screen.getByText('Épargne, Héritage')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Afficher les données personnelles' }));
    expect(screen.getByText('Martin')).toBeTruthy();
    expect(screen.getByText('claire@exemple.test')).toBeTruthy();
    expect(screen.getByText(/ne pas faire de capture d’écran/)).toBeTruthy();
  });

  it('JSON brut : masqué aussi par défaut', async () => {
    afficher();
    fireEvent.click(await screen.findByRole('tab', { name: 'JSON brut' }));
    const json = document.querySelector('.boite-scpi__json').textContent;
    expect(json).toContain('"idDossier": "D-1041"');
    expect(json).not.toContain('Martin');
  });

  it('sélection d’un autre message ; message illisible : texte brut', async () => {
    afficher();
    const liste = await screen.findByRole('navigation', { name: 'Messages reçus' });
    fireEvent.click(within(liste).getByText('D-1042'));
    expect(screen.getByRole('heading', { name: 'Demande D-1042 — SCPI IRZE' })).toBeTruthy();
    expect(screen.getByText('aucun profil validé')).toBeTruthy();

    fireEvent.click(within(liste).getByText('sans clé'));
    expect(screen.getByRole('heading', { name: 'Message illisible' })).toBeTruthy();
    expect(screen.getByText('pas du json')).toBeTruthy();
  });

  it('recherche par dossier ou code SCPI', async () => {
    afficher();
    const champ = await screen.findByRole('searchbox', { name: /Rechercher/ });
    fireEvent.change(champ, { target: { value: 'irze' } });
    const liste = screen.getByRole('navigation', { name: 'Messages reçus' });
    expect(within(liste).getAllByRole('button')).toHaveLength(1);
    fireEvent.change(champ, { target: { value: 'D-9999' } });
    expect(screen.getByText('Aucun résultat.')).toBeTruthy();
  });

  it('masquer / afficher les détails', async () => {
    afficher();
    fireEvent.click(await screen.findByRole('button', { name: 'Masquer les détails' }));
    expect(screen.getByText(/Cliquez sur « Détails »/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Détails' }));
    expect(screen.getByText('Identité')).toBeTruthy();
  });

  it('actualiser : nouvelle lecture', async () => {
    const lire = afficher();
    fireEvent.click(await screen.findByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(lire).toHaveBeenCalledTimes(2));
  });

  it.each([
    [{ active: false, connecte: false, topic: null }, 'Kafka désactivé'],
    [
      { active: true, connecte: false, topic: 't', erreur: 'NetworkError' },
      'Kafka injoignable (NetworkError)',
    ],
  ])('état Kafka %#', async (kafka, texte) => {
    afficher(
      vi.fn().mockResolvedValue({
        kafka,
        compteurs: { lus: 0, doublons: 0, invalides: 0 },
        messages: [],
      }),
    );
    expect(await screen.findByText(texte)).toBeTruthy();
    expect(screen.getByText('Aucun message reçu pour l’instant.')).toBeTruthy();
  });

  it('backend injoignable : message d’erreur', async () => {
    afficher(vi.fn().mockRejectedValue(new Error('La société de gestion ne répond pas (502).')));
    expect((await screen.findByRole('alert')).textContent).toContain('societe-gestion est lancé');
  });
});

describe('formatage', () => {
  it('euros, dates, masquage', () => {
    expect(euros(1000)).toMatch(/1\s?000,00\s?€/);
    expect(euros(undefined)).toBe('—');
    expect(date(null)).toBe('—');
    const m = masquer({ investisseur: { email: 'a@b', identite: { nom: 'X' } } });
    expect(m).toEqual({ investisseur: { email: '•••', identite: { nom: '•••' } } });
    expect(masquer({ idDossier: 'D-1' })).toEqual({ idDossier: 'D-1' });
  });
});
