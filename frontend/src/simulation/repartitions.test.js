import { describe, expect, it } from 'vitest';
import {
  AUTRES,
  PARTS_MAX,
  couperTexte,
  lignesDuNom,
  repartition,
  revenusParScpi,
} from './repartitions.js';

const scpi = (nom, pays, secteurs = []) => ({ nom, pays, secteurs });
const p = (libelle, part) => ({ libelle, part });

describe('répartition pondérée par les montants (US-09, règle 11)', () => {
  it('scénario : 60 000 € 100 % France + 40 000 € 50 % France / 50 % Espagne', () => {
    const { parts, sansRepartition } = repartition(
      [
        { scpi: scpi('A', [p('France', 100)]), montant: 60000 },
        { scpi: scpi('B', [p('France', 50), p('Espagne', 50)]), montant: 40000 },
      ],
      'pays',
    );
    expect(parts.map(({ nom, part }) => [nom, part])).toEqual([
      ['France', 80],
      ['Espagne', 20],
    ]);
    expect(parts[0].couleur).toMatch(/^#/);
    expect(sansRepartition).toEqual([]);
  });

  it('libellés du référentiel réunis sous le nom affiché (Gde Bretagne)', () => {
    const { parts } = repartition(
      [{ scpi: scpi('A', [p('Gde Bretagne', 40), p('GdeBretagne', 60)]), montant: 100 }],
      'pays',
    );
    expect(parts).toMatchObject([{ nom: 'Royaume-Uni', part: 100 }]);
  });

  it('secteurs : libellés tels quels', () => {
    const { parts } = repartition(
      [{ scpi: scpi('A', [], [p('Santé', 70), p('Bureaux', 30)]), montant: 100 }],
      'secteurs',
    );
    expect(parts.map((x) => x.nom)).toEqual(['Santé', 'Bureaux']);
  });

  it('règle 12 : SCPI sans répartition signalée et exclue du calcul', () => {
    const { parts, sansRepartition } = repartition(
      [
        { scpi: scpi('A', [p('France', 100)]), montant: 100 },
        { scpi: scpi('Sans', []), montant: 900 },
        { scpi: scpi('Sans', []), montant: 50 },
      ],
      'pays',
    );
    expect(parts).toMatchObject([{ nom: 'France', part: 100 }]);
    expect(sansRepartition).toEqual(['Sans']);
  });

  it(`règle 10 : au-delà de ${PARTS_MAX}, les plus petites dans « Autres », avec celle du référentiel`, () => {
    const pays = Array.from({ length: 10 }, (_, i) => p(`Pays ${i + 1}`, 10 - i));
    pays.push(p('Autres', 0.5));
    const { parts } = repartition([{ scpi: scpi('A', pays), montant: 1000 }], 'pays');
    expect(parts).toHaveLength(PARTS_MAX + 1);
    expect(parts.at(-1)).toMatchObject({ nom: AUTRES, part: 3.5 });
    expect(parts[0]).toMatchObject({ nom: 'Pays 1', part: 10 });
  });

  it('aucune ligne : rien à afficher', () => {
    expect(repartition([], 'pays')).toEqual({ parts: [], sansRepartition: [] });
  });
});

describe('revenus annuels par SCPI (barres brut et après fiscalité)', () => {
  const pp = (nom, revenuAnnuel, tauxImpot, duree = 10) => ({
    scpi: { nom },
    type: 'pleine-propriete',
    demembrement: 0,
    duree,
    revenuAnnuel,
    tauxImpot,
  });
  const ANS_10 = ['De l’année 1 à l’année 10'];

  it('lignes d’une même SCPI et d’une même durée réunies, de la plus forte à la plus faible', () => {
    expect(revenusParScpi([pp('A', 100, 0.3), pp('B', 300, 0.5), pp('A', 250, 0.2)])).toEqual([
      { cle: 'A · 10', nom: 'A', mentions: ANS_10, brut: 350, net: 270 },
      { cle: 'B · 10', nom: 'B', mentions: ANS_10, brut: 300, net: 150 },
    ]);
  });

  it('durées différentes : une barre par durée de placement', () => {
    expect(revenusParScpi([pp('A', 100, 0.3), pp('A', 100, 0.3, 1)])).toEqual([
      { cle: 'A · 1', nom: 'A', mentions: ['Année 1'], brut: 100, net: 70 },
      { cle: 'A · 10', nom: 'A', mentions: ANS_10, brut: 100, net: 70 },
    ]);
  });

  it('impôt pas encore connu : après fiscalité absent', () => {
    expect(revenusParScpi([pp('A', 100, 0.3), pp('A', 100, null)])).toEqual([
      { cle: 'A · 10', nom: 'A', mentions: ANS_10, brut: 200, net: null },
    ]);
  });

  it('démembrement : une barre par durée, avec ses années de revenus', () => {
    const ligne = (nom, type, demembrement, duree = 10) => ({
      scpi: { nom },
      type,
      demembrement,
      duree,
      revenuAnnuel: 1000,
      tauxImpot: 0.3,
    });
    expect(
      revenusParScpi([
        ligne('U', 'usufruit', 5),
        ligne('N', 'nue-propriete', 7, 12),
        ligne('Longue', 'nue-propriete', 10),
        ligne('Toute', 'usufruit', 15),
      ]),
    ).toEqual([
      {
        cle: 'N · nue-propriete 7 · 12',
        nom: 'N',
        mentions: ['Nue-propriété, de l’année 8 à l’année 12', '(fin du démembrement : année 7)'],
        brut: 1000,
        net: 700,
      },
      {
        cle: 'Toute · usufruit 15 · 10',
        nom: 'Toute',
        mentions: ['Usufruit, de l’année 1 à l’année 10'],
        brut: 1000,
        net: 700,
      },
      {
        cle: 'U · usufruit 5 · 10',
        nom: 'U',
        mentions: [
          'Usufruit, de l’année 1 à l’année 5',
          '(fin du démembrement), puis aucun revenu',
        ],
        brut: 1000,
        net: 700,
      },
      {
        cle: 'Longue · nue-propriete 10 · 10',
        nom: 'Longue',
        mentions: ['Nue-propriété, démembrement de 10 ans'],
        brut: 0,
        net: 0,
      },
    ]);
  });

  it('nom en entier, sur deux lignes s’il est long', () => {
    expect(lignesDuNom('Transitions Europe')).toEqual(['Transitions Europe']);
    expect(lignesDuNom('Pierval Santé Europe Opportunités')).toEqual([
      'Pierval Santé Europe',
      'Opportunités',
    ]);
    expect(lignesDuNom('Supercalifragilisticexpialidocious')).toEqual([
      'Supercalifragilisticexpialidocious',
    ]);
  });
});

describe('libellés sous les barres coupés à la largeur de la colonne', () => {
  it('coupe entre deux mots, sans dépasser la longueur ; un mot trop long reste entier', () => {
    expect(couperTexte('Usufruit, de l’année 1 à l’année 5', 15)).toEqual([
      'Usufruit, de',
      'l’année 1 à',
      'l’année 5',
    ]);
    expect(couperTexte('De l’année 1 à l’année 10', 40)).toEqual(['De l’année 1 à l’année 10']);
    expect(couperTexte('(fin du démembrement : année 3)', 10)).toEqual([
      '(fin du',
      'démembrement',
      ': année 3)',
    ]);
  });
});
