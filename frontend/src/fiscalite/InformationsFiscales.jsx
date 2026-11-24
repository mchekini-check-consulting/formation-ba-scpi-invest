// Écran « Mes informations fiscales » (US-06, SCPI-255), ouvert par « Infos fiscales » en
// bas du menu (/fiscalite) : revenu net imposable annuel du foyer, situation familiale
// (seul, en couple) et nombre d'enfants à charge, tous obligatoires.
//   - « Enregistrer » : sauvegarde et confirme ; valeurs ré-affichées à la visite suivante ;
//   - « Effacer mes informations » (seulement si des informations sont enregistrées) :
//     suppression après confirmation, le formulaire redevient vide.
// Indépendant du KYC : la situation familiale du KYC n'est pas reprise.
// Mise en page (maquette D) : carte du formulaire, une ligne par information, et à droite le
// récapitulatif « Votre foyer fiscal », mis à jour pendant la saisie (nombre de parts).
import { useEffect, useId, useRef, useState } from 'react';
import { deconnecter } from '../auth.js';
import Confirmation from '../navigation/Confirmation.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import {
  MESSAGE_EFFACEES,
  MESSAGE_ENREGISTREES,
  SITUATIONS,
  VIDE,
  effacerInformationsFiscales,
  enregistrerInformationsFiscales,
  formaterRevenu,
  lireInformationsFiscales,
  nombreParts,
  verifier,
  versFormulaire,
} from './informations.js';
import './fiscalite.css';

export const TITRE = 'Mes informations fiscales';
const ECHEC_CHARGEMENT =
  'Vos informations fiscales n’ont pas pu être chargées. Réessayez dans quelques instants.';

async function quitterParDefaut() {
  await deconnecter();
  window.location.assign('/');
}

// Ligne de la carte : libellé et aide à gauche, saisie et message d'erreur à droite
function Ligne({ idLibelle, libelle, pour, aide, erreur, idErreur, children }) {
  const Libelle = pour ? 'label' : 'span';
  return (
    <div className="fiscalite__ligne">
      <div>
        <Libelle id={idLibelle} className="fiscalite__libelle" htmlFor={pour}>
          {libelle}
        </Libelle>
        {aide && <p className="fiscalite__aide">{aide}</p>}
      </div>
      <div>
        {children}
        <p id={idErreur} className="fiscalite__erreur">
          {erreur}
        </p>
      </div>
    </div>
  );
}

// Récapitulatif « Votre foyer fiscal » : valeurs en cours de saisie, « — » si absentes
function Recapitulatif({ valeurs }) {
  const revenu = valeurs.revenuNetImposable.trim();
  const situation = SITUATIONS.find(({ valeur }) => valeur === valeurs.situationFamiliale);
  const enfants = Number(valeurs.nombreEnfants);
  const parts = nombreParts(valeurs.situationFamiliale, enfants);
  return (
    <aside className="fiscalite__recap" aria-labelledby="titre-recap">
      <h2 id="titre-recap" className="fiscalite__recap-titre">
        Votre foyer fiscal
      </h2>
      <dl className="fiscalite__recap-valeurs">
        <div>
          <dt>Revenu net imposable</dt>
          <dd>{revenu ? `${formaterRevenu(revenu)} €` : '—'}</dd>
        </div>
        <div>
          <dt>Situation</dt>
          <dd>{situation?.libelle ?? '—'}</dd>
        </div>
        <div>
          <dt>Enfants à charge</dt>
          <dd>{situation ? enfants : '—'}</dd>
        </div>
      </dl>
      <p className="fiscalite__parts">
        <strong>{parts === null ? '—' : parts.toLocaleString('fr-FR')}</strong>
        <span>
          {parts !== null && parts < 2 ? 'part de quotient familial' : 'parts de quotient familial'}
        </span>
      </p>
      <p className="fiscalite__recap-note">
        Ces valeurs serviront au calcul de l’estimation fiscale de vos revenus de SCPI (taux
        marginal et taux moyen).
      </p>
    </aside>
  );
}

