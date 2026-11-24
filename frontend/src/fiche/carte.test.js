import { describe, expect, it } from 'vitest';
import { chargerMonde, dessinerCarte, HAUTEUR, LARGEUR } from './carte.js';
import { listePays } from './donnees.js';

const monde = await chargerMonde();

const parts = (...liste) => listePays(liste.map(([libelle, part]) => ({ libelle, part })));

describe('Fiche SCPI (US-02) : carte des pays', () => {
  it('pays présents colorés, avec une étiquette chacun, dans le cadre de la carte', () => {
    const carte = dessinerCarte(
      monde,
      parts(['France', 30.28], ['GdeBretagne', 24.8], ['Pays-Bas', 12.95], ['Portugal', 2.22]),
    );
    expect(carte.presents.map((p) => [p.iso, p.couleur])).toEqual(
      expect.arrayContaining([
        [250, '#5b2ee6'],
        [826, '#3d6ef0'],
        [528, '#3d6ef0'],
        [620, '#6fdcbf'],
      ]),
    );
    expect(carte.presents.every((p) => p.d.startsWith('M'))).toBe(true);
    expect(carte.fonds.length).toBeGreaterThan(10);
    for (const e of carte.etiquettes) {
      expect(e.x).toBeGreaterThan(0);
      expect(e.x).toBeLessThan(LARGEUR);
      expect(e.y).toBeGreaterThan(0);
      expect(e.y).toBeLessThan(HAUTEUR);
    }
    const paysBas = carte.etiquettes.find((e) => e.iso === 528);
    expect(paysBas).toMatchObject({ nom: 'Pays-Bas', part: 12.95, trait: expect.any(Object) });
    expect(carte.etiquettes.find((e) => e.iso === 250).trait).toBeNull();
  });

  it('zoom sur les pays de la SCPI : les îles lointaines ne l’élargissent pas', () => {
    const carte = dessinerCarte(monde, parts(['France', 60], ['Portugal', 20], ['Espagne', 20]));
    const france = carte.etiquettes.find((e) => e.iso === 250);
    // France au centre de la carte (sans les Açores ni les Canaries, le zoom reste serré)
    expect(france.x).toBeGreaterThan(LARGEUR * 0.35);
    expect(france.y).toBeLessThan(HAUTEUR * 0.6);
  });

  it('pays sans réglage d’étiquette : étiquette au centre du pays', () => {
    const carte = dessinerCarte(monde, [
      { nom: 'Suisse', iso: 756, part: 100, couleur: '#5b2ee6' },
    ]);
    expect(carte.etiquettes).toEqual([expect.objectContaining({ nom: 'Suisse', trait: null })]);
  });

  it('aucun pays connu de la carte : pas de carte', () => {
    expect(dessinerCarte(monde, parts(['Autres', 100]))).toBeNull();
    expect(dessinerCarte(monde, [{ nom: 'Nulle part', iso: 999, part: 100 }])).toBeNull();
  });
});
