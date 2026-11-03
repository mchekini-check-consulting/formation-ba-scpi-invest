// Mise en page commune des écrans du compte (inscription, KYC, pages légales) :
// en-tête avec le logo, carte centrée
import './compte.css';
import LogoIcone from './LogoIcone.jsx';

export default function PageCompte({ titre, large = false, children }) {
  return (
    <div className="compte">
      <header className="compte__entete">
        <a href="/" className="compte__logo" aria-label="SCPI Invest+ — accueil">
          <LogoIcone />
          <span>
            SCPI INVEST<span className="compte__logo-plus">+</span>
          </span>
        </a>
      </header>
      <main className="compte__contenu">
        <section
          className={large ? 'compte__carte compte__carte--large' : 'compte__carte'}
          aria-labelledby="titre-page"
        >
          <h1 id="titre-page">{titre}</h1>
          {children}
        </section>
      </main>
    </div>
  );
}
