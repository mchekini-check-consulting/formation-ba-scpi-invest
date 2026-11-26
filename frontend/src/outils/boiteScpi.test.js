import { afterEach, describe, expect, it, vi } from 'vitest';
import { lireMessages } from './boiteScpi.js';

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
});
