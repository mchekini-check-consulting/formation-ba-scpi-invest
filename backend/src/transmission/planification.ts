import { Cron } from 'croner';
import type { Logger } from 'pino';
import { FUSEAU } from '../csv/planification.js';
import type { CanalKafka } from '../kafka/producteur.js';
import { decrireErreur } from '../logging/erreur.js';
import { businessLog, logger } from '../logging/logger.js';

// US-12 : transmission des dossiers toutes les minutes, plus un passage au démarrage.
// DOSSIER_TRANSMISSION_CRON permet un autre rythme. Plusieurs serveurs (preprod, prod :
// 2 réplicas) : chacun lance ses passages, un dossier n'est jamais pris par deux à la fois
// (depotTransmission : for update skip locked). protect : un passage encore en cours sur
// ce serveur n'est pas relancé.
export const HORAIRE_TRANSMISSION = '* * * * *';

// Canal Kafka désactivé (KAFKA_BOOTSTRAP_SERVERS absente : qualif, preprod, prod pour
// l'instant, poste sans Kafka) : rien n'est planifié, les dossiers restent « non
// transmis » et partiront dès que Kafka sera configuré.
export function demarrerTransmission(
  canal: Pick<CanalKafka, 'active'>,
  transmettre: () => Promise<unknown>,
  log: Logger = logger,
  env: NodeJS.ProcessEnv = process.env,
): Cron | null {
  if (!canal.active) {
    log.warn('transmission des dossiers à la SCPI désactivée : Kafka absent');
    return null;
  }
  const horaire = env.DOSSIER_TRANSMISSION_CRON || HORAIRE_TRANSMISSION;
  const tache = new Cron(
    horaire,
    { name: 'transmission-dossiers', timezone: FUSEAU, protect: true },
    async () => {
      // Une erreur n'arrête jamais le backend ; le passage suivant reprend
      try {
        await transmettre();
      } catch (err) {
        businessLog(
          log,
          'error',
          'service',
          'PlanificationTransmission',
          'declencher',
          'Transmission des dossiers en échec',
          decrireErreur(err),
        );
      }
    },
  );
  log.info({ horaire, fuseau: FUSEAU }, 'transmission des dossiers à la SCPI planifiée');
  void tache.trigger();
  return tache;
}
