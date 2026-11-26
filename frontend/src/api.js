// URL du backend du projet, déduite du host du frontend :
//   https://<application>.<projet>.<env>.<domaine>
//   -> passerelle https://gateway.<projet>.<env>.<domaine>/backend (pod gateway du projet)
// Même image dans tous les environnements (promotion Kargo) : rien à configurer.
// En local (localhost) : /api, relayé vers le backend par Vite (vite.config.js)
// ou nginx (nginx.local.conf).
//   fetch(`${apiBase()}/health`)
// Autre backend du projet (ex. societe-gestion) : second paramètre ; en ligne
// .../<backend>, en local /api/<backend> (relais de vite.config.js). Sans second
// paramètre : le backend principal, comme avant (/api en local).
//   fetch(`${apiBase(location.hostname, 'societe-gestion')}/messages`)
export function apiBase(hostname = location.hostname, backend = 'backend') {
  const [, projet, env, ...domaine] = hostname.split('.');
  const adresseIp = /^[\d.]+$/.test(hostname); // 127.0.0.1 : local aussi
  if (adresseIp || !projet || !env || domaine.length === 0) {
    return backend === 'backend' ? '/api' : `/api/${backend}`;
  }
  return `https://gateway.${projet}.${env}.${domaine.join('.')}/${backend}`;
}
