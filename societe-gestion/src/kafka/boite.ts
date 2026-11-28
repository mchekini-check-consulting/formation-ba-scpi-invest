// Boîte de réception de la société de gestion : les messages lus sur le topic des
// dossiers, gardés en mémoire (rien en base pour l'instant), du plus récent au plus ancien.
// Le topic est relu depuis le début à chaque démarrage (ecoute.ts) : la boîte ne garde
// qu'une fois chaque message (même partition et même offset).
// Contenu des messages (KYC de l'investisseur) : jamais dans les logs.
export const MAX_MESSAGES = 500;

// Message tel que lu dans Kafka (clé et valeur en texte)
export type Enregistrement = {
  partition: number;
  offset: bigint | number | string;
  cle?: string | null;
  valeur?: string | null;
  horodatage?: bigint | number | null; // millisecondes, posé par Kafka à la réception
};

export type MessageRecu = {
  partition: number;
  offset: string;
  cle: string | null;
  recuLe: string | null;
  // idMessage déjà reçu dans un message précédent : la SCPI l'ignorerait (règle C3)
  doublon: boolean;
  // valeur qui n'est pas un objet JSON : gardée telle quelle dans « brut »
  invalide: boolean;
  message: Record<string, unknown> | null;
  brut?: string;
};

export type Compteurs = { lus: number; doublons: number; invalides: number };

function lireJson(valeur: string | null | undefined): Record<string, unknown> | null {
  try {
    const json: unknown = JSON.parse(valeur ?? '');
    return json !== null && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function creerBoite(max = MAX_MESSAGES) {
  const messages: MessageRecu[] = []; // plus récent d'abord
  const positions = new Set<string>();
  const idsMessage = new Set<string>();
  const compteurs: Compteurs = { lus: 0, doublons: 0, invalides: 0 };

  return {
    ajouter(e: Enregistrement): void {
      const position = `${e.partition}-${e.offset}`;
      if (positions.has(position)) return; // relu après une reprise
      positions.add(position);

      const message = lireJson(e.valeur);
      const idMessage = typeof message?.idMessage === 'string' ? message.idMessage : null;
      const doublon = idMessage !== null && idsMessage.has(idMessage);
      if (idMessage) idsMessage.add(idMessage);

      compteurs.lus++;
      if (doublon) compteurs.doublons++;
      if (!message) compteurs.invalides++;

      messages.unshift({
        partition: e.partition,
        offset: String(e.offset),
        cle: e.cle ?? null,
        recuLe:
          e.horodatage === null || e.horodatage === undefined
            ? null
            : new Date(Number(e.horodatage)).toISOString(),
        doublon,
        invalide: !message,
        message,
        ...(message ? {} : { brut: e.valeur ?? '' }),
      });
      if (messages.length > max) messages.pop();
    },
    liste: (): MessageRecu[] => [...messages],
    compteurs: (): Compteurs => ({ ...compteurs }),
  };
}

export type Boite = ReturnType<typeof creerBoite>;
