import { describe, expect, it, vi } from 'vitest';
import { captureLogs } from '../logging/capture.js';
import {
  creerAccuseReceptionService,
  lireAccuse,
  MOTIFS,
  type DepotAccuseReception,
  type ResultatEnregistrement,
} from './accuse-service.js';

const TOPIC = 'scpi.souscription.accuse-reception.v1';
const DLQ = 'scpi.souscription.accuse-reception.v1.dlq';

const accuse = (champs: Record<string, unknown> = {}) =>
  JSON.stringify({
    idMessage: 'm-1',
    idDossier: 'D-1041',
    dateReception: '2026-11-18T09:15:00Z',
    ...champs,
  });

function preparer(resultat: ResultatEnregistrement = 'statut_change') {
  const depot: DepotAccuseReception = { enregistrer: vi.fn().mockResolvedValue(resultat) };
  const publier = vi.fn().mockResolvedValue({ topic: DLQ, partition: 0, offset: '0' });
  const { log, lignes } = captureLogs();
  const service = creerAccuseReceptionService(depot, { publier }, log);
  const traiter = (valeur: string | null, cle: string | null = 'D-1041') =>
    service.traiter({ topic: TOPIC, cle, valeur });
  return { depot, publier, lignes, traiter };
}

describe('lecture d’un accusé de réception (C3)', () => {
  it('message complet : accusé avec le numéro du dossier et la date', () => {
    expect(lireAccuse(JSON.parse(accuse()))).toEqual({
      accuse: {
        idMessage: 'm-1',
        idDossier: 1041,
        dateReception: new Date('2026-11-18T09:15:00Z'),
      },
    });
  });

  it.each([
    [null, MOTIFS.illisible],
    [{ idDossier: 'D-1', dateReception: '2026-11-18' }, MOTIFS.idMessage],
    [{ idMessage: ' ', idDossier: 'D-1', dateReception: '2026-11-18' }, MOTIFS.idMessage],
    [{ idMessage: 'a', dateReception: '2026-11-18' }, MOTIFS.idDossier],
    [{ idMessage: 'a', idDossier: '1041', dateReception: '2026-11-18' }, MOTIFS.idDossier],
    [{ idMessage: 'a', idDossier: 'D-1' }, MOTIFS.dateReception],
    [{ idMessage: 'a', idDossier: 'D-1', dateReception: 'hier' }, MOTIFS.dateReception],
  ])('message %j : rejeté (%s)', (json, motif) => {
    expect(lireAccuse(json)).toEqual({ motif });
  });
});

describe('accusé de réception de la SCPI (US-13)', () => {
  // Scénario « accusé de réception »
  it('dossier « Demande envoyée » : enregistré, passe à « Demande reçue »', async () => {
    const { depot, publier, lignes, traiter } = preparer('statut_change');
    expect(await traiter(accuse({ dateReception: '2026-11-18T09:15:00Z' }))).toBe('traite');
    expect(depot.enregistrer).toHaveBeenCalledWith(
      { idMessage: 'm-1', idDossier: 1041, dateReception: new Date('2026-11-18T09:15:00Z') },
      TOPIC,
    );
    expect(publier).not.toHaveBeenCalled();
    expect(lignes).toContainEqual(
      expect.objectContaining({
        layer: 'service',
        msg: 'Accusé de réception : dossier passé à « Demande reçue »',
        resultat: 'statut_change',
        idDossier: 'D-1041',
      }),
    );
  });

  // Scénario « accusé tardif »
  it('dossier plus avancé : date seule', async () => {
    const { lignes, traiter } = preparer('date_seule');
    expect(await traiter(accuse({ idDossier: 'D-1015' }))).toBe('traite');
    expect(lignes).toContainEqual(
      expect.objectContaining({
        msg: 'Accusé de réception tardif : date enregistrée, statut inchangé',
        idDossier: 'D-1015',
      }),
    );
  });

  // Scénario « doublon »
  it('idMessage déjà traité : ignoré, rien publié', async () => {
    const { publier, traiter } = preparer('doublon');
    expect(await traiter(accuse())).toBe('doublon');
    expect(publier).not.toHaveBeenCalled();
  });

  // Scénario « dossier inconnu »
  it('dossier inconnu : publié sur le topic d’erreur avec le motif', async () => {
    const { publier, lignes, traiter } = preparer('dossier_inconnu');
    expect(await traiter(accuse({ idDossier: 'D-9999' }), 'D-9999')).toBe('rejete');
    expect(publier).toHaveBeenCalledWith(DLQ, 'D-9999', {
      motif: MOTIFS.dossierInconnu,
      topic: TOPIC,
      rejeteLe: expect.any(String),
      message: JSON.parse(accuse({ idDossier: 'D-9999' })),
    });
    expect(lignes).toContainEqual(
      expect.objectContaining({ level: 'WARN', resultat: 'rejete', motif: MOTIFS.dossierInconnu }),
    );
  });

  it('champ manquant : rien enregistré, publié sur le topic d’erreur', async () => {
    const { depot, publier, traiter } = preparer();
    expect(await traiter(accuse({ dateReception: undefined }))).toBe('rejete');
    expect(depot.enregistrer).not.toHaveBeenCalled();
    expect(publier).toHaveBeenCalledWith(
      DLQ,
      'D-1041',
      expect.objectContaining({ motif: MOTIFS.dateReception }),
    );
  });

  it('message illisible, sans clé : texte brut publié sur le topic d’erreur', async () => {
    const { publier, traiter } = preparer();
    expect(await traiter('pas du json', null)).toBe('rejete');
    expect(publier).toHaveBeenCalledWith(
      DLQ,
      'inconnu',
      expect.objectContaining({ motif: MOTIFS.illisible, message: 'pas du json' }),
    );
  });

  it('topic d’erreur indisponible : l’erreur remonte (message relu plus tard)', async () => {
    const { publier, traiter } = preparer('dossier_inconnu');
    publier.mockRejectedValue(new Error('Kafka indisponible'));
    await expect(traiter(accuse())).rejects.toThrow('Kafka indisponible');
  });
});
