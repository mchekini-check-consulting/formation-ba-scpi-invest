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
  MODES,
  AUCUN_CASHBACK,
  MODE_PAR_DEFAUT,
  NOMBRE_VISIBLE,
  OPTIONS,
  PLAGES,
  POURCENTAGES_CASHBACK,
  basculer,
  basculerTousCashbacks,
  changerPlage,
  formaterValeur,
  groupesActifs,
  libelleCashback,
  pastilles,
  phraseRecherche,
  regle,
  tousLesCashbacks,
  valeursVisibles,
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
    // Valeur ramenée sur le cran le plus proche (évite 3,0000000004 %)
    const v = arrondir(Number(valeur), pas);
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

// Choix de la combinaison des cases (catégorie, pays) : au moins un, tous, uniquement
function ChoixMode({ titre, valeur, onChange }) {
  return (
    <div className="filtres__modes" role="group" aria-label={`Combinaison des cases ${titre}`}>
      {MODES.map(({ code, libelle }) => (
        <button
          key={code}
          type="button"
          className="filtres__mode"
          aria-pressed={valeur === code}
          onClick={() => onChange(code)}
        >
          {libelle}
        </button>
      ))}
    </div>
  );
}

function CasesACocher({
  titre,
  valeurs,
  choisies,
  libelle = (v) => v,
  onBasculer,
  mode,
  valeurMode = MODE_PAR_DEFAUT,
  onMode,
  colonnes = false,
  recherche = false,
}) {
  const idListe = useId();
  const [texte, setTexte] = useState('');
  const [tout, setTout] = useState(false);
  const { visibles, cachees } = recherche
    ? valeursVisibles(valeurs, { choisies, texte, tout, libelle })
    : { visibles: valeurs, cachees: 0 };

  // Échap dans la recherche : vide le champ d'abord, ferme le panneau ensuite
  function surTouche(evenement) {
    if (evenement.key === 'Escape' && texte) {
      evenement.stopPropagation();
      setTexte('');
    }
  }

  return (
    <fieldset className="filtres__groupe">
      <legend className="filtres__titre">{titre}</legend>
      {mode && <ChoixMode titre={titre} valeur={valeurMode} onChange={onMode} />}
      <p className="filtres__regle">{regle(valeurMode, mode?.nom)}</p>
      {recherche && valeurs.length > NOMBRE_VISIBLE && (
        <input
          type="search"
          className="filtres__chercher"
          placeholder={`Rechercher parmi ${valeurs.length}…`}
          aria-label={`Rechercher : ${titre}`}
          aria-controls={idListe}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={surTouche}
        />
      )}
      {valeurs.length === 0 && <p className="filtres__vide">Aucune valeur disponible.</p>}
      {valeurs.length > 0 && visibles.length === 0 && (
        <p className="filtres__vide" role="status">
          Aucun résultat pour « {texte.trim()} ».
        </p>
      )}
      {visibles.length > 0 && (
        <ul
          id={idListe}
          className={colonnes ? 'filtres__cases filtres__cases--colonnes' : 'filtres__cases'}
        >
          {visibles.map((valeur) => (
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
      {recherche && !texte.trim() && (cachees > 0 || tout) && (
        <button
          type="button"
          className="filtres__plus"
          aria-expanded={tout}
          aria-controls={idListe}
          onClick={() => setTout(!tout)}
        >
          {tout ? 'Voir moins' : `Voir les ${valeurs.length}`}
        </button>
      )}
    </fieldset>
  );
}

// SCPI-252 : pastilles du cashback sur une ligne : « Aucun cashback », 1 à 5 %, puis
// « Tous les cashbacks » (tous les pourcentages) ; plusieurs choix -> au moins un (OU) ;
// aucun choix -> pas de filtre sur le cashback
function PastillesCashback({ titre, choisies, onBasculer, onTous }) {
  const bouton = (cle, libelle, choisi, onClick) => (
    <button
      key={cle}
      type="button"
      className="filtres__bouton"
      aria-pressed={choisi}
      onClick={onClick}
    >
      {libelle}
    </button>
  );
  return (
    <fieldset className="filtres__groupe">
      <legend className="filtres__titre">{titre}</legend>
      <p className="filtres__regle">Plusieurs choix : au moins un (OU)</p>
      <div className="filtres__boutons">
        {[AUCUN_CASHBACK, ...POURCENTAGES_CASHBACK].map((valeur) =>
          bouton(valeur, libelleCashback(valeur), choisies.includes(valeur), () =>
            onBasculer(valeur),
          ),
        )}
        {bouton('tous', 'Tous les cashbacks', tousLesCashbacks(choisies), onTous)}
      </div>
    </fieldset>
  );
}

function valeursChoix(cle, options) {
  if (cle === 'capitalisations') return options.capitalisations.map((t) => t.code);
  return options[cle] ?? [];
}

// Cases « possible » (démembrement, versement programmé) : cochée = seulement les SCPI
// qui proposent l'option
function CasesOptions({ filtres, onChange }) {
  return (
    <fieldset className="filtres__groupe">
      <legend className="filtres__titre">Options</legend>
      <ul className="filtres__cases">
        {OPTIONS.map(({ cle, titre }) => (
          <li key={cle}>
            <label className="filtres__case">
              <input
                type="checkbox"
                checked={filtres[cle]}
                onChange={() => onChange({ ...filtres, [cle]: !filtres[cle] })}
              />
              {titre}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function libelleChoix(cle, options) {
  if (cle !== 'capitalisations') return undefined;
  return (code) => options.capitalisations.find((t) => t.code === code)?.libelle ?? code;
}

// Résumé des filtres choisis, en bas du panneau : les critères reliés par ET
function VotreRecherche({ filtres, options }) {
  const parties = phraseRecherche(filtres, options);
  return (
    <p className="filtres__recherche" aria-live="polite">
      <span className="filtres__recherche-titre">Votre recherche</span>
      {parties.length === 0
        ? 'Toutes les SCPI'
        : parties.map((morceaux, i) => (
            <span key={i}>
              {i > 0 && (
                <>
                  {' '}
                  <span className="filtres__et">ET</span>{' '}
                </>
              )}
              {morceaux.map((m, j) =>
                typeof m === 'string' ? (
                  m
                ) : (
                  <span key={j} className="filtres__ou">
                    {m.liaison}
                  </span>
                ),
              )}
            </span>
          ))}
    </p>
  );
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
              {CHOIX.filter((c) => !c.boutons).map(({ cle, titre, mode, colonnes, recherche }) => (
                <CasesACocher
                  key={cle}
                  colonnes={colonnes}
                  recherche={recherche}
                  titre={titre}
                  valeurs={valeursChoix(cle, options)}
                  choisies={filtres[cle]}
                  libelle={libelleChoix(cle, options)}
                  onBasculer={(valeur) => onChange(basculer(filtres, cle, valeur))}
                  mode={mode}
                  valeurMode={mode ? filtres[mode.cle] : undefined}
                  onMode={mode ? (code) => onChange({ ...filtres, [mode.cle]: code }) : undefined}
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
              <PastillesCashback
                titre="Cashback"
                choisies={filtres.cashback}
                onBasculer={(valeur) => onChange(basculer(filtres, 'cashback', valeur))}
                onTous={() => onChange(basculerTousCashbacks(filtres))}
              />
              <CasesOptions filtres={filtres} onChange={onChange} />
            </>
          ) : (
            <p className="filtres__vide">Les filtres ne sont pas disponibles pour le moment.</p>
          )}
        </div>
        {options && <VotreRecherche filtres={filtres} options={options} />}
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

// Bouton « Filtres » : ouvre le panneau, avec le nombre de filtres actifs. Placé
// dans la ligne des outils, entre la recherche et le tri.
export function BoutonFiltres({ filtres, options, onOuvrir, refBouton, ouvert }) {
  const actifs = pastilles(filtres, options).length;
  return (
    <button
      ref={refBouton}
      type="button"
      className="barre-filtres__bouton"
      aria-haspopup="dialog"
      aria-expanded={ouvert}
      aria-label={actifs > 0 ? `Filtres, ${actifs} actifs` : undefined}
      onClick={onOuvrir}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 6h16M7 12h10M10 18h4" />
      </svg>
      Filtres
      {actifs > 0 && <span className="barre-filtres__nombre">{actifs}</span>}
    </button>
  );
}

// Sous la ligne des outils, seulement si des filtres sont actifs : « Réinitialiser les
// filtres », puis une pastille par filtre actif (croix pour le retirer) (US-10c)
function Pastille({ pastille, filtres, onChange }) {
  return (
    <li className="pastille-filtre">
      {pastille.libelle}
      <button
        type="button"
        className="pastille-filtre__retirer"
        aria-label={`Retirer le filtre ${pastille.libelle}`}
        onClick={() => onChange(pastille.retirer(filtres))}
      >
        ×
      </button>
    </li>
  );
}

export function FiltresActifs({ filtres, options, onChange }) {
  const groupes = groupesActifs(filtres, options);
  if (groupes.length === 0) return null;
  return (
    <div className="barre-filtres">
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
      {/* Une bulle par critère à choix multiple (nom court, « Uniquement » si ce mode
          est choisi, ses pastilles), un trait entre les critères ; plages et cases
          « possible » : une pastille seule. La phrase du panneau détaille les ET / OU. */}
      <ul className="barre-filtres__groupes" aria-label="Filtres actifs">
        {groupes.map((groupe) =>
          groupe.titre ? (
            <li key={groupe.id} className="groupe-actif">
              <span className="groupe-actif__nom">{groupe.court}</span>
              {groupe.mode.code === 'uniquement' && (
                <span className="groupe-actif__mode">Uniquement</span>
              )}
              <ul className="groupe-actif__pastilles" aria-label={groupe.titre}>
                {groupe.pastilles.map((p) => (
                  <Pastille key={p.id} pastille={p} filtres={filtres} onChange={onChange} />
                ))}
              </ul>
            </li>
          ) : (
            <Pastille
              key={groupe.id}
              pastille={groupe.pastilles[0]}
              filtres={filtres}
              onChange={onChange}
            />
          ),
        )}
      </ul>
    </div>
  );
}
