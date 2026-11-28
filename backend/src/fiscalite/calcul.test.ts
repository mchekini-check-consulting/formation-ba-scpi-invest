import { describe, expect, it } from 'vitest';
import { BAREME_2026 } from './bareme.js';
import { estimer, foyer, partsFiscales, type Parametres } from './calcul.js';
import type { InformationsFiscales } from './service.js';

// Valeurs de l'US-07 (migration 0019_parametres_fiscaux)
const PARAMETRES: Parametres = {
  bareme: [
    { plafond: 11600, taux: 0 },
    { plafond: 29579, taux: 11 },
    { plafond: 84577, taux: 30 },
    { plafond: 181917, taux: 41 },
    { plafond: null, taux: 45 },
  ],
  prelevementsSociaux: 17.2,
  tauxForfaitaire: 30,
};

// Barème des constantes du code (règle 9 du 27/11/2026)
const BAREME_PARAMETRES: Parametres = { ...PARAMETRES, bareme: BAREME_2026 };

const SEUL_40000: InformationsFiscales = {
  revenuNetImposable: 40000,
  situationFamiliale: 'seul',
  nombreEnfants: 0,
};

describe('parts de quotient familial (règle 2)', () => {
  it.each([
    ['seul', 0, 1],
    ['couple', 0, 2],
    ['seul', 1, 1.5],
    ['couple', 2, 3],
    ['couple', 3, 4],
    ['seul', 4, 4],
  ] as const)('%s, %i enfant(s) : %d part(s)', (situationFamiliale, nombreEnfants, parts) => {
    expect(partsFiscales({ revenuNetImposable: 0, situationFamiliale, nombreEnfants })).toBe(parts);
  });
});

describe('TMI et taux moyen (règles 3 et 4)', () => {
  it('scénario : 40 000 €, seul, 0 enfant', () => {
    expect(foyer(SEUL_40000, PARAMETRES.bareme)).toEqual({
      parts: 1,
      tmi: 30,
      impotFoyer: 5103.99,
      tauxMoyen: 12.76,
    });
  });

  it('scénario quotient familial : 90 000 €, en couple, 3 enfants', () => {
    const resultat = foyer(
      { revenuNetImposable: 90000, situationFamiliale: 'couple', nombreEnfants: 3 },
      PARAMETRES.bareme,
    );
    expect(resultat.parts).toBe(4);
    expect(resultat.tmi).toBe(11);
  });

  it('revenu nul : TMI 0 %, taux moyen 0 %', () => {
    expect(foyer({ ...SEUL_40000, revenuNetImposable: 0 }, PARAMETRES.bareme)).toMatchObject({
      tmi: 0,
      impotFoyer: 0,
      tauxMoyen: 0,
    });
  });

  it('revenu dans la dernière tranche : TMI 45 %', () => {
    expect(foyer({ ...SEUL_40000, revenuNetImposable: 250000 }, PARAMETRES.bareme).tmi).toBe(45);
  });

  it('revenu égal à un plafond : taux de cette tranche', () => {
    expect(foyer({ ...SEUL_40000, revenuNetImposable: 29579 }, PARAMETRES.bareme).tmi).toBe(11);
  });

  it('barème vide : aucun impôt', () => {
    expect(foyer(SEUL_40000, [])).toMatchObject({ tmi: 0, impotFoyer: 0 });
  });
});

