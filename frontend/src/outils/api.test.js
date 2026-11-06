import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import { deposerCsv, lancerImport, lireCatalogue, lireEtat, lireRapports } from './api.js';

function reponse(status, corps) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corps) };
}

let fetchMock;

beforeEach(() => {
  sessionStorage.clear();
  fetchMock = vi.fn().mockResolvedValue(reponse(200, { ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appels de l’outil d’import du catalogue', () => {
  it('lireEtat : GET /outils/import-catalogue/etat, sans session', async () => {
    expect(await lireEtat()).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/outils/import-catalogue/etat');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('lancerImport : POST /import ; 409 -> message du backend', async () => {
    fetchMock.mockResolvedValue(reponse(409, { message: 'Un import est déjà en cours' }));
    const err = await lancerImport().catch((e) => e);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/outils/import-catalogue/import');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(err).toBeInstanceOf(ErreurApi);
    expect(err.message).toBe('Un import est déjà en cours');
  });

  it('lireRapports : limite dans l’adresse (50 par défaut)', async () => {
    await lireRapports();
    await lireRapports(10);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/outils/import-catalogue/rapports?limite=50',
      '/api/outils/import-catalogue/rapports?limite=10',
    ]);
  });

  it('lireCatalogue : GET /scpi', async () => {
    await lireCatalogue();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/outils/import-catalogue/scpi');
  });
});

describe('deposerCsv', () => {
  let requetes;

  beforeEach(() => {
    requetes = [];
    class FauxXhr {
      constructor() {
        this.entetes = {};
        this.upload = {};
        requetes.push(this);
      }
      open(methode, url) {
        Object.assign(this, { methode, url });
      }
      setRequestHeader(nom, valeur) {
        this.entetes[nom] = valeur;
      }
      send(corps) {
        this.corps = corps;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
        this.status = 200;
        this.responseText = JSON.stringify({ cle: 'scpi.csv' });
        this.onload();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FauxXhr);
  });

  it('PUT /fichier avec le type du fichier et la progression', async () => {
    const progression = vi.fn();
    const fichier = new File(['Nom\n'], 'scpi.csv', { type: 'text/csv' });
    expect(await deposerCsv(fichier, progression)).toEqual({ cle: 'scpi.csv' });
    expect(requetes[0]).toMatchObject({
      methode: 'PUT',
      url: '/api/outils/import-catalogue/fichier',
    });
    expect(requetes[0].entetes['Content-Type']).toBe('text/csv');
    expect(requetes[0].corps).toBe(fichier);
    expect(progression).toHaveBeenCalledWith(0.5);
  });

  it('fichier sans type (fréquent pour un .csv) : envoyé en text/csv', async () => {
    const fichier = new File(['Nom\n'], 'scpi.csv');
    await deposerCsv(fichier, vi.fn());
    expect(requetes[0].entetes['Content-Type']).toBe('text/csv');
    expect(requetes[0].corps).not.toBe(fichier);
    expect(requetes[0].corps.size).toBe(fichier.size);
  });
});
