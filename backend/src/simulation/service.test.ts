import { describe, expect, it, vi } from 'vitest';
import { creerSimulationService, type LigneSimulable } from './service.js';

const LIGNE: LigneSimulable = {
  id: 3,
  nom: 'Comète',
  prixPart: 200,
  tauxDistribution: 8.35,
  minimum: 5000,
  delaiJouissance: 5,
  demembrement: true,
  decotes: [
    { duree: 10, partNuePropriete: 68 },
    { duree: 5, partNuePropriete: 80 },
  ],
};

describe('Simulation (US-08) : service', () => {
  it('décote = 100 − part de la nue-propriété, de la plus courte à la plus longue durée', async () => {
    const service = creerSimulationService({ lister: vi.fn().mockResolvedValue([LIGNE]) });
    expect(await service.lister()).toEqual([
      {
        ...LIGNE,
        decotes: [
          { duree: 5, decote: 20 },
          { duree: 10, decote: 32 },
        ],
      },
    ]);
  });
});
