// Fenêtre de confirmation d'une action (déconnexion, effacement des informations fiscales
// US-06) : « Oui » confirme, « Non » (ou Échap, ou un clic à côté de la fenêtre) la referme
// sans rien faire. Le focus démarre sur « Non »
// (choix sans risque), reste dans la fenêtre (Tab / Maj+Tab) et revient ensuite sur le
// bouton qui l'a ouverte.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './confirmation.css';

export default function Confirmation({
  titre,
  message,
  libelleOui = 'Oui',
  libelleNon = 'Non',
  onOui,
  onNon,
  retour,
}) {
  const idTitre = useId();
  const idMessage = useId();
  const boutonNon = useRef(null);
  const boutonOui = useRef(null);

  useEffect(() => {
    const declencheur = retour?.current;
    boutonNon.current?.focus();
    return () => declencheur?.focus();
  }, [retour]);

  function surTouche(evenement) {
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      onNon();
    } else if (evenement.key === 'Tab') {
      // Deux boutons seulement : Tab et Maj+Tab passent de l'un à l'autre
      evenement.preventDefault();
      const suivant =
        document.activeElement === boutonNon.current ? boutonOui.current : boutonNon.current;
      suivant?.focus();
    }
  }

  return createPortal(
    // Voile : clic à côté de la fenêtre = « Non » ; clavier (Échap, Tab) géré ici aussi, les
    // touches frappées dans la fenêtre remontant jusqu'au voile
    <div
      className="confirmation"
      role="presentation"
      onMouseDown={(evenement) => evenement.target === evenement.currentTarget && onNon()}
      onKeyDown={surTouche}
    >
      <div
        className="confirmation__fenetre"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        aria-describedby={idMessage}
      >
        <h2 id={idTitre} className="confirmation__titre">
          {titre}
        </h2>
        <p id={idMessage} className="confirmation__message">
          {message}
        </p>
        <div className="confirmation__actions">
          <button ref={boutonNon} type="button" className="confirmation__bouton" onClick={onNon}>
            {libelleNon}
          </button>
          <button
            ref={boutonOui}
            type="button"
            className="confirmation__bouton confirmation__bouton--principal"
            onClick={onOui}
          >
            {libelleOui}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
