// Choix de l'écran selon l'adresse de la page, avec React Router (nginx renvoie
// index.html pour toute adresse : nginx.conf). Le routeur (BrowserRouter) est posé
// dans main.jsx ; les tests utilisent MemoryRouter.
import { useEffect, ViewTransition } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router';
import App from './App.jsx';
import { EVENEMENT_SESSION_EXPIREE } from './auth.js';
import Catalogue from './catalogue/Catalogue.jsx';
import Connexion from './connexion/Connexion.jsx';
import { memoriserPage } from './connexion/destination.js';
import Indicateurs from './Indicateurs.jsx';
import FormulaireInvestisseur from './investisseur/FormulaireInvestisseur.jsx';
import Inscription from './inscription/Inscription.jsx';
import ExigerKycComplete from './kyc/ExigerKycComplete.jsx';
import Kyc from './kyc/Kyc.jsx';
import Cgu from './legal/Cgu.jsx';
import Confidentialite from './legal/Confidentialite.jsx';
import Contact from './legal/Contact.jsx';
import MentionsLegales from './legal/MentionsLegales.jsx';
import { CHEMINS_INACTIFS } from './navigation/entrees.js';
import { CHEMIN_IMPORT_CATALOGUE } from './outils/environnement.js';
import { formulairesPassables } from './outils/passerFormulaires.js';
import ImportCatalogue from './outils/ImportCatalogue.jsx';

// Email pré-rempli transmis par l'adresse (?email=...)
function useEmailDeLAdresse() {
  const [parametres] = useSearchParams();
  return parametres.get('email') ?? '';
}

// Bouton cliqué pour arriver sur la page (LienCompte, MiseEnPage.jsx) : son texte
// glisse jusqu'au titre du formulaire
function useOrigine() {
  return useLocation().state?.origine;
}

function PageInscription() {
  return <Inscription emailInitial={useEmailDeLAdresse()} origine={useOrigine()} />;
}

function PageConnexion() {
  return <Connexion emailInitial={useEmailDeLAdresse()} origine={useOrigine()} />;
}

// passer : raccourci de test du poste (outils/passerFormulaires.js) : KYC et formulaire
// investisseur sautés, leurs adresses mènent au Catalogue (connexion toujours exigée)
export default function Routeur({ passer = formulairesPassables() }) {
  // Changement d'écran animé (<ViewTransition>, réglages dans index.css) : l'écran
  // quitté s'efface, le nouveau apparaît ; un écran par adresse (key)
  const { pathname } = useLocation();
  // Dernier écran du parcours, pour y revenir après une reconnexion (destination.js)
  useEffect(() => {
    memoriserPage(pathname.replace(/\/+$/, '') || '/');
  }, [pathname]);
  // US-03b : session expirée pendant un appel au backend (auth.js) -> écran de connexion,
  // qui affiche « Votre session a expiré »
  const naviguer = useNavigate();
  useEffect(() => {
    const versConnexion = () => naviguer('/connexion', { replace: true });
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, versConnexion);
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, versConnexion);
  }, [naviguer]);
  return (
    <ViewTransition key={pathname} enter="ecran-entre" exit="ecran-sort" default="none">
      <Routes>
        <Route path="/inscription" element={<PageInscription />} />
        <Route path="/connexion" element={<PageConnexion />} />
        <Route
          path="/connaissance-client"
          element={passer ? <Navigate to="/catalogue" replace /> : <Kyc />}
        />
        {/* Ancienne adresse du KYC (favoris, liens déjà envoyés) */}
        <Route path="/kyc" element={<Navigate to="/connaissance-client" replace />} />
        {/* Écrans de l'application : session et KYC validé exigés (US-04b) */}
        <Route
          path="/formulaire-investisseur"
          element={
            passer ? (
              <Navigate to="/catalogue" replace />
            ) : (
              <ExigerKycComplete>
                <FormulaireInvestisseur />
              </ExigerKycComplete>
            )
          }
        />
        {/* Catalogue : profil investisseur validé exigé en plus (Catalogue.jsx, US-05b) */}
        <Route
          path="/catalogue"
          element={
            <ExigerKycComplete>
              <Catalogue />
            </ExigerKycComplete>
          }
        />
        {/* Écrans pas encore disponibles (entrées grisées de la sidebar, US-06) :
            adresse saisie directement -> Catalogue */}
        {CHEMINS_INACTIFS.map((chemin) => (
          <Route key={chemin} path={chemin} element={<Navigate to="/catalogue" replace />} />
        ))}
        <Route path="/indicateurs" element={<Indicateurs />} />
        {/* Outil de test de l'import du catalogue (dev et poste uniquement, sans connexion) */}
        <Route path={CHEMIN_IMPORT_CATALOGUE} element={<ImportCatalogue />} />
        {/* Pages légales du pied de page (US-01b) */}
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/cgu" element={<Cgu />} />
        <Route path="/confidentialite" element={<Confidentialite />} />
        {/* Accueil, et toute adresse inconnue */}
        <Route path="*" element={<App />} />
      </Routes>
    </ViewTransition>
  );
}