describe('impôt estimé (règles 5 à 8)', () => {
  it('scénario SCPI 100 % française : 472,00 €', () => {
    const resultat = estimer(
      [{ scpiId: 1, revenuAnnuel: 1000, partFrance: 100 }],
      PARAMETRES,
      SEUL_40000,
    );
    expect(resultat.impot).toBe(472);
    expect(resultat.net).toBe(528);
    expect(resultat.avecInformations).toBe(true);
    expect(resultat.tauxApplique).toBeNull();
  });

  it('scénario SCPI 20 % France : 228,96 € (taux effectif, règles du 27/11/2026)', () => {
    const resultat = estimer(
      [{ scpiId: 1, revenuAnnuel: 1000, partFrance: 20 }],
      PARAMETRES,
      SEUL_40000,
    );
    expect(resultat.lignes[0]).toEqual({
      scpiId: 1,
      revenuAnnuel: 1000,
      revenuFrance: 200,
      revenuEtranger: 800,
      impot: 228.96,
    });
  });

  it('sans répartition géographique : revenu traité comme français', () => {
    const resultat = estimer(
      [{ scpiId: 1, revenuAnnuel: 1000, partFrance: null }],
      PARAMETRES,
      SEUL_40000,
    );
    expect(resultat.impot).toBe(472);
  });

  it('scénario sans informations fiscales : 30 % forfaitaire, 300,00 €', () => {
    const resultat = estimer([{ scpiId: 1, revenuAnnuel: 1000, partFrance: 20 }], PARAMETRES, null);
    expect(resultat).toMatchObject({
      avecInformations: false,
      foyer: null,
      tauxApplique: 30,
      impot: 300,
      net: 700,
    });
  });

  it('sans informations fiscales, avec un taux choisi (US-09)', () => {
    const resultat = estimer(
      [{ scpiId: 1, revenuAnnuel: 4175, partFrance: 100 }],
      PARAMETRES,
      null,
      11,
    );
    expect(resultat).toMatchObject({ tauxApplique: 11, impot: 459.25, net: 3715.75 });
  });

  it('plusieurs lignes : totaux', () => {
    const resultat = estimer(
      [
        { scpiId: 1, revenuAnnuel: 1000, partFrance: 100 },
        { scpiId: 2, revenuAnnuel: 1000, partFrance: 20 },
      ],
      PARAMETRES,
      SEUL_40000,
    );
    // impôt(42 000) × 41 200 ÷ 42 000 − impôt(40 000) = 491,35 € ; PS 1 200 × 17,2 %
    expect(resultat).toMatchObject({ revenus: 2000, impot: 697.75, net: 1302.25 });
  });

  it('aucune ligne : 0', () => {
    expect(estimer([], PARAMETRES, null)).toMatchObject({ revenus: 0, impot: 0, net: 0 });
  });
});

// Anomalie « changement de TMI » : Mistral Sélection (180 €/part, TD 6 %, délai de
// jouissance 4 mois, 100 % France), pleine propriété, 10 ans. Année 1 : 8 mois de revenus,
// avec son propre calcul d'impôt ; cumul = somme des nets annuels (tolérance ± 0,05 €).
describe('changement de tranche marginale (TMI) avec les revenus SCPI', () => {
  const revenuAnnuel = (partsScpi: number) => (partsScpi * 180 * 6) / 100;
  const foyerDe = (revenu: number, parts: 1 | 2): InformationsFiscales => ({
    revenuNetImposable: revenu,
    situationFamiliale: parts === 2 ? 'couple' : 'seul',
    nombreEnfants: 0,
  });
  const annee = (revenu: number, informations: InformationsFiscales) =>
    estimer([{ scpiId: 1, revenuAnnuel: revenu, partFrance: 100 }], PARAMETRES, informations);
  // « 11 % » ou « 11 % → 30 % » (TMI sans SCPI → TMI avec SCPI)
  const tmiAffichee = (e: ReturnType<typeof estimer>) => {
    const avant = e.foyer?.tmi;
    const apres = (e as { avecScpi?: { tmi: number } | null }).avecScpi?.tmi ?? avant;
    return apres === avant ? `${avant} %` : `${avant} % → ${apres} %`;
  };

  it.each([
    // revenu, parts fiscales, parts SCPI, IR, PS, impôt, net, net mensuel, cumul, TMI
    [1, 28900, 1, 100, 194.99, 185.76, 380.75, 699.25, 58.27, 6802.42, '11 % → 30 %'],
    [2, 28900, 1, 10, 11.88, 18.58, 30.46, 77.54, 6.46, 749.59, '11 %'],
    [3, 29471, 1, 10, 11.88, 18.58, 30.46, 77.54, 6.46, 749.59, '11 %'],
    [4, 29472, 1, 10, 12.07, 18.58, 30.65, 77.35, 6.45, 747.88, '11 % → 30 %'],
    [5, 40000, 1, 100, 324.0, 185.76, 509.76, 570.24, 47.52, 5512.32, '30 %'],
    [6, 57800, 2, 100, 118.8, 185.76, 304.56, 775.44, 64.62, 7495.92, '11 %'],
  ] as const)(
    'cas %i : foyer %i €, %i part(s), %i parts SCPI',
    (_, revenu, parts, partsScpi, ir, ps, impot, net, mensuel, cumul, tmi) => {
      const informations = foyerDe(revenu, parts);
      const pleine = annee(revenuAnnuel(partsScpi), informations);
      const premiere = annee((revenuAnnuel(partsScpi) / 12) * 8, informations);
      expect(pleine.impot).toBeCloseTo(impot, 1);
      expect(pleine.impot - (revenuAnnuel(partsScpi) * 17.2) / 100).toBeCloseTo(ir, 1);
      expect(pleine.net).toBeCloseTo(net, 1);
      expect(pleine.net / 12).toBeCloseTo(mensuel, 1);
      expect(premiere.net + 9 * pleine.net).toBeCloseTo(cumul, 1);
      expect(tmiAffichee(pleine)).toBe(tmi);
    },
  );

  it('cas 1, année 1 (720 €) : IR = 679 × 11 % + 41 × 30 % = 86,99 €, PS 123,84 €, net 509,17 €', () => {
    const premiere = annee(720, foyerDe(28900, 1));
    expect(premiere.impot).toBeCloseTo(86.99 + 123.84, 1);
    expect(premiere.net).toBeCloseTo(509.17, 1);
  });
});

