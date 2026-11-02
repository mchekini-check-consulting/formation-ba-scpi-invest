// Choix de l'écran selon l'adresse de la page (nginx renvoie index.html pour toute
// adresse : nginx.conf). Navigation par liens classiques, sans bibliothèque de routage.
import App from './App.jsx';
import Indicateurs from './Indicateurs.jsx';
import Inscription from './inscription/Inscription.jsx';
import Kyc from './Kyc.jsx';
import PageCompte from './PageCompte.jsx';

// Pages prévues par d'autres US, pas encore réalisées
const A_VENIR = {
  '/connexion': 'Connexion',
  '/mentions-legales': 'Mentions légales',
  '/contact': 'Contact',
  '/cgu': 'Conditions générales d’utilisation',
  '/confidentialite': 'Politique de confidentialité',
};

export default function Routeur({
  chemin = window.location.pathname,
  recherche = window.location.search,
}) {
  const page = chemin.replace(/\/+$/, '') || '/';
  if (page === '/inscription') {
    return <Inscription emailInitial={new URLSearchParams(recherche).get('email') ?? ''} />;
  }
  if (page === '/kyc') {
    return <Kyc />;
  }
  if (page === '/indicateurs') {
    return <Indicateurs />;
  }
  if (A_VENIR[page]) {
    return (
      <PageCompte titre={A_VENIR[page]}>
        <p className="compte__texte">Cette page sera bientôt disponible.</p>
        <p className="compte__lien">
          <a href="/">Retour à l’accueil</a>
        </p>
      </PageCompte>
    );
  }
  return <App />;
}
