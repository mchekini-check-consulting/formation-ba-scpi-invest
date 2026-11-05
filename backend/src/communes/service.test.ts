import { describe, expect, it, vi } from 'vitest';
import { creerCommunesService } from './service.js';

function reponse(status: number, corps: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corps } as Response;
}

describe('CommunesService', () => {
  it('France : communes du code postal, triées, sans doublon', async () => {
    const chercher = vi
      .fn()
      .mockResolvedValue(
        reponse(200, [
          { nom: 'Saint-Denis-lès-Bourg' },
          { nom: 'Bourg-en-Bresse' },
          { nom: 'Bourg-en-Bresse' },
        ]),
      );
    const service = creerCommunesService(chercher, 'https://geo.exemple');
    expect(await service.communes('FR', ' 01000 ')).toEqual([
      'Bourg-en-Bresse',
      'Saint-Denis-lès-Bourg',
    ]);
    const [url, options] = chercher.mock.calls[0];
    expect(url).toBe('https://geo.exemple/communes?codePostal=01000&fields=nom&format=json');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('même code postal redemandé : réponse gardée en mémoire', async () => {
    const chercher = vi.fn().mockResolvedValue(reponse(200, [{ nom: 'Lyon' }]));
    const service = creerCommunesService(chercher, 'https://geo.exemple');
    await service.communes('FR', '69003');
    expect(await service.communes('FR', '69003')).toEqual(['Lyon']);
    expect(chercher).toHaveBeenCalledOnce();
  });

  it.each([
    ['BE', '1000'],
    ['FR', '6900'],
    ['FR', 'ABCDE'],
    ['FR', undefined],
    [undefined, '69003'],
  ])('pays %s, code %s : aucune recherche', async (pays, code) => {
    const chercher = vi.fn();
    const service = creerCommunesService(chercher, 'https://geo.exemple');
    expect(await service.communes(pays, code)).toEqual([]);
    expect(chercher).not.toHaveBeenCalled();
  });

  it('service indisponible, en erreur ou réponse inattendue : liste vide', async () => {
    for (const chercher of [
      vi.fn().mockRejectedValue(new Error('délai dépassé')),
      vi.fn().mockResolvedValue(reponse(502, {})),
      vi.fn().mockResolvedValue(reponse(200, { message: 'inattendu' })),
      vi.fn().mockResolvedValue(reponse(200, [{ code: '69123' }, null])),
    ]) {
      const service = creerCommunesService(chercher, 'https://geo.exemple');
      expect(await service.communes('FR', '69003')).toEqual([]);
    }
  });

  it('erreur non gardée en mémoire : nouvelle tentative au prochain appel', async () => {
    const chercher = vi
      .fn()
      .mockRejectedValueOnce(new Error('panne'))
      .mockResolvedValue(reponse(200, [{ nom: 'Lyon' }]));
    const service = creerCommunesService(chercher, 'https://geo.exemple');
    expect(await service.communes('FR', '69003')).toEqual([]);
    expect(await service.communes('FR', '69003')).toEqual(['Lyon']);
  });

  it('mémoire limitée : les plus anciens codes postaux sont oubliés', async () => {
    const chercher = vi.fn().mockImplementation(async () => reponse(200, [{ nom: 'X' }]));
    const service = creerCommunesService(chercher, 'https://geo.exemple');
    for (let i = 0; i <= 2000; i += 1) {
      await service.lister('FR', String(10000 + i));
    }
    expect(chercher).toHaveBeenCalledTimes(2001);
    await service.lister('FR', '10000'); // le premier a été oublié
    expect(chercher).toHaveBeenCalledTimes(2002);
  });

  it('adresse de l’API par défaut : le service de l’État', async () => {
    const chercher = vi.fn().mockResolvedValue(reponse(200, []));
    await creerCommunesService(chercher).communes('FR', '75008');
    expect(chercher.mock.calls[0][0]).toMatch(/^https:\/\/geo\.api\.gouv\.fr\/communes\?/);
  });
});
