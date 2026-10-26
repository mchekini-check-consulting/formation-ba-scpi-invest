import { describe, expect, it } from 'vitest';
import { captureLogs } from './capture.js';
import { HttpError } from './http-error.js';
import { loggable } from './service.js';

function serviceTest() {
  const { log, lignes } = captureLogs();
  const service = loggable(
    'ClientService',
    {
      prefixe: 'client-',
      nommer(id: number) {
        return `${this.prefixe}${id}`;
      },
      async charger(id: number) {
        return { id };
      },
      async trouver(): Promise<never> {
        throw new HttpError(404, 'client introuvable');
      },
      verifier(): never {
        throw new Error('base indisponible');
      },
      async lever(): Promise<never> {
        throw 'pas une Error';
      },
    },
    log,
  );
  return { service, lignes };
}

describe('loggable (layer service)', () => {
  it('fonction synchrone : résultat inchangé, log INFO sans arguments ni retour', () => {
    const { service, lignes } = serviceTest();
    expect(service.nommer(7)).toBe('client-7');
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      level: 'INFO',
      layer: 'service',
      class: 'ClientService',
      method: 'nommer',
      msg: 'ClientService.nommer ok',
    });
    expect(lignes[0].durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(lignes)).not.toMatch(/client-7|"7"/);
  });

  it('fonction asynchrone : log à la fin', async () => {
    const { service, lignes } = serviceTest();
    await expect(service.charger(3)).resolves.toEqual({ id: 3 });
    expect(lignes[0]).toMatchObject({ level: 'INFO', method: 'charger' });
  });

  it('HttpError 4xx : WARN (règle métier), erreur relancée', async () => {
    const { service, lignes } = serviceTest();
    await expect(service.trouver()).rejects.toThrow('client introuvable');
    expect(lignes[0]).toMatchObject({
      level: 'WARN',
      msg: 'ClientService.trouver en échec',
      error: 'HttpError',
      errorMessage: 'client introuvable',
    });
  });

  it('autre erreur : ERROR, erreur relancée', () => {
    const { service, lignes } = serviceTest();
    expect(() => service.verifier()).toThrow('base indisponible');
    expect(lignes[0]).toMatchObject({
      level: 'ERROR',
      error: 'Error',
      errorMessage: 'base indisponible',
    });
  });

  it('valeur levée qui n’est pas une Error', async () => {
    const { service, lignes } = serviceTest();
    await expect(service.lever()).rejects.toBe('pas une Error');
    expect(lignes[0]).toMatchObject({ level: 'ERROR', errorMessage: 'pas une Error' });
  });

  it('propriétés non fonction conservées', () => {
    expect(serviceTest().service.prefixe).toBe('client-');
  });
});
