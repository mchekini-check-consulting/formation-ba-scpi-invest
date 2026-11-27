// Éléments communs aux écrans « Investir » et « Suivi de ma demande » (US-11) : icônes et
// bandeau bleu, sur le modèle de la Fiche (classes de fiche/fiche.css).
import { LienInterne } from '../MiseEnPage.jsx';
import { formaterEuros, NON_COMMUNIQUE } from '../utils/format.js';

// Icônes décoratives (traits), mêmes dessins que la Fiche
const ICONES = {
  prix: (
    <>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  minimum: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  capitalisation: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  souscription: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  gestion: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  reconstitution: <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10" />,
  pleine_propriete: <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10" />,
  nue_propriete: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  usufruit: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  valide: <path d="M5 12l5 5L19 7" />,
  // Suivi de ma demande (US-16)
  suite: <path d="M5 12h14M13 6l6 6-6 6" />,
  virement: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  dossier: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  // Correction de l'US-16 : carte du statut et ses lignes de faits
  envoi: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  loupe: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  horloge: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alerte: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5h.01" />
    </>
  ),
};

export function Icone({ nom }) {
  return (
    <svg
      className="fiche__icone"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONES[nom]}
    </svg>
  );
}

// Bandeau bleu : retour, société de gestion, titre de la page (h1), pastille, et à droite
// le montant de la demande (à la place du taux de distribution de la Fiche)
export function Bandeau({ retour, gerant, titre, pastille, pastilleClasse, montant }) {
  return (
    <header className="fiche__bandeau">
      <LienInterne to={retour.to} className="fiche__retour">
        <span className="fiche__retour-fleche" aria-hidden="true">
          ←
        </span>
        {retour.libelle}
      </LienInterne>
      <div className="fiche__identite">
        <div className="fiche__nom">
          <p className="fiche__gerant">
            Société de gestion · <strong>{gerant ?? NON_COMMUNIQUE}</strong>
          </p>
          <h1 id="titre-page" className="fiche__titre">
            {titre}
          </h1>
          <ul className="fiche__pastilles">
            <li className={pastilleClasse}>{pastille}</li>
          </ul>
        </div>
        <div className="fiche__taux investir__total">
          <svg
            className="fiche__cercles"
            viewBox="0 0 400 400"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="200" cy="200" r="190" />
            <circle cx="200" cy="200" r="140" />
            <circle cx="200" cy="200" r="90" />
          </svg>
          <p>Montant de votre demande</p>
          <p className="fiche__taux-valeur">{formaterEuros(montant)}</p>
        </div>
      </div>
    </header>
  );
}