describe('estimation par période et année par année', () => {
  const FOYER_28900: InformationsFiscales = {
    revenuNetImposable: 28900,
    situationFamiliale: 'seul',
    nombreEnfants: 0,
  };
  const mistral = (revenuAnnuel: number) => [{ scpiId: 1, revenuAnnuel, partFrance: 100 }];

  it('cas 1 : impôt détaillé, cumul sur 10 ans, TMI et taux moyen avec SCPI, dépassement', () => {
    const resultat = estimer(mistral(1080), PARAMETRES, FOYER_28900, undefined, {
      periodes: [mistral(1080)],
      annees: [mistral(720), ...Array.from({ length: 9 }, () => mistral(1080))],
    });
    expect(resultat).toMatchObject({
      impotRevenu: 194.99,
      impotRevenuFrance: 194.99,
      impotRevenuEtranger: 0,
      prelevementsSociaux: 185.76,
      impot: 380.75,
      net: 699.25,
      foyer: { tmi: 11, tauxMoyen: 6.58 },
      avecScpi: { tmi: 30, tauxMoyen: 7, depassement: { plafond: 29579, montant: 401 } },
      cumul: { revenus: 10440, net: 6802.42 },
    });
    expect(resultat.periodes).toHaveLength(1);
    expect(resultat.periodes[0]).toMatchObject({ revenus: 1080, impot: 380.75, net: 699.25 });
  });

  it('sans changement de tranche : TMI × revenus, pas de dépassement', () => {
    const resultat = estimer(mistral(108), PARAMETRES, FOYER_28900);
    expect(resultat.impotRevenu).toBe(11.88);
    expect(resultat.avecScpi).toEqual({
      tmi: 11,
      tauxMoyen: 6.6,
      depassement: null,
      revenuFrance: 108,
      revenuEtranger: 0,
      impotRevenuFrance: 11.88,
      impotRevenuEtranger: 0,
      prelevementsSociaux: 18.58,
    });
    // Sans groupe demandé : aucune période, cumul nul
    expect(resultat.periodes).toEqual([]);
    expect(resultat.cumul).toEqual({ revenus: 0, impot: 0, net: 0 });
  });

  it('plusieurs SCPI : le barème porte sur leur total, impôt réparti au prorata', () => {
    const resultat = estimer(
      [
        { scpiId: 1, revenuAnnuel: 540, partFrance: 100 },
        { scpiId: 2, revenuAnnuel: 540, partFrance: 100 },
      ],
      PARAMETRES,
      FOYER_28900,
    );
    expect(resultat.impot).toBe(380.75);
    expect(resultat.lignes.map((l) => l.impot)).toEqual([190.38, 190.38]);
  });

  it('TMI avec SCPI : celle de la période aux revenus les plus hauts', () => {
    const resultat = estimer(mistral(1080), PARAMETRES, FOYER_28900, undefined, {
      periodes: [mistral(108), mistral(1080), mistral(500)],
    });
    expect(resultat.avecScpi?.tmi).toBe(30);
    expect(resultat.periodes.map((p) => p.impot)).toEqual([30.46, 380.75, 141]);
  });

  it('2 parts : plafond et dépassement du foyer (plafond par part × parts)', () => {
    const resultat = estimer(mistral(1080), PARAMETRES, {
      revenuNetImposable: 58800,
      situationFamiliale: 'couple',
      nombreEnfants: 0,
    });
    expect(resultat.avecScpi?.depassement).toEqual({ plafond: 59158, montant: 722 });
  });

  it('revenus étrangers : ils font monter le taux et peuvent changer la TMI', () => {
    const resultat = estimer(
      [{ scpiId: 1, revenuAnnuel: 1000, partFrance: 20 }],
      PARAMETRES,
      FOYER_28900,
    );
    // 28 900 + 1 000 = 29 900 € > 29 579 € : TMI 30 %. impôt(29 900) = 2 073,99 €
    // IR = 2 073,99 × 29 100 ÷ 29 900 − 1 903 = 115,50 € dont 22 € pour les 200 € français
    expect(resultat).toMatchObject({
      impotRevenu: 115.5,
      impotRevenuFrance: 22,
      impotRevenuEtranger: 93.5,
      prelevementsSociaux: 34.4,
      impot: 149.9,
      avecScpi: { tmi: 30, depassement: { plafond: 29579, montant: 321 } },
    });
  });

  it('revenu du foyer nul, sans revenu SCPI : taux moyen 0 %', () => {
    const resultat = estimer([], PARAMETRES, { ...FOYER_28900, revenuNetImposable: 0 });
    expect(resultat.avecScpi).toEqual({
      tmi: 0,
      tauxMoyen: 0,
      depassement: null,
      revenuFrance: 0,
      revenuEtranger: 0,
      impotRevenuFrance: 0,
      impotRevenuEtranger: 0,
      prelevementsSociaux: 0,
    });
  });

  it('sans informations fiscales : taux appliqué par période et par année', () => {
    const resultat = estimer(mistral(1080), PARAMETRES, null, 11, {
      periodes: [mistral(1080)],
      annees: [mistral(720), mistral(1080)],
    });
    expect(resultat).toMatchObject({
      avecScpi: null,
      impotRevenu: null,
      prelevementsSociaux: null,
      impot: 118.8,
      cumul: { revenus: 1800, impot: 198, net: 1602 },
    });
    expect(resultat.periodes[0].impot).toBe(118.8);
  });
});

