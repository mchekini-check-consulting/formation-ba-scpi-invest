// Mise à jour du profil investisseur (US-05d) : ouverte par « Mettre à jour mon profil »
// (page Profil) ou par le bandeau de rappel. Le formulaire en 5 étapes est pré-rempli avec
// les réponses actuelles et suit les mêmes règles de saisie (US-05a) ; à la fin,
// récapitulatif, certification et validation, puis nouveau profil (FinQuestionnaire.jsx).
// Non bloquant : la sidebar reste là. Les réponses en cours restent dans l'écran, rien
// n'est enregistré avant la validation : abandonner (ou changer d'écran) laisse l'ancien
// profil actif et inchangé.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { deconnecter } from '../auth.js';
import PageApplication from '../navigation/PageApplication.jsx';
import { lireQuestionnaire, validerMiseAJour } from './api.js';
import { Progression, Question } from './FormulaireInvestisseur.jsx';
import {
  ETAPES,
  NOMBRE_ETAPES,
  erreursEtape,
  pourSaisie,
  questionsVisibles,
  reponsesAEnvoyer,
} from './questionnaire.js';
import FinQuestionnaire from './FinQuestionnaire.jsx';
import './investisseur.css';

function naviguer(url) {
  window.location.assign(url);
}

// lire, valider, seDeconnecter, allerA, chargerIdentite : remplacés dans les tests
export default function MiseAJourProfil({
  lire = lireQuestionnaire,
  valider = validerMiseAJour,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const [etape, setEtape] = useState(null);
  const [reponses, setReponses] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [alerte, setAlerte] = useState('');

  useEffect(() => {
    document.title = 'SCPI Invest+ · Mise à jour du profil investisseur';
  }, []);

  useEffect(() => {
    let actif = true;
    lire()
      .then((avancement) => {
        if (!actif) return;
        // Pas encore de profil validé : c'est le premier questionnaire (US-05a)
        if (!avancement.valide) {
          allerA('/formulaire-investisseur');
          return;
        }
        setReponses(pourSaisie(avancement.reponses));
        setEtape(1);
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

  // Réponses des 5 étapes au format du backend (montants en nombres)
  const aEnvoyer = useMemo(() => {
    const resultat = {};
    for (let n = 1; n <= NOMBRE_ETAPES; n += 1) {
      resultat[n] = reponsesAEnvoyer(n, reponses[n] ?? {});
    }
    return resultat;
  }, [reponses]);
  const validerNouveauProfil = useCallback(() => valider(aEnvoyer), [valider, aEnvoyer]);

  const reponsesEtape = reponses[etape] ?? {};

  function changer(cle, valeur) {
    setReponses({ ...reponses, [etape]: { ...reponsesEtape, [cle]: valeur } });
    setErreurs({ ...erreurs, [cle]: undefined });
  }

  function suivant(event) {
    event.preventDefault();
    const trouvees = erreursEtape(etape, reponsesEtape);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length === 0) setEtape(etape + 1);
  }

  function precedent() {
    setErreurs({});
    setEtape(etape - 1);
  }

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  let contenu;
  if (etape === null) {
    contenu = alerte ? (
      <p className="compte__alerte" role="alert">
        {alerte}
      </p>
    ) : (
      <p className="compte__texte">Chargement…</p>
    );
  } else if (etape > NOMBRE_ETAPES) {
    contenu = (
      <FinQuestionnaire
        intro="Votre nouveau profil investisseur"
        reponses={reponses}
        valider={validerNouveauProfil}
        modifier={() => setEtape(1)}
        destination="/profil"
        libelleBouton="Revenir à mon profil"
        allerA={allerA}
      />
    );
  } else {
    const { titre } = ETAPES[etape - 1];
    contenu = (
      <>
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
            <button type="submit" className="compte__bouton">
              Suivant
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <PageApplication
      titre="Mettre à jour mon profil investisseur"
      actif="profil"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
      sansRappel
    >
      <div className="mise-a-jour__avis" role="note">
        <p>
          <strong>Mise à jour de votre profil.</strong> Votre profil actuel reste actif tant que
          vous n’avez pas validé le nouveau.
        </p>
        <button type="button" className="mise-a-jour__abandon" onClick={() => allerA('/profil')}>
          Abandonner la mise à jour
        </button>
      </div>
      <section
        className="compte__carte compte__carte--large mise-a-jour"
        aria-label="Questionnaire"
      >
        {contenu}
      </section>
    </PageApplication>
  );
}
