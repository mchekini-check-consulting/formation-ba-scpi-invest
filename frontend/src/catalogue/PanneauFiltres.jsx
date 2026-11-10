// Filtres du Catalogue : barre des filtres actifs (US-10c) et panneau des filtres
// (US-10a, US-10b). Le panneau s'ouvre par-dessus la liste, défile verticalement, et se
// ferme par « Fermer », « Voir les SCPI », Échap ou un clic à côté. Chaque changement est
// appliqué tout de suite à la liste ; un curseur l'est quand on le relâche.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './filtres.css';
import {
  CHOIX,
  FILTRES_VIDES,
  PLAGES,
  basculer,
  changerPlage,
  formaterValeur,
  pastilles,
} from './filtres.js';

const PRECISION = 1e-9;

function decimales(pas) {
  return String(pas).split('.')[1]?.length ?? 0;
}

function arrondir(valeur, pas) {
  return Number((Math.round(valeur / pas) * pas).toFixed(decimales(pas)));
}

// Extrémités du curseur, arrondies au pas pour être atteignables
function extremites(bornes, pas) {
  return {
    min: arrondir(Math.floor(bornes.min / pas + PRECISION) * pas, pas),
    max: arrondir(Math.ceil(bornes.max / pas - PRECISION) * pas, pas),
  };
}

// Curseur à deux poignées (minimum et maximum), bornes issues des données disponibles
function CurseurPlage({ titre, unite, pas, plage, bornes, anneeTaux, onChange }) {
  const id = useId();
  const ext = extremites(bornes, pas);
  const depuisFiltre = () => ({ min: plage.min ?? ext.min, max: plage.max ?? ext.max });
  const [brouillon, setBrouillon] = useState(depuisFiltre);
  // Filtre changé ailleurs (pastille retirée, réinitialisation) : curseur remis à jour
  const [suivi, setSuivi] = useState(plage);
  if (suivi.min !== plage.min || suivi.max !== plage.max) {
    setSuivi(plage);
    setBrouillon(depuisFiltre());
  }
  const titreComplet = anneeTaux ? `${titre} ${anneeTaux}` : titre;

  function valider() {
    onChange({
      min: brouillon.min <= ext.min + PRECISION ? null : brouillon.min,
      max: brouillon.max >= ext.max - PRECISION ? null : brouillon.max,
    });
  }

  function deplacer(borne, valeur) {
    const v = Number(valeur);
    setBrouillon((b) =>
      borne === 'min' ? { ...b, min: Math.min(v, b.max) } : { ...b, max: Math.max(v, b.min) },
    );
  }

  const position = (v) => (ext.max === ext.min ? 0 : ((v - ext.min) / (ext.max - ext.min)) * 100);
  const evenements = { onPointerUp: valider, onKeyUp: valider, onBlur: valider };

  return (
    <fieldset className="filtres__groupe">
      <legend className="filtres__titre">
        {titreComplet} ({unite})
      </legend>
      <p className="filtres__plage" id={`${id}-valeurs`} aria-live="polite">
        {formaterValeur(brouillon.min, unite)} – {formaterValeur(brouillon.max, unite)}
      </p>
      <div
        className="curseur"
        style={{
          '--debut': `${position(brouillon.min)}%`,
          '--fin': `${position(brouillon.max)}%`,
        }}
      >
        <input
          type="range"
          aria-label={`${titreComplet} : minimum`}
          aria-valuetext={formaterValeur(brouillon.min, unite)}
          min={ext.min}
          max={ext.max}
          step={pas}
          value={brouillon.min}
          disabled={ext.min === ext.max}
          onChange={(e) => deplacer('min', e.target.value)}
          {...evenements}
        />
        <input
          type="range"
          aria-label={`${titreComplet} : maximum`}
          aria-valuetext={formaterValeur(brouillon.max, unite)}
          min={ext.min}
          max={ext.max}
          step={pas}
          value={brouillon.max}
          disabled={ext.min === ext.max}
          onChange={(e) => deplacer('max', e.target.value)}
          {...evenements}
        />
      </div>
    </fieldset>
  );
}

