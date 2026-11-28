// Écran « Investir » (US-11, SCPI-259), à l'adresse /investir/<id de la SCPI> : ouvert par
// les boutons « Investir » du Catalogue, de la Fiche et du Comparateur. Maquette validée
// par le BA, sur le modèle de la Fiche (bandeau bleu, chiffres clés, cartes) :
//   - rappel de la SCPI : société de gestion, prix de part, minimum, frais de souscription ;
//   - nombre de parts (chiffres seulement), jauge du minimum, type d'investissement ;
//   - récapitulatif mis à jour pendant la saisie, montant dans le bandeau ;
//   - « Valider ma demande » (inactif tant que la saisie est refusée) crée le dossier puis
//     ouvre son suivi (/demandes/<id>), au statut « Demande envoyée ».
// Les règles sont refaites par le backend (backend/src/demandes/service.ts).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { deconnecter } from '../auth.js';
import { lireFiche } from '../fiche/api.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import { formaterEuros, formaterTaux, NON_COMMUNIQUE } from '../utils/format.js';
import { creerDemande } from './api.js';
import {
  chiffresSeulement,
  evaluer,
  KYC_NON_VALIDE,
  libelleType,
  partsInitiales,
  TYPE_PAR_DEFAUT,
  TYPES,
} from './demande.js';
import { Bandeau, Icone } from './Elements.jsx';
import '../fiche/fiche.css';
import './investir.css';

function naviguer(url) {
  window.location.assign(url);
}

// couleur : celle d'un chiffre clé de la Fiche (fiche.css)
function Chiffre({ icone, couleur = icone, libelle, valeur, detail }) {
  return (
    <div className={`fiche__chiffre fiche__chiffre--${couleur}`}>
      <span className="fiche__chiffre-icone">
        <Icone nom={icone} />
      </span>
      <div>
        <dt>{libelle}</dt>
        <dd className="fiche__chiffre-valeur">{valeur}</dd>
        {detail && <dd className="fiche__chiffre-detail">{detail}</dd>}
      </div>
    </div>
  );
}

function Rappel({ fiche }) {
  return (
    <dl className="fiche__chiffres investir__chiffres" aria-label="Rappel de la SCPI">
      <Chiffre
        icone="prix"
        libelle="Prix de part"
        valeur={fiche.prixPart ? formaterEuros(fiche.prixPart.valeur) : NON_COMMUNIQUE}
        detail={fiche.prixPart ? `en ${fiche.prixPart.annee}` : null}
      />
      <Chiffre
        icone="minimum"
        libelle="Minimum à investir"
        valeur={formaterEuros(fiche.minimum)}
        detail={fiche.minimumParts ? `soit ${fiche.minimumParts} parts` : null}
      />
      <Chiffre
        icone="souscription"
        couleur="delai"
        libelle="Frais de souscription"
        valeur={formaterTaux(fiche.fraisSouscription)}
        detail="du montant investi"
      />
    </dl>
  );
}

function Jauge({ fiche, evaluation }) {
  if (evaluation.progression === null) return null;
  return (
    <div className="investir__jauge">
      <p>
        <span>
          Minimum à investir : <strong>{formaterEuros(fiche.minimum)}</strong>
          {fiche.minimumParts ? `, soit ${fiche.minimumParts} parts` : ''}
        </span>
        <strong
          className={evaluation.minimumAtteint ? 'investir__atteint' : 'investir__atteint--non'}
        >
          {evaluation.minimumAtteint ? 'Atteint' : 'Non atteint'}
        </strong>
      </p>
      <span className="investir__barre" aria-hidden="true">
        <span
          className={evaluation.minimumAtteint ? undefined : 'investir__barre--non'}
          style={{ width: `${evaluation.progression}%` }}
        />
      </span>
    </div>
  );
}