// Règles du 27/11/2026 (SCPI-256 US-07, SCPI-258 US-09) : méthode du taux effectif pour les
// revenus étrangers, taux moyen avec les revenus SCPI (tolérance ± 0,05 €)
describe('règles du 27/11/2026 : estimation annuelle (seul, 0 enfant, 1 part)', () => {
  const seul = (revenuNetImposable: number): InformationsFiscales => ({
    revenuNetImposable,
    situationFamiliale: 'seul',
    nombreEnfants: 0,
  });
  const tmiAffichee = (e: ReturnType<typeof estimer>) => {
    const avant = e.foyer?.tmi;
    const apres = e.avecScpi?.tmi;
    return apres === avant ? `${avant} %` : `${avant} % → ${apres} %`;
  };

  it.each([
    // cas, R, revenus SCPI, part France, impôt, taux moyen (null : non vérifié), TMI
    ['A', 40000, 1000, 100, 472.0, 13.18, '30 %'],
    ['B', 40000, 1000, 20, 228.96, 13.18, '30 %'],
    ['C', 28900, 1080, 100, 380.75, 7.0, '11 % → 30 %'],
    ['D', 28900, 1080, 0, 119.41, 7.0, '11 % → 30 %'],
    ['E', 29471, 108, 100, 30.46, null, '11 %'],
    ['F', 29472, 108, 100, 30.65, null, '11 % → 30 %'],
  ] as const)(
    'cas %s : R %i €, %i € de revenus SCPI à %i %% France',
    (_, revenu, revenuAnnuel, partFrance, impot, tauxMoyen, tmi) => {
      const e = estimer([{ scpiId: 1, revenuAnnuel, partFrance }], BAREME_PARAMETRES, seul(revenu));
      expect(e.impot).toBeCloseTo(impot, 1);
      if (tauxMoyen !== null) expect(e.avecScpi?.tauxMoyen).toBeCloseTo(tauxMoyen, 2);
      expect(tmiAffichee(e)).toBe(tmi);
    },
  );

  it('cas B : IR 194,56 € dont part française 60,00 € et effet des revenus étrangers 134,56 € ; PS 34,40 €', () => {
    const e = estimer(
      [{ scpiId: 1, revenuAnnuel: 1000, partFrance: 20 }],
      BAREME_PARAMETRES,
      seul(40000),
    );
    expect(e.impotRevenu).toBeCloseTo(194.56, 1);
    expect(e.impotRevenuFrance).toBeCloseTo(60, 1);
    expect(e.impotRevenuEtranger).toBeCloseTo(134.56, 1);
    expect(e.prelevementsSociaux).toBeCloseTo(34.4, 1);
    expect(e.lignes[0].impot).toBeCloseTo(228.96, 1);
    // Détail affiché sous le taux moyen
    expect(e.avecScpi).toMatchObject({
      revenuFrance: 200,
      revenuEtranger: 800,
      impotRevenuFrance: 60,
      impotRevenuEtranger: 134.56,
      prelevementsSociaux: 34.4,
    });
  });

  it('cas C : IR 194,99 € ; PS 185,76 € ; dépassement 401 € au-dessus de 29 579 €', () => {
    const e = estimer(
      [{ scpiId: 1, revenuAnnuel: 1080, partFrance: 100 }],
      BAREME_PARAMETRES,
      seul(28900),
    );
    expect(e.impotRevenu).toBeCloseTo(194.99, 1);
    expect(e.prelevementsSociaux).toBeCloseTo(185.76, 1);
    expect(e.avecScpi?.depassement).toEqual({ plafond: 29579, montant: 401 });
  });

  it('cas D : 100 % étranger, IR seul (119,41 €), pas de PS, la TMI change aussi', () => {
    const e = estimer(
      [{ scpiId: 1, revenuAnnuel: 1080, partFrance: 0 }],
      BAREME_PARAMETRES,
      seul(28900),
    );
    expect(e.impotRevenu).toBeCloseTo(119.41, 1);
    expect(e.prelevementsSociaux).toBe(0);
    expect(e.impotRevenuFrance).toBe(0);
    expect(e.avecScpi?.depassement).toEqual({ plafond: 29579, montant: 401 });
  });

  it('cas G : sans SCPI, impôt du foyer 5 103,99 €, taux moyen 12,76 %, TMI 30 %', () => {
    const e = estimer([], BAREME_PARAMETRES, seul(40000));
    expect(e.foyer).toMatchObject({ impotFoyer: 5103.99, tauxMoyen: 12.76, tmi: 30 });
    expect(e.avecScpi).toEqual({
      tmi: 30,
      tauxMoyen: 12.76,
      depassement: null,
      revenuFrance: 0,
      revenuEtranger: 0,
      impotRevenuFrance: 0,
      impotRevenuEtranger: 0,
      prelevementsSociaux: 0,
    });
    expect(e.impot).toBe(0);
  });

  it('sans changement de tranche : IR = FR × TMI + ET × (TMI − taux moyen avec SCPI)', () => {
    const e = estimer(
      [{ scpiId: 1, revenuAnnuel: 1000, partFrance: 20 }],
      BAREME_PARAMETRES,
      seul(40000),
    );
    const tauxMoyen = (5103.99 + 1000 * 0.3) / 41000;
    expect(e.impotRevenu).toBeCloseTo(200 * 0.3 + 800 * (0.3 - tauxMoyen), 2);
  });
});

