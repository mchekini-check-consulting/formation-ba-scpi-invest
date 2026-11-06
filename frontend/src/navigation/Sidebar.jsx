// Sidebar de navigation de l'application (US-06, SCPI-23), en barre d'icônes verticale
// sur toute la hauteur de l'écran :
// - en haut : le logo (vers l'accueil) et la flèche qui déplie la barre pour afficher
//   les libellés ;
// - au milieu : les 4 entrées (icône, libellé en infobulle quand la barre est repliée).
//   Seul le Catalogue est cliquable ; les 3 autres sont grisées, sans lien ni curseur
//   de clic, avec l'infobulle « Bientôt disponible » au survol (règle optionnelle de la
//   story, à valider avec le PO) ;
// - en bas : la pastille aux initiales de l'investisseur et le bouton « Se déconnecter ».
import { useEffect, useState } from 'react';
import LogoIcone from '../LogoIcone.jsx';
import { LienInterne } from '../MiseEnPage.jsx';
import { PROFILS } from '../investisseur/profils.js';
import { ENTREES } from './entrees.js';
import { initiales, lireIdentite } from './identite.js';
import './navigation.css';

const ICONES = {
  catalogue: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  comparaison: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  simulation: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8" />
    </>
  ),
  portefeuille: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20" />
    </>
  ),
  deconnexion: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  deplier: <path d="M9 6l6 6-6 6" />,
};

function Icone({ id }) {
  return (
    <svg className="sidebar__icone" viewBox="0 0 24 24" aria-hidden="true">
      {ICONES[id]}
    </svg>
  );
}

// Identité de l'investisseur pour la pastille du bas ; rien tant qu'elle n'est pas connue
function useIdentite(charger) {
  const [identite, setIdentite] = useState(null);
  useEffect(() => {
    let actif = true;
    charger()
      .then((resultat) => actif && setIdentite(resultat))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [charger]);
  return identite;
}

function Profil({ identite }) {
  const lettres = identite ? initiales(identite) : '';
  if (!lettres) return null;
  const nom = identite.nomComplet || identite.email;
  const profil = identite.profil ? `Profil ${PROFILS[identite.profil].nom.toLowerCase()}` : '';
  return (
    <div className="sidebar__profil" data-infobulle={nom}>
      <span className="sidebar__pastille" aria-hidden="true">
        {lettres}
      </span>
      <span className="sidebar__libelle sidebar__identite">
        <span className="sidebar__nom">{nom}</span>
        {profil && <span className="sidebar__profil-type">{profil}</span>}
      </span>
    </div>
  );
}

// actif : identifiant de l'écran affiché (ex. « catalogue »), entrée marquée sélectionnée
// seDeconnecter : action du bouton du bas (absent : pas de bouton)
// chargerIdentite : lecture du nom et du profil (remplacée dans les tests)
export default function Sidebar({ actif, seDeconnecter, chargerIdentite = lireIdentite }) {
  const [deplie, setDeplie] = useState(false);
  const identite = useIdentite(chargerIdentite);

  return (
    <nav
      className={deplie ? 'sidebar sidebar--deplie' : 'sidebar'}
      aria-label="Menu de l’application"
    >
      <div className="sidebar__haut">
        <LienInterne
          to="/catalogue"
          className="sidebar__logo"
          aria-label="SCPI Invest+ — catalogue"
        >
          <LogoIcone clair />
        </LienInterne>
        <button
          type="button"
          className="sidebar__deplier"
          aria-expanded={deplie}
          aria-label={deplie ? 'Replier le menu' : 'Déplier le menu'}
          onClick={() => setDeplie(!deplie)}
        >
          <Icone id="deplier" />
        </button>
      </div>

      <ul className="sidebar__liste">
        {ENTREES.map((entree) => (
          <li key={entree.id}>
            {entree.inactive ? (
              <span
                className="sidebar__entree sidebar__entree--inactive"
                aria-disabled="true"
                data-libelle={entree.libelle}
                data-infobulle="Bientôt disponible"
              >
                <Icone id={entree.id} />
                <span className="sidebar__libelle">{entree.libelle}</span>
                <span className="sr-only"> (bientôt disponible)</span>
              </span>
            ) : (
              <LienInterne
                to={entree.chemin}
                className="sidebar__entree"
                aria-current={actif === entree.id ? 'page' : undefined}
                data-infobulle={entree.libelle}
              >
                <Icone id={entree.id} />
                <span className="sidebar__libelle">{entree.libelle}</span>
              </LienInterne>
            )}
          </li>
        ))}
      </ul>

      <div className="sidebar__bas">
        <Profil identite={identite} />
        {seDeconnecter && (
          <button
            type="button"
            className="sidebar__entree sidebar__deconnexion"
            data-infobulle="Se déconnecter"
            onClick={seDeconnecter}
          >
            <Icone id="deconnexion" />
            <span className="sidebar__libelle">Se déconnecter</span>
          </button>
        )}
      </div>
    </nav>
  );
}