export default function InformationsFiscales({
  lire = lireInformationsFiscales,
  enregistrer = enregistrerInformationsFiscales,
  effacer = effacerInformationsFiscales,
  seDeconnecter = quitterParDefaut,
  chargerIdentite,
}) {
  const [chargement, setChargement] = useState(true);
  const [echecChargement, setEchecChargement] = useState(false);
  const [valeurs, setValeurs] = useState(VIDE);
  // Des informations sont enregistrées en base : « Effacer mes informations » est proposé
  const [enregistrees, setEnregistrees] = useState(false);
  const [erreurs, setErreurs] = useState({});
  const [succes, setSucces] = useState('');
  const [alerte, setAlerte] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const boutonEffacer = useRef(null);
  const id = useId();

  useEffect(() => {
    let actif = true;
    lire()
      .then((informations) => {
        if (!actif) return;
        setValeurs(versFormulaire(informations));
        setEnregistrees(informations !== null);
      })
      .catch(() => actif && setEchecChargement(true))
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
  }, [lire]);

  function changer(champ, valeur) {
    setValeurs((avant) => ({ ...avant, [champ]: valeur }));
    setErreurs((avant) => ({ ...avant, [champ]: undefined }));
    setSucces('');
    setAlerte('');
  }

  const enfants = Number(valeurs.nombreEnfants) || 0;

  async function surEnregistrer(evenement) {
    evenement.preventDefault();
    setSucces('');
    setAlerte('');
    const resultat = verifier(valeurs);
    if (resultat.erreurs) {
      setErreurs(resultat.erreurs);
      return;
    }
    setErreurs({});
    setEnvoiEnCours(true);
    try {
      setValeurs(versFormulaire(await enregistrer(resultat.informations)));
      setEnregistrees(true);
      setSucces(MESSAGE_ENREGISTREES);
    } catch (err) {
      setAlerte(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function surEffacer() {
    setConfirmer(false);
    setSucces('');
    setAlerte('');
    setEnvoiEnCours(true);
    try {
      await effacer();
      setValeurs(VIDE);
      setErreurs({});
      setEnregistrees(false);
      setSucces(MESSAGE_EFFACEES);
    } catch (err) {
      setAlerte(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const idErreur = (champ) => `${id}-${champ}-erreur`;

  let contenu;
  if (chargement) {
    contenu = <p role="status">Chargement…</p>;
  } else if (echecChargement) {
    contenu = (
      <p className="compte__alerte" role="alert">
        {ECHEC_CHARGEMENT}
      </p>
    );
  } else {
    contenu = (
      <>
        {/* Carte et récapitulatif côte à côte, de même hauteur ; messages dessous */}
        <div className="fiscalite">
          <form
            className="fiscalite__carte"
            aria-label={TITRE}
            onSubmit={surEnregistrer}
            noValidate
          >
            <Ligne
              libelle="Revenu net imposable du foyer"
              pour="revenuNetImposable"
              aide="Par an, indiqué sur votre dernier avis d’impôt."
              erreur={erreurs.revenuNetImposable}
              idErreur={idErreur('revenuNetImposable')}
            >
              <div
                className={`fiscalite__saisie${erreurs.revenuNetImposable ? ' fiscalite__saisie--invalide' : ''}`}
              >
                <input
                  id="revenuNetImposable"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  aria-invalid={erreurs.revenuNetImposable ? 'true' : undefined}
                  aria-describedby={idErreur('revenuNetImposable')}
                  disabled={envoiEnCours}
                  value={valeurs.revenuNetImposable}
                  onChange={(e) => changer('revenuNetImposable', e.target.value)}
                  onBlur={(e) => {
                    // Espaces de milliers en quittant le champ, sans effacer erreur ni message
                    const formate = formaterRevenu(e.target.value);
                    setValeurs((avant) => ({ ...avant, revenuNetImposable: formate }));
                  }}
                />
                <span className="fiscalite__unite" aria-hidden="true">
                  € / an
                </span>
              </div>
            </Ligne>

            <Ligne
              idLibelle={`${id}-situation`}
              libelle="Situation familiale"
              aide="Pour le calcul du nombre de parts."
              erreur={erreurs.situationFamiliale}
              idErreur={idErreur('situationFamiliale')}
            >
              <div
                className="fiscalite__segments"
                role="group"
                aria-labelledby={`${id}-situation`}
                aria-describedby={idErreur('situationFamiliale')}
              >
                {SITUATIONS.map(({ valeur, libelle }) => (
                  <button
                    key={valeur}
                    type="button"
                    aria-pressed={valeurs.situationFamiliale === valeur}
                    disabled={envoiEnCours}
                    onClick={() => changer('situationFamiliale', valeur)}
                  >
                    {libelle}
                  </button>
                ))}
              </div>
            </Ligne>

            <Ligne
              idLibelle={`${id}-enfants`}
              libelle="Enfants à charge"
              erreur={erreurs.nombreEnfants}
              idErreur={idErreur('nombreEnfants')}
            >
              <div className="fiscalite__compteur" role="group" aria-labelledby={`${id}-enfants`}>
                <button
                  type="button"
                  aria-label="Un enfant de moins"
                  disabled={envoiEnCours || enfants === 0}
                  onClick={() => changer('nombreEnfants', String(enfants - 1))}
                >
                  −
                </button>
                <output aria-live="polite">{enfants}</output>
                <button
                  type="button"
                  aria-label="Un enfant de plus"
                  disabled={envoiEnCours}
                  onClick={() => changer('nombreEnfants', String(enfants + 1))}
                >
                  +
                </button>
              </div>
            </Ligne>

            <div className="fiscalite__pied">
              <p className="fiscalite__confidentialite">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Données personnelles, utilisées uniquement pour cette estimation
              </p>
              {enregistrees && (
                <button
                  ref={boutonEffacer}
                  type="button"
                  className="fiscalite__effacer"
                  disabled={envoiEnCours}
                  onClick={() => setConfirmer(true)}
                >
                  Effacer mes informations
                </button>
              )}
              <button type="submit" className="fiscalite__enregistrer" disabled={envoiEnCours}>
                {envoiEnCours ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
          <Recapitulatif valeurs={valeurs} />
        </div>
        {succes && (
          <p className="fiscalite__message fiscalite__message--succes" role="status">
            {succes}
          </p>
        )}
        {alerte && (
          <p className="compte__alerte fiscalite__message" role="alert">
            {alerte}
          </p>
        )}
      </>
    );
  }

  return (
    <PageApplication
      titre={TITRE}
      actif="fiscalite"
      seDeconnecter={seDeconnecter}
      chargerIdentite={chargerIdentite}
    >
      <p className="fiscalite__intro">
        Elles servent uniquement à estimer l’impôt sur vos revenus de SCPI, à partir de votre
        situation réelle.
      </p>
      {contenu}
      {confirmer && (
        <Confirmation
          titre="Effacer vos informations fiscales ?"
          message="Elles seront définitivement supprimées."
          libelleOui="Effacer"
          libelleNon="Annuler"
          onOui={surEffacer}
          onNon={() => setConfirmer(false)}
          retour={boutonEffacer}
        />
      )}
    </PageApplication>
  );
}
