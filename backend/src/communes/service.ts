import { loggable } from '../logging/service.js';

// Communes correspondant à un code postal (KYC, étape « Coordonnées ») : l'écran propose
// la ville à sélectionner. France (DOM compris) : API Géo de l'État, publique et gratuite
// (https://geo.api.gouv.fr), adresse modifiable par la variable GEO_API_URL.
// Autres pays : aucune source pour l'instant, l'écran garde la saisie libre.
// En cas de panne ou de lenteur du service, la liste est vide : la saisie libre prend le
// relais, sans bloquer l'utilisateur.

export type Chercher = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

const DELAI_MS = 3000;
const TAILLE_CACHE = 2000; // codes postaux gardés en mémoire (les communes changent rarement)

export function creerCommunesService(
  chercher: Chercher = fetch,
  base = process.env.GEO_API_URL ?? 'https://geo.api.gouv.fr',
) {
  const cache = new Map<string, string[]>();

  async function lister(pays: unknown, codePostal: unknown): Promise<string[]> {
    const code = typeof codePostal === 'string' ? codePostal.trim() : '';
    if (pays !== 'FR' || !/^\d{5}$/.test(code)) {
      return [];
    }
    const connues = cache.get(code);
    if (connues) return connues;

    const url = `${base}/communes?codePostal=${code}&fields=nom&format=json`;
    const reponse = await chercher(url, { signal: AbortSignal.timeout(DELAI_MS) });
    if (!reponse.ok) {
      throw new Error(`API Géo : réponse ${reponse.status}`);
    }
    const corps: unknown = await reponse.json();
    const noms = Array.isArray(corps)
      ? corps
          .map((c) => (c as { nom?: unknown })?.nom)
          .filter((nom): nom is string => typeof nom === 'string' && nom !== '')
      : [];
    const communes = [...new Set(noms)].sort((a, b) => a.localeCompare(b, 'fr'));

    if (cache.size >= TAILLE_CACHE) {
      cache.delete(cache.keys().next().value as string);
    }
    cache.set(code, communes);
    return communes;
  }

  // Service indisponible : liste vide (et une ligne de log en erreur, via loggable)
  async function communes(pays: unknown, codePostal: unknown): Promise<string[]> {
    return service.lister(pays, codePostal).catch(() => []);
  }

  const service = loggable('CommunesService', { lister });
  return { communes, lister: service.lister };
}

export type CommunesService = ReturnType<typeof creerCommunesService>;
