import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { captureLogs } from '../logging/capture.js';
import { creerEnvoiAccuses } from './accuses.js';
import { creerBoite } from './boite.js';
import { routesBoite } from './routes.js';

const DEV = 'gateway.formation-ba-scpi-invest.dev.check-consulting.net';
const QUALIF = 'gateway.formation-ba-scpi-invest.qualif.check-consulting.net';
const ETAT = {
  active: true,
  connecte: true,
  topic: 'scpi.souscription.dossier.v1',
  groupe: 'societe-gestion',
  erreur: null,
};

function application() {
  const boite = creerBoite();
  boite.ajouter({
    partition: 0,
    offset: 0,
    cle: 'D-1',
    valeur: '{"idMessage":"a","idDossier":"D-1"}',
  });
  return createApp(vi.fn(), captureLogs().log, [routesBoite(boite, { etat: () => ETAT }, envoi)]);
}

const publier = vi.fn().mockResolvedValue(undefined);
const envoi = creerEnvoiAccuses(publier, 'scpi.souscription.accuse-reception.v1');

describe('POST /accuses (US-13, dev)', () => {
  it('envoie l’accusé : 201 avec le message publié', async () => {
    const res = await request(application())
      .post('/accuses')
      .set('Host', DEV)
      .send({ idDossier: 'D-1', variante: 'normal' })
      .expect(201);
    expect(res.body.message).toMatchObject({ idDossier: 'D-1', idMessage: expect.any(String) });
    expect(publier).toHaveBeenCalledWith(
      'scpi.souscription.accuse-reception.v1',
      'D-1',
      res.body.message,
    );
  });

  it('demande invalide : 400 avec le message', async () => {
    const res = await request(application())
      .post('/accuses')
      .set('Host', DEV)
      .send({ variante: 'normal' })
      .expect(400);
    expect(res.body.message).toContain('idDossier');
  });

  it('erreur inattendue : 500', async () => {
    publier.mockRejectedValueOnce(new Error('Kafka indisponible'));
    await request(application())
      .post('/accuses')
      .set('Host', DEV)
      .send({ idDossier: 'D-1', variante: 'normal' })
      .expect(500);
  });

  it('fermé ailleurs qu’en dev : 404', async () => {
    await request(application())
      .post('/accuses')
      .set('Host', QUALIF)
      .send({ idDossier: 'D-1', variante: 'normal' })
      .expect(404);
  });
});

describe('GET /messages (boîte de réception, dev)', () => {
  it.each([[DEV], ['localhost:8081'], ['127.0.0.1']])(
    'ouvert (%s) : état, compteurs et messages',
    async (host) => {
      const res = await request(application()).get('/messages').set('Host', host).expect(200);
      expect(res.body).toMatchObject({
        kafka: ETAT,
        compteurs: { lus: 1, doublons: 0, invalides: 0 },
        messages: [{ cle: 'D-1', message: { idDossier: 'D-1' } }],
      });
    },
  );

  it.each([[QUALIF], ['societe-gestion']])('fermé ailleurs (%s) : 404', async (host) => {
    await request(application())
      .get('/messages')
      .set('Host', host)
      .expect(404, { message: 'introuvable' });
  });
});
