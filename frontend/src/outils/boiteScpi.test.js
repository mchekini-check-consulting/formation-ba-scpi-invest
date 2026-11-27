import { afterEach, describe, expect, it, vi } from 'vitest';
import { envoyerAccuse, lireMessages } from './boiteScpi.js';

afterEach(() => vi.unstubAllGlobals());

describe('appel au backend societe-gestion', () => {
  it('local : /api/societe-gestion/messages (relais vite.config.js)', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [] }) });
    vi.stubGlobal('fetch', fetch);
    await expect(lireMessages()).resolves.toEqual({ messages: [] });
    expect(fetch).toHaveBeenCalledWith('/api/societe-gestion/messages');
  });

  it('réponse en erreur : message compréhensible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(lireMessages('/x')).rejects.toThrow('La société de gestion ne répond pas (502).');
  });

  // US-13
  it('accusé de réception : POST /accuses, renvoie le message envoyé', async () => {
    const message = { idMessage: 'a', idDossier: 'D-1' };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message }) });
    vi.stubGlobal('fetch', fetch);
    await expect(envoyerAccuse('D-1')).resolves.toEqual(message);
    expect(fetch).toHaveBeenCalledWith('/api/societe-gestion/accuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"idDossier":"D-1","variante":"normal"}',
    });
  });

  it('accusé refusé : message du backend, sinon message générique', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 409, json: async () => ({ message: 'Non.' }) }),
    );
    await expect(envoyerAccuse('D-1', 'doublon', '/x')).rejects.toThrow('Non.');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject() }),
    );
    await expect(envoyerAccuse('D-1', 'normal', '/x')).rejects.toThrow(
      'La société de gestion ne répond pas (502).',
    );
  });
});
