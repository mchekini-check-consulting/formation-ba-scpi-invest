import { describe, expect, it, vi } from 'vitest';
import {
  creerPortefeuilleService,
  type LigneInvestissement,
  premierDuMois,
  regrouper,
  revenuMensuel,
} from './service.js';

const AUJOURDHUI = new Date('2026-11-17T10:00:00.000Z');

let prochainId = 1;
function ligne(valeurs: Partial<LigneInvestissement> = {}): LigneInvestissement {
  return {
    id: prochainId++,
    scpiId: 1,
    scpiNom: 'Transitions Europe',
    gerant: 'Arkéa REIM',
    nombreParts: 10,
    montant: 1000,
    type: 'pleine_propriete',
    mode: 'ponctuel',
    statut: 'investissement_actif',
    demandeLe: new Date('2026-06-01T10:00:00.000Z'),
    jouissanceLe: '2026-08-01',
    referenceVirement: null,
    motifRefus: null,
    tauxDistribution: 7.2,
    ...valeurs,
  };
}

describe('premierDuMois', () => {
  it('premier jour du mois, à l’heure de Paris', () => {
    expect(premierDuMois(AUJOURDHUI)).toBe('2026-11-01');
    // 30/11 à 23h30 UTC = 1er décembre à Paris
    expect(premierDuMois(new Date('2026-11-30T23:30:00.000Z'))).toBe('2026-12-01');
  });
});

describe('revenuMensuel (C6, règle commune de l’epic)', () => {
  it('montant × taux ÷ 12 pour un investissement actif en jouissance', () => {
    expect(revenuMensuel(ligne({ montant: 12000, tauxDistribution: 7 }), AUJOURDHUI)).toBe(70);
  });

  it('jouissance au 1er du mois en cours : compte', () => {
    expect(revenuMensuel(ligne({ jouissanceLe: '2026-11-01' }), AUJOURDHUI)).toBeGreaterThan(0);
  });

  it.each([
    ['pas actif', { statut: 'acceptee_attente_paiement' as const }],
    ['nue-propriété', { type: 'nue_propriete' as const }],
    ['jouissance après le 1er du mois', { jouissanceLe: '2026-11-02' }],
    ['sans date de jouissance', { jouissanceLe: null }],
    ['taux de distribution inconnu', { tauxDistribution: null }],
  ])('0 si %s', (_cas, valeurs) => {
    expect(revenuMensuel(ligne(valeurs), AUJOURDHUI)).toBe(0);
  });

  it('usufruit : produit un revenu', () => {
    expect(revenuMensuel(ligne({ type: 'usufruit', montant: 1200, tauxDistribution: 5 }), AUJOURDHUI)).toBe(5);
  });
});

