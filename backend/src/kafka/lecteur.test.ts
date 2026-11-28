import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureLogs } from '../logging/capture.js';
import type { KafkaConfig } from './config.js';
import { lireKafka, type Lecteur } from './lecteur.js';

const CONFIG: KafkaConfig = { brokers: ['kafka:9092'] };
const TOPIC = 'scpi.souscription.accuse-reception.v1';

// Faux flux Kafka : messages poussés par le test, lus un par un par le lecteur
type Suite = Promise<IteratorResult<never>>;

function fauxFlux() {
  const prets: Suite[] = []; // poussés avant d'être lus
  const lecteurs: ((suite: Suite) => void)[] = []; // lus avant d'être poussés
  const livrer = (suite: Suite) => {
    suite.catch(() => undefined); // rejet lu plus tard par le lecteur
    const lecteur = lecteurs.shift();
    if (lecteur) lecteur(suite);
    else prets.push(suite);
  };
  const commits: string[] = [];
  return {
    commits,
    pousser(valeur: string | null, topic = TOPIC, cle: string | null = 'D-1041') {
      const commit = vi.fn(() => void commits.push(valeur ?? ''));
      livrer(Promise.resolve({ value: { topic, key: cle, value: valeur, commit } as never }));
    },
    casser: (err: Error) => livrer(Promise.reject(err)),
    finir: () => livrer(Promise.resolve({ value: undefined as never, done: true })),
    [Symbol.asyncIterator]() {
      return {
        next: (): Suite =>
          prets.shift() ?? new Promise<Suite>((r) => lecteurs.push(r)).then((s) => s),
      };
    },
  };
}

function fauxLecteur(consume: Lecteur['consume']) {
  return { consume: vi.fn(consume), close: vi.fn().mockResolvedValue(undefined) };
}

describe('lecture Kafka des messages de la SCPI (backend)', () => {
  afterEach(() => vi.useRealTimers());

  it('sans configuration : désactivée, aucun lecteur créé', () => {
    const { log, lignes } = captureLogs();
    const creer = vi.fn();
    const lecture = lireKafka({ [TOPIC]: vi.fn() }, null, log, creer);
    expect(creer).not.toHaveBeenCalled();
    expect(lecture.etat()).toEqual({
      active: false,
      connecte: false,
      topics: [TOPIC],
      erreur: null,
    });
    expect(lignes[0].msg).toBe('lecture Kafka désactivée : KAFKA_BOOTSTRAP_SERVERS absente');
  });

  it('reprend au marque-page du groupe, traite puis enregistre le marque-page', async () => {
    const { log, lignes } = captureLogs();
    const flux = fauxFlux();
    const lecteur = fauxLecteur(async () => flux);
    const traiter = vi.fn().mockResolvedValue('traite');
    const lecture = lireKafka({ [TOPIC]: traiter }, CONFIG, log, () => lecteur);

    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(true));
    expect(lecteur.consume).toHaveBeenCalledWith({
      topics: [TOPIC],
      mode: 'committed',
      fallbackMode: 'earliest',
      autocommit: false,
    });
    flux.pousser('{"idMessage":"a","secret":"Martin"}');
    await vi.waitFor(() => expect(flux.commits).toHaveLength(1));
    expect(traiter).toHaveBeenCalledWith({
      topic: TOPIC,
      cle: 'D-1041',
      valeur: '{"idMessage":"a","secret":"Martin"}',
    });
    // Jamais le contenu des messages dans les logs
    expect(JSON.stringify(lignes)).not.toContain('Martin');
    await lecture.arreter();
    expect(lecteur.close).toHaveBeenCalledWith(true);
  });

  it('topic sans traitement : marque-page enregistré quand même', async () => {
    const flux = fauxFlux();
    const lecture = lireKafka({ [TOPIC]: vi.fn() }, CONFIG, captureLogs().log, () =>
      fauxLecteur(async () => flux),
    );
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(true));
    flux.pousser(null, 'autre.topic', null);
    await vi.waitFor(() => expect(flux.commits).toEqual(['']));
    await lecture.arreter();
  });

  it('traitement en échec : pas de marque-page, relecture du même message après le délai', async () => {
    vi.useFakeTimers();
    const { log, lignes } = captureLogs();
    const flux = [fauxFlux(), fauxFlux()];
    let n = 0;
    const traiter = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('base indisponible'), { name: 'DbError' }))
      .mockResolvedValue('traite');
    const lecture = lireKafka(
      { [TOPIC]: traiter },
      CONFIG,
      log,
      () => fauxLecteur(async () => flux[n++]),
      1000,
    );
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(true));
    flux[0].pousser('{"idMessage":"a"}');
    await vi.waitFor(() =>
      expect(lecture.etat()).toMatchObject({ connecte: false, erreur: 'DbError' }),
    );
    expect(flux[0].commits).toEqual([]);
    expect(lignes).toContainEqual(
      expect.objectContaining({
        level: 'WARN',
        msg: 'lecture Kafka interrompue, nouvelle tentative',
      }),
    );

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(true));
    flux[1].pousser('{"idMessage":"a"}');
    await vi.waitFor(() => expect(flux[1].commits).toHaveLength(1));
    expect(traiter).toHaveBeenCalledTimes(2);
    await lecture.arreter();
  });

  it('Kafka injoignable ou flux coupé : nouvelle tentative', async () => {
    vi.useFakeTimers();
    const flux = fauxFlux();
    const lecteurs = [
      fauxLecteur(async () => Promise.reject(new Error('Connection refused'))),
      fauxLecteur(async () => flux),
      fauxLecteur(async () => fauxFlux()),
    ];
    let n = 0;
    const lecture = lireKafka(
      { [TOPIC]: vi.fn() },
      CONFIG,
      captureLogs().log,
      () => lecteurs[n++],
      1000,
    );
    await vi.waitFor(() => expect(lecture.etat().erreur).toBe('Error'));
    expect(lecteurs[0].close).toHaveBeenCalledWith(true);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(true));
    flux.casser(new Error('coupure'));
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(false));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(true));
    expect(n).toBe(3);
    await lecture.arreter();
  });

  it('flux terminé sans erreur : relancé', async () => {
    vi.useFakeTimers();
    const flux = fauxFlux();
    const creer = vi.fn(() => fauxLecteur(async () => flux));
    const lecture = lireKafka({ [TOPIC]: vi.fn() }, CONFIG, captureLogs().log, creer, 1000);
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(true));
    flux.finir();
    await vi.waitFor(() => expect(lecture.etat().connecte).toBe(false));
    await lecture.arreter();
  });

  it('arrêté pendant une attente : plus aucune tentative', async () => {
    vi.useFakeTimers();
    const creer = vi.fn(() => fauxLecteur(async () => Promise.reject(new Error('panne'))));
    const lecture = lireKafka({ [TOPIC]: vi.fn() }, CONFIG, captureLogs().log, creer, 1000);
    await vi.waitFor(() => expect(lecture.etat().erreur).toBe('Error'));
    await lecture.arreter();
    await vi.advanceTimersByTimeAsync(5000);
    expect(creer).toHaveBeenCalledTimes(1);
  });
});
