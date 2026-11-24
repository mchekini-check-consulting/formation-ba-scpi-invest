import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../logging/http-error.js';
import {
  creerFicheService,
  identifiant,
  nombreDeParts,
  versFiche,
  type DepotFiche,
  type LigneFiche,
} from './service.js';

const LIGNE: LigneFiche = {
  id: 12,
  nom: 'Pierval Santé',
  gerant: ' Euryale AM ',
  capitalisation: 3_200_000_000,
  minimum: 1020,
  fraisSouscription: 10.51,
  fraisGestion: 8.4,
  delaiJouissance: 4,
  frequence: 'Trimestrielle',
  cashback: 3,
  versementProgramme: false,
  publicite: 'SCPI diversifiée.',
  prix: [
    { annee: 2025, valeur: 204 },
    { annee: 2023, valeur: 200 },
    { annee: 2024, valeur: 204 },
  ],
  taux: [
    { annee: 2024, valeur: 5.35 },
    { annee: 2025, valeur: 5.1 },
  ],
  valeursReconstitution: [{ annee: 2025, valeur: 199.14 }],
  pays: [
    { libelle: 'Allemagne', part: 14.34 },
    { libelle: 'France', part: 30.28 },
    { libelle: 'Espagne', part: 14.34 },
  ],
  secteurs: [
    { libelle: 'Bureaux', part: 9 },
    { libelle: 'Santé', part: 91 },
  ],
};

function depot(ligne: LigneFiche | null, supprimee = false): DepotFiche {
  return {
    lire: vi.fn().mockResolvedValue(ligne),
    estSupprimee: vi.fn().mockResolvedValue(supprimee),
  };
}

describe('Fiche SCPI (US-02) : service', () => {
  it('valeurs les plus récentes avec leur année, historiques du plus ancien au plus récent', () => {
    const fiche = versFiche(LIGNE);
    expect(fiche.prixPart).toEqual({ annee: 2025, valeur: 204 });
    expect(fiche.tauxDistribution).toEqual({ annee: 2025, valeur: 5.1 });
    expect(fiche.valeurReconstitution).toEqual({ annee: 2025, valeur: 199.14 });
    expect(fiche.historiquePrix.map((p) => p.annee)).toEqual([2023, 2024, 2025]);
    expect(fiche.historiqueTaux.map((t) => t.annee)).toEqual([2024, 2025]);
    expect(fiche).not.toHaveProperty('prix');
    expect(fiche).not.toHaveProperty('pays');
  });

  it('répartitions de la plus forte à la plus faible (égalité : ordre alphabétique)', () => {
    const fiche = versFiche(LIGNE);
    expect(fiche.repartitionGeographique.map((p) => p.libelle)).toEqual([
      'France',
      'Allemagne',
      'Espagne',
    ]);
    expect(fiche.repartitionSectorielle.map((s) => s.libelle)).toEqual(['Santé', 'Bureaux']);
  });

  it('minimum en parts, société de gestion sans espaces, textes vides absents', () => {
    const fiche = versFiche({ ...LIGNE, publicite: '   ', gerant: '' });
    expect(fiche.minimumParts).toBe(5);
    expect(fiche.publicite).toBeNull();
    expect(fiche.gerant).toBeNull();
    expect(versFiche(LIGNE).gerant).toBe('Euryale AM');
  });

  it('sans données : valeurs à null, historiques et répartitions vides', () => {
    const fiche = versFiche({
      ...LIGNE,
      minimum: null,
      prix: [],
      taux: [],
      valeursReconstitution: [],
      pays: [],
      secteurs: [],
    });
    expect(fiche).toMatchObject({
      prixPart: null,
      tauxDistribution: null,
      valeurReconstitution: null,
      minimumParts: null,
      historiquePrix: [],
      repartitionGeographique: [],
    });
  });

  it('nombre de parts arrondi au-dessus (une part ne se divise pas)', () => {
    expect(nombreDeParts(5000, { annee: 2025, valeur: 202 })).toBe(25);
    expect(nombreDeParts(1020, { annee: 2025, valeur: 204 })).toBe(5);
    expect(nombreDeParts(null, { annee: 2025, valeur: 204 })).toBeNull();
    expect(nombreDeParts(1000, null)).toBeNull();
    expect(nombreDeParts(1000, { annee: 2025, valeur: 0 })).toBeNull();
  });

  it('identifiant d’adresse : entier positif uniquement', () => {
    expect(identifiant('12')).toBe(12);
    expect(identifiant('0')).toBeNull();
    expect(identifiant('abc')).toBeNull();
    expect(identifiant('1.5')).toBeNull();
    expect(identifiant('9999999999')).toBeNull();
    expect(identifiant(undefined)).toBeNull();
  });

  it('SCPI présente : fiche renvoyée', async () => {
    const service = creerFicheService(depot(LIGNE));
    expect(await service.lire('12')).toMatchObject({ id: 12, nom: 'Pierval Santé' });
  });

  it('SCPI supprimée du référentiel : 404 « n’est plus disponible »', async () => {
    const service = creerFicheService(depot(null, true));
    const erreur = await service.lire('40').catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(HttpError);
    expect(erreur).toMatchObject({
      status: 404,
      message: 'Cette SCPI n’est plus disponible',
      details: { statut: 'supprimee' },
    });
  });

  it('SCPI introuvable : 404 « n’est pas disponible »', async () => {
    const service = creerFicheService(depot(null, false));
    await expect(service.lire('99999')).rejects.toMatchObject({
      status: 404,
      message: 'Cette SCPI n’est pas disponible',
      details: { statut: 'introuvable' },
    });
  });

  it('adresse erronée : introuvable, sans lire la base', async () => {
    const d = depot(LIGNE);
    await expect(creerFicheService(d).lire('abc')).rejects.toMatchObject({
      details: { statut: 'introuvable' },
    });
    expect(d.lire).not.toHaveBeenCalled();
    expect(d.estSupprimee).not.toHaveBeenCalled();
  });
});
