// US-06 : blocs de la page Mon profil. Chaque bloc s'affiche en lecture avec un bouton
// « Modifier » ; un seul bloc à la fois s'ouvre en formulaire (les autres boutons sont
// grisés). La modification est appliquée dès l'enregistrement.
import { useId, useState } from 'react';
import { Champ } from '../kyc/FormulaireKyc.jsx';
import { reponseLisible } from '../kyc/etapes.js';
import { FORMATS_ACCEPTES, PIECES } from '../kyc/pieces.js';
import '../kyc/kyc.css';
import {
  BLOCS,
  ESSAIS_MOT_DE_PASSE,
  MESSAGE_ECHEC,
  MESSAGE_JUSTIFICATIF,
  MESSAGE_MOT_DE_PASSE,
  champsAffiches,
  dateHeure,
  demandeBloc,
  erreurJustificatif,
  erreursBloc,
  libelleHistorique,
} from './informations.js';

function Crayon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function EnTete({ id, titre, badge, children }) {
  return (
    <div className="bloc-info__tete">
      <h2 id={id}>{titre}</h2>
      {badge}
      {children}
    </div>
  );
}

function BoutonModifier({ titre, desactive, onClick }) {
  return (
    <button
      type="button"
      className="bloc-info__modifier"
      disabled={desactive}
      aria-label={`Modifier : ${titre}`}
      onClick={onClick}
    >
      <Crayon />
      Modifier
    </button>
  );
}

