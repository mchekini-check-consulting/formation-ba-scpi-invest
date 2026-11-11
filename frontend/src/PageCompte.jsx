// Mise en page commune des écrans du compte (inscription, connexion, KYC, pages légales),
// modèle « bleu éditorial » : cadre de page, en-tête avec le logo, carte blanche centrée
// sur un panneau sable, pied de page avec la mention de risque
import './compte.css';
import { EnTete, TitreCompte } from './MiseEnPage.jsx';
import LiensLegaux from './legal/LiensLegaux.jsx';

// origine : bouton cliqué pour arriver ici (Routeur.jsx) ; son texte glisse jusqu'au titre.
// seDeconnecter : écrans connectés, bouton « Se déconnecter » dans l'en-tête
export default function PageCompte({ titre, large = false, origine, seDeconnecter, children }) {
  return (
    <div className="cadre compte">
      <EnTete actions={false} seDeconnecter={seDeconnecter} />
      <main className="panneau compte__contenu">
        <section
          className={large ? 'compte__carte compte__carte--large' : 'compte__carte'}
          aria-labelledby="titre-page"
        >
          <TitreCompte origine={origine}>
            <h1 id="titre-page">{titre}</h1>
          </TitreCompte>
          {children}
        </section>
      </main>
      <footer className="pied compte__pied">
        <LiensLegaux compact />
        <p className="pied__mention">
          Investir en SCPI comporte des risques de perte en capital. Les performances passées ne
          préjugent pas des performances futures.
        </p>
      </footer>
    </div>
  );
}
