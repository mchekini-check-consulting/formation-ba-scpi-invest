// Liens vers les pages légales (US-01b), affichés dans le pied de page de tous les écrans :
// accueil, indicateurs, écrans du compte (PageCompte) et de l'application (PageApplication)
const LIENS_LEGAUX = [
  { href: '/mentions-legales', texte: 'Mentions légales' },
  { href: '/confidentialite', texte: 'Politique de confidentialité' },
  { href: '/cgu', texte: 'CGU' },
  { href: '/contact', texte: 'Contact' },
];

// compact : pieds de page sans logo (tous les écrans sauf l'accueil), liens au-dessus
// de la mention de risque
export default function LiensLegaux({ compact = false }) {
  return (
    <nav aria-label="Liens légaux" className={compact ? 'pied__nav' : undefined}>
      <ul className="pied__liens">
        {LIENS_LEGAUX.map((l) => (
          <li key={l.href}>
            <a href={l.href}>{l.texte}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
