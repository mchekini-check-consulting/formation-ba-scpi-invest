import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { FournisseurIdentite } from '../auth/fournisseur.js';
import { captureLogs } from '../logging/capture.js';
import { routesPortefeuille } from './routes.js';
import { creerPortefeuilleService, type PortefeuilleService } from './service.js';

const UTILISATEUR = { id: 'u1', email: 'jean@exemple.fr' };
const PORTEFEUILLE = {
  scpis: [
    {
      scpiId: 7,
      scpiNom: 'Transitions Europe',
      gerant: 'Arkéa REIM',
      nombreDossiers: 1,
      montantInvesti: 5000,
      nombreParts: 25,
      revenusMensuels: 30,
      dossiers: [],
    },
  ],
};

function application(service: Partial<PortefeuilleService>, connecte = true) {
  const fournisseur: FournisseurIdentite = {
    creerCompte: vi.fn(),
    connecter: vi.fn(),
    identifiantDe: vi.fn(),
    utilisateurConnecte: vi.fn().mockResolvedValue(connecte ? UTILISATEUR : null),
  };
  const { log, lignes } = captureLogs();
  const app = createApp(vi.fn(), log, {
    routeurs: [routesPortefeuille(service as PortefeuilleService, fournisseur)],
  });
  return { app, lignes };
}

describe('routes du portefeuille (US-20, SCPI-267)', () => {
  it('GET /portefeuille/investissements : investissements de l’investisseur connecté', async () => {
    const lister = vi.fn().mockResolvedValue(PORTEFEUILLE);
    const { app, lignes } = application({ lister });

    await request(app)
      .get('/portefeuille/investissements')
      .set('Authorization', 'Bearer jeton')
      .expect(200, PORTEFEUILLE);

    expect(lister).toHaveBeenCalledWith('u1');
    expect(lignes.at(-1)).toMatchObject({
      layer: 'controller',
      method: 'listerInvestissements',
    });
    expect(JSON.stringify(lignes)).not.toContain('Transitions Europe');
  });

  it('logs métier : comptages sur la ligne de la requête, sans montant ni nom de SCPI', async () => {
    const ligne = (id: number, scpiId: number, statut: 'investissement_actif' | 'refusee') => ({
      id,
      scpiId,
      scpiNom: `SCPI ${scpiId}`,
      gerant: 'Gestion Exemple',
      nombreParts: 5,
      montant: 4321,
      type: 'pleine_propriete' as const,
      mode: 'ponctuel' as const,
      statut,
      demandeLe: new Date('2026-06-01T10:00:00.000Z'),
      jouissanceLe: '2026-08-01',
      referenceVirement: null,
      motifRefus: null,
      tauxDistribution: 6,
    });
    const service = creerPortefeuilleService({
      investissements: vi
        .fn()
        .mockResolvedValue([
          ligne(1, 7, 'investissement_actif'),
          ligne(2, 7, 'refusee'),
          ligne(3, 8, 'investissement_actif'),
        ]),
    });
    const { app, lignes } = application(service);

    await request(app)
      .get('/portefeuille/investissements')
      .set('Authorization', 'Bearer jeton')
      .expect(200);

    const controleur = lignes.find((l) => l.layer === 'controller');
    expect(controleur).toMatchObject({ nombreScpis: 2, nombreDossiers: 3, nombreActifs: 2 });
    // Ni montant, ni nom de SCPI, ni société de gestion, sur aucune ligne
    const texte = JSON.stringify(lignes);
    expect(texte).not.toMatch(/4321|8642|SCPI 7|Gestion Exemple/);
  });

  it('non connecté : 401, service non appelé', async () => {
    const lister = vi.fn();
    const { app } = application({ lister }, false);
    await request(app).get('/portefeuille/investissements').expect(401);
    expect(lister).not.toHaveBeenCalled();
  });
});
