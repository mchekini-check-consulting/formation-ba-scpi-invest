import { describe, expect, it } from 'vitest';
import { captureLogs } from '../logging/capture.js';
import { alerteAdministrateur } from './alerte.js';

describe('alerteAdministrateur', () => {
  it('en attendant le serveur SMTP : une ligne de log métier au niveau error', async () => {
    const { log, lignes } = captureLogs();

    await alerteAdministrateur(log)('fichier du catalogue rejeté : scpi.csv', 'colonnes absentes');

    expect(lignes).toEqual([
      expect.objectContaining({
        level: 'ERROR',
        layer: 'service',
        class: 'AlerteAdministrateur',
        method: 'alerter',
        msg: 'fichier du catalogue rejeté : scpi.csv',
        motif: 'colonnes absentes',
      }),
    ]);
  });
});
