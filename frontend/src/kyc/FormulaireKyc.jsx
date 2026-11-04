// Formulaire KYC en 4 étapes avec barre de progression (US-04a, SCPI-21) :
// « Suivant » contrôle l'étape (champs manquants signalés en rouge), « Précédent »
// revient en arrière sans perdre les réponses. Les réponses restent dans la page :
// enregistrement, reprise, récapitulatif et validation sont portés par l'US-04b.
import { useEffect, useRef, useState } from 'react';
import { ETAPES, champsVisibles, erreursEtape } from './etapes.js';
import './kyc.css';

const idChamp = (nom) => `kyc-${nom}`;
const idErreur = (nom) => `kyc-${nom}-erreur`;

function descriptions(champ, erreur) {
  const ids = [];
  if (champ.aide) ids.push(`kyc-${champ.nom}-aide`);
  if (erreur) ids.push(idErreur(champ.nom));
  return ids.length ? ids.join(' ') : undefined;
}

function Aide({ champ }) {
  return champ.aide ? (
    <p id={`kyc-${champ.nom}-aide`} className="champ__aide">
      {champ.aide}
    </p>
  ) : null;
}

function Erreur({ nom, message }) {
  return message ? (
    <p id={idErreur(nom)} className="champ__erreur">
      {message}
    </p>
  ) : null;
}

function Libelle({ champ }) {
  return (
    <>
      {champ.libelle}
      {champ.facultatif && <span className="champ__facultatif"> (facultatif)</span>}
    </>
  );
}

