// Choix de l'écran selon l'adresse de la page (nginx renvoie index.html pour toute
// adresse : nginx.conf). Navigation par liens classiques, sans bibliothèque de routage.
import App from './App.jsx';
import Connexion from './connexion/Connexion.jsx';
import Indicateurs from './Indicateurs.jsx';
import Inscription from './inscription/Inscription.jsx';
import FormulaireInvestisseur from './investisseur/FormulaireInvestisseur.jsx';
import Kyc from './Kyc.jsx';
import Cgu from './legal/Cgu.jsx';
import Confidentialite from './legal/Confidentialite.jsx';
import Contact from './legal/Contact.jsx';
import MentionsLegales from './legal/MentionsLegales.jsx';

// Pages légales du pied de page (US-01b)
const PAGES_LEGALES = {
  '/mentions-legales': MentionsLegales,
  '/contact': Contact,
  '/cgu': Cgu,
  '/confidentialite': Confidentialite,
};

export default function Routeur({
  chemin = window.location.pathname,
  recherche = window.location.search,
}) {
  const page = chemin.replace(/\/+$/, '') || '/';
  if (page === '/inscription') {
    return <Inscription emailInitial={new URLSearchParams(recherche).get('email') ?? ''} />;
  }
  if (page === '/connexion') {
    return <Connexion emailInitial={new URLSearchParams(recherche).get('email') ?? ''} />;
  }
  if (page === '/kyc') {
    return <Kyc />;
  }
  if (page === '/profil-investisseur') {
    return <FormulaireInvestisseur />;
  }
  if (page === '/indicateurs') {
    return <Indicateurs />;
  }
  const PageLegale = PAGES_LEGALES[page];
  if (PageLegale) {
    return <PageLegale />;
  }
  return <App />;
}
