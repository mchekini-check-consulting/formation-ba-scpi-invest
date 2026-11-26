import type { RequestHandler } from 'express';

// Outils de test (boîte de réception de la SCPI simulée) : disponibles en dev et sur le
// poste, jamais en qualif, preprod ni prod. Même règle que backend/ et le frontend :
// l'environnement se lit dans l'adresse appelée,
//   gateway.<projet>.<env>.<domaine> -> <env> ; localhost ou adresse IP -> « local » ;
//   adresse non reconnue (nom interne du cluster...) -> fermé.
export function environnementDe(hostname: string): string | null {
  if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.includes(':')) {
    return 'local';
  }
  const [, projet, env, ...domaine] = hostname.split('.');
  return projet && env && domaine.length > 0 ? env : null;
}

export function outilsDisponibles(hostname: string): boolean {
  return ['local', 'dev'].includes(environnementDe(hostname) ?? '');
}

// Ailleurs qu'en dev : 404, comme si la route n'existait pas
export const seulementEnDev: RequestHandler = (req, res, next) => {
  if (outilsDisponibles(req.hostname)) {
    next();
  } else {
    res.status(404).json({ message: 'introuvable' });
  }
};
