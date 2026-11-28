// Carte de la répartition géographique de la simulation (US-09) : même dessin que la carte
// de la fiche US-02 (dessinerCarte de fiche/carte.js, réutilisé sans le modifier), mais sans
// étiquettes posées sur les pays (décision BA : elles cachaient les pays). Le nom et la part
// d'un pays s'affichent dans une bulle au survol (souris) ou au toucher (mobile) ; toutes
// les parts restent écrites dans la légende sous la carte, pour tous les lecteurs.
import { useEffect, useMemo, useRef, useState } from 'react';
import { chargerMonde, dessinerCarte, HAUTEUR, LARGEUR } from '../fiche/carte.js';
import { formaterPart } from '../fiche/donnees.js';

export default function CarteSimulation({ pays, charger = chargerMonde }) {
  const [monde, setMonde] = useState(null);
  const [actif, setActif] = useState(null);
  // Carte dessinée aux dimensions de son cadre, mesurées par le navigateur
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
    let enCours = true;
    charger()
      .then((topo) => enCours && setMonde(topo))
      .catch(() => enCours && setMonde(null));
    return () => {
      enCours = false;
    };
  }, [charger]);

  const carte = useMemo(
    () => (monde ? dessinerCarte(monde, pays, taille) : null),
    [monde, pays, taille],
  );
  // Nom, part et position de la bulle de chaque pays (centre du pays sur la carte)
  const infos = new Map((carte?.etiquettes ?? []).map((e) => [e.iso, e]));
  const bulle = actif === null ? null : infos.get(actif);

  return (
    <div ref={cadre} className="fiche__cadre-carte simulation__cadre-carte">
      {carte && (
        <svg
          className="fiche__carte"
          viewBox={`0 0 ${taille.largeur} ${taille.hauteur}`}
          aria-hidden="true"
          focusable="false"
          onPointerLeave={() => setActif(null)}
        >
          <defs>
            <linearGradient id="simulation-mer" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#eaf1ff" />
              <stop offset="1" stopColor="#dff3f6" />
            </linearGradient>
            <filter id="simulation-ombre" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="3"
                stdDeviation="4"
                floodColor="#0f1f45"
                floodOpacity="0.22"
              />
            </filter>
          </defs>
          <rect
            width={taille.largeur}
            height={taille.hauteur}
            fill="url(#simulation-mer)"
            onClick={() => setActif(null)}
          />
          {carte.fonds.map((d, i) => (
            <path key={i} d={d} fill="#e3e7ee" stroke="#ffffff" strokeWidth="0.8" />
          ))}
          <g filter="url(#simulation-ombre)">
            {carte.presents.map((p) => (
              <path
                key={p.iso}
                d={p.d}
                fill={p.couleur}
                stroke={p.iso === actif ? '#0f1f45' : '#ffffff'}
                strokeWidth={p.iso === actif ? 2 : 1.4}
                strokeLinejoin="round"
                className="simulation__pays"
                data-iso={p.iso}
                onPointerEnter={() => setActif(p.iso)}
                onClick={() => setActif(p.iso)}
              />
            ))}
          </g>
        </svg>
      )}
      {bulle && (
        <div
          className="simulation__bulle-carte"
          style={{ left: `${bulle.x}px`, top: `${bulle.y}px` }}
          aria-hidden="true"
        >
          {bulle.nom} · <strong>{formaterPart(bulle.part)}</strong>
        </div>
      )}
    </div>
  );
}