function Fiche({ lignes }) {
  return (
    <dl className="profil__fiche">
      {lignes.map((ligne) => (
        <div key={ligne.cle}>
          <dt>{ligne.libelle}</dt>
          <dd>{ligne.valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

// Choix d'un fichier (justificatif), présenté comme les pièces du KYC : libellé, aide,
// bouton « Choisir un fichier » toujours visible (le champ natif, masqué, reste celui qui
// reçoit le focus au clavier), nom du fichier choisi, erreur de format
function ChoixFichier({ id, libelle, aide, facultatif = false, fichier, erreur, choisir }) {
  const idAide = `${id}-aide`;
  const idErreur = `${id}-erreur`;
  return (
    <div className={`kyc-piece bloc-info__piece${erreur ? ' kyc-piece--erreur' : ''}`}>
      <div className="kyc-piece__texte">
        <label htmlFor={id} className="kyc-piece__libelle">
          {libelle}
          {facultatif && <span className="champ__facultatif"> (facultatif)</span>}
        </label>
        {aide && (
          <p id={idAide} className="champ__aide">
            {aide}
          </p>
        )}
        {fichier && (
          <p className="kyc-piece__fichier">
            <span className="kyc-piece__nom">{fichier.name}</span>
          </p>
        )}
        <p id={idErreur} className="champ__erreur" role="alert">
          {erreur ?? ''}
        </p>
      </div>
      <div className="kyc-piece__actions">
        <input
          id={id}
          type="file"
          accept={FORMATS_ACCEPTES}
          className="kyc-piece__champ"
          aria-invalid={erreur ? true : undefined}
          aria-describedby={[aide && idAide, idErreur].filter(Boolean).join(' ')}
          onChange={(e) => {
            const choisi = e.target.files?.[0] ?? null;
            e.target.value = ''; // même fichier choisi deux fois : pris en compte
            if (choisi) choisir(choisi);
          }}
        />
        <label htmlFor={id} className="kyc-piece__bouton" aria-hidden="true">
          {fichier ? 'Remplacer' : 'Choisir un fichier'}
        </label>
      </div>
    </div>
  );
}

// Bloc Coordonnées, Adresse ou Situation (BLOCS, informations.js)
export function BlocModifiable({
  bloc,
  initiales,
  reponses,
  ouvert,
  verrouille,
  succes,
  ouvrir,
  fermer,
  enregistrer,
  deposer,
  annuler,
  chercherAdresses,
  chercherCommunes,
}) {
  const config = BLOCS[bloc];
  const idTitre = useId();
  const [valeurs, setValeurs] = useState(initiales);
  const [erreurs, setErreurs] = useState({});
  const [fichier, setFichier] = useState(null);
  const [motDePasse, setMotDePasse] = useState('');
  const [essais, setEssais] = useState(0);
  const [alerte, setAlerte] = useState('');
  const [envoi, setEnvoi] = useState(false);

  function commencer() {
    setValeurs(initiales);
    setErreurs({});
    setFichier(null);
    setMotDePasse('');
    setEssais(0);
    setAlerte('');
    ouvrir();
  }

  function changer(nom, valeur) {
    setValeurs((v) => ({ ...v, [nom]: valeur }));
    setErreurs((e) => ({ ...e, [nom]: undefined }));
  }

  function choisirFichier(choisi) {
    setFichier(choisi);
    setErreurs((e) => ({ ...e, justificatif: choisi ? erreurJustificatif(choisi) : undefined }));
  }

  async function envoyer(event) {
    event.preventDefault();
    const trouvees = erreursBloc(bloc, valeurs);
    const exige = config.justificatif?.exige(valeurs, initiales) ?? false;
    if (exige && !fichier) trouvees.justificatif = MESSAGE_JUSTIFICATIF;
    else if (exige) {
      const erreur = erreurJustificatif(fichier);
      if (erreur) trouvees.justificatif = erreur;
    }
    if (config.motDePasse && !motDePasse) trouvees.motDePasse = MESSAGE_MOT_DE_PASSE;
    setErreurs(trouvees);
    if (Object.values(trouvees).some(Boolean)) return;

    setEnvoi(true);
    setAlerte('');
    try {
      const justificatif = exige ? (await deposer(fichier)).id : undefined;
      await enregistrer(bloc, demandeBloc(bloc, valeurs, { justificatif, motDePasse }));
    } catch (err) {
      if (err?.status === 403) {
        const faits = essais + 1;
        setEssais(faits);
        setMotDePasse('');
        if (faits >= ESSAIS_MOT_DE_PASSE) {
          annuler();
          return;
        }
        const reste = ESSAIS_MOT_DE_PASSE - faits;
        setErreurs({ motDePasse: `Mot de passe incorrect. Il vous reste ${reste} tentative(s).` });
      } else {
        setAlerte(err?.status === 400 || err?.status === 409 ? err.message : MESSAGE_ECHEC);
      }
    } finally {
      setEnvoi(false);
    }
  }

  const badge = succes ? <span className="bloc-info__badge">✓ Mise à jour</span> : null;

  if (!ouvert) {
    const lignes = config.champs.map((c) => ({
      cle: c.nom,
      libelle: c.libelle,
      valeur:
        c.nom === 'email'
          ? initiales.email || 'Non renseigné'
          : reponseLisible(c, reponses[c.nom], reponses),
    }));
    return (
      <section className="profil__carte profil__rubrique bloc-info" aria-labelledby={idTitre}>
        <EnTete id={idTitre} titre={config.titre} badge={badge}>
          {enregistrer && (
            <BoutonModifier titre={config.titre} desactive={verrouille} onClick={commencer} />
          )}
        </EnTete>
        <Fiche lignes={lignes} />
        {succes && <div className="bloc-info__message">{succes}</div>}
      </section>
    );
  }

  const exige = config.justificatif?.exige(valeurs, initiales) ?? false;
  return (
    <section
      className="profil__carte profil__rubrique bloc-info bloc-info--ouvert"
      aria-labelledby={idTitre}
    >
      <EnTete id={idTitre} titre={`${config.titre} — modification`} />
      <form className="compte__form bloc-info__form kyc" onSubmit={envoyer} noValidate>
        {champsAffiches(bloc, valeurs).map((c) => (
          <Champ
            key={c.nom}
            champ={c}
            reponses={valeurs}
            erreur={erreurs[c.nom]}
            changer={changer}
            chercherAdresses={chercherAdresses}
            chercherCommunes={chercherCommunes}
          />
        ))}
        {config.justificatif && (exige || bloc === 'adresse') && (
          <ChoixFichier
            id={`${idTitre}-justificatif`}
            libelle={config.justificatif.libelle}
            aide={config.justificatif.aide}
            fichier={fichier}
            erreur={erreurs.justificatif}
            choisir={choisirFichier}
          />
        )}
        {config.motDePasse && (
          <div className="champ">
            <label htmlFor={`${idTitre}-mot-de-passe`}>Mot de passe de votre compte</label>
            <input
              id={`${idTitre}-mot-de-passe`}
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              aria-invalid={erreurs.motDePasse ? true : undefined}
              aria-describedby={`${idTitre}-mot-de-passe-aide ${idTitre}-mot-de-passe-erreur`}
              onChange={(e) => {
                setMotDePasse(e.target.value);
                setErreurs((er) => ({ ...er, motDePasse: undefined }));
              }}
            />
            <p id={`${idTitre}-mot-de-passe-aide`} className="bloc-info__aide">
              Pour protéger votre compte, confirmez la modification avec votre mot de passe.
            </p>
            <p id={`${idTitre}-mot-de-passe-erreur`} className="champ__erreur" role="alert">
              {erreurs.motDePasse ?? ''}
            </p>
          </div>
        )}
        {alerte && (
          <p className="compte__alerte" role="alert">
            {alerte}
          </p>
        )}
        <div className="bloc-info__actions">
          <button
            type="button"
            className="compte__bouton compte__bouton--secondaire"
            onClick={fermer}
            disabled={envoi}
          >
            Annuler
          </button>
          <button type="submit" className="compte__bouton" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </section>
  );
}

// Bloc Pièce d'identité : nouvelle pièce ; recto obligatoire, verso facultatif (comme au KYC)
export function BlocIdentite({
  pieces,
  ouvert,
  verrouille,
  succes,
  ouvrir,
  fermer,
  enregistrer,
  deposer,
}) {
  const idTitre = useId();
  const [recto, setRecto] = useState(null);
  const [verso, setVerso] = useState(null);
  const [erreurs, setErreurs] = useState({});
  const [alerte, setAlerte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const titre = 'Pièce d’identité';

  function commencer() {
    setRecto(null);
    setVerso(null);
    setErreurs({});
    setAlerte('');
    ouvrir();
  }

  const erreurDe = (fichier) => (fichier ? erreurJustificatif(fichier) : MESSAGE_JUSTIFICATIF);

  async function envoyer(event) {
    event.preventDefault();
    const trouvees = { recto: erreurDe(recto), verso: verso ? erreurJustificatif(verso) : null };
    setErreurs(trouvees);
    if (trouvees.recto || trouvees.verso) return;
    setEnvoi(true);
    setAlerte('');
    try {
      const r = await deposer(recto);
      const v = verso ? await deposer(verso) : null;
      await enregistrer('identite', v ? { recto: r.id, verso: v.id } : { recto: r.id });
    } catch (err) {
      setAlerte(err?.status === 400 || err?.status === 409 ? err.message : MESSAGE_ECHEC);
    } finally {
      setEnvoi(false);
    }
  }

  const nom = (type) => pieces?.find((p) => p.type === type)?.nomFichier;
  const badge = succes ? <span className="bloc-info__badge">✓ Mise à jour</span> : null;

  if (!ouvert) {
    return (
      <section className="profil__carte profil__rubrique bloc-info" aria-labelledby={idTitre}>
        <EnTete id={idTitre} titre={titre} badge={badge}>
          {enregistrer && (
            <BoutonModifier titre={titre} desactive={verrouille} onClick={commencer} />
          )}
        </EnTete>
        <Fiche
          lignes={[
            { cle: 'recto', libelle: 'Recto', valeur: nom('identite') ?? 'Non fournie' },
            { cle: 'verso', libelle: 'Verso', valeur: nom('identite_verso') ?? 'Non fourni' },
          ]}
        />
        {succes && <div className="bloc-info__message">{succes}</div>}
      </section>
    );
  }

  return (
    <section
      className="profil__carte profil__rubrique bloc-info bloc-info--ouvert"
      aria-labelledby={idTitre}
    >
      <EnTete id={idTitre} titre={`${titre} — modification`} />
      <form className="compte__form bloc-info__form kyc" onSubmit={envoyer} noValidate>
        <ChoixFichier
          id={`${idTitre}-recto`}
          libelle="Recto"
          aide={PIECES.identite.aide}
          fichier={recto}
          erreur={erreurs.recto}
          choisir={(f) => {
            setRecto(f);
            setErreurs((e) => ({ ...e, recto: f ? erreurJustificatif(f) : undefined }));
          }}
        />
        <ChoixFichier
          id={`${idTitre}-verso`}
          libelle="Verso"
          aide={PIECES.identite_verso.aide}
          facultatif
          fichier={verso}
          erreur={erreurs.verso}
          choisir={(f) => {
            setVerso(f);
            setErreurs((e) => ({ ...e, verso: f ? erreurJustificatif(f) : undefined }));
          }}
        />
        {alerte && (
          <p className="compte__alerte" role="alert">
            {alerte}
          </p>
        )}
        <div className="bloc-info__actions">
          <button
            type="button"
            className="compte__bouton compte__bouton--secondaire"
            onClick={fermer}
            disabled={envoi}
          >
            Annuler
          </button>
          <button type="submit" className="compte__bouton" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </section>
  );
}

// Bloc RIB : affiché, pas encore modifiable (authentification renforcée à venir)
export function BlocRib({ piece }) {
  const idTitre = useId();
  return (
    <section className="profil__carte profil__rubrique bloc-info" aria-labelledby={idTitre}>
      <EnTete
        id={idTitre}
        titre="Coordonnées bancaires (RIB)"
        badge={
          <span className="bloc-info__badge bloc-info__badge--bientot">Bientôt modifiable</span>
        }
      />
      <Fiche lignes={[{ cle: 'rib', libelle: 'RIB', valeur: piece?.nomFichier ?? 'Non fourni' }]} />
    </section>
  );
}

// Historique des modifications, le plus récent en premier
export function Historique({ lignes }) {
  if (!lignes?.length) return null;
  return (
    <section className="profil__carte profil__rubrique" aria-labelledby="profil-historique">
      <h2 id="profil-historique">Historique des modifications</h2>
      <ul className="historique">
        {lignes.map((ligne, i) => (
          <li key={`${ligne.modifieLe}-${ligne.champ}-${i}`} className="historique__ligne">
            <span className="historique__date">{dateHeure(ligne.modifieLe)}</span>
            <span>
              {libelleHistorique(ligne.champ)} :{' '}
              {ligne.ancienneValeur && (
                <>
                  <del className="historique__ancien">{ligne.ancienneValeur}</del> →{' '}
                </>
              )}
              <strong>{ligne.nouvelleValeur ?? '—'}</strong>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
