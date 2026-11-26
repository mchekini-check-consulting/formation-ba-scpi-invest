import type { Logger } from 'pino';
import { numeroDossier } from '../demandes/service.js';
import type { CanalKafka } from '../kafka/producteur.js';
import { decrireErreur } from '../logging/erreur.js';
import { businessLog, logger } from '../logging/logger.js';
import { loggable } from '../logging/service.js';
import { construireMessage, type DossierATransmettre } from './message.js';

// US-12 (SCPI-260) : transmission des dossiers « Demande envoyée » à la SCPI partenaire,
// lancée toutes les minutes (planification.ts), sans action de l'investisseur.
// - RG1 : dossiers ponctuels au statut « Demande envoyée » pas encore transmis, SCPI avec
//   un code ; le plus ancien d'abord.
// - RG3 : un dossier n'est publié qu'une fois : transmis_le est écrit dans la même
//   transaction que la publication (depotTransmission). Kafka indisponible : rien n'est
//   écrit, le dossier est repris au passage suivant, avec le même idMessage.
// - RG4 : date de transmission enregistrée (transmis_le).
// - RG5 : logs avec des compteurs seulement, jamais de donnée de l'investisseur.
export type DepotTransmission = {
  // Prend le prochain dossier à transmettre et le verrouille (un autre serveur ne peut pas
  // le prendre), appelle publier puis enregistre transmis_le, dans une transaction ;
  // publier en échec : rien n'est enregistré, l'erreur est relancée. false : plus aucun
  // dossier à transmettre.
  transmettreProchain(publier: (dossier: DossierATransmettre) => Promise<void>): Promise<boolean>;
  // Dossiers qui attendent un code SCPI (SCPI pas encore réimportée, ou retirée du catalogue)
  enAttenteSansCode(): Promise<number>;
};

export type BilanTransmission = {
  transmis: number;
  enAttenteSansCode: number;
  erreur: string | null;
};

// Garde-fou : nombre de dossiers au plus par passage (les suivants attendent une minute)
export const MAX_PAR_PASSAGE = 200;

export function creerTransmissionService(
  depot: DepotTransmission,
  canal: CanalKafka,
  topic: string,
  log: Logger = logger,
) {
  const tracer = (level: 'info' | 'warn', msg: string, champs: Record<string, unknown>) =>
    businessLog(log, level, 'service', 'TransmissionService', 'transmettre', msg, champs);

  const publier = async (dossier: DossierATransmettre) => {
    await canal.publier(topic, numeroDossier(dossier.id), construireMessage(dossier));
  };

  async function transmettre(): Promise<BilanTransmission> {
    let transmis = 0;
    let echec: ReturnType<typeof decrireErreur> | null = null;
    try {
      // Arrêt à la première erreur : Kafka indisponible, les suivants échoueraient aussi
      while (transmis < MAX_PAR_PASSAGE && (await depot.transmettreProchain(publier))) {
        transmis++;
      }
    } catch (err) {
      // Type et message de l'erreur seulement (erreur.ts : sans requête SQL ni valeurs)
      echec = decrireErreur(err);
    }
    const enAttenteSansCode = await depot.enAttenteSansCode();
    const bilan = { transmis, enAttenteSansCode, erreur: echec?.error ?? null };

    if (echec) {
      tracer('warn', 'Transmission des dossiers interrompue, reprise au passage suivant', {
        ...bilan,
        ...echec,
      });
    } else if (transmis > 0) {
      tracer('info', `${transmis} dossier(s) transmis à la SCPI`, bilan);
    }
    if (enAttenteSansCode > 0) {
      tracer('warn', `${enAttenteSansCode} dossier(s) en attente d'un code SCPI`, bilan);
    }
    return bilan;
  }

  return loggable('TransmissionService', { transmettre }, log);
}

export type TransmissionService = ReturnType<typeof creerTransmissionService>;
