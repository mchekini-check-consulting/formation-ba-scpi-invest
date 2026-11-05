// Formulaire KYC en 4 étapes avec barre de progression (US-04a, SCPI-21) :
// « Suivant » contrôle l'étape (champs manquants signalés en rouge), « Précédent »
// revient en arrière sans perdre les réponses.
// US-04b (SCPI-37) : réponses enregistrées à chaque « Suivant » (reprise à l'étape
// atteinte), puis récapitulatif et « Valider ». Étapes numérotées 1 à 4, 5 = récapitulatif.
import { useEffect, useRef, useState } from 'react';
import {
  ETAPES,
  aideDe,
  champsVisibles,
  erreursEtape,
  indicatifChoisi,
  reponsesAEnregistrer,
} from './etapes.js';
import { codePostalValide } from './coordonnees.js';
import { PAYS } from './pays.js';
import Recapitulatif from './Recapitulatif.jsx';
import './kyc.css';

const idChamp = (nom) => `kyc-${nom}`;
const AUCUNE_COMMUNE = async () => [];
const idErreur = (nom) => `kyc-${nom}-erreur`;

function descriptions(champ, erreur, aide) {
  const ids = [];
  if (aide) ids.push(`kyc-${champ.nom}-aide`);
  if (erreur) ids.push(idErreur(champ.nom));
  return ids.length ? ids.join(' ') : undefined;
}

function Aide({ champ, texte }) {
  return texte ? (
    <p id={`kyc-${champ.nom}-aide`} className="champ__aide">
      {texte}
    </p>
  ) : null;
}

function ListePays(props) {
  return (
    <select {...props}>
      <option value="">Choisir un pays…</option>
      {PAYS.map((p) => (
        <option key={p.code} value={p.code}>
          {p.nom}
        </option>
      ))}
    </select>
  );
}

