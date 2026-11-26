import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureLogs } from '../logging/capture.js';
import { creerBoite } from './boite.js';
import type { KafkaConfig } from './config.js';
import { ecouterKafka, type Lecteur } from './ecoute.js';

const CONFIG: KafkaConfig = {
  brokers: ['kafka:9092'],
  topic: 'scpi.souscription.dossier.v1',
  groupe: 'societe-gestion',
};

function fauxLecteur(consume: Lecteur['consume']) {
  return { consume: vi.fn(consume), close: vi.fn().mockResolvedValue(undefined) };
}

describe('lecture Kafka de la société de gestion', () => {
  afterEach(() => vi.useRealTimers());

  it('sans configuration : désactivée, aucun lecteur créé', () => {
    const { log, lignes } = captureLogs();
    const creer = vi.fn();
    const ecoute = ecouterKafka(creerBoite(), null, log, creer);
    expect(creer).not.toHaveBeenCalled();
    expect(ecoute.etat()).toEqual({
      active: false,
      connecte: false,
      topic: null,
      groupe: null,
      erreur: null,
    });
    expect(lignes[0].msg).toBe('lecture Kafka désactivée : KAFKA_BOOTSTRAP_SERVERS absente');
  });

  it('lit depuis le début, sans enregistrer de marque-page, et range les messages', async () => {
    const { log, lignes } = captureLogs();
    const flux = new EventEmitter();
    const lecteur = fauxLecteur(async () => flux);
    const boite = creerBoite();
    const ecoute = ecouterKafka(boite, CONFIG, log, () => lecteur);

    await vi.waitFor(() => expect(ecoute.etat().connecte).toBe(true));
    expect(lecteur.consume).toHaveBeenCalledWith({
      topics: ['scpi.souscription.dossier.v1'],
      mode: 'earliest',
      autocommit: false,
    });
    flux.emit('data', {
      partition: 0,
      offset: 4n,
      key: 'D-1041',
      value: JSON.stringify({
        idMessage: 'x',
        investisseur: { nom: 'Martin', email: 'claire@exemple.test' },
      }),
      timestamp: 1795700000000n,
    });
    expect(boite.liste()[0]).toMatchObject({ cle: 'D-1041', offset: '4' });
    // Jamais le contenu des messages dans les logs
    const texte = JSON.stringify(lignes);
    expect(texte).not.toContain('Martin');
    expect(texte).not.toContain('claire@exemple.test');
    await ecoute.arreter();
    expect(lecteur.close).toHaveBeenCalled();
  });

  it('Kafka injoignable : backend toujours debout, nouvelle tentative après le délai', async () => {
    vi.useFakeTimers();
    const { log, lignes } = captureLogs();
    const erreur = Object.assign(new Error('Connection refused'), { name: 'NetworkError' });
    const lecteurs = [
      fauxLecteur(async () => Promise.reject(erreur)),
      fauxLecteur(async () => new EventEmitter()),
    ];
    let n = 0;
    const ecoute = ecouterKafka(creerBoite(), CONFIG, log, () => lecteurs[n++], 1000);

    await vi.waitFor(() =>
      expect(ecoute.etat()).toMatchObject({ connecte: false, erreur: 'NetworkError' }),
    );
    expect(lignes).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        msg: 'lecture Kafka interrompue, nouvelle tentative',
      }),
    );
    expect(lecteurs[0].close).toHaveBeenCalledWith(true);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(ecoute.etat()).toMatchObject({ connecte: true, erreur: null }));
    await ecoute.arreter();
  });

  it('lecture interrompue en cours de route : reprise depuis le début, sans double', async () => {
    vi.useFakeTimers();
    const flux = [new EventEmitter(), new EventEmitter()];
    let n = 0;
    const boite = creerBoite();
    const ecoute = ecouterKafka(
      boite,
      CONFIG,
      captureLogs().log,
      () => fauxLecteur(async () => flux[n++]),
      1000,
    );
    await vi.waitFor(() => expect(ecoute.etat().connecte).toBe(true));
    const message = { partition: 0, offset: 0n, key: 'D-1', value: '{"idMessage":"a"}' };
    flux[0].emit('data', message);

    flux[0].emit('error', new Error('coupure'));
    expect(ecoute.etat().connecte).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(ecoute.etat().connecte).toBe(true));
    flux[1].emit('data', message);

    expect(boite.liste()).toHaveLength(1);
    await ecoute.arreter();
  });

  it('arrêté pendant une attente : plus aucune tentative', async () => {
    vi.useFakeTimers();
    const creer = vi.fn(() => fauxLecteur(async () => Promise.reject(new Error('panne'))));
    const ecoute = ecouterKafka(creerBoite(), CONFIG, captureLogs().log, creer, 1000);
    await vi.waitFor(() => expect(ecoute.etat().erreur).toBe('Error'));
    await ecoute.arreter();
    await vi.advanceTimersByTimeAsync(5000);
    expect(creer).toHaveBeenCalledTimes(1);
  });
});
