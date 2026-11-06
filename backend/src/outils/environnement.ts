import type { RequestHandler } from 'express';
import { HttpError } from '../logging/http-error.js';

// Outils de test (import du catalogue) : disponibles en dev et sur le poste, jamais en
// qualif, preprod ni prod. L'environnement se lit dans l'adresse appelée, comme le
// frontend le fait (frontend/src/api.js) :
//   gateway.<projet>.<env>.<domaine> -> <env> ; localhost ou adresse IP -> "local".
// Adresse non reconnue (nom interne du cluster...) : null, outils fermés.
export function environnementDe(hostname: string): string | null {
  if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.includes(':')) {
    return 'local';
  }
  const [, projet, env, ...domaine] = hostname.split('.');
  return projet && env && domaine.length > 0 ? env : null;
}

export const ENVIRONNEMENTS_DES_OUTILS = ['local', 'dev'];

export function outilsDisponibles(hostname: string): boolean {
  return ENVIRONNEMENTS_DES_OUTILS.includes(environnementDe(hostname) ?? '');
}

// Ailleurs qu'en dev : 404, comme si les routes n'existaient pas. req.hostname = en-tête
// Host (trust proxy désactivé : X-Forwarded-Host ignoré)
export const seulementEnDev: RequestHandler = (req, _res, next) => {
  next(outilsDisponibles(req.hostname) ? undefined : new HttpError(404, 'introuvable'));
};
