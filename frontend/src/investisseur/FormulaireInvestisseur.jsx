// Formulaire investisseur (US-05a) : questionnaire MIF2 en 5 étapes, réponses enregistrées
// à chaque « Suivant » et reprise à la première étape non complétée ; à la fin,
// récapitulatif des réponses, certification et validation, puis profil calculé et bouton
// « Accéder au Catalogue » (US-05b, FinQuestionnaire.jsx).
// Écran /formulaire-investisseur, destination après la validation du KYC (US-04b) :
// accessible seulement avec un KYC validé (ExigerKycComplete, Routeur.jsx).
import { useEffect, useState } from 'react';
import { deconnecter } from '../auth.js';
import PageCompte from '../PageCompte.jsx';
import { enregistrerEtape, lireQuestionnaire, reinitialiserEtape, validerProfil } from './api.js';
import {
  ETAPES,
  MESSAGES,
  NOMBRE_ETAPES,
  basculer,
  erreursEtape,
  pourSaisie,
  questionsVisibles,
  reponsesAEnvoyer,
} from './questionnaire.js';
import FinQuestionnaire from './FinQuestionnaire.jsx';
import './investisseur.css';

// Montant en euros : 9 chiffres au plus (jusqu'à 999 999 999 €)
const LONGUEUR_MAX_MONTANT = 9;

function naviguer(url) {
  window.location.assign(url);
}

// Progression en pastilles numérotées reliées : ✓ pour les étapes faites, étape courante
// entourée. Sur mobile, les libellés laissent place au texte « Étape n/5 — titre ».
export function Progression({ etape }) {
  return (
    <nav className="investisseur-progression" aria-label="Progression du formulaire">
      <p className="investisseur-progression__texte">
        Étape {etape}/{NOMBRE_ETAPES} — {ETAPES[etape - 1].titre}
      </p>
      <ol className="investisseur-progression__etapes">
        {ETAPES.map(({ titre }, i) => {
          const numero = i + 1;
          const etat = numero < etape ? 'faite' : numero === etape ? 'courante' : 'a-venir';
          return (
            <li
              key={titre}
              className={`investisseur-progression__etape investisseur-progression__etape--${etat}`}
              aria-current={etat === 'courante' ? 'step' : undefined}
            >
              <span className="investisseur-progression__pastille" aria-hidden="true">
                {etat === 'faite' ? '✓' : numero}
              </span>
              <span className="investisseur-progression__libelle">
                {titre}
                {etat === 'faite' && (
                  <span className="investisseur-progression__cache"> (terminée)</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Question({ question, valeur, erreur, changer }) {
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
            maxLength={LONGUEUR_MAX_MONTANT}
            // chiffres seulement, 9 au plus : lettres et autres caractères ignorés (frappe
            // ou collage)
            onChange={(e) =>
              changer(e.target.value.replace(/\D/g, '').slice(0, LONGUEUR_MAX_MONTANT))
            }
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
  effacer = reinitialiserEtape,
  valider = validerProfil,
  seDeconnecter = deconnecter,
  allerA = naviguer,
}) {
  const [etape, setEtape] = useState(null);
  const [reponses, setReponses] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [alerte, setAlerte] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  useEffect(() => {
    document.title = 'SCPI Invest+ · Formulaire investisseur';
  }, []);

  useEffect(() => {
    let actif = true;
    lire()
      .then((avancement) => {
        if (!actif) return;
        // Formulaire déjà validé : il n'est plus proposé (US-05b, scénario 11)
        if (avancement.valide) {
          allerA('/catalogue');
          return;
        }
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

  // « Réinitialiser » : efface en base les réponses de l'étape affichée, et seulement
  // elle, puis vide ses champs. En cas d'échec, les saisies restent à l'écran.
  async function reinitialiser() {
    setEnvoiEnCours(true);
    setAlerte('');
    try {
      await effacer(etape);
      setReponses({ ...reponses, [etape]: {} });
      setErreurs({});
    } catch {
      setAlerte(MESSAGES.echecReinitialisation);
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

  if (etape === null) {
    return (
      <PageCompte titre="Formulaire investisseur" seDeconnecter={quitter}>
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
      <PageCompte titre="Formulaire investisseur" seDeconnecter={quitter}>
        <FinQuestionnaire
          reponses={reponses}
          valider={valider}
          modifier={() => setEtape(1)}
          destination="/catalogue"
          libelleBouton="Accéder au Catalogue"
          allerA={allerA}
        />
      </PageCompte>
    );
  }

  const { titre } = ETAPES[etape - 1];
  return (
    <PageCompte titre="Formulaire investisseur" seDeconnecter={quitter} large>
      <Progression etape={etape} />

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
          <button
            type="button"
            className="compte__bouton compte__bouton--secondaire"
            onClick={reinitialiser}
            disabled={envoiEnCours}
          >
            Réinitialiser
          </button>
          <button type="submit" className="compte__bouton" disabled={envoiEnCours}>
            {envoiEnCours ? 'Enregistrement…' : 'Suivant'}
          </button>
        </div>
      </form>
    </PageCompte>
  );
}
