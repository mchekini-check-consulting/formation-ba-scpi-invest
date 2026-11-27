import { describe, expect, it, vi } from 'vitest';
import { creerEnvoiAccuses, ErreurEnvoi, KAFKA_DESACTIVE, producteurKafka } from './accuses.js';

const TOPIC = 'scpi.souscription.accuse-reception.v1';
const MAINTENANT = new Date('2026-11-18T09:15:00Z');

function preparer() {
  const publier = vi.fn().mockResolvedValue(undefined);
  let n = 0;
  const envoi = creerEnvoiAccuses(
    publier,
    TOPIC,
    () => MAINTENANT,
    () => `id-${++n}`,
  );
  return { publier, envoi };
}

describe('envoi des accusés de réception par la SCPI simulée (US-13)', () => {
  it('normal : message C3 avec nouvel idMessage et date, clé = idDossier', async () => {
    const { publier, envoi } = preparer();
    const message = await envoi.envoyer('D-1041', 'normal');
    expect(message).toEqual({
      idMessage: 'id-1',
      idDossier: 'D-1041',
      dateReception: '2026-11-18T09:15:00.000Z',
    });
    expect(publier).toHaveBeenCalledWith(TOPIC, 'D-1041', message);
  });

  it('doublon : renvoie à l’identique le dernier accusé du dossier', async () => {
    const { publier, envoi } = preparer();
    const premier = await envoi.envoyer('D-1041', 'normal');
    expect(await envoi.envoyer('D-1041', 'doublon')).toEqual(premier);
    expect(publier).toHaveBeenLastCalledWith(TOPIC, 'D-1041', premier);
  });

  it('doublon sans accusé déjà envoyé : 409, rien publié', async () => {
    const { publier, envoi } = preparer();
    await expect(envoi.envoyer('D-1041', 'doublon')).rejects.toMatchObject({ status: 409 });
    expect(publier).not.toHaveBeenCalled();
  });

  it('invalide : sans dateReception, et pas retenu pour le doublon', async () => {
    const { envoi } = preparer();
    expect(await envoi.envoyer('D-1041', 'invalide')).toEqual({
      idMessage: 'id-1',
      idDossier: 'D-1041',
    });
    await expect(envoi.envoyer('D-1041', 'doublon')).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    [undefined, 'normal'],
    ['1041', 'normal'],
    ['D-1041', 'autre'],
  ])('demande invalide (%s, %s) : 400', async (idDossier, variante) => {
    const { envoi } = preparer();
    await expect(envoi.envoyer(idDossier, variante)).rejects.toMatchObject({ status: 400 });
  });

  it('sans Kafka : 503', async () => {
    const envoi = creerEnvoiAccuses(null, TOPIC);
    const erreur = await envoi.envoyer('D-1', 'normal').catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurEnvoi);
    expect(erreur).toMatchObject({ status: 503, message: KAFKA_DESACTIVE });
  });

  it('producteur : null sans configuration', () => {
    expect(producteurKafka(null)).toBeNull();
  });
});
