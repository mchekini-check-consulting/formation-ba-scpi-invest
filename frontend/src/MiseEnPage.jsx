// Éléments communs des écrans (modèle « bleu éditorial ») : logo, en-tête avec les
// boutons de compte, flèche des grands boutons. Styles dans index.css.
//
// Transition animée (<ViewTransition> de React, https://react.dev/reference/react/ViewTransition) :
// le texte du bouton cliqué glisse jusqu'au titre du formulaire de connexion ou
// d'inscription (PageCompte.jsx) et le logo reste en place. Les navigations par <Link>
// passent par startTransition (BrowserRouter useTransitions, main.jsx).
import { ViewTransition } from 'react';
import { Link, useInRouterContext } from 'react-router';
import LogoIcone from './LogoIcone.jsx';

export function Logo({ clair = false }) {
  return (
    <>
      <LogoIcone clair={clair} />
      <span>
        SCPI INVEST<span className="logo__plus">+</span>
      </span>
    </>
  );
}

// Lien interne : navigation React Router (sans rechargement, donc animée) ; simple lien
// quand l'écran est affiché hors routeur (tests unitaires d'un écran seul)
function LienInterne({ to, state, ...props }) {
  return useInRouterContext() ? (
    <Link to={to} state={state} {...props} />
  ) : (
    <a href={to} {...props} />
  );
}

// Nom de la transition partagée entre un bouton de compte et le titre du formulaire.
// Un nom par bouton (unique dans la page) ; la page d'arrivée le retrouve grâce à
// l'origine transmise avec la navigation (Routeur.jsx).
const nomTransition = (origine) => `compte-${origine}`;

// Titre du formulaire de connexion / d'inscription : le texte du bouton cliqué
// (origine) y glisse ; sans origine (adresse tapée, rechargement), titre simple
export function TitreCompte({ origine, children }) {
  if (!origine) return children;
  return (
    <ViewTransition name={nomTransition(origine)} share="titre-compte">
      {children}
    </ViewTransition>
  );
}

// Bouton vers la connexion ou l'inscription. origine : nom unique du bouton dans la page
// (ex. « heros-inscription »).
export function LienCompte({ vers, origine, className, fleche = false, children }) {
  return (
    <LienInterne to={`/${vers}`} state={{ origine }} className={className}>
      <ViewTransition name={nomTransition(origine)} share="titre-compte">
        <span>{children}</span>
      </ViewTransition>
      {fleche && <Fleche />}
    </LienInterne>
  );
}

// En-tête : logo vers l'accueil, menu facultatif au centre, boutons de compte à droite
// (masqués sur les écrans du compte)
export function EnTete({ menu, actions = true }) {
  return (
    <header className={menu ? 'entete entete--avec-menu' : 'entete'}>
      <ViewTransition name="logo" share="au-premier-plan">
        <LienInterne to="/" className="logo" aria-label="SCPI Invest+ — accueil">
          <Logo />
        </LienInterne>
      </ViewTransition>
      {menu && (
        <nav className="nav" aria-label="Navigation">
          {menu.map((l) => (
            <a key={l.href} href={l.href}>
              {l.texte}
            </a>
          ))}
        </nav>
      )}
      {actions && (
        <div className="entete__actions">
          <LienCompte vers="connexion" origine="entete-connexion" className="btn btn--clair">
            Se connecter
          </LienCompte>
          <LienCompte vers="inscription" origine="entete-inscription" className="btn btn--sombre">
            Créer mon compte
          </LienCompte>
        </div>
      )}
    </header>
  );
}

// Pastille blanche avec une flèche, à droite des grands boutons bleus
export function Fleche() {
  return (
    <span className="btn__fleche" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
    </span>
  );
}
