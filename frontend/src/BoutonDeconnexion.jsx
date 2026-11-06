// Bouton « Se déconnecter » mis en évidence, avec le pictogramme de déconnexion
// (porte et flèche de sortie), affiché dans l'en-tête des écrans connectés
export default function BoutonDeconnexion({ onClick }) {
  return (
    <button type="button" className="bouton-deconnexion" onClick={onClick}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span>Se déconnecter</span>
    </button>
  );
}
