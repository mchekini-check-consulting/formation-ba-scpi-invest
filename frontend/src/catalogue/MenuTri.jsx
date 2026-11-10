// Menu « Trier par » du Catalogue (US-11), fait sur mesure pour reprendre le style du site
// (bouton arrondi comme « Filtres » et la recherche, liste comme celle des pays du KYC).
// Bouton qui ouvre une liste de choix (rôle listbox), regroupés par critère, tri actif
// coché. Clavier : flèches haut / bas sur le bouton pour ouvrir ; dans la liste, flèches,
// Début / Fin, Entrée ou Espace pour choisir, Échap pour fermer (focus rendu au bouton).
// Clic en dehors : fermée.
import { useEffect, useId, useRef, useState } from 'react';
import { GROUPES_TRI, OPTIONS_TRI, libelleTri } from './tri.js';
import './tri.css';

const TRACES = {
  chevron: 'M6 9l6 6 6-6',
  coche: 'M5 12.5l4.5 4.5L19 7.5',
};

function Trace({ nom, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={TRACES[nom]} />
    </svg>
  );
}

export default function MenuTri({ tri, onChange }) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(tri);
  const zone = useRef(null);
  const bouton = useRef(null);
  const liste = useRef(null);
  const idListe = `${id}-liste`;
  const idOption = (valeur) => `${id}-${valeur}`;
  const libelle = libelleTri(tri);

  function ouvrir() {
    setActif(tri);
    setOuvert(true);
  }

  function fermer() {
    setOuvert(false);
    bouton.current?.focus();
  }

  function choisir(valeur) {
    fermer();
    if (valeur !== tri) onChange(valeur);
  }

  // Liste ouverte : elle reçoit le focus ; un clic en dehors la ferme
  useEffect(() => {
    if (!ouvert) return undefined;
    liste.current?.focus();
    const dehors = (e) => {
      if (!zone.current?.contains(e.target)) setOuvert(false);
    };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [ouvert]);

  // Option active toujours visible quand la liste défile
  useEffect(() => {
    if (!ouvert) return;
    document.getElementById(`${id}-${actif}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [ouvert, actif, id]);

  function deplacer(pas) {
    const i = OPTIONS_TRI.findIndex((o) => o.valeur === actif);
    const j = Math.min(OPTIONS_TRI.length - 1, Math.max(0, i + pas));
    setActif(OPTIONS_TRI[j].valeur);
  }

  function toucheListe(e) {
    if (e.key === 'Tab') {
      setOuvert(false);
      return;
    }
    const actions = {
      ArrowDown: () => deplacer(1),
      ArrowUp: () => deplacer(-1),
      Home: () => setActif(OPTIONS_TRI[0].valeur),
      End: () => setActif(OPTIONS_TRI[OPTIONS_TRI.length - 1].valeur),
      Enter: () => choisir(actif),
      ' ': () => choisir(actif),
      Escape: fermer,
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  }

  function toucheBouton(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      ouvrir();
    }
  }

  return (
    <div className="menu-tri" ref={zone}>
      <button
        ref={bouton}
        type="button"
        className="menu-tri__bouton"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idListe : undefined}
        aria-label={`Trier par : ${libelle}`}
        onClick={() => (ouvert ? fermer() : ouvrir())}
        onKeyDown={toucheBouton}
      >
        <span className="menu-tri__valeur">{libelle}</span>
        <Trace nom="chevron" className="menu-tri__chevron" />
      </button>
      {ouvert && (
        <div
          ref={liste}
          id={idListe}
          role="listbox"
          tabIndex={-1}
          aria-label="Trier par"
          aria-activedescendant={idOption(actif)}
          className="menu-tri__liste"
          onKeyDown={toucheListe}
        >
          {GROUPES_TRI.map((groupe) => (
            <div
              key={groupe.critere}
              role="group"
              aria-labelledby={`${id}-groupe-${groupe.critere}`}
              className="menu-tri__groupe"
            >
              <div id={`${id}-groupe-${groupe.critere}`} className="menu-tri__titre">
                {groupe.titre}
              </div>
              {groupe.options.map((option) => (
                <div
                  key={option.valeur}
                  id={idOption(option.valeur)}
                  role="option"
                  aria-selected={option.valeur === tri}
                  aria-label={option.libelle}
                  data-actif={option.valeur === actif}
                  className="menu-tri__option"
                  onClick={() => choisir(option.valeur)}
                  onMouseEnter={() => setActif(option.valeur)}
                >
                  <Trace nom="coche" className="menu-tri__coche" />
                  {option.court}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
