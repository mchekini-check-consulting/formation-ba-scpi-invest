// Mise en page des écrans de l'application (US-06) : barre de navigation verticale à
// gauche sur toute la hauteur (logo, menu, initiales et « Se déconnecter »), contenu de
// l'écran à droite, mention de risque en pied de page. Sur petit écran, la barre passe
// au-dessus du contenu.
// Les écrans du parcours d'entrée (KYC, formulaire investisseur) gardent PageCompte,
// sans sidebar.
// entete (facultatif) : contenu ajouté sous le titre ; titre et entete restent alors figés
// en haut de l'écran quand on fait défiler la page.
import '../compte.css';
import './navigation.css';
import Sidebar from './Sidebar.jsx';

export default function PageApplication({
  titre,
  actif,
  seDeconnecter,
  chargerIdentite,
  entete,
  children,
}) {
  const titrePage = (
    <h1 id="titre-page" className="application__titre">
      {titre}
    </h1>
  );
  return (
    <div className="compte application">
      <Sidebar actif={actif} seDeconnecter={seDeconnecter} chargerIdentite={chargerIdentite} />
      <div className="application__zone">
        <main className="panneau application__contenu" aria-labelledby="titre-page">
          {entete ? (
            <header className="application__entete">
              {titrePage}
              {entete}
            </header>
          ) : (
            titrePage
          )}
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
