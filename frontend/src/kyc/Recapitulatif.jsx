// Récapitulatif du KYC avant validation (US-04b, scénario 3) : les réponses des 4 étapes,
// un bouton « Modifier » par étape, puis « Valider ». Après validation, le KYC est figé.
import { ETAPES, champsVisibles, reponseLisible } from './etapes.js';

export default function Recapitulatif({
  titreRef,
  reponses,
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
        Vérifiez vos réponses avant de valider votre KYC. Une fois validé, il ne pourra plus être
        modifié.
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
            {champsVisibles(etape, reponses).map((champ) => (
              <div key={champ.nom} className="kyc-recap__ligne">
                <dt>{champ.libelle}</dt>
                <dd>{reponseLisible(champ, reponses[champ.nom])}</dd>
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
        <button
          type="button"
          className="compte__bouton kyc__suivant"
          onClick={valider}
          disabled={envoi}
        >
          {envoi ? 'Validation…' : 'Valider'}
        </button>
      </div>
    </section>
  );
}
