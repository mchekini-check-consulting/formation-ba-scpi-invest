import { describe, expect, it } from 'vitest';
import {
  detailDossier,
  libelleModeCourt,
  libelleStatutCourt,
  nombreDossiers,
  nombreScpis,
} from './investissements.js';

describe('libellés de « Mon portefeuille » (US-20)', () => {
  it('mode d’investissement court', () => {
    expect(libelleModeCourt('ponctuel')).toBe('Ponctuelle');
    expect(libelleModeCourt('programme')).toBe('Programmé');
    expect(libelleModeCourt('inconnu')).toBe('inconnu');
  });

  it('statut court du tableau', () => {
    expect(libelleStatutCourt('investissement_actif')).toBe('Actif');
    expect(libelleStatutCourt('acceptee_attente_paiement')).toBe('En attente de paiement');
    expect(libelleStatutCourt('refusee')).toBe('Refusée');
    expect(libelleStatutCourt('demande_envoyee')).toBe('Demande envoyée');
  });

  it('pastilles du bandeau : singulier et pluriel', () => {
    expect(nombreScpis(1)).toBe('1 SCPI');
    expect(nombreScpis(3)).toBe('3 SCPI');
    expect(nombreDossiers(1)).toBe('1 dossier');
    expect(nombreDossiers(6)).toBe('6 dossiers');
  });

  it('détail selon le statut (règle 3)', () => {
    expect(detailDossier({ statut: 'investissement_actif', jouissanceLe: '2026-08-01' })).toBe(
      'Jouissance le 01/08/2026',
    );
    expect(detailDossier({ statut: 'acceptee_attente_paiement', referenceVirement: 'SIP-1' })).toBe(
      'Réf. virement : SIP-1',
    );
    expect(detailDossier({ statut: 'refusee', motifRefus: 'Dossier incomplet' })).toBe(
      'Motif : Dossier incomplet',
    );
    expect(detailDossier({ statut: 'refusee', motifRefus: null })).toBeNull();
    expect(detailDossier({ statut: 'investissement_actif', jouissanceLe: null })).toBeNull();
    expect(detailDossier({ statut: 'demande_envoyee' })).toBeNull();
  });
});
