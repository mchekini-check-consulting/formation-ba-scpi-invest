import { loggable } from '../logging/service.js';

// Suggestions d'adresses (KYC, étape « Coordonnées ») : le client tape le début de son
// adresse, l'écran propose des adresses officielles ; un clic remplit adresse, code postal
// et ville. France uniquement : service national des adresses de l'IGN (Géoplateforme,
// public et gratuit), adresse modifiable par la variable GEOCODAGE_API_URL.
// En cas de panne ou de lenteur du service, la liste est vide : la saisie libre prend le
// relais, sans bloquer l'utilisateur.
// Communes d'un code postal (France) : API Découpage administratif (geo.api.gouv.fr, public
// et gratuit), adresse modifiable par la variable GEO_COMMUNES_API_URL. Le code postal tapé
// propose la ou les villes correspondantes.

export type Chercher = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export type Adresse = { libelle: string; adresse: string; codePostal: string; ville: string };

const DELAI_MS = 3000;
const LONGUEUR_MIN = 3;
const LONGUEUR_MAX = 200;
const NOMBRE_MAX = 5;

type Proprietes = { label?: unknown; name?: unknown; postcode?: unknown; city?: unknown };

const texte = (valeur: unknown) => (typeof valeur === 'string' ? valeur.trim() : '');

// Une suggestion du service -> adresse de l'écran (incomplète : ignorée)
function versAdresse(proprietes: Proprietes): Adresse | null {
  const adresse = {
    libelle: texte(proprietes.label),
    adresse: texte(proprietes.name),
    codePostal: texte(proprietes.postcode),
    ville: texte(proprietes.city),
  };
  return Object.values(adresse).every(Boolean) ? adresse : null;
}

function lireSuggestions(corps: unknown): Adresse[] {
  const features = (corps as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((f) => versAdresse((f as { properties?: Proprietes })?.properties ?? {}))
    .filter((a): a is Adresse => a !== null);
}

const CODE_POSTAL = /^\d{5}$/;

// Noms des communes de la réponse, sans doublon, dans l'ordre alphabétique
function lireCommunes(corps: unknown): string[] {
  if (!Array.isArray(corps)) return [];
  const noms = corps.map((c) => texte((c as { nom?: unknown })?.nom)).filter(Boolean);
  return [...new Set(noms)].sort((a, b) => a.localeCompare(b, 'fr'));
}

export function creerAdressesService(
  chercher: Chercher = fetch,
  base = process.env.GEOCODAGE_API_URL ?? 'https://data.geopf.fr/geocodage',
  baseCommunes = process.env.GEO_COMMUNES_API_URL ?? 'https://geo.api.gouv.fr',
) {
  async function rechercher(recherche: unknown): Promise<Adresse[]> {
    const saisie = texte(recherche).slice(0, LONGUEUR_MAX);
    if (saisie.length < LONGUEUR_MIN) return [];
    const parametres = new URLSearchParams({
      q: saisie,
      index: 'address',
      autocomplete: '1',
      limit: String(NOMBRE_MAX),
    });
    const reponse = await chercher(`${base}/search?${parametres}`, {
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!reponse.ok) {
      throw new Error(`Service des adresses : réponse ${reponse.status}`);
    }
    return lireSuggestions(await reponse.json());
  }

  // Service indisponible : liste vide (et une ligne de log en erreur, via loggable)
  async function suggestions(recherche: unknown): Promise<Adresse[]> {
    return service.rechercher(recherche).catch(() => []);
  }

  // Communes d'un code postal à 5 chiffres ; autre saisie : liste vide, sans appel
  async function rechercherCommunes(codePostal: unknown): Promise<string[]> {
    const code = texte(codePostal);
    if (!CODE_POSTAL.test(code)) return [];
    const parametres = new URLSearchParams({ codePostal: code, fields: 'nom', format: 'json' });
    const reponse = await chercher(`${baseCommunes}/communes?${parametres}`, {
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!reponse.ok) {
      throw new Error(`Service des communes : réponse ${reponse.status}`);
    }
    return lireCommunes(await reponse.json());
  }

  // Service indisponible : liste vide (et une ligne de log en erreur, via loggable)
  async function communes(codePostal: unknown): Promise<string[]> {
    return service.rechercherCommunes(codePostal).catch(() => []);
  }

  const service = loggable('AdressesService', { rechercher, rechercherCommunes });
  return {
    suggestions,
    rechercher: service.rechercher,
    communes,
    rechercherCommunes: service.rechercherCommunes,
  };
}

export type AdressesService = ReturnType<typeof creerAdressesService>;
