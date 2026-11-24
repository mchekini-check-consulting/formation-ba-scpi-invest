// Carte de la répartition géographique (US-02) : zoom sur les pays de la SCPI (carte.js).
// Décorative pour les lecteurs d'écran : les mêmes pays et parts sont écrits dans la
// liste juste en dessous. Contours chargés à l'affichage ; indisponibles : pas de carte.
import { useEffect, useMemo, useRef, useState } from 'react';
import { chargerMonde, dessinerCarte, HAUTEUR, LARGEUR } from './carte.js';
import { formaterPart } from './donnees.js';

export default function CartePays({ pays, charger = chargerMonde }) {
  const [monde, setMonde] = useState(null);
  // Carte dessinée aux dimensions de son cadre (toute la largeur du bloc) ; mesurées par
  // le navigateur (ResizeObserver), dimensions par défaut sinon
  const cadre = useRef(null);
  const [taille, setTaille] = useState({ largeur: LARGEUR, hauteur: HAUTEUR });

  useEffect(() => {
    const element = cadre.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observateur = new ResizeObserver(([entree]) => {
      const { width, height } = entree.contentRect;
      if (width > 0 && height > 0) {
        setTaille({ largeur: Math.round(width), hauteur: Math.round(height) });
      }
    });
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  useEffect(() => {
    let actif = true;
    charger()
      .then((topo) => actif && setMonde(topo))
      .catch(() => actif && setMonde(null));
    return () => {
      actif = false;
    };
  }, [charger]);

  const carte = useMemo(
    () => (monde ? dessinerCarte(monde, pays, taille) : null),
    [monde, pays, taille],
  );

  return (
    <div ref={cadre} className="fiche__cadre-carte">
      {carte && <Dessin carte={carte} taille={taille} />}
    </div>
  );
}

function Dessin({ carte, taille: { largeur, hauteur } }) {
  return (
    <svg
      className="fiche__carte"
      viewBox={`0 0 ${largeur} ${hauteur}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="fiche-mer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eaf1ff" />
          <stop offset="1" stopColor="#dff3f6" />
        </linearGradient>
        <filter id="fiche-ombre" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f1f45" floodOpacity="0.22" />
        </filter>
      </defs>
      <rect width={largeur} height={hauteur} fill="url(#fiche-mer)" />
      {carte.fonds.map((d, i) => (
        <path key={i} d={d} fill="#e3e7ee" stroke="#ffffff" strokeWidth="0.8" />
      ))}
      <g filter="url(#fiche-ombre)">
        {carte.presents.map((p) => (
          <path
            key={p.iso}
            d={p.d}
            fill={p.couleur}
            stroke="#ffffff"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        ))}
      </g>
      {carte.etiquettes.map((e) => (
        <g key={e.iso}>
          {e.trait && (
            <>
              <line
                x1={e.trait.x}
                y1={e.trait.y}
                x2={e.x}
                y2={e.y}
                stroke="#0f1f45"
                strokeWidth="1.4"
              />
              <circle
                cx={e.trait.x}
                cy={e.trait.y}
                r="4"
                fill="#fff"
                stroke="#0f1f45"
                strokeWidth="2"
              />
            </>
          )}
          <rect
            x={e.x - e.largeur / 2}
            y={e.y - 22}
            width={e.largeur}
            height="44"
            rx="13"
            fill="#ffffff"
            filter="url(#fiche-ombre)"
          />
          <text x={e.x} y={e.y - 4} textAnchor="middle" className="fiche__carte-nom">
            {e.nom}
          </text>
          <text x={e.x} y={e.y + 14} textAnchor="middle" className="fiche__carte-part">
            {formaterPart(e.part)}
          </text>
        </g>
      ))}
    </svg>
  );
}
