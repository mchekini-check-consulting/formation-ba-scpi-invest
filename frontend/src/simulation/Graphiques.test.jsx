import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Barres } from './Graphiques.jsx';
import { libellesSousBarre } from './repartitions.js';

afterEach(cleanup);

const barre = (nom, mentions, brut = 1000) => ({ cle: nom, nom, mentions, brut, net: brut * 0.7 });

describe('Revenus annuels par SCPI : libellés sous les barres', () => {
  it('nom et mentions coupés au nombre de caractères de la colonne', () => {
    const libelles = libellesSousBarre(
      barre('Transitions Europe', [
        'Nue-propriété, de l’année 4 à l’année 5',
        '(fin du démembrement : année 3)',
      ]),
      15,
    );
    expect(libelles.nom).toEqual(['Transitions', 'Europe']);
    expect(libelles.mentions.every((l) => l.length <= 15)).toBe(true);
    expect(libelles.mentions.join(' ')).toBe(
      'Nue-propriété, de l’année 4 à l’année 5 (fin du démembrement : année 3)',
    );
  });

  it('5 SCPI : aucune ligne plus large que sa colonne (graphique de 520 px)', () => {
    const { container } = render(
      <Barres
        barres={[
          barre('Activimmo', ['De l’année 1 à l’année 10'], 33672),
          barre('Comète', ['Usufruit, de l’année 1 à l’année 5']),
          barre('Transitions Europe', [
            'Nue-propriété, de l’année 4 à l’année 5',
            '(fin du démembrement : année 3)',
          ]),
          barre('Primofamily', ['De l’année 1 à l’année 20'], 337),
          barre('Novapierre 1', ['De l’année 1 à l’année 13'], 99),
        ]}
      />,
    );
    // (520 − 16) ÷ 5 = 100,8 px par colonne : 15 caractères de 6 px au plus par ligne
    const textes = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    const sousLesBarres = textes.filter((t) => !t.includes('€'));
    expect(sousLesBarres.length).toBeGreaterThan(5);
    expect(sousLesBarres.filter((t) => t.length > 15)).toEqual([]);
    expect(sousLesBarres).toContain('Usufruit, de');
  });
});
