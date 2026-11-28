import { matchPath } from 'react-router';

// Animation d'arrivée d'un écran (<ViewTransition> de Routeur.jsx, réglages dans
// index.css) : fondu pour tous les écrans, sauf la fiche d'une SCPI (/catalogue/<id>)
// qui s'affiche directement, sans animation
export function classeEntree(pathname) {
  return matchPath('/catalogue/:id', pathname) ? 'fiche-entre' : 'ecran-entre';
}
