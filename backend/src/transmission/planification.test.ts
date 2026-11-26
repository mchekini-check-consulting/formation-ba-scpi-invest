import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cron } from 'croner';
import { captureLogs } from '../logging/capture.js';
import { demarrerTransmission, HORAIRE_TRANSMISSION } from './planification.js';

describe('planification de la transmission (US-12)', () => {
  let tache: Cron | null = null;
  afterEach(() => tache?.stop());

  it('Kafka absent : rien n’est planifié', () => {
    const { log, lignes } = captureLogs();
    const transmettre = vi.fn();
    tache = demarrerTransmission({ active: false }, transmettre, log, {});
    expect(tache).toBeNull();
    expect(transmettre).not.toHaveBeenCalled();
    expect(lignes).toMatchObject([
      { msg: 'transmission des dossiers à la SCPI désactivée : Kafka absent' },
    ]);
  });

  it('Kafka actif : toutes les minutes, plus un passage tout de suite', async () => {
    const { log } = captureLogs();
    const transmettre = vi.fn().mockResolvedValue(undefined);
    tache = demarrerTransmission({ active: true }, transmettre, log, {});
    expect(tache?.getPattern()).toBe(HORAIRE_TRANSMISSION);
    await vi.waitFor(() => expect(transmettre).toHaveBeenCalledTimes(1));
  });

  it('autre rythme : DOSSIER_TRANSMISSION_CRON', () => {
    tache = demarrerTransmission(
      { active: true },
      vi.fn().mockResolvedValue(undefined),
      captureLogs().log,
      {
        DOSSIER_TRANSMISSION_CRON: '*/5 * * * *',
      },
    );
    expect(tache?.getPattern()).toBe('*/5 * * * *');
  });

  it('erreur : journalisée, jamais propagée', async () => {
    const { log, lignes } = captureLogs();
    const transmettre = vi.fn().mockRejectedValue(new Error('base injoignable'));
    tache = demarrerTransmission({ active: true }, transmettre, log, {});
    await vi.waitFor(() =>
      expect(lignes).toContainEqual(
        expect.objectContaining({
          level: 'ERROR',
          class: 'PlanificationTransmission',
          msg: 'Transmission des dossiers en échec',
          errorMessage: 'base injoignable',
        }),
      ),
    );
  });
});
