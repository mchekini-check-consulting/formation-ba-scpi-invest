// Sidebar de navigation de l'application (US-06, SCPI-23), en barre d'icônes verticale
// sur toute la hauteur de l'écran :
// - en haut : le logo (vers l'accueil) et la flèche qui déplie la barre pour afficher
//   les libellés ;
// - au milieu : les entrées de entrees.js (icône, libellé en infobulle quand la barre est
//   repliée) ;
// - en bas : « Infos fiscales » (EN-03), la pastille aux initiales de l'investisseur (lien
//   vers la page Profil, entourée quand elle est affichée) et le bouton « Se déconnecter »,
//   qui demande confirmation (« Oui » / « Non ») avant de déconnecter.
import { useRef, useState } from 'react';
import LogoIcone from '../LogoIcone.jsx';
import ConfirmationDeconnexion from './ConfirmationDeconnexion.jsx';
import { LienInterne } from '../MiseEnPage.jsx';
import { PROFILS } from '../investisseur/profils.js';
import { ENTREES, INFOS_FISCALES } from './entrees.js';
import { initiales, lireIdentite, useIdentite } from './identite.js';
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
  versements: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  fiscalite: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9.5 17l5-6" />
      <circle cx="9.75" cy="11.75" r="1" />
      <circle cx="14.25" cy="16.25" r="1" />
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

// Entrée du menu, marquée sélectionnée quand son écran est affiché
function Entree({ entree, actif }) {
  return (
    <LienInterne
      to={entree.chemin}
      className="sidebar__entree"
      aria-current={actif === entree.id ? 'page' : undefined}
      data-infobulle={entree.libelle}
    >
      <Icone id={entree.id} />
      <span className="sidebar__libelle">{entree.libelle}</span>
    </LienInterne>
  );
}

// Lien vers la page Profil (lecture seule), marqué sélectionné quand elle est affichée
function Profil({ identite, actif }) {
  const lettres = identite ? initiales(identite) : '';
  if (!lettres) return null;
  const nom = identite.nomComplet || identite.email;
  const profil = identite.profil ? `Profil ${PROFILS[identite.profil].nom.toLowerCase()}` : '';
  return (
    <LienInterne
      to="/profil"
      className="sidebar__profil"
      aria-label={`Mon profil : ${nom}`}
      aria-current={actif ? 'page' : undefined}
      data-infobulle={nom}
    >
      <span className="sidebar__pastille" aria-hidden="true">
        {lettres}
      </span>
      <span className="sidebar__libelle sidebar__identite">
        <span className="sidebar__nom">{nom}</span>
        {profil && <span className="sidebar__profil-type">{profil}</span>}
      </span>
    </LienInterne>
  );
}

// actif : identifiant de l'écran affiché (ex. « catalogue »), entrée marquée sélectionnée
// seDeconnecter : action du bouton du bas (absent : pas de bouton)
// chargerIdentite : lecture du nom et du profil (remplacée dans les tests)
// identite : déjà lue par la page (PageApplication) ; absente, la sidebar la lit elle-même
export default function Sidebar({
  actif,
  seDeconnecter,
  chargerIdentite = lireIdentite,
  identite: fournie,
}) {
  const [deplie, setDeplie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const boutonDeconnexion = useRef(null);
  const chargee = useIdentite(fournie === undefined ? chargerIdentite : null);
  const identite = fournie === undefined ? chargee : fournie;

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
            <Entree entree={entree} actif={actif} />
          </li>
        ))}
      </ul>

      <div className="sidebar__bas">
        <Entree entree={INFOS_FISCALES} actif={actif} />
        <Profil identite={identite} actif={actif === 'profil'} />
        {seDeconnecter && (
          <button
            ref={boutonDeconnexion}
            type="button"
            className="sidebar__entree sidebar__deconnexion"
            data-infobulle="Se déconnecter"
            aria-haspopup="dialog"
            onClick={() => setConfirmer(true)}
          >
            <Icone id="deconnexion" />
            <span className="sidebar__libelle">Se déconnecter</span>
          </button>
        )}
        {confirmer && (
          <ConfirmationDeconnexion
            retour={boutonDeconnexion}
            onNon={() => setConfirmer(false)}
            onOui={() => {
              setConfirmer(false);
              seDeconnecter();
            }}
          />
        )}
      </div>
    </nav>
  );
}
