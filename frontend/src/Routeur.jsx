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
import MiseAJourProfil from './investisseur/MiseAJourProfil.jsx';
import Inscription from './inscription/Inscription.jsx';
import ExigerKycComplete from './kyc/ExigerKycComplete.jsx';
import Kyc from './kyc/Kyc.jsx';
import Cgu from './legal/Cgu.jsx';
import Confidentialite from './legal/Confidentialite.jsx';
import Contact from './legal/Contact.jsx';
import MentionsLegales from './legal/MentionsLegales.jsx';
import PageBientot from './navigation/PageBientot.jsx';
import { CHEMIN_MISE_A_JOUR } from './navigation/rappel.js';
import { CHEMIN_IMPORT_CATALOGUE } from './outils/environnement.js';
import { formulairesPassables } from './outils/passerFormulaires.js';
import ImportCatalogue from './outils/ImportCatalogue.jsx';
import Profil from './profil/Profil.jsx';

// Adresses définitives des écrans du sprint 2 (convention C1), en attente de leur US ;
// actif : entrée du menu marquée sélectionnée
const ECRANS_A_VENIR = [
  { chemin: '/catalogue/:id', titre: 'Détails' },
  { chemin: '/comparaison', titre: 'Comparer', actif: 'comparaison' },
  { chemin: '/simulation', titre: 'Simuler', actif: 'simulation' },
  { chemin: '/investir/:id', titre: 'Investir' },
  // Titre provisoire (nom de l'écran dans C1), à préciser à la création de la page
  { chemin: '/demandes/:id', titre: 'Suivi de ma demande' },
  // Titre provisoire (nom de l'écran dans C1), à préciser à la création de la page
  { chemin: '/versements/nouveau', titre: 'Programmer un versement', actif: 'versements' },
  // Titre provisoire (nom de l'écran dans C1), à préciser à la création de la page
  { chemin: '/portefeuille', titre: 'Mon portefeuille', actif: 'portefeuille' },
  { chemin: '/fiscalite', titre: 'Fiscalité', actif: 'fiscalite' },
];

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
        {/* Page Profil, en lecture seule : ouverte par les initiales de la sidebar */}
        <Route
          path="/profil"
          element={
            <ExigerKycComplete>
              <Profil />
            </ExigerKycComplete>
          }
        />
        {/* Mise à jour du profil investisseur (US-05d), non bloquante */}
        <Route
          path={CHEMIN_MISE_A_JOUR}
          element={
            <ExigerKycComplete>
              <MiseAJourProfil />
            </ExigerKycComplete>
          }
        />
        {/* Écrans du sprint 2 pas encore développés (EN-03) */}
        {ECRANS_A_VENIR.map(({ chemin, titre, actif }) => (
          <Route
            key={chemin}
            path={chemin}
            element={
              <ExigerKycComplete>
                <PageBientot titre={titre} actif={actif} />
              </ExigerKycComplete>
            }
          />
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
