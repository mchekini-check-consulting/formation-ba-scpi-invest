// Page « Définitions des indicateurs », adresse /indicateurs, modèle « bleu éditorial »
// (mockups/indicateurs.html) : les 37 indicateurs SCPI par thème, avec recherche et
// filtre par thème
import { useEffect, useState } from 'react';
import { THEMES, filtrerIndicateurs } from './contenus/indicateurs';
import './Indicateurs.css';
import { EnTete, LienCompte } from './MiseEnPage.jsx';
import LiensLegaux from './legal/LiensLegaux.jsx';

const FILTRES = [{ id: 'tous', titre: 'Tous' }, ...THEMES];
const TOTAL = THEMES.reduce((n, t) => n + t.indicateurs.length, 0);
// Numéro d'un thème (01, 02…) dans l'ordre du contenu, gardé quand on filtre
const NUMEROS = Object.fromEntries(THEMES.map((t, i) => [t.id, String(i + 1).padStart(2, '0')]));

function Indicateurs() {
  const [recherche, setRecherche] = useState('');
  const [theme, setTheme] = useState('tous');
  const groupes = filtrerIndicateurs(recherche, theme);

  useEffect(() => {
    document.title = 'SCPI Invest+ · Définitions des indicateurs';
  }, []);

  return (
    <div className="cadre indicateurs">
      {/* En-tête : logo vers l'accueil et boutons de compte (pas de menu sur cette page) */}
      <EnTete />

      <main>
        <section className="panneau ind-heros">
          <div>
            <p className="surtitre">Comprendre les SCPI</p>
            <h1 className="titre">
              Les indicateurs des SCPI, <em>expliqués simplement.</em>
            </h1>
            <p className="ind-heros__chapeau">
              Prix, rendement, frais, santé financière : toutes les notions que vous retrouverez sur
              SCPI INVEST+, en une phrase chacune.
            </p>
          </div>
          <p className="compteur">
            <strong>{TOTAL}</strong>indicateurs
          </p>
        </section>

        <div className="outils">
          <label className="recherche">
            <span className="sr-only">Rechercher un indicateur</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Ex. taux d’occupation, TRI, report à nouveau…"
            />
          </label>
          <fieldset className="filtres">
            <legend className="sr-only">Thèmes</legend>
            {FILTRES.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={theme === f.id}
                className="filtre"
                onClick={() => setTheme(f.id)}
              >
                {f.titre}
              </button>
            ))}
          </fieldset>
        </div>

        <section className="liste">
          {groupes.map((g) => (
            <div key={g.id} className="groupe">
              <div className="groupe__entete">
                <span className="groupe__num" aria-hidden="true">
                  {NUMEROS[g.id]}
                </span>
                <h2>{g.titre}</h2>
                <span className="groupe__nombre">
                  {g.indicateurs.length} {g.indicateurs.length > 1 ? 'indicateurs' : 'indicateur'}
                </span>
              </div>
              <div className="grille">
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
            <p className="vide">Aucun indicateur ne correspond à votre recherche.</p>
          )}
        </section>

        <section className="bandeau">
          <div>
            <h2>Comparez les SCPI sur tous ces indicateurs.</h2>
            <p>Chaque indicateur est expliqué directement dans le catalogue et le comparateur.</p>
          </div>
          <LienCompte
            vers="inscription"
            origine="bandeau-inscription"
            className="btn btn--bleu btn--lg"
            fleche
          >
            Créer mon compte
          </LienCompte>
        </section>
      </main>

      <footer className="pied">
        <LiensLegaux compact />
        <p className="pied__mention">
          Investir en SCPI comporte des risques de perte en capital. Les performances passées ne
          préjugent pas des performances futures.
        </p>
      </footer>
    </div>
  );
}

export default Indicateurs;
