// Fin du formulaire investisseur (US-05b, et mise à jour US-05d) :
// 1. récapitulatif des réponses des 5 étapes, « Modifier mes réponses » (retour à l'étape 1,
//    réponses conservées) ;
// 2. certification obligatoire (« Valider » désactivé tant qu'elle n'est pas cochée) ;
// 3. validation : le backend calcule et enregistre le profil, qui s'affiche alors avec ses
//    avertissements ; l'investisseur passe à l'écran suivant quand il le décide (bouton),
//    sans redirection automatique.
import { useState } from 'react';
import { AVERTISSEMENTS, CERTIFICATION, ECHEC_VALIDATION, PROFILS } from './profils.js';
import { recapitulatif } from './questionnaire.js';

function Recapitulatif({ reponses }) {
  return recapitulatif(reponses).map((etape) => (
    <section key={etape.titre} className="recap-investisseur" aria-label={etape.titre}>
      <h3 className="recap-investisseur__titre">{etape.titre}</h3>
      <dl className="recap-investisseur__liste">
        {etape.lignes.map((ligne) => (
          <div key={ligne.cle} className="recap-investisseur__ligne">
            <dt>{ligne.libelle}</dt>
            <dd>{ligne.valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  ));
}

// Profil obtenu après la validation ; l'écran suivant s'ouvre au clic sur le bouton
function ProfilObtenu({ resultat, intro, destination, libelleBouton, allerA }) {
  const { nom, explication } = PROFILS[resultat.profil];
  return (
    <div className="compte__form" aria-live="polite">
      <section className="profil" aria-labelledby="profil-nom">
        <p className="profil__intro">{intro}</p>
        <p id="profil-nom" className="profil__nom">
          {nom}
        </p>
        <p className="profil__explication">{explication}</p>
      </section>
      {resultat.avertissements.map((cle) => (
        <p key={cle} className="avertissement">
          {AVERTISSEMENTS[cle]}
        </p>
      ))}
      <button type="button" className="compte__bouton" onClick={() => allerA(destination)}>
        {libelleBouton}
      </button>
    </div>
  );
}

// reponses : réponses des 5 étapes ({ 1: {...}, ... }) ; valider() renvoie le profil
// calculé ; destination : écran ouvert par le bouton libelleBouton après la validation
export default function FinQuestionnaire({
  reponses,
  valider,
  modifier,
  destination,
  libelleBouton,
  allerA,
  intro = 'Votre profil investisseur',
}) {
  const [certifie, setCertifie] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  async function envoyer(event) {
    event.preventDefault();
    if (!certifie || envoiEnCours) return;
    setEnvoiEnCours(true);
    setErreur('');
    try {
      setResultat(await valider());
    } catch (err) {
      // Refus expliqué par le backend (ex. une mise à jour par 24 heures) : son message
      setErreur(err?.status === 409 ? err.message : ECHEC_VALIDATION);
      setEnvoiEnCours(false);
    }
  }

  if (resultat) {
    return (
      <ProfilObtenu
        resultat={resultat}
        intro={intro}
        destination={destination}
        libelleBouton={libelleBouton}
        allerA={allerA}
      />
    );
  }

  return (
    <form className="compte__form" aria-label="Récapitulatif" onSubmit={envoyer} noValidate>
      <p className="compte__texte">
        Vérifiez vos réponses avant de valider : votre profil investisseur sera calculé à partir de
        celles-ci.
      </p>
      <Recapitulatif reponses={reponses} />

      <button
        type="button"
        className="compte__bouton compte__bouton--secondaire"
        onClick={modifier}
      >
        Modifier mes réponses
      </button>

      <label className="case">
        <input
          type="checkbox"
          checked={certifie}
          onChange={(e) => {
            setCertifie(e.target.checked);
            setErreur('');
          }}
        />
        <span>{CERTIFICATION}</span>
      </label>

      {erreur && (
        <p className="compte__alerte" role="alert">
          {erreur}
        </p>
      )}

      <button type="submit" className="compte__bouton" disabled={!certifie || envoiEnCours}>
        {envoiEnCours ? 'Validation en cours…' : 'Valider'}
      </button>
    </form>
  );
}
