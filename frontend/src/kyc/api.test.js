import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import {
  deposerPiece,
  enregistrerKyc,
  lireKyc,
  listerPieces,
  suggererAdresses,
  suggererCommunes,
  supprimerPiece,
  validerKyc,
} from './api.js';

function reponse(status, corps) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corps) };
}

let fetchMock;

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('scpi-invest.session', 'jeton-1');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appels du KYC (US-04b)', () => {
  it('suggererAdresses : GET /adresses avec le texte tapé', async () => {
    const lilas = { libelle: '12 Rue des Lilas 69008 Lyon' };
    fetchMock.mockResolvedValue(reponse(200, { adresses: [lilas] }));
    expect(await suggererAdresses('12 rue des lilas')).toEqual([lilas]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/adresses?recherche=12+rue+des+lilas');
  });

  it('suggererCommunes : GET /adresses/communes avec le code postal', async () => {
    fetchMock.mockResolvedValue(reponse(200, { communes: ['Lyon'] }));
    expect(await suggererCommunes('69003')).toEqual(['Lyon']);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/adresses/communes?codePostal=69003');
  });

  it('lireKyc : GET /connaissance-client avec la session', async () => {
    const etat = { statut: 'en_cours', etape: 2, reponses: {}, valideLe: null };
    fetchMock.mockResolvedValue(reponse(200, etat));
    expect(await lireKyc()).toEqual(etat);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/connaissance-client');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer jeton-1');
    expect(options.body).toBeUndefined();
  });

  it('enregistrerKyc : PUT /connaissance-client avec l’étape et les réponses', async () => {
    fetchMock.mockResolvedValue(reponse(200, {}));
    await enregistrerKyc(3, { nom: 'Martin' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/connaissance-client');
    expect(options.method).toBe('PUT');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ etape: 3, reponses: { nom: 'Martin' } });
  });

  it('validerKyc : POST /connaissance-client/validation ; refus -> message du backend', async () => {
    fetchMock.mockResolvedValue(reponse(400, { message: 'Le formulaire KYC est incomplet' }));
    const err = await validerKyc().catch((e) => e);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/connaissance-client/validation');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(err).toBeInstanceOf(ErreurApi);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Le formulaire KYC est incomplet');
  });
});

describe('appels des pièces justificatives (US-04c)', () => {
  it('listerPieces : GET /connaissance-client/pieces', async () => {
    fetchMock.mockResolvedValue(reponse(200, []));
    expect(await listerPieces()).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/connaissance-client/pieces');
  });

  it('deposerPiece : PUT du fichier, nom dans l’adresse, avancement transmis', async () => {
    let xhr;
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        upload = {};
        constructor() {
          xhr = this;
        }
        open(methode, url) {
          Object.assign(this, { methode, url });
        }
        setRequestHeader() {}
        send(corps) {
          this.corps = corps;
        }
      },
    );
    const progression = vi.fn();
    const fichier = new File(['%PDF-'], 'mon rib & co.pdf', { type: 'application/pdf' });
    const envoi = deposerPiece('rib', fichier, progression);
    expect(xhr.url).toBe('/api/connaissance-client/pieces/rib?nom=mon%20rib%20%26%20co.pdf');
    expect([xhr.methode, xhr.corps]).toEqual(['PUT', fichier]);
    xhr.upload.onprogress({ lengthComputable: true, loaded: 1, total: 2 });
    expect(progression).toHaveBeenCalledWith(0.5);
    Object.assign(xhr, { status: 200, responseText: '{"type":"rib"}' });
    xhr.onload();
    expect(await envoi).toEqual({ type: 'rib' });
  });

  it('supprimerPiece : DELETE /connaissance-client/pieces/<type>', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: () => Promise.reject() });
    expect(await supprimerPiece('rib')).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/connaissance-client/pieces/rib');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});
