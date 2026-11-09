// Récapitulatif du KYC avant validation (US-04b, scénario 3) : les réponses des 4 étapes
// et les pièces déposées (US-04c), un bouton « Modifier » par étape, puis « Valider ».
// Après validation, le KYC et les pièces sont figés.
import { ETAPES, champsVisibles, reponseLisible } from './etapes.js';
import { piecesAttendues } from './pieces.js';

function lignes(etape, reponses, pieces) {
  if (etape.id === 'pieces') {
    return piecesAttendues(reponses).map((piece) => ({
      cle: piece.type,
      libelle: piece.libelle,
      valeur: pieces.find((p) => p.type === piece.type)?.nomFichier ?? 'Non fourni',
    }));
  }
  return champsVisibles(etape, reponses).map((champ) => ({
    cle: champ.nom,
    libelle: champ.libelle,
    valeur: reponseLisible(champ, reponses[champ.nom], reponses),
  }));
}

export default function Recapitulatif({
  titreRef,
  reponses,
  pieces = [],
  modifier,
  precedent,
  valider,
  envoi,
  erreur,
}) {
  return (
    <section className="kyc-recap" aria-labelledby="kyc-titre-recap">
      <h2 id="kyc-titre-recap" ref={titreRef} tabIndex={-1} className="kyc__titre-etape">
        Récapitulatif
      </h2>
      <p className="compte__texte kyc-recap__intro">
        Vérifiez vos réponses et vos pièces avant de valider votre KYC. Une fois validé, il ne
        pourra plus être modifié.
      </p>
      {ETAPES.map((etape, i) => (
        <section key={etape.id} className="kyc-recap__etape" aria-labelledby={`recap-${etape.id}`}>
          <div className="kyc-recap__entete">
            <h3 id={`recap-${etape.id}`}>
              {i + 1}. {etape.titre}
            </h3>
            <button
              type="button"
              className="kyc__lien-bouton"
              onClick={() => modifier(i)}
              aria-label={`Modifier l’étape ${etape.titre}`}
            >
              Modifier
            </button>
          </div>
          <dl className="kyc-recap__liste">
            {lignes(etape, reponses, pieces).map((ligne) => (
              <div key={ligne.cle} className="kyc-recap__ligne">
                <dt>{ligne.libelle}</dt>
                <dd>{ligne.valeur}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {erreur && (
        <p className="compte__alerte" role="alert">
          {erreur}
        </p>
      )}
      <div className="kyc__boutons">
        <button
          type="button"
          className="compte__bouton compte__bouton--secondaire"
          onClick={precedent}
        >
          Précédent
        </button>
        <button type="button" className="compte__bouton" onClick={valider} disabled={envoi}>
          {envoi ? 'Validation…' : 'Valider'}
        </button>
      </div>
    </section>
  );
}
