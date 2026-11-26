import { describe, expect, it, vi } from 'vitest';
import type { CanalKafka } from '../kafka/producteur.js';
import { captureLogs } from '../logging/capture.js';
import { dossierExemple } from './exemple.js';
import type { DossierATransmettre } from './message.js';
import { creerTransmissionService, MAX_PAR_PASSAGE, type DepotTransmission } from './service.js';

const TOPIC = 'scpi.souscription.dossier.v1';

// Faux dépôt : dossiers en mémoire ; transmis seulement si la publication réussit (comme
// la transaction de depotTransmission)
function fauxDepot(dossiers: DossierATransmettre[], sansCode = 0) {
  const transmis = new Set<number>();
  const depot: DepotTransmission = {
    async transmettreProchain(publier) {
      const prochain = dossiers.find((d) => !transmis.has(d.id));
      if (!prochain) return false;
      await publier(prochain);
      transmis.add(prochain.id);
      return true;
    },
    enAttenteSansCode: async () => sansCode,
  };
  return { depot, transmis };
}

function fauxCanal(
  publier = vi.fn().mockResolvedValue({ topic: TOPIC, partition: 0, offset: '0' }),
) {
  return { canal: { active: true, publier, fermer: vi.fn() } as CanalKafka, publier };
}

describe('transmission des dossiers (US-12)', () => {
  it('publie chaque dossier non transmis, clé = idDossier, message C3', async () => {
    const { depot } = fauxDepot([dossierExemple(), dossierExemple({ id: 1042 })]);
    const { canal, publier } = fauxCanal();
    const service = creerTransmissionService(depot, canal, TOPIC, captureLogs().log);

    expect(await service.transmettre()).toEqual({
      transmis: 2,
      enAttenteSansCode: 0,
      erreur: null,
    });
    expect(publier).toHaveBeenCalledTimes(2);
    expect(publier).toHaveBeenNthCalledWith(
      1,
      TOPIC,
      'D-1041',
      expect.objectContaining({ idDossier: 'D-1041', codeSCPI: 'TREU', montant: 1000 }),
    );
  });

  // US-12, scénario « pas de double envoi »
  it('dossier déjà transmis : aucun nouveau message au passage suivant', async () => {
    const { depot } = fauxDepot([dossierExemple()]);
    const { canal, publier } = fauxCanal();
    const service = creerTransmissionService(depot, canal, TOPIC, captureLogs().log);

    await service.transmettre();
    expect(await service.transmettre()).toMatchObject({ transmis: 0 });
    expect(publier).toHaveBeenCalledTimes(1);
  });

  // US-12, scénario « Kafka indisponible »
  it('Kafka indisponible puis revenu : publié une seule fois, même idMessage', async () => {
    const { depot, transmis } = fauxDepot([dossierExemple()]);
    const publier = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Connection refused'), { name: 'NetworkError' }),
      )
      .mockResolvedValue({ topic: TOPIC, partition: 0, offset: '0' });
    const { canal } = fauxCanal(publier);
    const service = creerTransmissionService(depot, canal, TOPIC, captureLogs().log);

    expect(await service.transmettre()).toEqual({
      transmis: 0,
      enAttenteSansCode: 0,
      erreur: 'NetworkError',
    });
    expect(transmis.size).toBe(0);
    expect(await service.transmettre()).toMatchObject({ transmis: 1, erreur: null });
    expect(publier.mock.calls[0][2].idMessage).toBe(publier.mock.calls[1][2].idMessage);
    expect(await service.transmettre()).toMatchObject({ transmis: 0 });
    expect(publier).toHaveBeenCalledTimes(2);
  });

  it('arrêt à la première erreur : les dossiers suivants attendent le passage suivant', async () => {
    const { depot } = fauxDepot([dossierExemple(), dossierExemple({ id: 1042 })]);
    const { canal, publier } = fauxCanal(vi.fn().mockRejectedValue(new Error('panne')));
    await creerTransmissionService(depot, canal, TOPIC, captureLogs().log).transmettre();
    expect(publier).toHaveBeenCalledTimes(1);
  });

  it('au plus MAX_PAR_PASSAGE dossiers par passage', async () => {
    const dossiers = Array.from({ length: MAX_PAR_PASSAGE + 3 }, (_, i) =>
      dossierExemple({ id: i + 1 }),
    );
    const { depot } = fauxDepot(dossiers);
    const { canal } = fauxCanal();
    const service = creerTransmissionService(depot, canal, TOPIC, captureLogs().log);
    expect(await service.transmettre()).toMatchObject({ transmis: MAX_PAR_PASSAGE });
    expect(await service.transmettre()).toMatchObject({ transmis: 3 });
  });

  it('logs : compteurs seulement, jamais de donnée de l’investisseur (RG5)', async () => {
    const { log, lignes } = captureLogs('debug');
    const { depot } = fauxDepot([dossierExemple()], 2);
    const { canal } = fauxCanal(vi.fn().mockRejectedValue(new Error('Connection refused')));
    await creerTransmissionService(depot, canal, TOPIC, log).transmettre();

    expect(lignes).toContainEqual(
      expect.objectContaining({
        level: 'WARN',
        layer: 'service',
        class: 'TransmissionService',
        msg: 'Transmission des dossiers interrompue, reprise au passage suivant',
        transmis: 0,
        errorMessage: 'Connection refused',
      }),
    );
    expect(lignes).toContainEqual(
      expect.objectContaining({ level: 'WARN', msg: "2 dossier(s) en attente d'un code SCPI" }),
    );
    const texte = JSON.stringify(lignes);
    for (const donnee of ['Martin', 'Claire', 'investisseur@exemple.test', 'cni.pdf', 'D-1041']) {
      expect(texte).not.toContain(donnee);
    }
  });

  it('dossiers transmis : log info avec le nombre', async () => {
    const { log, lignes } = captureLogs();
    const { depot } = fauxDepot([dossierExemple()]);
    await creerTransmissionService(depot, fauxCanal().canal, TOPIC, log).transmettre();
    expect(lignes).toContainEqual(
      expect.objectContaining({
        level: 'INFO',
        msg: '1 dossier(s) transmis à la SCPI',
        transmis: 1,
      }),
    );
  });

  it('rien à transmettre : aucun log métier hors debug', async () => {
    const { log, lignes } = captureLogs();
    await creerTransmissionService(
      fauxDepot([]).depot,
      fauxCanal().canal,
      TOPIC,
      log,
    ).transmettre();
    expect(lignes).toEqual([]);
  });
});
