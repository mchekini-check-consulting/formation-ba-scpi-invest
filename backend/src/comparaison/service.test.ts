import { describe, expect, it, vi } from 'vitest';
import { creerComparaisonService, evolutionDuPrix, type LigneComparable } from './service.js';

const LIGNE: LigneComparable = {
  id: 3,
  nom: 'Comète',
  tauxDistribution: 8,
  anneeTaux: 2025,
  prix: [
    { annee: 2020, prix: 200 },
    { annee: 2025, prix: 250 },
  ],
  minimum: 5000,
  capitalisation: null,
  fraisSouscription: 12,
  fraisGestion: 10,
  delaiJouissance: 6,
  frequence: 'Trimestrielle',
  demembrement: false,
  versementProgramme: false,
  paysPrincipal: { libelle: 'France', part: 70 },
  secteurPrincipal: null,
};

describe('Comparateur (US-04) : service', () => {
  it('prix de part = prix le plus récent, évolution sur la période', async () => {
    const service = creerComparaisonService({ lister: vi.fn().mockResolvedValue([LIGNE]) });
    const [scpi] = await service.lister();
    expect(scpi).not.toHaveProperty('prix');
    expect(scpi).toMatchObject({
      id: 3,
      prixPart: 250,
      capitalisation: null,
      evolutionPrix: {
        debut: { annee: 2020, prix: 200 },
        fin: { annee: 2025, prix: 250 },
        variation: 25,
      },
    });
  });

  it('sans prix : prix de part et évolution non renseignés', async () => {
    const service = creerComparaisonService({
      lister: vi.fn().mockResolvedValue([{ ...LIGNE, prix: [] }]),
    });
    expect(await service.lister()).toMatchObject([{ prixPart: null, evolutionPrix: null }]);
  });

  it('évolution : au moins deux prix, variation arrondie à deux décimales', () => {
    expect(evolutionDuPrix([{ annee: 2025, prix: 250 }])).toBeNull();
    expect(
      evolutionDuPrix([
        { annee: 2022, prix: 1100 },
        { annee: 2023, prix: 1050 },
        { annee: 2025, prix: 1135 },
      ]),
    ).toEqual({
      debut: { annee: 2022, prix: 1100 },
      fin: { annee: 2025, prix: 1135 },
      variation: 3.18,
    });
  });
});