describe('règles du 27/11/2026 : simulateur sur 10 ans (Mistral Sélection, délai 4 mois)', () => {
  const mistral = (revenuAnnuel: number) => [{ scpiId: 1, revenuAnnuel, partFrance: 100 }];
  const simuler = (partsScpi: number) => {
    const pleine = (partsScpi * 180 * 6) / 100;
    return estimer(
      mistral(pleine),
      BAREME_PARAMETRES,
      { revenuNetImposable: 28900, situationFamiliale: 'seul', nombreEnfants: 0 },
      undefined,
      {
        periodes: [mistral(pleine)],
        annees: [mistral((pleine / 12) * 8), ...Array.from({ length: 9 }, () => mistral(pleine))],
      },
    );
  };

  it.each([
    // cas, parts, impôt, net annuel, net mensuel, cumul brut, cumul net, TMI, taux moyen
    [1, 100, 380.75, 699.25, 58.27, 10440, 6802.42, 30, 7.0],
    [2, 10, 30.46, 77.54, 6.46, 1044, 749.59, 11, null],
  ] as const)(
    'cas %i : %i parts',
    (_, parts, impot, net, mensuel, cumulBrut, cumulNet, tmi, tauxMoyen) => {
      const e = simuler(parts);
      expect(e.impot).toBeCloseTo(impot, 1);
      expect(e.net).toBeCloseTo(net, 1);
      expect(e.net / 12).toBeCloseTo(mensuel, 1);
      expect(e.cumul.revenus).toBeCloseTo(cumulBrut, 1);
      expect(e.cumul.net).toBeCloseTo(cumulNet, 1);
      expect(e.foyer?.tmi).toBe(11);
      expect(e.avecScpi?.tmi).toBe(tmi);
      if (tauxMoyen !== null) expect(e.avecScpi?.tauxMoyen).toBeCloseTo(tauxMoyen, 2);
    },
  );

  it('cas 1, année 1 (720 € bruts) : IR 86,99 €, PS 123,84 €, net 509,17 €', () => {
    const e = estimer(mistral(720), BAREME_PARAMETRES, {
      revenuNetImposable: 28900,
      situationFamiliale: 'seul',
      nombreEnfants: 0,
    });
    expect(e.impotRevenu).toBeCloseTo(86.99, 1);
    expect(e.prelevementsSociaux).toBeCloseTo(123.84, 1);
    expect(e.net).toBeCloseTo(509.17, 1);
  });
});

