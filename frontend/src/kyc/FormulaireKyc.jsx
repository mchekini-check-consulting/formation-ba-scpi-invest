// Formulaire KYC en 4 étapes avec barre de progression (US-04a, SCPI-21) :
// « Suivant » contrôle l'étape (champs manquants signalés en rouge), « Précédent »
// revient en arrière sans perdre les réponses.
// US-04b (SCPI-37) : réponses enregistrées à chaque « Suivant » (reprise à l'étape
// atteinte), puis récapitulatif et « Valider ».
// US-04c (SCPI-44) : étape 5 « Pièces justificatives » (EtapePieces.jsx), avant le récapitulatif.
// Étapes numérotées 1 à 5, 6 = récapitulatif.
import { useEffect, useRef, useState } from 'react';
import ChampAdresse from './ChampAdresse.jsx';
import ChampDate from './ChampDate.jsx';
import ChampVille from './ChampVille.jsx';
import ChoixPays from './ChoixPays.jsx';
import { chiffresCodePostal, filtrerCodePostal, filtrerTelephone } from './coordonnees.js';
import EtapePieces from './EtapePieces.jsx';
import {
  ETAPES,
  champsVisibles,
  erreursEtape,
  indicatifChoisi,
  reponsesAEnregistrer,
} from './etapes.js';
import { PAYS_INDICATIFS } from './indicatifs.js';
import { paysParNom } from './pays.js';
import { idPiece, piecesManquantes } from './pieces.js';
import Recapitulatif from './Recapitulatif.jsx';
import './kyc.css';

const idChamp = (nom) => `kyc-${nom}`;
const AUCUNE_ADRESSE = async () => [];
const AUCUNE_COMMUNE = async () => [];
const CHAMPS_LIES = { pays: ['codePostal', 'telephone'], indicatif: ['telephone'] };
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

// Téléphone : menu des indicatifs (« France (+33) »), puis le numéro en chiffres
function ChampTelephone({ champ, commun, indicatif, changerIndicatif, changerNumero }) {
  return (
    <div className="kyc-telephone">
      <select
        aria-label="Indicatif du pays"
        value={indicatif}
        onChange={(e) => changerIndicatif(e.target.value)}
        className="kyc-telephone__indicatif"
      >
        {PAYS_INDICATIFS.map((p) => (
          <option key={p.nom} value={p.nom}>
            {p.nom} (+{p.indicatif})
          </option>
        ))}
      </select>
      <input
        {...commun}
        type="tel"
        inputMode="numeric"
        autoComplete={champ.autoComplete}
        onChange={(e) => changerNumero(e.target.value)}
      />
    </div>
  );
}