function TypeInvestissement({ type, choisir }) {
  return (
    <fieldset className="investir__types">
      <legend>Type d’investissement</legend>
      <div className="investir__tuiles">
        {TYPES.map((t) => (
          <label
            key={t.id}
            className={
              t.id === type
                ? `investir__tuile investir__tuile--${t.id} investir__tuile--choisie`
                : `investir__tuile investir__tuile--${t.id}`
            }
          >
            <span className="investir__tuile-haut">
              <span className="investir__tuile-icone">
                <Icone nom={t.id} />
              </span>
              <input
                type="radio"
                name="type"
                value={t.id}
                checked={t.id === type}
                onChange={() => choisir(t.id)}
              />
            </span>
            <strong>{t.libelle}</strong>
            <span className="investir__tuile-texte">{t.texte}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// couleur : celle d'une ligne « Frais et conditions » de la Fiche (fiche.css)
function Ligne({ icone, couleur, libelle, valeur }) {
  return (
    <div className={`fiche__condition fiche__condition--${couleur}`}>
      <dt>
        <span className="fiche__condition-icone">
          <Icone nom={icone} />
        </span>
        {libelle}
      </dt>
      <dd>{valeur}</dd>
    </div>
  );
}

function Recapitulatif({ fiche, evaluation, type, envoi, erreurEnvoi, valider }) {
  return (
    <section className="fiche__carte-blanche fiche__frais investir__recap" aria-labelledby="recap">
      <h2 id="recap" className="fiche__titre-section">
        Récapitulatif
      </h2>
      <dl className="investir__lignes">
        <Ligne icone="reconstitution" couleur="reconstitution" libelle="SCPI" valeur={fiche.nom} />
        <Ligne
          icone="capitalisation"
          couleur="gestion"
          libelle="Nombre de parts"
          valeur={evaluation.nombre > 0 ? evaluation.nombre : '—'}
        />
        <Ligne
          icone="prix"
          couleur="souscription"
          libelle="Prix de part"
          valeur={fiche.prixPart ? formaterEuros(fiche.prixPart.valeur) : NON_COMMUNIQUE}
        />
        <Ligne
          icone="gestion"
          couleur="frequence"
          libelle="Type d’investissement"
          valeur={libelleType(type)}
        />
        <Ligne
          icone="souscription"
          couleur="cashback"
          libelle="Frais de souscription"
          valeur={formaterTaux(fiche.fraisSouscription)}
        />
      </dl>
      <p className="investir__montant">
        <span>Montant</span>
        <strong>{formaterEuros(evaluation.montant)}</strong>
      </p>
      {erreurEnvoi && (
        <p className="compte__alerte" role="alert">
          {erreurEnvoi}
        </p>
      )}
      {erreurEnvoi === KYC_NON_VALIDE && (
        <LienInterne to="/connaissance-client" className="compte__bouton">
          Compléter mon KYC
        </LienInterne>
      )}
      <button
        type="button"
        className="investir__valider"
        disabled={evaluation.erreur !== '' || envoi}
        onClick={valider}
      >
        {envoi ? 'Envoi en cours…' : 'Valider ma demande →'}
      </button>
    </section>
  );
}

function Saisie({ fiche, envoyer, page }) {
  const [parts, setParts] = useState(() => partsInitiales(fiche));
  const [type, setType] = useState(TYPE_PAR_DEFAUT);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState('');
  const evaluation = evaluer(parts, fiche);

  async function valider() {
    setEnvoi(true);
    setErreurEnvoi('');
    try {
      await envoyer({ scpiId: fiche.id, nombreParts: evaluation.nombre, type });
    } catch (err) {
      // 403 : KYC non validé (vérifié par le backend, même si l'écran a été contourné)
      setErreurEnvoi(err.status === 403 ? KYC_NON_VALIDE : err.message);
      setEnvoi(false);
    }
  }

  return page(
    <Bandeau
      retour={{ to: `/catalogue/${fiche.id}`, libelle: 'Retour à la fiche' }}
      gerant={fiche.gerant}
      titre={`Investir dans ${fiche.nom}`}
      pastille="Demande de souscription"
      montant={evaluation.montant}
    />,
    <div className="fiche investir">
      <Rappel fiche={fiche} />
      <div className="investir__colonnes">
        <section className="fiche__carte-blanche investir__demande" aria-labelledby="demande">
          <h2 id="demande" className="fiche__titre-section">
            Votre demande
          </h2>
          <div className="investir__parts">
            <label htmlFor="parts">Nombre de parts</label>
            <input
              id="parts"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={parts}
              onChange={(e) => {
                setParts(chiffresSeulement(e.target.value));
                setErreurEnvoi('');
              }}
              aria-invalid={evaluation.erreur !== ''}
              aria-describedby="parts-aide"
            />
            {evaluation.erreur && (
              <p className="investir__erreur" role="alert">
                {evaluation.erreur}
              </p>
            )}
            <Jauge fiche={fiche} evaluation={evaluation} />
            <p id="parts-aide" className="investir__aide">
              Nombre entier, chiffres uniquement : une virgule, un point ou une lettre ne s’écrivent
              pas.
            </p>
          </div>
          <TypeInvestissement type={type} choisir={setType} />
        </section>
        <Recapitulatif
          fiche={fiche}
          evaluation={evaluation}
          type={type}
          envoi={envoi}
          erreurEnvoi={erreurEnvoi}
          valider={valider}
        />
      </div>
    </div>,
  );
}

export default function Investir({
  lire = lireFiche,
  creer = creerDemande,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const { id } = useParams();
  const ouvrir = useNavigate();
  const [etat, setEtat] = useState({ id: null, fiche: null, absente: '', alerte: '' });

  useEffect(() => {
    let actif = true;
    lire(id)
      .then((fiche) => actif && setEtat({ id, fiche, absente: '', alerte: '' }))
      .catch((err) => {
        if (!actif) return;
        if (err.status === 401) allerA('/connexion');
        else if (err.status === 404) setEtat({ id, fiche: null, absente: err.message, alerte: '' });
        else setEtat({ id, fiche: null, absente: '', alerte: err.message });
      });
    return () => {
      actif = false;
    };
  }, [id, lire, allerA]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  // Règle 6 : dossier créé -> son suivi, avec le message de transmission
  async function envoyer(saisie) {
    const dossier = await creer(saisie);
    ouvrir(`/demandes/${dossier.id}`, { state: { transmise: true } });
  }

  const { fiche, absente, alerte } =
    etat.id === id ? etat : { fiche: null, absente: '', alerte: '' };
  // Mise en page commune (menu, pied de page) ; bandeau : en-tête propre à l'écran
  const page = (bandeau, contenu) => (
    <PageApplication
      titre="Investir"
      actif="catalogue"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
      bandeau={bandeau}
    >
      {contenu}
    </PageApplication>
  );

  if (fiche) return <Saisie key={fiche.id} fiche={fiche} envoyer={envoyer} page={page} />;
  if (absente) {
    return page(
      <div className="fiche__absente">
        <h1 id="titre-page" className="application__titre">
          {absente}
        </h1>
        <LienInterne to="/catalogue" className="compte__bouton">
          Retour au catalogue
        </LienInterne>
      </div>,
    );
  }
  return page(
    undefined,
    alerte ? (
      <p className="compte__alerte" role="alert">
        {alerte}
      </p>
    ) : (
      <p className="compte__texte">Chargement…</p>
    ),
  );
}
