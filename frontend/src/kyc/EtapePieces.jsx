// Étape « Pièces justificatives » du KYC (US-04c, SCPI-44) : liste des pièces demandées,
// adaptée aux réponses des étapes précédentes, avec pour chacune le dépôt d'un fichier
// (PDF, JPG ou PNG, 10 Mo maximum), puis « Remplacer » ou « Supprimer » tant que le KYC
// n'est pas validé. Le contrôle des pièces obligatoires se fait au clic sur « Suivant »
// (FormulaireKyc.jsx) ; les erreurs arrivent par type de pièce.
import { useRef, useState } from 'react';
import {
  FORMATS_ACCEPTES,
  MESSAGE_ENVOI,
  MESSAGE_SUPPRESSION,
  STATUTS,
  erreurFichier,
  idPiece,
  piecesAttendues,
} from './pieces.js';

function message(err, parDefaut) {
  const status = err?.status;
  return status >= 400 && status < 500 && err.message ? err.message : parDefaut;
}

// Avancement d'un envoi ou d'une suppression, sous le texte de la pièce
function Avancement({ operation, id }) {
  if (operation.action === 'suppression') {
    return (
      <p className="kyc-piece__avancement" role="status">
        Suppression…
      </p>
    );
  }
  const pourcentage = Math.round(operation.part * 100);
  const fini = pourcentage >= 100; // tout est transmis, le serveur enregistre le fichier
  return (
    <div className="kyc-piece__avancement">
      <p className="kyc-piece__avancement-texte" id={`${id}-avancement`}>
        <span className="kyc-piece__nom">{operation.nom}</span>
        <span>{fini ? 'Finalisation…' : `${pourcentage} %`}</span>
      </p>
      <div
        className="kyc-piece__barre"
        role="progressbar"
        aria-labelledby={`${id}-avancement`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pourcentage}
        aria-valuetext={fini ? 'Finalisation' : `${pourcentage} % envoyés`}
      >
        <span style={{ width: `${pourcentage}%` }} />
      </div>
    </div>
  );
}

function Piece({ piece, deposee, erreur, operation, deposer, supprimer }) {
  const enCours = Boolean(operation);
  const champ = useRef(null);
  const id = idPiece(piece.type);
  const idAide = `${id}-aide`;
  const idErreur = `${id}-erreur`;
  const decrit = [idAide, erreur && idErreur].filter(Boolean).join(' ');

  function choisir(event) {
    const fichier = event.target.files?.[0];
    event.target.value = ''; // même fichier choisi deux fois : nouvel envoi
    if (fichier) deposer(piece.type, fichier);
  }

  return (
    <li className={`kyc-piece${erreur ? ' kyc-piece--erreur' : ''}`}>
      <div className="kyc-piece__texte">
        <label htmlFor={id} className="kyc-piece__libelle">
          {piece.libelle}
          {!piece.obligatoire && <span className="champ__facultatif"> (facultatif)</span>}
        </label>
        <p id={idAide} className="champ__aide">
          {piece.aide}
        </p>
        {operation && <Avancement operation={operation} id={id} />}
        {deposee && !operation && (
          <p className="kyc-piece__fichier">
            <span className="kyc-piece__nom">{deposee.nomFichier}</span>
            <span className="kyc-piece__statut">{STATUTS[deposee.statut] ?? deposee.statut}</span>
          </p>
        )}
        {erreur && (
          <p id={idErreur} className="champ__erreur">
            {erreur}
          </p>
        )}
      </div>
      <div className="kyc-piece__actions">
        <input
          ref={champ}
          id={id}
          type="file"
          accept={FORMATS_ACCEPTES}
          className={deposee || enCours ? 'kyc-piece__champ--masque' : 'kyc-piece__champ'}
          onChange={choisir}
          disabled={enCours}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit}
        />
        {/* Bouton visible, identique dans tous les navigateurs ; le champ natif, masqué,
            reste celui qui reçoit le focus au clavier et que lisent les lecteurs d'écran */}
        {!deposee && !enCours && (
          <label htmlFor={id} className="kyc-piece__bouton" aria-hidden="true">
            Choisir un fichier
          </label>
        )}
        {deposee && !enCours && (
          <>
            <button
              type="button"
              className="kyc__lien-bouton"
              onClick={() => champ.current?.click()}
              aria-label={`Remplacer : ${piece.libelle}`}
            >
              Remplacer
            </button>
            <button
              type="button"
              className="kyc__lien-bouton"
              onClick={() => supprimer(piece.type)}
              aria-label={`Supprimer : ${piece.libelle}`}
            >
              Supprimer
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export default function EtapePieces({
  reponses,
  pieces,
  setPieces,
  erreurs,
  setErreurs,
  deposer,
  supprimer,
  setOccupe = () => {},
}) {
  // Opération en cours : { type, action: 'envoi' | 'suppression', nom, part de 0 à 1 }
  const [enCours, setEnCours] = useState(null);

  async function operation(type, suivi, action, parDefaut) {
    setEnCours({ type, ...suivi });
    setOccupe(true);
    setErreurs((e) => {
      const { [type]: _retire, ...reste } = e;
      return reste;
    });
    try {
      await action();
    } catch (err) {
      setErreurs((e) => ({ ...e, [type]: message(err, parDefaut) }));
    } finally {
      setEnCours(null);
      setOccupe(false);
    }
  }

  function deposerFichier(type, fichier) {
    const refus = erreurFichier(fichier);
    if (refus) {
      setErreurs((e) => ({ ...e, [type]: refus }));
      return;
    }
    const avancer = (part) => setEnCours((o) => (o?.type === type ? { ...o, part } : o));
    operation(
      type,
      { action: 'envoi', nom: fichier.name, part: 0 },
      async () => {
        const piece = await deposer(type, fichier, avancer);
        setPieces((liste) => [...liste.filter((p) => p.type !== type), piece]);
      },
      MESSAGE_ENVOI,
    );
  }

  function supprimerPiece(type) {
    operation(
      type,
      { action: 'suppression' },
      async () => {
        await supprimer(type);
        setPieces((liste) => liste.filter((p) => p.type !== type));
      },
      MESSAGE_SUPPRESSION,
    );
  }

  return (
    <>
      <p className="compte__texte">
        Déposez une copie lisible de chaque pièce demandée, au format PDF, JPG ou PNG (10 Mo maximum
        par fichier). Vos documents sont conservés de façon sécurisée et vérifiés après la
        validation de votre KYC.
      </p>
      <ul className="kyc-pieces">
        {piecesAttendues(reponses).map((piece) => (
          <Piece
            key={piece.type}
            piece={piece}
            deposee={pieces.find((p) => p.type === piece.type)}
            erreur={erreurs[piece.type]}
            operation={enCours?.type === piece.type ? enCours : null}
            deposer={deposerFichier}
            supprimer={supprimerPiece}
          />
        ))}
      </ul>
    </>
  );
}
