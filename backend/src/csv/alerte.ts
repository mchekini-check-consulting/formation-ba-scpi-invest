import type { Logger } from 'pino';
import { businessLog, logger } from '../logging/logger.js';

// Alerte à l'administrateur quand l'import du catalogue échoue (US-07b, scénarios 2 et 5)
// motif : fichier refusé, un bloc par ligne (où, constat, cause probable, à faire :
// texteAlerte, erreurs.ts) ; erreur technique, son message.
export type Alerter = (sujet: string, motif: string) => Promise<void>;

export function alerteAdministrateur(log: Logger = logger): Alerter {
  return async (sujet, motif) => {
    // TODO US-07b : envoyer un e-mail à l'administrateur (sujet + motif) dès qu'un serveur
    // SMTP sera disponible. En attendant, l'alerte n'est qu'une ligne de log (Grafana
    // « Logs métier »), au niveau error.
    businessLog(log, 'error', 'service', 'AlerteAdministrateur', 'alerter', sujet, { motif });
  };
}
