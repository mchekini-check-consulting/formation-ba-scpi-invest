// Outils de test (import du catalogue) : visibles en dev et sur le poste seulement,
// jamais en qualif, preprod ni prod. L'environnement se lit dans l'adresse de la page,
// comme dans api.js : <application>.<projet>.<env>.<domaine> ; localhost ou IP -> local.
// Le backend applique la même règle (backend/src/outils/environnement.js) : ailleurs
// qu'en dev, ses routes répondent 404.
export function environnementDe(hostname = location.hostname) {
  if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.includes(':')) {
    return 'local';
  }
  const [, projet, env, ...domaine] = hostname.split('.');
  return projet && env && domaine.length > 0 ? env : null;
}

export function outilsDeTestVisibles(hostname = location.hostname) {
  return ['local', 'dev'].includes(environnementDe(hostname));
}

export const CHEMIN_IMPORT_CATALOGUE = '/outils/import-catalogue';
