// Mise en page des écrans de l'application (US-06) : barre de navigation verticale à
// gauche sur toute la hauteur (logo, menu, initiales et « Se déconnecter »), contenu de
// l'écran à droite, mention de risque en pied de page. Sur petit écran, la barre passe
// au-dessus du contenu.
// Les écrans du parcours d'entrée (KYC, formulaire investisseur) gardent PageCompte,
// sans sidebar.
// entete (facultatif) : contenu ajouté sous le titre ; titre et entete restent alors figés
// en haut de l'écran quand on fait défiler la page.
// Rappel de mise à jour du profil investisseur (US-05d, BandeauRappel.jsx) : affiché en
// haut de chaque écran quand le profil a plus de 24 mois ou que le questionnaire a changé ;
// sansRappel : écran de la mise à jour elle-même.
import '../compte.css';
import './navigation.css';
import BandeauRappel from './BandeauRappel.jsx';
import { lireIdentite, useIdentite } from './identite.js';
import Sidebar from './Sidebar.jsx';
import LiensLegaux from '../legal/LiensLegaux.jsx';

export default function PageApplication({
  titre,
  actif,
  seDeconnecter,
  chargerIdentite = lireIdentite,
  entete,
  sansRappel = false,
  children,
}) {
  const identite = useIdentite(chargerIdentite);
  const titrePage = (
    <h1 id="titre-page" className="application__titre">
      {titre}
    </h1>
  );
  return (
    <div className="compte application">
      <Sidebar actif={actif} seDeconnecter={seDeconnecter} identite={identite} />
      <div className="application__zone">
        <main className="panneau application__contenu" aria-labelledby="titre-page">
          {!sansRappel && identite?.aMettreAJour && <BandeauRappel />}
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
          <LiensLegaux compact />
          <p className="pied__mention">
            Investir en SCPI comporte des risques de perte en capital. Les performances passées ne
            préjugent pas des performances futures.
          </p>
        </footer>
      </div>
    </div>
  );
}
