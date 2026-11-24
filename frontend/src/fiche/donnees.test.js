import { describe, expect, it } from 'vitest';
import {
  couleurPays,
  couleurSecteur,
  echelleTaux,
  formaterCapital,
  formaterCashback,
  formaterMois,
  formaterPart,
  liens,
  listePays,
  pastilles,
  pays,
  texteParts,
  texteVersement,
  VERSEMENT_NON_DISPONIBLE,
} from './donnees.js';

const sansEspaceInsecable = (t) => t.replace(/[  ]/g, ' ');

const FICHE = {
  id: 12,
  frequence: 'Trimestrielle',
  versementProgramme: false,
  prixPart: { annee: 2025, valeur: 202 },
  repartitionGeographique: [
    { libelle: 'France', part: 45 },
    { libelle: 'Gde Bretagne', part: 2 },
    { libelle: 'Autres', part: 5 },
  ],
};

describe('Fiche SCPI (US-02) : mise en forme', () => {
  it('pays du référentiel -> nom affiché et code de la carte ; pays inconnu gardé tel quel', () => {
    expect(pays('GdeBretagne')).toEqual({ nom: 'Royaume-Uni', iso: 826 });
    expect(pays(' Gde Bretagne ')).toEqual({ nom: 'Royaume-Uni', iso: 826 });
    expect(pays('Autres')).toEqual({ nom: 'Autres', iso: null });
  });

  it('liste des pays : libellés d’un même pays réunis, de la plus forte à la plus faible part', () => {
    expect(
      listePays([
        { libelle: 'Espagne', part: 10 },
        { libelle: 'Gde Bretagne', part: 1.1 },
        { libelle: 'France', part: 30 },
        { libelle: 'GdeBretagne', part: 9.2 },
        { libelle: 'Allemagne', part: 10 },
      ]),
    ).toEqual([
      { nom: 'France', iso: 250, part: 30, couleur: '#5b2ee6' },
      { nom: 'Royaume-Uni', iso: 826, part: 10.3, couleur: '#3d6ef0' },
      { nom: 'Allemagne', iso: 276, part: 10, couleur: '#3d6ef0' },
      { nom: 'Espagne', iso: 724, part: 10, couleur: '#3d6ef0' },
    ]);
  });

  it('couleurs selon la part, secteurs dans l’ordre', () => {
    expect([30, 12, 6, 2].map(couleurPays)).toEqual(['#5b2ee6', '#3d6ef0', '#1fb5d1', '#6fdcbf']);
    expect(couleurSecteur(0)).toBe('#e0457a');
    expect(couleurSecteur(6)).toBe(couleurSecteur(0));
  });

  it('parts, mois, capitalisation, cashback ; donnée absente « Non communiqué »', () => {
    expect(sansEspaceInsecable(formaterPart(30.28))).toBe('30,28 %');
    expect(sansEspaceInsecable(formaterPart(91))).toBe('91 %');
    expect(sansEspaceInsecable(formaterMois(4))).toBe('4 mois');
    expect(formaterMois(null)).toBe('Non communiqué');
    expect(sansEspaceInsecable(formaterCapital(3_200_000_000))).toBe('3,20 Md€');
    expect(formaterCapital(null)).toBe('Non communiqué');
    expect(formaterCashback(null)).toBe('Non communiqué');
    expect(formaterCashback(0)).toBe('Aucun');
    expect(sansEspaceInsecable(formaterCashback(3))).toBe('3 %');
  });

  it('versement programmé : « dès » le prix d’une part, sinon non disponible (règle 3)', () => {
    expect(sansEspaceInsecable(texteVersement({ ...FICHE, versementProgramme: true }))).toBe(
      'dès 202 €',
    );
    expect(texteVersement({ ...FICHE, versementProgramme: true, prixPart: null })).toBe(
      'Non communiqué',
    );
    expect(texteVersement(FICHE)).toBe(VERSEMENT_NON_DISPONIBLE);
    expect(texteVersement({ ...FICHE, versementProgramme: null })).toBe(VERSEMENT_NON_DISPONIBLE);
  });

  it('nombre de parts du minimum', () => {
    expect(texteParts(5)).toBe('soit 5 parts');
    expect(texteParts(1)).toBe('soit 1 part');
    expect(texteParts(null)).toBeNull();
  });

  it('pastilles : revenus, pays de la carte (sans « Autres »), versement programmé', () => {
    expect(pastilles(FICHE)).toEqual(['Revenus trimestriels', 'Diversifiée · 2 pays']);
    expect(
      pastilles({
        ...FICHE,
        frequence: null,
        versementProgramme: true,
        repartitionGeographique: [{ libelle: 'France', part: 100 }],
      }).map(sansEspaceInsecable),
    ).toEqual(['Versement programmé dès 202 €']);
  });

  it('adresses des boutons (règle 6), « Programmer un versement » seulement si proposé', () => {
    expect(liens(FICHE)).toEqual({
      investir: '/investir/12',
      comparer: '/comparaison?scpi=12',
      simuler: '/simulation?scpi=12:1',
      versement: null,
    });
    expect(liens({ ...FICHE, versementProgramme: true }).versement).toBe(
      '/versements/nouveau?scpi=12',
    );
  });

  it('échelle du taux : resserrée autour des valeurs, pas adapté à l’écart', () => {
    const proches = echelleTaux([{ valeur: 4.95 }, { valeur: 5.35 }]);
    expect(proches.domaine).toEqual([4.6, 5.6]);
    expect(proches.graduations).toEqual([4.8, 5, 5.2, 5.4, 5.6]);
    expect(echelleTaux([{ valeur: 4 }, { valeur: 6 }]).graduations).toEqual([
      3.5, 4, 4.5, 5, 5.5, 6, 6.5,
    ]);
    expect(echelleTaux([{ valeur: 0.5 }, { valeur: 8 }]).domaine).toEqual([0, 9]);
  });
});