describe('regrouper (US-20, SCPI-267)', () => {
  it('critère d’acceptation : 3 dossiers, 7 000 € investis (le refusé ne compte pas)', () => {
    const { scpis } = regrouper(
      [
        ligne({ montant: 5000, nombreParts: 25 }),
        ligne({ montant: 2000, nombreParts: 10 }),
        ligne({ montant: 1000, nombreParts: 5, statut: 'refusee', motifRefus: 'Dossier incomplet' }),
      ],
      AUJOURDHUI,
    );
    expect(scpis).toHaveLength(1);
    expect(scpis[0]).toMatchObject({
      scpiNom: 'Transitions Europe',
      gerant: 'Arkéa REIM',
      nombreDossiers: 3,
      montantInvesti: 7000,
      nombreParts: 35,
      revenusMensuels: 42, // 7 000 × 7,2 % ÷ 12
    });
    // Le dossier refusé affiche son motif
    expect(scpis[0].dossiers.find((d) => d.statut === 'refusee')?.motifRefus).toBe(
      'Dossier incomplet',
    );
  });

  it('règle 2 : SCPI triées par montant investi décroissant, puis par nom', () => {
    const { scpis } = regrouper(
      [
        ligne({ scpiId: 1, scpiNom: 'Petite', montant: 1000 }),
        ligne({ scpiId: 2, scpiNom: 'Grande', montant: 9000 }),
        ligne({ scpiId: 3, scpiNom: 'Zéro B', montant: 4000, statut: 'demande_envoyee' }),
        ligne({ scpiId: 4, scpiNom: 'Zéro A', montant: 3000, statut: 'refusee' }),
      ],
      AUJOURDHUI,
    );
    expect(scpis.map((s) => [s.scpiNom, s.montantInvesti])).toEqual([
      ['Grande', 9000],
      ['Petite', 1000],
      ['Zéro A', 0],
      ['Zéro B', 0],
    ]);
  });

  it('règle 3 : dossiers du plus récent au plus ancien, avec l’information de leur statut', () => {
    const ancien = ligne({
      demandeLe: new Date('2026-01-10T10:00:00.000Z'),
      jouissanceLe: '2026-03-01',
    });
    const enAttente = ligne({
      demandeLe: new Date('2026-10-10T10:00:00.000Z'),
      statut: 'acceptee_attente_paiement',
      referenceVirement: 'SIP-REF-1',
      jouissanceLe: '2027-01-01',
      motifRefus: 'ignoré',
    });
    const envoye = ligne({
      demandeLe: new Date('2026-11-10T10:00:00.000Z'),
      statut: 'demande_envoyee',
      referenceVirement: 'ignorée',
    });
    const { scpis } = regrouper([ancien, enAttente, envoye], AUJOURDHUI);
    const dossiers = scpis[0].dossiers;
    expect(dossiers.map((d) => d.id)).toEqual([envoye.id, enAttente.id, ancien.id]);
    expect(dossiers[0]).toEqual({
      id: envoye.id,
      numero: `D-${envoye.id}`,
      demandeLe: '2026-11-10T10:00:00.000Z',
      mode: 'ponctuel',
      type: 'pleine_propriete',
      nombreParts: 10,
      montant: 1000,
      statut: 'demande_envoyee',
      jouissanceLe: null,
      referenceVirement: null,
      motifRefus: null,
    });
    expect(dossiers[1]).toMatchObject({
      referenceVirement: 'SIP-REF-1',
      jouissanceLe: null,
      motifRefus: null,
    });
    expect(dossiers[2]).toMatchObject({ jouissanceLe: '2026-03-01', referenceVirement: null });
  });

  it('même date de demande : le plus grand numéro d’abord', () => {
    const demandeLe = new Date('2026-05-05T10:00:00.000Z');
    const a = ligne({ demandeLe });
    const b = ligne({ demandeLe });
    expect(regrouper([a, b], AUJOURDHUI).scpis[0].dossiers.map((d) => d.id)).toEqual([b.id, a.id]);
  });

  it('nom et société de gestion : ceux du dossier le plus récent ; montants arrondis au centime', () => {
    const { scpis } = regrouper(
      [
        ligne({ scpiNom: 'Ancien nom', demandeLe: new Date('2026-01-01T00:00:00.000Z') }),
        ligne({
          scpiNom: 'Nouveau nom',
          gerant: null,
          montant: 1000.1,
          tauxDistribution: 5,
          demandeLe: new Date('2026-02-01T00:00:00.000Z'),
        }),
      ],
      AUJOURDHUI,
    );
    expect(scpis[0]).toMatchObject({
      scpiNom: 'Nouveau nom',
      gerant: null,
      montantInvesti: 2000.1,
      revenusMensuels: 10.17, // 6,00 € + 4,17 €
    });
  });

  it('aucun dossier : liste vide', () => {
    expect(regrouper([], AUJOURDHUI)).toEqual({ scpis: [] });
  });
});

describe('creerPortefeuilleService', () => {
  it('lister : lit les dossiers de l’investisseur et les regroupe', async () => {
    const investissements = vi.fn().mockResolvedValue([ligne({ montant: 3000 })]);
    const service = creerPortefeuilleService({ investissements }, () => AUJOURDHUI);
    const { scpis } = await service.lister('u1');
    expect(investissements).toHaveBeenCalledWith('u1');
    expect(scpis[0].montantInvesti).toBe(3000);
  });

  it('date du jour par défaut', async () => {
    const service = creerPortefeuilleService({ investissements: vi.fn().mockResolvedValue([]) });
    expect(await service.lister('u1')).toEqual({ scpis: [] });
  });
});
