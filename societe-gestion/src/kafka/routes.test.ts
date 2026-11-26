import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { captureLogs } from '../logging/capture.js';
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
  return createApp(vi.fn(), captureLogs().log, [routesBoite(boite, { etat: () => ETAT })]);
}

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
