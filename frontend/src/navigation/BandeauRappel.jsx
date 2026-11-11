// Bandeau de rappel (US-05d, scénarios 5 et 7) : profil investisseur validé il y a plus
// de 24 mois, ou questionnaire modifié depuis. Non bloquant : un bouton mène à la mise à
// jour, la croix le ferme jusqu'à la prochaine connexion.
import { useState } from 'react';
import { LienInterne } from '../MiseEnPage.jsx';
import { CHEMIN_MISE_A_JOUR, fermerRappel, rappelFerme } from './rappel.js';

export const TEXTE_RAPPEL =
  'Votre profil investisseur doit être mis à jour : il date de plus de 2 ans ou le questionnaire a évolué.';

export default function BandeauRappel() {
  const [ferme, setFerme] = useState(rappelFerme);
  if (ferme) return null;

  function fermer() {
    fermerRappel();
    setFerme(true);
  }

  return (
    <aside className="rappel-profil" aria-label="Rappel">
      <p className="rappel-profil__texte">{TEXTE_RAPPEL}</p>
      <LienInterne to={CHEMIN_MISE_A_JOUR} className="rappel-profil__action">
        Mettre à jour
      </LienInterne>
      <button
        type="button"
        className="rappel-profil__fermer"
        aria-label="Fermer le rappel"
        onClick={fermer}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </aside>
  );
}