// Zone de saisie selon le type du champ. Code postal et téléphone : caractères non
// acceptés retirés dès la frappe (coordonnees.js). Adresse : suggestions si pays = France.
function Saisie({
  champ,
  commun,
  reponses,
  erreur,
  changer,
  aujourdhui,
  chercherAdresses,
  chercherCommunes,
}) {
  const valeur = reponses[champ.nom];
  const changerValeur = (v) => changer(champ.nom, v);
  switch (champ.type) {
    case 'pays':
      return (
        <ChoixPays
          id={commun.id}
          valeur={valeur}
          changer={changerValeur}
          invalide={Boolean(erreur)}
          decritPar={commun['aria-describedby']}
        />
      );
    case 'adresse':
      return (
        <ChampAdresse
          id={commun.id}
          valeur={valeur}
          changer={changerValeur}
          choisir={({ adresse, codePostal, ville }) => {
            changer('adresse', adresse);
            changer('codePostal', codePostal);
            changer('ville', ville);
          }}
          actif={paysParNom(reponses.pays)?.code === 'fr'}
          chercher={chercherAdresses}
          invalide={Boolean(erreur)}
          decritPar={commun['aria-describedby']}
          autoComplete={champ.autoComplete}
        />
      );
    case 'ville':
      return (
        <ChampVille
          id={commun.id}
          valeur={valeur}
          changer={changerValeur}
          codePostal={reponses.codePostal}
          actif={paysParNom(reponses.pays)?.code === 'fr'}
          chercher={chercherCommunes}
          invalide={Boolean(erreur)}
          decritPar={commun['aria-describedby']}
          autoComplete={champ.autoComplete}
        />
      );
    case 'codePostal':
      return (
        <input
          {...commun}
          type="text"
          inputMode={chiffresCodePostal(reponses.pays) ? 'numeric' : 'text'}
          autoComplete={champ.autoComplete}
          onChange={(e) => changerValeur(filtrerCodePostal(e.target.value, reponses.pays))}
        />
      );
    case 'tel':
      return (
        <ChampTelephone
          champ={champ}
          commun={commun}
          indicatif={indicatifChoisi(reponses)}
          changerIndicatif={(nom) => changer(champ.indicatif, nom)}
          changerNumero={(v) => changerValeur(filtrerTelephone(v))}
        />
      );
    case 'date':
      return (
        <ChampDate {...commun} valeur={valeur} changer={changerValeur} aujourdhui={aujourdhui} />
      );
    case 'liste':
      return (
        <select {...commun}>
          <option value="">Choisir…</option>
          {champ.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      );
    default:
      return (
        <input
          {...commun}
          type={champ.type === 'texte' ? 'text' : champ.type}
          autoComplete={champ.autoComplete}
          readOnly={champ.lectureSeule}
        />
      );
  }
}

export function Champ({
  champ,
  reponses,
  erreur,
  changer,
  aujourdhui,
  chercherAdresses,
  chercherCommunes = AUCUNE_COMMUNE,
}) {
  const valeur = reponses[champ.nom];
  if (champ.type === 'choix' || champ.type === 'cases') {
    return (
      <Groupe
        champ={champ}
        valeur={valeur}
        erreur={erreur}
        changer={(v) => changer(champ.nom, v)}
      />
    );
  }
  const commun = {
    id: idChamp(champ.nom),
    value: valeur ?? '',
    onChange: (e) => changer(champ.nom, e.target.value),
    'aria-invalid': erreur ? true : undefined,
    'aria-describedby': descriptions(champ, erreur),
  };
  return (
    <div className="champ">
      <label htmlFor={idChamp(champ.nom)}>
        <Libelle champ={champ} />
      </label>
      <Saisie
        champ={champ}
        commun={commun}
        reponses={reponses}
        erreur={erreur}
        changer={changer}
        aujourdhui={aujourdhui}
        chercherAdresses={chercherAdresses}
        chercherCommunes={chercherCommunes}
      />
      <Aide champ={champ} />
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
  piecesInitiales = [],
  enregistrer = async () => {},
  valider = async () => {},
  deposerPiece = async () => {},
  supprimerPiece = async () => {},
  apresValidation = () => {},
  chercherAdresses = AUCUNE_ADRESSE,
  chercherCommunes = AUCUNE_COMMUNE,
}) {
  const recap = ETAPES.length; // index du récapitulatif
  const [index, setIndex] = useState(Math.min(Math.max(etapeInitiale, 1), recap + 1) - 1);
  const [reponses, setReponses] = useState({ ...reponsesInitiales, email });
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');
  const [pieces, setPieces] = useState(piecesInitiales);
  const [envoiPiece, setEnvoiPiece] = useState(false);
  const titreEtape = useRef(null);
  const aBouge = useRef(false);

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

  // Un changement efface l'erreur du champ, et celle des champs qui en dépendent
  // (pays -> code postal et téléphone, indicatif -> téléphone)
  function changer(nom, valeur) {
    setReponses((r) => ({ ...r, [nom]: valeur }));
    const touches = [nom, ...(CHAMPS_LIES[nom] ?? [])];
    setErreurs((e) =>
      touches.some((n) => e[n])
        ? Object.fromEntries(Object.entries(e).filter(([n]) => !touches.includes(n)))
        : e,
    );
  }

  async function suivant(event) {
    event.preventDefault();
    if (envoi || envoiPiece) return;
    const etape = ETAPES[index];
    setErreurServeur('');
    if (etape.id === 'pieces') {
      const manquantes = piecesManquantes(reponses, pieces);
      setErreurs(manquantes);
      const premiere = Object.keys(manquantes)[0];
      if (premiere) {
        document.getElementById(idPiece(premiere))?.focus();
        return;
      }
    } else {
      const trouvees = erreursEtape(etape, reponses, aujourdhui);
      setErreurs(trouvees);
      const premier = champsVisibles(etape, reponses).find((c) => trouvees[c.nom]);
      if (premier) {
        document.getElementById(idChamp(premier.nom))?.focus();
        return;
      }
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
          pieces={pieces}
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
  const etapePieces = etape.id === 'pieces';
  let alerte = '';
  if (etapePieces && nbErreurs > 0) {
    alerte =
      nbErreurs === 1
        ? 'Une pièce est à déposer ou à corriger : elle est signalée en rouge.'
        : `${nbErreurs} pièces sont à déposer ou à corriger : elles sont signalées en rouge.`;
  } else if (nbErreurs > 0) {
    alerte =
      nbErreurs === 1
        ? 'Un champ est à compléter ou à corriger : il est signalé en rouge.'
        : `${nbErreurs} champs sont à compléter ou à corriger : ils sont signalés en rouge.`;
  }

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
        {alerte && (
          <p className="compte__alerte" role="alert">
            {alerte}
          </p>
        )}
        {etapePieces ? (
          <EtapePieces
            reponses={reponses}
            pieces={pieces}
            setPieces={setPieces}
            erreurs={erreurs}
            setErreurs={setErreurs}
            deposer={deposerPiece}
            supprimer={supprimerPiece}
            setOccupe={setEnvoiPiece}
          />
        ) : (
          <div className="kyc__champs">
            {champsVisibles(etape, reponses).map((champ) => (
              <Champ
                key={champ.nom}
                champ={champ}
                reponses={reponses}
                erreur={erreurs[champ.nom]}
                changer={changer}
                aujourdhui={aujourdhui}
                chercherAdresses={chercherAdresses}
                chercherCommunes={chercherCommunes}
              />
            ))}
          </div>
        )}
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
          <button type="submit" className="compte__bouton" disabled={envoi || envoiPiece}>
            {envoi ? 'Enregistrement…' : 'Suivant'}
          </button>
        </div>
      </form>
    </div>
  );
}