function CasesACocher({ titre, valeurs, choisies, libelle = (v) => v, onBasculer }) {
  return (
    <fieldset className="filtres__groupe">
      <legend className="filtres__titre">{titre}</legend>
      {valeurs.length === 0 ? (
        <p className="filtres__vide">Aucune valeur disponible.</p>
      ) : (
        <ul className="filtres__cases">
          {valeurs.map((valeur) => (
            <li key={valeur}>
              <label className="filtres__case">
                <input
                  type="checkbox"
                  checked={choisies.includes(valeur)}
                  onChange={() => onBasculer(valeur)}
                />
                {libelle(valeur)}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function valeursChoix(cle, options) {
  if (cle === 'capitalisations') return options.capitalisations.map((t) => t.code);
  return options[cle];
}

function libelleChoix(cle, options) {
  if (cle !== 'capitalisations') return undefined;
  return (code) => options.capitalisations.find((t) => t.code === code)?.libelle ?? code;
}

function focusables(conteneur) {
  return [...conteneur.querySelectorAll('button, input:not([disabled])')];
}

export function PanneauFiltres({ filtres, options, total, onChange, onFermer, retour }) {
  const idTitre = useId();
  const fenetre = useRef(null);
  const boutonFermer = useRef(null);

  useEffect(() => {
    const declencheur = retour?.current;
    boutonFermer.current?.focus();
    return () => declencheur?.focus();
  }, [retour]);

  // Page du Catalogue figée tant que le panneau est ouvert : la molette sur le voile ou
  // au bout de la liste des filtres ne fait plus défiler les SCPI
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  function surTouche(evenement) {
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      onFermer();
    } else if (evenement.key === 'Tab' && fenetre.current) {
      // Focus gardé dans le panneau
      const elements = focusables(fenetre.current);
      const premier = elements[0];
      const dernier = elements.at(-1);
      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    }
  }

  const actifs = pastilles(filtres, options).length;

  return createPortal(
    <div
      className="filtres"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onFermer()}
      onKeyDown={surTouche}
    >
      <div
        ref={fenetre}
        className="filtres__panneau"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
      >
        <div className="filtres__haut">
          <h2 id={idTitre} className="filtres__entete">
            Filtres
          </h2>
          <button
            ref={boutonFermer}
            type="button"
            className="filtres__fermer"
            aria-label="Fermer les filtres"
            onClick={onFermer}
          >
            ×
          </button>
        </div>
        <div className="filtres__corps">
          {options ? (
            <>
              {CHOIX.map(({ cle, titre }) => (
                <CasesACocher
                  key={cle}
                  titre={titre}
                  valeurs={valeursChoix(cle, options)}
                  choisies={filtres[cle]}
                  libelle={libelleChoix(cle, options)}
                  onBasculer={(valeur) => onChange(basculer(filtres, cle, valeur))}
                />
              ))}
              {PLAGES.map(({ cle, titre, unite, pas }) =>
                options[cle]?.min == null || options[cle]?.max == null ? null : (
                  <CurseurPlage
                    key={cle}
                    titre={titre}
                    unite={unite}
                    pas={pas}
                    plage={filtres[cle]}
                    bornes={options[cle]}
                    anneeTaux={cle === 'taux' ? options.anneeTaux : undefined}
                    onChange={(plage) =>
                      onChange(changerPlage(filtres, cle, plage, extremites(options[cle], pas)))
                    }
                  />
                ),
              )}
            </>
          ) : (
            <p className="filtres__vide">Les filtres ne sont pas disponibles pour le moment.</p>
          )}
        </div>
        <div className="filtres__bas">
          <button
            type="button"
            className="compte__bouton compte__bouton--secondaire"
            disabled={actifs === 0}
            onClick={() => onChange(FILTRES_VIDES)}
          >
            Réinitialiser
          </button>
          <button type="button" className="compte__bouton" onClick={onFermer}>
            {total == null ? 'Voir les SCPI' : `Voir les ${total} SCPI`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Bouton d'ouverture du panneau, « Réinitialiser les filtres », puis une pastille par
// filtre actif (croix pour le retirer) (US-10c)
export function BarreFiltres({ filtres, options, onChange, onOuvrir, refBouton, ouvert }) {
  const liste = pastilles(filtres, options);
  return (
    <div className="barre-filtres">
      <button
        ref={refBouton}
        type="button"
        className="barre-filtres__bouton"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-label={liste.length > 0 ? `Filtres, ${liste.length} actifs` : undefined}
        onClick={onOuvrir}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filtres
        {liste.length > 0 && <span className="barre-filtres__nombre">{liste.length}</span>}
      </button>
      {liste.length > 0 && (
        <>
          <button
            type="button"
            className="barre-filtres__reinitialiser"
            onClick={() => onChange(FILTRES_VIDES)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
            </svg>
            Réinitialiser les filtres
          </button>
          <ul className="barre-filtres__pastilles" aria-label="Filtres actifs">
            {liste.map((p) => (
              <li key={p.id} className="pastille-filtre">
                {p.libelle}
                <button
                  type="button"
                  className="pastille-filtre__retirer"
                  aria-label={`Retirer le filtre ${p.libelle}`}
                  onClick={() => onChange(p.retirer(filtres))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
