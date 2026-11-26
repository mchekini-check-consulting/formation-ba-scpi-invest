// Liens du pied de page de l'accueil vers les outils de test (import du catalogue,
// boîte de réception de la SCPI simulée) : affichés en dev et sur le poste seulement
// (environnement.js), jamais en qualif, preprod ni prod. À côté des liens légaux, pas
// parmi eux.
import {
  CHEMIN_BOITE_SCPI,
  CHEMIN_IMPORT_CATALOGUE,
  outilsDeTestVisibles,
} from './environnement.js';
import './outils.css';

export default function LienOutilsPied({ visible = outilsDeTestVisibles() }) {
  if (!visible) return null;
  return (
    <span className="pied__outils">
      <a href={CHEMIN_IMPORT_CATALOGUE} className="pied__dev">
        Import du catalogue <span className="pastille-dev">dev</span>
      </a>
      <a href={CHEMIN_BOITE_SCPI} className="pied__dev">
        Boîte de la SCPI <span className="pastille-dev">dev</span>
      </a>
    </span>
  );
}
