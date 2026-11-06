// Mise en page des écrans de l'application (US-06) : barre de navigation verticale à
// gauche sur toute la hauteur (logo, menu, initiales et « Se déconnecter »), contenu de
// l'écran à droite, mention de risque en pied de page. Sur petit écran, la barre passe
// au-dessus du contenu.
// Les écrans du parcours d'entrée (KYC, formulaire investisseur) gardent PageCompte,
// sans sidebar.
import '../compte.css';
import './navigation.css';
import Sidebar from './Sidebar.jsx';

export default function PageApplication({
  titre,
  actif,
  seDeconnecter,
  chargerIdentite,
  children,
}) {
  return (
    <div className="compte application">
      <Sidebar actif={actif} seDeconnecter={seDeconnecter} chargerIdentite={chargerIdentite} />
      <div className="application__zone">
        <main className="panneau application__contenu" aria-labelledby="titre-page">
          <h1 id="titre-page" className="application__titre">
            {titre}
          </h1>
          {children}
        </main>
        <footer className="pied compte__pied">
          <p className="pied__mention">
            Investir en SCPI comporte des risques de perte en capital. Les performances passées ne
            préjugent pas des performances futures.
          </p>
        </footer>
      </div>
    </div>
  );
}
