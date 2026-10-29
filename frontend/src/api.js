// URL du backend du projet, déduite du host du frontend :
//   https://<application>.<projet>.<env>.<domaine>
//   -> passerelle https://gateway.<projet>.<env>.<domaine>/backend (pod gateway du projet)
// Même image dans tous les environnements (promotion Kargo) : rien à configurer.
// En local (localhost) : /api, relayé vers le backend par Vite (vite.config.js)
// ou nginx (nginx.local.conf).
//   fetch(`${apiBase()}/health`)
export function apiBase(hostname = location.hostname) {
  const [, projet, env, ...domaine] = hostname.split('.');
  const adresseIp = /^[\d.]+$/.test(hostname); // 127.0.0.1 : local aussi
  if (adresseIp || !projet || !env || domaine.length === 0) {
    return '/api';
  }
  return `https://gateway.${projet}.${env}.${domaine.join('.')}/backend`;
}
