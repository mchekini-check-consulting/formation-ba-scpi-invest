// Pictogramme d'immeubles placé devant « SCPI INVEST+ » ; variante claire pour le pied de page
export default function LogoIcone({ clair = false }) {
  const cote = clair ? '#7fa6e6' : '#1e3a8a';
  return (
    <svg aria-hidden="true" width="30" height="30" viewBox="0 0 30 30">
      <rect x="2" y="12" width="9" height="16" rx="1.5" fill={cote} />
      <rect x="12" y="4" width="9" height="24" rx="1.5" fill="#3b6fd4" />
      <rect x="22" y="15" width="6" height="13" rx="1.5" fill={cote} />
    </svg>
  );
}
