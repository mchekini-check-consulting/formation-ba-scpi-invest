import { describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import {
  chargerProfil,
  compteurPieces,
  dateLongue,
  identite,
  piecesAffichees,
  profilInvestisseur,
  rubriques,
} from './donnees.js';

const REPONSES = {
  civilite: 'Madame',
  prenom: ' Marie ',
  nom: 'Curie',
  dateNaissance: '1980-11-07',
  nationalite: 'Française',
  telephone: '612345678',
  email: 'kyc@exemple.fr',
  residenceFiscale: 'France',
  origineFonds: ['Épargne issue de mes revenus'],
  ppe: 'Non',
};

describe('chargerProfil', () => {
  const sources = (autres = {}) => ({
    lireUtilisateur: vi.fn().mockResolvedValue({ email: 'm@x.fr' }),
    lireLeKyc: vi.fn().mockResolvedValue({ reponses: REPONSES }),
    lirePieces: vi.fn().mockResolvedValue([]),
    lireLeProfil: vi.fn().mockResolvedValue({ profil: 'prudent' }),
    ...autres,
  });

  it('réunit compte, KYC, pièces et profil', async () => {
    expect(await chargerProfil(sources())).toEqual({
      utilisateur: { email: 'm@x.fr' },
      kyc: { reponses: REPONSES },
      pieces: [],
      profil: { profil: 'prudent' },
    });
  });

  it('pièces et profil indisponibles (ex. 409 profil non terminé) : null', async () => {
    const resultat = await chargerProfil(
      sources({
        lirePieces: vi.fn().mockRejectedValue(new ErreurApi(500, 'x')),
        lireLeProfil: vi.fn().mockRejectedValue(new ErreurApi(409, 'x')),
        lireUtilisateur: vi.fn().mockRejectedValue(new Error('réseau')),
      }),
    );
    expect([resultat.pieces, resultat.profil, resultat.utilisateur]).toEqual([null, null, null]);
  });

  it('KYC indisponible ou session expirée : erreur remontée', async () => {
    await expect(
      chargerProfil(sources({ lireLeKyc: vi.fn().mockRejectedValue(new ErreurApi(500, 'x')) })),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      chargerProfil(sources({ lireLeProfil: vi.fn().mockRejectedValue(new ErreurApi(401, 'x')) })),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('dateLongue', () => {
  it('date en toutes lettres, heure de Paris', () => {
    expect(dateLongue('2026-11-04T09:30:00.000Z')).toBe('4 novembre 2026');
    expect(dateLongue('2026-11-04T23:30:00.000Z')).toBe('5 novembre 2026');
  });

  it('absente ou illisible : vide', () => {
    expect(dateLongue(null)).toBe('');
    expect(dateLongue('pas une date')).toBe('');
  });
});

describe('identite', () => {
  it('prénom et nom du KYC, email du compte', () => {
    expect(identite({ utilisateur: { email: 'm@x.fr' }, kyc: { reponses: REPONSES } })).toEqual({
      nomComplet: 'Marie Curie',
      email: 'm@x.fr',
    });
  });

  it('compte indisponible : email du KYC ; rien de connu : vide', () => {
    expect(identite({ utilisateur: null, kyc: { reponses: REPONSES } }).email).toBe(
      'kyc@exemple.fr',
    );
    expect(identite({ utilisateur: null, kyc: null })).toEqual({ nomComplet: '', email: '' });
  });
});

describe('profilInvestisseur', () => {
  it('profil validé : nom, explication, position sur la jauge, date', () => {
    expect(
      profilInvestisseur({ profil: 'equilibre', valideLe: '2026-11-04T09:30:00.000Z' }),
    ).toMatchObject({
      code: 'equilibre',
      nom: 'Équilibré',
      position: 1,
      valideLe: '4 novembre 2026',
    });
  });

  it('pas encore validé, inconnu ou absent : null', () => {
    expect(profilInvestisseur({ profil: 'prudent', valideLe: null })).toBeNull();
    expect(profilInvestisseur({ profil: 'audacieux', valideLe: '2026-11-04' })).toBeNull();
    expect(profilInvestisseur(null)).toBeNull();
  });
});

describe('rubriques', () => {
  it('les 4 rubriques du KYC, libellés et valeurs du récapitulatif', () => {
    const liste = rubriques(REPONSES);
    expect(liste.map((r) => r.titre)).toEqual([
      'Identité',
      'Coordonnées',
      'Situation personnelle et professionnelle',
      'Déclarations réglementaires',
    ]);
    const identiteKyc = liste[0].lignes;
    expect(identiteKyc.find((l) => l.cle === 'dateNaissance').valeur).toBe('07/11/1980');
    expect(identiteKyc.find((l) => l.cle === 'civilite').libelle).toBe('Civilité');
  });

  it('champ masqué selon les réponses : absent', () => {
    const declarations = (reponses) => rubriques(reponses)[3].lignes.map((l) => l.cle);
    expect(declarations(REPONSES)).not.toContain('paysResidenceFiscale');
    expect(declarations({ residenceFiscale: 'Autre pays' })).toContain('paysResidenceFiscale');
  });

  it('sans réponses : « Non renseigné »', () => {
    expect(rubriques()[0].lignes[0].valeur).toBe('Non renseigné');
  });
});

describe('piecesAffichees', () => {
  const PIECES = [
    {
      type: 'identite',
      nomFichier: 'cni.pdf',
      statut: 'validee',
      deposeLe: '2026-11-02T10:00:00Z',
    },
    { type: 'domicile', nomFichier: 'edf.jpg', statut: 'inconnu', deposeLe: null },
  ];

  it('pièces demandées, avec fichier, date et statut ; manquante signalée', () => {
    const liste = piecesAffichees(REPONSES, PIECES);
    expect(liste.map((p) => p.type)).toEqual(['identite', 'domicile', 'rib']);
    expect(liste[0]).toMatchObject({
      libelle: 'Pièce d’identité',
      nomFichier: 'cni.pdf',
      deposeLe: '2 novembre 2026',
      statut: 'Vérifiée',
      fournie: true,
    });
    expect(liste[1]).toMatchObject({ statut: 'Déposée', deposeLe: '' });
    expect(liste[2]).toMatchObject({ statut: 'Non fournie', fournie: false, nomFichier: '' });
    expect(compteurPieces(liste)).toBe('2 / 3');
  });

  it('pièce facultative (verso) : affichée seulement si déposée', () => {
    const verso = { type: 'identite_verso', nomFichier: 'verso.pdf', statut: 'deposee' };
    expect(piecesAffichees(REPONSES, [verso]).map((p) => p.type)).toContain('identite_verso');
    expect(piecesAffichees().map((p) => p.type)).not.toContain('identite_verso');
  });
});