describe('barème 2026 (revenus 2025), par part', () => {
  it('0 % jusqu’à 11 600 €, 11 % jusqu’à 29 579 €, 30 % jusqu’à 84 577 €, 41 % jusqu’à 181 917 €, 45 % au-delà', () => {
    expect(BAREME_2026).toEqual([
      { plafond: 11600, taux: 0 },
      { plafond: 29579, taux: 11 },
      { plafond: 84577, taux: 30 },
      { plafond: 181917, taux: 41 },
      { plafond: null, taux: 45 },
    ]);
  });
});

// Résultat de la simulation (décision BA du 28/11/2026) : TMI et taux moyen de chaque période,
// et détail de l'impôt sur toute la durée (somme des années, année 1 comprise)
describe('TMI et taux moyen par période, détail cumulé sur la durée', () => {
  const foyer40000: InformationsFiscales = {
    revenuNetImposable: 40000,
    situationFamiliale: 'seul',
    nombreEnfants: 0,
  };
  // A : française, 1 080 €/an sur 10 ans (720 € l'année 1) ; B : 20 % France, 1 000 €/an
  // en usufruit sur 5 ans
  const a = (revenuAnnuel: number) => ({ scpiId: 1, revenuAnnuel, partFrance: 100 });
  const b = { scpiId: 2, revenuAnnuel: 1000, partFrance: 20 };
  const annee = (n: number) => [a(n === 1 ? 720 : 1080), ...(n <= 5 ? [b] : [])];
  const groupes = {
    periodes: [[a(1080), b], [a(1080)]],
    annees: Array.from({ length: 10 }, (_, i) => annee(i + 1)),
  };

  it('chaque période a sa TMI et son taux moyen ; la réponse garde ceux de la plus haute', () => {
    const e = estimer([a(1080), b], BAREME_PARAMETRES, foyer40000, undefined, groupes);
    expect(e.foyer).toMatchObject({ tmi: 30, tauxMoyen: 12.76 });
    // 42 080 € : impôt 5 727,99 € ; 41 080 € : impôt 5 427,99 €
    expect(e.periodes.map((p) => [p.avecScpi?.tmi, p.avecScpi?.tauxMoyen])).toEqual([
      [30, 13.61],
      [30, 13.21],
    ]);
    expect(e.avecScpi?.tauxMoyen).toBe(13.61);
  });

  it('détail cumulé : somme des 10 années, égal à l’impôt cumulé', () => {
    const e = estimer([a(1080), b], BAREME_PARAMETRES, foyer40000, undefined, groupes);
    expect(e.detailCumul).toEqual({
      revenuFrance: 11440,
      revenuEtranger: 4000,
      impotRevenuFrance: 3432,
      impotRevenuEtranger: 656.65, // somme des montants non arrondis de chaque année
      prelevementsSociaux: 1967.68,
    });
    const d = e.detailCumul!;
    expect(d.revenuFrance + d.revenuEtranger).toBe(e.cumul.revenus);
    expect(d.impotRevenuFrance + d.impotRevenuEtranger + d.prelevementsSociaux).toBeCloseTo(
      e.cumul.impot,
      2,
    );
  });

  it('sans informations fiscales : ni TMI par période, ni détail cumulé', () => {
    const e = estimer([a(1080)], BAREME_PARAMETRES, null, 30, groupes);
    expect(e.periodes[0].avecScpi).toBeNull();
    expect(e.detailCumul).toBeNull();
  });
});
