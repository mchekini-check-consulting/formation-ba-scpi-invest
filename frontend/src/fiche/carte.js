// Carte de la répartition géographique (US-02) : pays du monde (world-atlas, 1:50 000 000),
// zoomée sur les pays où la SCPI est présente ; chaque pays présent est coloré selon sa
// part et porte une étiquette (nom et part). Calcul pur : le composant CartePays dessine.
import { geoArea, geoBounds, geoConicConformal, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

export const LARGEUR = 640;
export const HAUTEUR = 540;
const MARGE = 30;
// Étendue minimale (en degrés) : une SCPI présente dans un seul pays reste lisible
const ETENDUE_MIN = { lon: 16, lat: 11 };

// Point d'ancrage de l'étiquette de chaque pays (longitude, latitude) ; renvoi : étiquette
// déplacée en mer, reliée au pays par un trait (petits pays, pays voisins)
const ETIQUETTES = {
  250: { point: [2.4, 46.7] },
  276: { point: [10.4, 51.0] },
  724: { point: [-3.7, 40.1] },
  528: { point: [5.6, 52.3], renvoi: [4.4, 55.4] },
  372: { point: [-8.0, 53.1], renvoi: [-10.6, 50.2] },
  826: { point: [-1.6, 52.6], renvoi: [-5.8, 56.4] },
  380: { point: [12.6, 42.9] },
  620: { point: [-8.1, 39.6], renvoi: [-11.2, 41.6] },
  56: { point: [4.6, 50.6], renvoi: [1.6, 51.9] },
  616: { point: [19.2, 52.1] },
};

// France : métropole et Corse seulement (sans les territoires d'outre-mer)
function sansOutreMer(f) {
  if (Number(f.id) !== 250 || f.geometry.type !== 'MultiPolygon') return f;
  const coordinates = f.geometry.coordinates.filter(
    (poly) => poly[0][0][0] > -10 && poly[0][0][1] > 35,
  );
  return { ...f, geometry: { ...f.geometry, coordinates } };
}

// Partie principale d'un pays (plus grand polygone) : les îles lointaines (Açores,
// Madère, Canaries, Caraïbes néerlandaises...) n'élargissent pas le zoom
function partiePrincipale(f) {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const polygones = f.geometry.coordinates.map((coordinates) => ({
    type: 'Polygon',
    coordinates,
  }));
  return polygones.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
}

// Rectangle (longitudes, latitudes) qui contient tous les pays présents, élargi
function cadre(presents) {
  let [o, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of presents) {
    const [[o1, s1], [e1, n1]] = geoBounds(partiePrincipale(f));
    o = Math.min(o, o1);
    s = Math.min(s, s1);
    e = Math.max(e, e1);
    n = Math.max(n, n1);
  }
  const centre = [(o + e) / 2, (s + n) / 2];
  const demiLon = Math.max(e - o + 3, ETENDUE_MIN.lon) / 2;
  const demiLat = Math.max(n - s + 2, ETENDUE_MIN.lat) / 2;
  return [
    [centre[0] - demiLon, centre[1] - demiLat],
    [centre[0] + demiLon, centre[1] + demiLat],
  ];
}

const arrondi = (n) => Math.round(n * 10) / 10;

// topo : world-atlas countries-50m ; parts : [{ iso, nom, part, couleur }] (listePays) ;
// taille : dimensions du cadre de la carte à l'écran (la carte remplit tout le cadre).
// -> { fonds: [d], presents: [{ iso, d, couleur }], etiquettes: [{ x, y, nom, part, trait }] }
// Aucun pays connu de la carte : null (la liste suffit).
export function dessinerCarte(topo, parts, { largeur: L = LARGEUR, hauteur: H = HAUTEUR } = {}) {
  const parIso = new Map(parts.filter((p) => p.iso !== null).map((p) => [p.iso, p]));
  if (parIso.size === 0) return null;
  const monde = feature(topo, topo.objects.countries).features.map(sansOutreMer);
  const presents = monde.filter((f) => parIso.has(Number(f.id)));
  if (presents.length === 0) return null;

  const [[o, s], [e, n]] = cadre(presents);
  const projection = geoConicConformal()
    .rotate([-(o + e) / 2, 0])
    .parallels([s, n])
    .fitExtent(
      [
        [MARGE, MARGE],
        [L - MARGE, H - MARGE],
      ],
      {
        type: 'MultiPoint',
        coordinates: [
          [o, s],
          [e, s],
          [o, n],
          [e, n],
          [(o + e) / 2, n + 0.5],
        ],
      },
    );
  projection.clipExtent([
    [0, 0],
    [L, H],
  ]);
  const chemin = geoPath(projection).digits(1);

  const fonds = monde
    .filter((f) => !parIso.has(Number(f.id)))
    .map((f) => chemin(f))
    .filter(Boolean);
  const dessines = presents.map((f) => {
    const p = parIso.get(Number(f.id));
    return { iso: p.iso, d: chemin(f), couleur: p.couleur };
  });

  const etiquettes = presents.map((f) => {
    const p = parIso.get(Number(f.id));
    const reglage = ETIQUETTES[p.iso];
    const ancre = reglage ? projection(reglage.point) : chemin.centroid(f);
    const position = reglage?.renvoi ? projection(reglage.renvoi) : ancre;
    const largeur = Math.max(p.nom.length, 6) * 7.4 + 22;
    const x = Math.min(Math.max(position[0], largeur / 2 + 4), L - largeur / 2 - 4);
    const y = Math.min(Math.max(position[1], 26), H - 26);
    return {
      iso: p.iso,
      nom: p.nom,
      part: p.part,
      x: arrondi(x),
      y: arrondi(y),
      largeur: arrondi(largeur),
      trait: reglage?.renvoi ? { x: arrondi(ancre[0]), y: arrondi(ancre[1]) } : null,
    };
  });

  return { fonds, presents: dessines, etiquettes };
}

// Contours des pays, chargés à l'ouverture de la fiche seulement (fichier volumineux)
export function chargerMonde() {
  return import('world-atlas/countries-50m.json').then((m) => m.default ?? m);
}