// Boutons radio (choix unique) ou cases à cocher (choix multiple)
function Groupe({ champ, valeur, erreur, changer }) {
  const multiple = champ.type === 'cases';
  const coches = multiple ? (valeur ?? []) : [valeur];

  function basculer(option) {
    if (!multiple) return changer(option);
    const liste = coches.includes(option)
      ? coches.filter((o) => o !== option)
      : [...coches, option];
    return changer(liste);
  }

  return (
    <fieldset
      className={`champ kyc-groupe${erreur ? ' kyc-groupe--erreur' : ''}`}
      aria-describedby={descriptions(champ, erreur)}
    >
      <legend>
        <Libelle champ={champ} />
      </legend>
      <Aide champ={champ} />
      <div className={multiple ? 'kyc-options kyc-options--colonnes' : 'kyc-options'}>
        {champ.options.map((option, i) => (
          <label key={option} className="case">
            <input
              id={i === 0 ? idChamp(champ.nom) : undefined}
              type={multiple ? 'checkbox' : 'radio'}
              name={champ.nom}
              value={option}
              checked={coches.includes(option)}
              onChange={() => basculer(option)}
              aria-invalid={erreur ? true : undefined}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <Erreur nom={champ.nom} message={erreur} />
    </fieldset>
  );
}

function Champ({ champ, valeur, erreur, changer }) {
  if (champ.type === 'choix' || champ.type === 'cases') {
    return <Groupe champ={champ} valeur={valeur} erreur={erreur} changer={changer} />;
  }
  const commun = {
    id: idChamp(champ.nom),
    value: valeur ?? '',
    onChange: (e) => changer(e.target.value),
    'aria-invalid': erreur ? true : undefined,
    'aria-describedby': descriptions(champ, erreur),
  };
  return (
    <div className="champ">
      <label htmlFor={idChamp(champ.nom)}>
        <Libelle champ={champ} />
      </label>
      <Aide champ={champ} />
      {champ.type === 'liste' ? (
        <select {...commun}>
          <option value="">Choisir…</option>
          {champ.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          {...commun}
          type={champ.type === 'texte' ? 'text' : champ.type}
          autoComplete={champ.autoComplete}
          readOnly={champ.lectureSeule}
        />
      )}
      <Erreur nom={champ.nom} message={erreur} />
    </div>
  );
}

function Progression({ index }) {
  const total = ETAPES.length;
  return (
    <div className="kyc-progression">
      <p className="kyc-progression__texte">
        Étape {index + 1}/{total}
      </p>
      <div
        className="kyc-progression__barre"
        role="progressbar"
        aria-label="Progression du formulaire KYC"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-valuetext={`Étape ${index + 1} sur ${total} : ${ETAPES[index].titre}`}
      >
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
      <ol className="kyc-progression__etapes">
        {ETAPES.map((e, i) => {
          const etat = i < index ? 'faite' : i === index ? 'courante' : 'a-venir';
          return (
            <li
              key={e.id}
              className={`kyc-progression__etape kyc-progression__etape--${etat}`}
              aria-current={i === index ? 'step' : undefined}
            >
              {e.titre}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function FormulaireKyc({ email = '', aujourdhui }) {
  const [index, setIndex] = useState(0);
  const [reponses, setReponses] = useState({ email });
  const [erreurs, setErreurs] = useState({});
  const [termine, setTermine] = useState(false);
  const titreEtape = useRef(null);
  const aBouge = useRef(false);

  const etape = ETAPES[index];
  const derniere = index === ETAPES.length - 1;

  // Après un changement d'étape : focus sur son titre (lecteurs d'écran, défilement)
  useEffect(() => {
    if (aBouge.current) titreEtape.current?.focus();
  }, [index, termine]);

  function changer(nom, valeur) {
    setReponses((r) => ({ ...r, [nom]: valeur }));
    setErreurs((e) => {
      if (!e[nom]) return e;
      const { [nom]: _retire, ...reste } = e;
      return reste;
    });
  }

  function suivant(event) {
    event.preventDefault();
    const trouvees = erreursEtape(etape, reponses, aujourdhui);
    setErreurs(trouvees);
    const premier = champsVisibles(etape, reponses).find((c) => trouvees[c.nom]);
    if (premier) {
      document.getElementById(idChamp(premier.nom))?.focus();
      return;
    }
    aBouge.current = true;
    if (derniere) {
      setTermine(true);
    } else {
      setIndex(index + 1);
    }
  }

  function precedent() {
    aBouge.current = true;
    setErreurs({});
    setIndex(index - 1);
  }

  if (termine) {
    return (
      <div className="kyc">
        <h2 ref={titreEtape} tabIndex={-1} className="kyc__titre-etape">
          Vos réponses sont complètes
        </h2>
        <p className="compte__texte">
          Merci, les 4 étapes du formulaire KYC sont remplies. Le récapitulatif et la validation de
          votre dossier arrivent prochainement.
        </p>
        <div className="kyc__boutons">
          <button
            type="button"
            className="compte__bouton compte__bouton--secondaire"
            onClick={() => setTermine(false)}
          >
            Revenir au formulaire
          </button>
        </div>
      </div>
    );
  }

  const nbErreurs = Object.keys(erreurs).length;

  return (
    <div className="kyc">
      <Progression index={index} />
      <form
        className="compte__form"
        aria-labelledby="kyc-titre-etape"
        onSubmit={suivant}
        noValidate
      >
        <h2 id="kyc-titre-etape" ref={titreEtape} tabIndex={-1} className="kyc__titre-etape">
          {etape.titre}
        </h2>
        {nbErreurs > 0 && (
          <p className="compte__alerte" role="alert">
            {nbErreurs === 1
              ? 'Un champ est à compléter ou à corriger : il est signalé en rouge.'
              : `${nbErreurs} champs sont à compléter ou à corriger : ils sont signalés en rouge.`}
          </p>
        )}
        <div className="kyc__champs">
          {champsVisibles(etape, reponses).map((champ) => (
            <Champ
              key={champ.nom}
              champ={champ}
              valeur={reponses[champ.nom]}
              erreur={erreurs[champ.nom]}
              changer={(valeur) => changer(champ.nom, valeur)}
            />
          ))}
        </div>
        <div className="kyc__boutons">
          {index > 0 && (
            <button
              type="button"
              className="compte__bouton compte__bouton--secondaire"
              onClick={precedent}
            >
              Précédent
            </button>
          )}
          <button type="submit" className="compte__bouton kyc__suivant">
            {derniere ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </form>
    </div>
  );
}
