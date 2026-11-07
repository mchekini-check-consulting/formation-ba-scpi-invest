// Lien du pied de page de l'accueil vers l'outil de test de l'import du catalogue :
// affiché en dev et sur le poste seulement (environnement.js), jamais en qualif,
// preprod ni prod. À côté des liens légaux, pas parmi eux.
import { CHEMIN_IMPORT_CATALOGUE, outilsDeTestVisibles } from './environnement.js';
import './outils.css';

export default function LienOutilsPied({ visible = outilsDeTestVisibles() }) {
  if (!visible) return null;
  return (
    <a href={CHEMIN_IMPORT_CATALOGUE} className="pied__dev">
      Import du catalogue <span className="pastille-dev">dev</span>
    </a>
  );
}