// Téléphone : liste des indicatifs (pays et +XX) puis le numéro
function ChampTelephone({ champ, commun, indicatif, changerIndicatif }) {
  return (
    <div className="kyc-telephone">
      <select
        aria-label="Indicatif du pays"
        value={indicatif}
        onChange={(e) => changerIndicatif(e.target.value)}
        className="kyc-telephone__indicatif"
      >
        {PAYS.map((p) => (
          <option key={p.code} value={p.code}>
            {p.nom} (+{p.indicatif})
          </option>
        ))}
      </select>
      <input {...commun} type="tel" inputMode="tel" autoComplete={champ.autoComplete} />
    </div>
  );
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
function Groupe({ champ, valeur, erreur, changer, aide }) {
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
      aria-describedby={descriptions(champ, erreur, aide)}
    >
      <legend>
        <Libelle champ={champ} />
      </legend>
      <Aide champ={champ} texte={aide} />
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

// Comparaison de noms de communes sans tenir compte des accents ni des majuscules
const normaliser = (texte) =>
  (texte ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s'’-]+/g, ' ')
    .trim();

function Champ({ champ, reponses, erreur, changer, communes = [] }) {
  const valeur = reponses[champ.nom];
  const proposees = champ.nom === 'ville' && communes.length > 0;
  const aide = proposees
    ? `${communes.length === 1 ? 'Commune' : 'Communes'} du code postal ${reponses.codePostal.trim()}.`
    : aideDe(champ, reponses);
  if (champ.type === 'choix' || champ.type === 'cases') {
    return (
      <Groupe
        champ={champ}
        valeur={valeur}
        erreur={erreur}
        changer={(v) => changer(champ.nom, v)}
        aide={aide}
      />
    );
  }
  const commun = {
    id: idChamp(champ.nom),
    value: valeur ?? '',
    onChange: (e) => changer(champ.nom, e.target.value),
    'aria-invalid': erreur ? true : undefined,
    'aria-describedby': descriptions(champ, erreur, aide),
  };
  return (
    <div className="champ">
      <label htmlFor={idChamp(champ.nom)}>
        <Libelle champ={champ} />
      </label>
      <Aide champ={champ} texte={aide} />
      {proposees ? (
        <select {...commun} autoComplete={champ.autoComplete}>
          {communes.length > 1 && <option value="">Choisir une commune…</option>}
          {communes.map((nom) => (
            <option key={nom}>{nom}</option>
          ))}
        </select>
      ) : champ.type === 'pays' ? (
        <ListePays {...commun} autoComplete={champ.autoComplete} />
      ) : champ.type === 'tel' ? (
        <ChampTelephone
          champ={champ}
          commun={commun}
          indicatif={indicatifChoisi(champ, reponses)}
          changerIndicatif={(code) => changer(champ.indicatif, code)}
        />
      ) : champ.type === 'liste' ? (
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

export const MESSAGE_ENREGISTREMENT =
  'Vos réponses n’ont pas pu être enregistrées. Veuillez réessayer.';
export const MESSAGE_VALIDATION = 'Votre KYC n’a pas pu être validé. Veuillez réessayer.';

function Progression({ index }) {
  const total = ETAPES.length;
  const recapitulatif = index === total;
  const position = Math.min(index, total - 1);
  return (
    <div className="kyc-progression">
      <p className="kyc-progression__texte">
        {recapitulatif ? 'Récapitulatif' : `Étape ${index + 1}/${total}`}
      </p>
      <div
        className="kyc-progression__barre"
        role="progressbar"
        aria-label="Progression du formulaire KYC"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={position + 1}
        aria-valuetext={
          recapitulatif
            ? 'Toutes les étapes sont remplies : récapitulatif'
            : `Étape ${index + 1} sur ${total} : ${ETAPES[index].titre}`
        }
      >
        <span style={{ width: `${((position + 1) / total) * 100}%` }} />
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

export default function FormulaireKyc({
  email = '',
  aujourdhui,
  etapeInitiale = 1,
  reponsesInitiales = {},
  enregistrer = async () => {},
  valider = async () => {},
  apresValidation = () => {},
  chercherCommunes = AUCUNE_COMMUNE,
}) {
  const recap = ETAPES.length; // index du récapitulatif
  const [index, setIndex] = useState(Math.min(Math.max(etapeInitiale, 1), recap + 1) - 1);
  const [reponses, setReponses] = useState({ ...reponsesInitiales, email });
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');
  const [communes, setCommunes] = useState({ codePostal: '', liste: [] });
  const titreEtape = useRef(null);
  const aBouge = useRef(false);

  // Code postal français valide : communes proposées pour la ville. Une seule commune :
  // choisie d'office ; ville déjà saisie : remplacée par le nom officiel si elle en fait
  // partie, sinon effacée pour être choisie dans la liste.
  const codePostal = (reponses.codePostal ?? '').trim();
  const cleCommunes =
    reponses.pays === 'FR' && codePostalValide(codePostal, 'FR') ? codePostal : '';
  useEffect(() => {
    if (!cleCommunes) return undefined;
    let actif = true;
    chercherCommunes('FR', cleCommunes)
      .catch(() => [])
      .then((liste) => {
        if (!actif) return;
        setCommunes({ codePostal: cleCommunes, liste });
        if (liste.length === 0) return;
        setReponses((r) => {
          const officielle = liste.find((nom) => normaliser(nom) === normaliser(r.ville));
          const ville = officielle ?? (liste.length === 1 ? liste[0] : '');
          return r.ville === ville ? r : { ...r, ville };
        });
      });
    return () => {
      actif = false;
    };
  }, [cleCommunes, chercherCommunes]);
  const communesProposees = communes.codePostal === cleCommunes ? communes.liste : [];

  // Après un changement d'étape : focus sur son titre (lecteurs d'écran, défilement)
  useEffect(() => {
    if (aBouge.current) titreEtape.current?.focus();
  }, [index]);

  function aller(nouvelIndex) {
    aBouge.current = true;
    setErreurs({});
    setErreurServeur('');
    setIndex(nouvelIndex);
  }

  // Un changement efface l'erreur du champ, et celle du champ qui en dépend
  // (pays -> code postal et téléphone, indicatif -> téléphone)
  function changer(nom, valeur) {
    setReponses((r) => ({ ...r, [nom]: valeur }));
    const lies = { pays: ['codePostal', 'telephone'], indicatif: ['telephone'] }[nom] ?? [];
    setErreurs((e) => {
      const touches = [nom, ...lies].filter((n) => e[n]);
      if (touches.length === 0) return e;
      return Object.fromEntries(Object.entries(e).filter(([n]) => !touches.includes(n)));
    });
  }

  async function suivant(event) {
    event.preventDefault();
    if (envoi) return;
    const etape = ETAPES[index];
    const trouvees = erreursEtape(etape, reponses, aujourdhui);
    setErreurs(trouvees);
    setErreurServeur('');
    const premier = champsVisibles(etape, reponses).find((c) => trouvees[c.nom]);
    if (premier) {
      document.getElementById(idChamp(premier.nom))?.focus();
      return;
    }
    setEnvoi(true);
    try {
      await enregistrer(index + 2, reponsesAEnregistrer(reponses));
      aller(index + 1);
    } catch {
      setErreurServeur(MESSAGE_ENREGISTREMENT);
    } finally {
      setEnvoi(false);
    }
  }

  async function validerKyc() {
    if (envoi) return;
    setEnvoi(true);
    setErreurServeur('');
    try {
      await valider();
      apresValidation();
    } catch (err) {
      setErreurServeur(
        err?.status === 400 || err?.status === 409 ? err.message : MESSAGE_VALIDATION,
      );
      setEnvoi(false);
    }
  }

  if (index === recap) {
    return (
      <div className="kyc">
        <Progression index={index} />
        <Recapitulatif
          titreRef={titreEtape}
          reponses={reponses}
          modifier={aller}
          precedent={() => aller(recap - 1)}
          valider={validerKyc}
          envoi={envoi}
          erreur={erreurServeur}
        />
      </div>
    );
  }

  const etape = ETAPES[index];
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
              reponses={reponses}
              erreur={erreurs[champ.nom]}
              changer={changer}
              communes={communesProposees}
            />
          ))}
        </div>
        {erreurServeur && (
          <p className="compte__alerte" role="alert">
            {erreurServeur}
          </p>
        )}
        <div className="kyc__boutons">
          {index > 0 && (
            <button
              type="button"
              className="compte__bouton compte__bouton--secondaire"
              onClick={() => aller(index - 1)}
            >
              Précédent
            </button>
          )}
          <button type="submit" className="compte__bouton kyc__suivant" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Suivant'}
          </button>
        </div>
      </form>
    </div>
  );
}
