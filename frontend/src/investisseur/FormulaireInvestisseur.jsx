// Formulaire investisseur (US-05a) : questionnaire MIF2 en 5 étapes, réponses enregistrées
// à chaque « Suivant » et reprise à la première étape non complétée. Le calcul du profil,
// la certification et la validation relèvent de l'US-05b.
import { useEffect, useState } from 'react';
import { deconnecter } from '../auth.js';
import PageCompte from '../PageCompte.jsx';
import { enregistrerEtape, lireQuestionnaire } from './api.js';
import {
  ETAPES,
  MESSAGES,
  NOMBRE_ETAPES,
  basculer,
  erreursEtape,
  questionsVisibles,
  reponsesAEnvoyer,
} from './questionnaire.js';
import './investisseur.css';

function naviguer(url) {
  window.location.assign(url);
}

// Les montants sont saisis comme du texte : ceux reçus du backend repassent en texte
function pourSaisie(reponses) {
  const resultat = {};
  for (const [etape, valeurs] of Object.entries(reponses ?? {})) {
    resultat[etape] = Object.fromEntries(
      Object.entries(valeurs).map(([cle, v]) => [cle, typeof v === 'number' ? String(v) : v]),
    );
  }
  return resultat;
}

function Question({ question, valeur, erreur, changer }) {
  const idErreur = `${question.cle}-erreur`;
  const messageErreur = (
    <p id={idErreur} className="champ__erreur" role="alert">
      {erreur ?? ''}
    </p>
  );

  if (question.type === 'montant') {
    return (
      <div className="champ">
        <label htmlFor={question.cle}>{question.libelle}</label>
        <div className="montant">
          <input
            id={question.cle}
            type="text"
            inputMode="numeric"
            value={valeur ?? ''}
            onChange={(e) => changer(e.target.value)}
            aria-invalid={Boolean(erreur)}
            aria-describedby={idErreur}
          />
          <span aria-hidden="true">€</span>
        </div>
        {messageErreur}
      </div>
    );
  }

  const multiple = question.type === 'multiple';
  const exclusiveCochee = multiple && (valeur ?? []).includes(question.exclusive);
  return (
    <fieldset className="question" aria-describedby={idErreur} aria-invalid={Boolean(erreur)}>
      <legend>{question.libelle}</legend>
      <div className="question__options">
        {question.options.map((option) => {
          const coche = multiple
            ? (valeur ?? []).includes(option.valeur)
            : valeur === option.valeur;
          return (
            <label key={option.valeur} className="option">
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={question.cle}
                value={option.valeur}
                checked={coche}
                disabled={exclusiveCochee && option.valeur !== question.exclusive}
                onChange={() =>
                  changer(multiple ? basculer(question, valeur, option.valeur) : option.valeur)
                }
              />
              <span>{option.libelle}</span>
            </label>
          );
        })}
      </div>
      {messageErreur}
    </fieldset>
  );
}

export default function FormulaireInvestisseur({
  lire = lireQuestionnaire,
  enregistrer = enregistrerEtape,
  seDeconnecter = deconnecter,
  allerA = naviguer,
}) {
  const [etape, setEtape] = useState(null);
  const [reponses, setReponses] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [alerte, setAlerte] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    let actif = true;
    lire()
      .then((avancement) => {
        if (!actif) return;
        setReponses(pourSaisie(avancement.reponses));
        setEtape(avancement.etapeCourante);
      })
      .catch((err) => {
        if (!actif) return;
        if (err.status === 401) {
          allerA('/connexion');
        } else {
          setAlerte(err.message);
        }
      });
    return () => {
      actif = false;
    };
  }, [lire, allerA]);

  const reponsesEtape = reponses[etape] ?? {};

  function changer(cle, valeur) {
    setReponses({ ...reponses, [etape]: { ...reponsesEtape, [cle]: valeur } });
    setErreurs({ ...erreurs, [cle]: undefined });
    setAlerte('');
  }

  async function suivant(event) {
    event.preventDefault();
    const trouvees = erreursEtape(etape, reponsesEtape);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) return;
    setEnvoiEnCours(true);
    setAlerte('');
    try {
      await enregistrer(etape, reponsesAEnvoyer(etape, reponsesEtape));
      setEtape(etape + 1);
    } catch {
      setAlerte(MESSAGES.echec);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function precedent() {
    setErreurs({});
    setAlerte('');
    setEtape(etape - 1);
  }

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const deconnexion = (
    <p className="compte__lien">
      <button type="button" className="lien-bouton" onClick={quitter}>
        Se déconnecter
      </button>
    </p>
  );

  if (etape === null) {
    return (
      <PageCompte titre="Formulaire investisseur">
        {alerte ? (
          <p className="compte__alerte" role="alert">
            {alerte}
          </p>
        ) : (
          <p className="compte__texte">Chargement…</p>
        )}
      </PageCompte>
    );
  }

  if (etape > NOMBRE_ETAPES) {
    return (
      <PageCompte titre="Formulaire investisseur">
        <p className="compte__texte">Merci, vos réponses aux 5 étapes sont enregistrées.</p>
        <p className="compte__texte">
          Prochaine étape : le calcul de votre profil investisseur, bientôt disponible.
        </p>
        <button
          type="button"
          className="compte__bouton compte__bouton--secondaire"
          onClick={() => setEtape(1)}
        >
          Revoir mes réponses
        </button>
        {deconnexion}
      </PageCompte>
    );
  }

  const { titre } = ETAPES[etape - 1];
  return (
    <PageCompte titre="Formulaire investisseur" large>
      <div className="progression">
        <p className="progression__texte">
          Étape {etape}/{NOMBRE_ETAPES} — {titre}
        </p>
        <div
          className="progression__barre"
          role="progressbar"
          aria-label="Progression du formulaire"
          aria-valuemin={1}
          aria-valuemax={NOMBRE_ETAPES}
          aria-valuenow={etape}
        >
          <span style={{ width: `${(etape / NOMBRE_ETAPES) * 100}%` }} />
        </div>
      </div>

      <form className="compte__form" aria-label={titre} onSubmit={suivant} noValidate>
        {questionsVisibles(etape, reponsesEtape).map((question) => (
          <Question
            key={question.cle}
            question={question}
            valeur={reponsesEtape[question.cle]}
            erreur={erreurs[question.cle]}
            changer={(valeur) => changer(question.cle, valeur)}
          />
        ))}

        {alerte && (
          <p className="compte__alerte" role="alert">
            {alerte}
          </p>
        )}

        <div className="navigation">
          {etape > 1 && (
            <button
              type="button"
              className="compte__bouton compte__bouton--secondaire"
              onClick={precedent}
            >
              Précédent
            </button>
          )}
          <button type="submit" className="compte__bouton" disabled={envoiEnCours}>
            {envoiEnCours ? 'Enregistrement…' : 'Suivant'}
          </button>
        </div>
      </form>
      {deconnexion}
    </PageCompte>
  );
}
