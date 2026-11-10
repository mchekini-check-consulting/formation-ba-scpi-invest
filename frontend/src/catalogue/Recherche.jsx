// Barre de recherche par nom, au-dessus du Catalogue, et ses résultats (logique dans
// useRecherche.js). Combinée aux filtres et au tri actifs (US-12) ; pendant la recherche,
// ses résultats (mêmes cartes) remplacent la liste du Catalogue.
import { useId, useRef } from 'react';
import { LIMITE_RECHERCHE, RECHERCHE_MIN } from './useRecherche.js';
import './recherche.css';

// Croix à droite du champ dès qu'il contient du texte : vide le champ et y laisse le
// curseur, pour taper une autre recherche
export function BarreRecherche({ valeur, onChange }) {
  const idAide = useId();
  const champ = useRef(null);
  const tropCourt = valeur.trim().length > 0 && valeur.trim().length < RECHERCHE_MIN;

  function effacer() {
    onChange('');
    champ.current?.focus();
  }

  return (
    <div className="recherche-scpi" role="search">
      <svg
        className="recherche-scpi__icone"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" />
      </svg>
      <input
        ref={champ}
        type="search"
        className="recherche-scpi__champ"
        placeholder="Rechercher une SCPI par son nom"
        aria-label="Rechercher une SCPI par son nom"
        aria-describedby={tropCourt ? idAide : undefined}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      />
      {valeur !== '' && (
        <button
          type="button"
          className="recherche-scpi__effacer"
          aria-label="Effacer la saisie"
          onClick={effacer}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      {tropCourt && (
        <p id={idAide} className="recherche-scpi__aide">
          Saisissez au moins {RECHERCHE_MIN} caractères
        </p>
      )}
    </div>
  );
}

// afficherCartes(resultats) : cartes des SCPI trouvées, les mêmes que dans le Catalogue
// filtre : des filtres sont actifs (US-12), rappelé dans le nombre de résultats
export function ResultatsRecherche({ recherche, effacer, afficherCartes, filtre = false }) {
  const { texte, enCours, resultats, erreur } = recherche;
  const avecFiltres = filtre ? ' avec les filtres actifs' : '';
  if (enCours) {
    return (
      <p className="compte__texte" aria-live="polite">
        Recherche en cours…
      </p>
    );
  }
  if (erreur) {
    return (
      <p className="compte__alerte" role="alert">
        {erreur.message}
      </p>
    );
  }
  const nombre = resultats.scpis.length;
  if (nombre === 0) {
    return (
      <div className="catalogue__aucun">
        <p className="compte__texte" aria-live="polite">
          Aucune SCPI ne correspond à « {texte} »{avecFiltres}.
        </p>
        <button type="button" className="compte__bouton" onClick={effacer}>
          Effacer la recherche
        </button>
      </div>
    );
  }
  return (
    <section aria-label="Résultats de la recherche">
      <p className="recherche-scpi__total" aria-live="polite">
        {nombre > 1
          ? `${nombre} SCPI trouvées pour « ${texte} »${avecFiltres}`
          : `1 SCPI trouvée pour « ${texte} »${avecFiltres}`}
        {nombre >= LIMITE_RECHERCHE &&
          ` : seules les ${LIMITE_RECHERCHE} premières sont affichées, précisez votre recherche`}
      </p>
      {afficherCartes(resultats)}
    </section>
  );
}
