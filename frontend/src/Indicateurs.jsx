// Page « Définitions des indicateurs » (maquette Definitions.dc.html), adresse /indicateurs :
// les 37 indicateurs SCPI par thème, avec recherche et filtre par thème
import { useEffect, useState } from 'react';
import { THEMES, filtrerIndicateurs } from './contenus/indicateurs';
import './Indicateurs.css';
import LogoIcone from './LogoIcone.jsx';

const FILTRES = [{ id: 'tous', titre: 'Tous' }, ...THEMES];

function Indicateurs() {
  const [recherche, setRecherche] = useState('');
  const [theme, setTheme] = useState('tous');
  const groupes = filtrerIndicateurs(recherche, theme);

  useEffect(() => {
    document.title = 'SCPI Invest+ · Définitions des indicateurs';
  }, []);

  return (
    <div className="indicateurs">
      {/* En-tête : logo vers l'accueil et boutons de compte (pas de menu sur cette page) */}
      <header className="ind-header">
        <div className="ind-conteneur ind-header__inner">
          <a href="/" className="ind-logo" aria-label="SCPI Invest+ — accueil">
            <LogoIcone />
            <span>
              SCPI INVEST<span className="ind-logo__plus">+</span>
            </span>
          </a>
          <div className="ind-header__actions">
            <a href="/connexion" className="ind-bouton ind-bouton--contour">
              Se connecter
            </a>
            <a href="/inscription" className="ind-bouton ind-bouton--sombre">
              Créer mon compte
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="ind-conteneur ind-intro">
          <p className="ind-surtitre">Comprendre les SCPI</p>
          <h1 className="ind-titre">Les indicateurs des SCPI, expliqués simplement.</h1>
          <p className="ind-chapeau">
            Prix, rendement, frais, santé financière : toutes les notions que vous retrouverez sur
            SCPI INVEST+, en une phrase chacune.
          </p>
          <div className="ind-recherche">
            <label htmlFor="q">Rechercher un indicateur</label>
            <input
              id="q"
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Ex. taux d’occupation, TRI, report à nouveau…"
            />
          </div>
          <fieldset className="ind-filtres">
            <legend className="sr-only">Thèmes</legend>
            {FILTRES.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={theme === f.id}
                className="ind-filtre"
                onClick={() => setTheme(f.id)}
              >
                {f.titre}
              </button>
            ))}
          </fieldset>
        </section>

        <section className="ind-conteneur ind-liste">
          {groupes.map((g) => (
            <div key={g.id} className="ind-groupe">
              <div className="ind-groupe__entete">
                <h2>{g.titre}</h2>
                <span className="ind-groupe__nombre">
                  {g.indicateurs.length} {g.indicateurs.length > 1 ? 'indicateurs' : 'indicateur'}
                </span>
              </div>
              <div className="ind-grille">
                {g.indicateurs.map((i) => (
                  <article key={i.nom} className="ind-carte">
                    <div className="ind-carte__entete">
                      <h3>{i.nom}</h3>
                      {i.sigle && <span className="ind-sigle">{i.sigle}</span>}
                    </div>
                    <p>{i.definition}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
          {groupes.length === 0 && (
            <p className="ind-vide">Aucun indicateur ne correspond à votre recherche.</p>
          )}
        </section>

        <section className="ind-bandeau">
          <div className="ind-conteneur ind-bandeau__inner">
            <div className="ind-bandeau__texte">
              <h2>Comparez les SCPI sur tous ces indicateurs.</h2>
              <p>Chaque indicateur est expliqué directement dans le catalogue et le comparateur.</p>
            </div>
            <a href="/inscription" className="ind-bouton ind-bouton--accent">
              Créer mon compte
            </a>
          </div>
        </section>
      </main>

      <footer className="ind-pied">
        <div className="ind-conteneur ind-pied__inner">
          Investir en SCPI comporte des risques de perte en capital. Les performances passées ne
          préjugent pas des performances futures.
        </div>
      </footer>
    </div>
  );
}

export default Indicateurs;
