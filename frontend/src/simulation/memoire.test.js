import { afterEach, describe, expect, it } from 'vitest';
import { garderSimulation, lireSimulationEnCours, oublierSimulation } from './memoire.js';

afterEach(oublierSimulation);

describe('simulation en cours gardée pendant la visite', () => {
  it('rien au départ ; gardée puis relue ; oubliée', () => {
    expect(lireSimulationEnCours()).toBeNull();
    const simulation = { origine: null, lignes: [{ cle: 1 }], taux: 11 };
    garderSimulation(simulation);
    expect(lireSimulationEnCours()).toBe(simulation);
    oublierSimulation();
    expect(lireSimulationEnCours()).toBeNull();
  });
});
