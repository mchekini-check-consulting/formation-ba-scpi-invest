import { describe, expect, it } from 'vitest';
import { creerBoite } from './boite.js';

const dossier = (idMessage: string, idDossier: string) =>
  JSON.stringify({ idMessage, idDossier, investisseur: { nom: 'Martin' } });

describe('boîte de réception de la société de gestion', () => {
  it('garde chaque message, du plus récent au plus ancien, avec sa position Kafka', () => {
    const boite = creerBoite();
    boite.ajouter({
      partition: 0,
      offset: 0n,
      cle: 'D-1',
      valeur: dossier('a', 'D-1'),
      horodatage: 1795700000000n,
    });
    boite.ajouter({
      partition: 0,
      offset: 1n,
      cle: 'D-2',
      valeur: dossier('b', 'D-2'),
      horodatage: 1795700060000n,
    });

    const liste = boite.liste();
    expect(liste.map((m) => m.cle)).toEqual(['D-2', 'D-1']);
    expect(liste[1]).toEqual({
      partition: 0,
      offset: '0',
      cle: 'D-1',
      recuLe: new Date(1795700000000).toISOString(),
      doublon: false,
      invalide: false,
      message: { idMessage: 'a', idDossier: 'D-1', investisseur: { nom: 'Martin' } },
    });
    expect(boite.compteurs()).toEqual({ lus: 2, doublons: 0, invalides: 0 });
  });

  it('même idMessage reçu une 2e fois : marqué doublon (règle C3)', () => {
    const boite = creerBoite();
    boite.ajouter({ partition: 0, offset: 0, valeur: dossier('a', 'D-1') });
    boite.ajouter({ partition: 0, offset: 1, valeur: dossier('a', 'D-1') });
    expect(boite.liste().map((m) => m.doublon)).toEqual([true, false]);
    expect(boite.compteurs().doublons).toBe(1);
  });

  it('même position relue après une reprise : gardée une seule fois', () => {
    const boite = creerBoite();
    boite.ajouter({ partition: 0, offset: 3, valeur: dossier('a', 'D-1') });
    boite.ajouter({ partition: 0, offset: 3, valeur: dossier('a', 'D-1') });
    expect(boite.liste()).toHaveLength(1);
    expect(boite.compteurs()).toEqual({ lus: 1, doublons: 0, invalides: 0 });
  });

  it.each([['pas du json'], ['[1,2]'], ['42'], [null]])(
    'valeur illisible (%s) : invalide, texte brut gardé',
    (valeur) => {
      const boite = creerBoite();
      boite.ajouter({ partition: 0, offset: 0, valeur });
      expect(boite.liste()[0]).toMatchObject({
        invalide: true,
        message: null,
        brut: valeur ?? '',
        recuLe: null,
        cle: null,
      });
      expect(boite.compteurs().invalides).toBe(1);
    },
  );

  it('au plus N messages : les plus anciens sortent', () => {
    const boite = creerBoite(2);
    for (const offset of [0, 1, 2])
      boite.ajouter({ partition: 0, offset, valeur: dossier(`m${offset}`, 'D-1') });
    expect(boite.liste().map((m) => m.offset)).toEqual(['2', '1']);
    expect(boite.compteurs().lus).toBe(3);
  });
});
