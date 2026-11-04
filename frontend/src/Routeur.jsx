// Choix de l'écran selon l'adresse de la page, avec React Router (nginx renvoie
// index.html pour toute adresse : nginx.conf). Le routeur (BrowserRouter) est posé
// dans main.jsx ; les tests utilisent MemoryRouter.
import { Route, Routes, useSearchParams } from 'react-router';
import App from './App.jsx';
import Connexion from './connexion/Connexion.jsx';
import Indicateurs from './Indicateurs.jsx';
import Inscription from './inscription/Inscription.jsx';
import Kyc from './kyc/Kyc.jsx';
import Cgu from './legal/Cgu.jsx';
import Confidentialite from './legal/Confidentialite.jsx';
import Contact from './legal/Contact.jsx';
import MentionsLegales from './legal/MentionsLegales.jsx';

// Email pré-rempli transmis par l'adresse (?email=...)
function useEmailDeLAdresse() {
  const [parametres] = useSearchParams();
  return parametres.get('email') ?? '';
}

function PageInscription() {
  return <Inscription emailInitial={useEmailDeLAdresse()} />;
}

function PageConnexion() {
  return <Connexion emailInitial={useEmailDeLAdresse()} />;
}

export default function Routeur() {
  return (
    <Routes>
      <Route path="/inscription" element={<PageInscription />} />
      <Route path="/connexion" element={<PageConnexion />} />
      <Route path="/kyc" element={<Kyc />} />
      <Route path="/indicateurs" element={<Indicateurs />} />
      {/* Pages légales du pied de page (US-01b) */}
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/cgu" element={<Cgu />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      {/* Accueil, et toute adresse inconnue */}
      <Route path="*" element={<App />} />
    </Routes>
  );
}
