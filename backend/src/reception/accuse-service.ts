import type { Logger } from 'pino';
import { dlq } from '../kafka/config.js';
import type { MessageLu } from '../kafka/lecteur.js';
import type { CanalKafka } from '../kafka/producteur.js';
import { businessLog, logger } from '../logging/logger.js';
import { loggable } from '../logging/service.js';

// US-13 (SCPI-261) : accusé de réception de la SCPI partenaire, lu sur
// scpi.souscription.accuse-reception.v1 (contrat C3 : idMessage, idDossier, dateReception).
// - RG1 : dossier « Demande envoyée » -> « Demande reçue », date de réception enregistrée.
// - RG2 : dossier plus avancé (accusé arrivé après la décision) : seule la date est enregistrée.
// - RG3, règles communes C3 : idMessage déjà traité -> ignoré ; champ obligatoire absent ou
//   dossier inconnu -> rien n'est modifié, message publié sur <topic>.dlq avec le motif.
// Le message ne contient aucune donnée de l'investisseur ; les logs n'ont que le numéro du
// dossier et le résultat.

export type Accuse = { idMessage: string; idDossier: number; dateReception: Date };

export type ResultatEnregistrement = 'statut_change' | 'date_seule' | 'doublon' | 'dossier_inconnu';

export type DepotAccuseReception = {
  // Dans une transaction : dossier inconnu -> rien n'est écrit ; idMessage déjà traité ->
  // rien n'est écrit ; sinon idMessage retenu, date enregistrée et statut avancé si le
  // dossier était « Demande envoyée ».
  enregistrer(accuse: Accuse, topic: string): Promise<ResultatEnregistrement>;
};

export type ResultatAccuse = 'traite' | 'doublon' | 'rejete';

export const MOTIFS = {
  illisible: 'Message illisible : objet JSON attendu',
  idMessage: 'Champ obligatoire absent ou vide : idMessage',
  idDossier: 'Champ obligatoire absent ou invalide : idDossier (format D-<numéro>)',
  dateReception: 'Champ obligatoire absent ou invalide : dateReception (date ISO 8601)',
  dossierInconnu: 'Dossier inconnu',
} as const;

const FORMAT_DOSSIER = /^D-(\d{1,15})$/;

function lireJson(valeur: string | null): Record<string, unknown> | null {
  try {
    const json: unknown = JSON.parse(valeur ?? '');
    return json !== null && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Message C3 -> accusé, ou motif du rejet (premier champ en défaut)
export function lireAccuse(
  json: Record<string, unknown> | null,
): { accuse: Accuse } | { motif: string } {
  if (!json) return { motif: MOTIFS.illisible };
  const { idMessage, idDossier, dateReception } = json;
  if (typeof idMessage !== 'string' || idMessage.trim() === '') {
    return { motif: MOTIFS.idMessage };
  }
  const numero = typeof idDossier === 'string' ? FORMAT_DOSSIER.exec(idDossier) : null;
  if (!numero) return { motif: MOTIFS.idDossier };
  const date = typeof dateReception === 'string' ? new Date(dateReception) : null;
  if (!date || Number.isNaN(date.getTime())) return { motif: MOTIFS.dateReception };
  return { accuse: { idMessage, idDossier: Number(numero[1]), dateReception: date } };
}

export function creerAccuseReceptionService(
  depot: DepotAccuseReception,
  canal: Pick<CanalKafka, 'publier'>,
  log: Logger = logger,
) {
  const tracer = (level: 'info' | 'warn', msg: string, champs: Record<string, unknown>) =>
    businessLog(log, level, 'service', 'AccuseReceptionService', 'traiter', msg, champs);

  // Règle C3 : message invalide publié sur le topic d'erreur, avec le motif et le message
  // tel que reçu. Kafka indisponible : l'erreur remonte, le message sera relu.
  async function rejeter(message: MessageLu, json: Record<string, unknown> | null, motif: string) {
    await canal.publier(dlq(message.topic), message.cle ?? 'inconnu', {
      motif,
      topic: message.topic,
      rejeteLe: new Date().toISOString(),
      message: json ?? message.valeur,
    });
    tracer('warn', `Accusé de réception rejeté : ${motif}`, { resultat: 'rejete', motif });
    return 'rejete' as const;
  }

  async function traiter(message: MessageLu): Promise<ResultatAccuse> {
    const json = lireJson(message.valeur);
    const lu = lireAccuse(json);
    if ('motif' in lu) return rejeter(message, json, lu.motif);

    const resultat = await depot.enregistrer(lu.accuse, message.topic);
    const idDossier = `D-${lu.accuse.idDossier}`;
    switch (resultat) {
      case 'dossier_inconnu':
        return rejeter(message, json, MOTIFS.dossierInconnu);
      case 'doublon':
        tracer('info', 'Accusé de réception déjà traité, ignoré', { resultat, idDossier });
        return 'doublon';
      default:
        tracer(
          'info',
          resultat === 'statut_change'
            ? 'Accusé de réception : dossier passé à « Demande reçue »'
            : 'Accusé de réception tardif : date enregistrée, statut inchangé',
          { resultat, idDossier },
        );
        return 'traite';
    }
  }

  return loggable('AccuseReceptionService', { traiter }, log);
}

export type AccuseReceptionService = ReturnType<typeof creerAccuseReceptionService>;
