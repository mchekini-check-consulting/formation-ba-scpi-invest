// Fin du formulaire investisseur (US-05b) : profil calculé par le backend sur les
// réponses enregistrées (recalculé à chaque arrivée sur cet écran), avertissements,
// certification obligatoire puis validation.
import { useEffect, useState } from 'react';
import { AVERTISSEMENTS, CERTIFICATION, ECHEC_VALIDATION, PROFILS } from './profils.js';

export default function ResultatProfil({ lireProfil, valider, modifier, apresValidation }) {
  const [resultat, setResultat] = useState(null);
  const [erreurChargement, setErreurChargement] = useState('');
  const [certifie, setCertifie] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurValidation, setErreurValidation] = useState('');

  useEffect(() => {
    let actif = true;
    lireProfil()
      .then((r) => actif && setResultat(r))
      .catch((err) => actif && setErreurChargement(err.message));
    return () => {
      actif = false;
    };
  }, [lireProfil]);

  async function envoyer(event) {
    event.preventDefault();
    if (!certifie || envoiEnCours) return;
    setEnvoiEnCours(true);
    setErreurValidation('');
    try {
      await valider();
      apresValidation();
    } catch {
      setErreurValidation(ECHEC_VALIDATION);
      setEnvoiEnCours(false);
    }
  }

  if (!resultat) {
    return erreurChargement ? (
      <p className="compte__alerte" role="alert">
        {erreurChargement}
      </p>
    ) : (
      <p className="compte__texte">Calcul de votre profil…</p>
    );
  }

  const { nom, explication } = PROFILS[resultat.profil];
  return (
    <form className="compte__form" aria-label="Validation du profil" onSubmit={envoyer} noValidate>
      <section className="profil" aria-labelledby="profil-nom">
        <p className="profil__intro">Votre profil investisseur</p>
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
            setErreurValidation('');
          }}
        />
        <span>{CERTIFICATION}</span>
      </label>

      {erreurValidation && (
        <p className="compte__alerte" role="alert">
          {erreurValidation}
        </p>
      )}

      <button type="submit" className="compte__bouton" disabled={!certifie || envoiEnCours}>
        {envoiEnCours ? 'Validation en cours…' : 'Valider'}
      </button>
    </form>
  );
}
