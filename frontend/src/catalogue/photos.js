// Photo d'illustration de chaque carte du Catalogue : 52 photos d'architecture libres de
// droits (CC0, sources dans photos/CREDITS.md). Elles ne représentent pas les biens réels
// des SCPI. Chaque SCPI du catalogue actuel a sa photo attitrée, choisie d'après son nom
// (même photo en local, sur dev et en qualif, quel que soit l'identifiant en base). Une
// SCPI qui n'est pas dans la liste (nouvelle SCPI) prend une photo d'après son identifiant.
const fichiers = import.meta.glob('./photos/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const PHOTOS = Object.keys(fichiers)
  .sort((a, b) => a.localeCompare(b))
  .map((chemin) => fichiers[chemin]);

// Nom de la SCPI -> numéro de la photo (fichier photos/scpi-<numéro>.webp)
const PHOTO_PAR_NOM = {
  'Transitions Europe': 43,
  Comète: 46,
  'Elevation Tertiom': 44,
  Upéka: 45,
  'Remake Live': 47,
  'Iroko Zen': 48,
  'Osmo Energie': 49,
  Sofidynamic: 50,
  'Wemo One': 51,
  'Ncap Continent': 26,
  'Novaxia NEO': 52,
  'Epargne Pierre Europe': 1,
  'Epsilon 360': 2,
  'Log In': 3,
  'Coeur de Regions': 4,
  'EDR Europa': 42,
  'Mistral Selection': 6,
  "Coeur d'Europe": 7,
  'Paref Evo': 8,
  'Altixia Cadence XII': 9,
  Activimmo: 10,
  'Paref Hexa': 11,
  "Coeur d'Avenir": 12,
  'Foncière des Praticiens': 13,
  'Altixia Commerces': 14,
  'Logipierre 3': 15,
  'Atream Hotels': 16,
  'Coeur de Ville': 17,
  'Epargne Pierre': 5,
  'Kyaneos Pierre': 18,
  'Pierval Sante': 19,
  Eurovalys: 20,
  Sofiboutique: 21,
  'Urban Coeur Commerce': 22,
  'Placement Pierre': 23,
  'Cristal Rente': 24,
  Immorente: 25,
  'Paref Prima': 27,
  'NCap Education Sante': 28,
  'Sofidy Europe Invest': 29,
  'Efimmo 1': 30,
  Ficommerce: 31,
  'Novapierre 1': 32,
  'Pierre Rendement': 33,
  Primovie: 34,
  Primopierre: 36,
  Selectipierre2: 37,
  "Cap'HebergImmo": 38,
  Buroboutic: 35,
  Primofamily: 39,
  'GMA Essentialis': 40,
  'Novapierre Residentiel': 41,
};

function rang(id) {
  const n = Number.isInteger(id) ? id : 0;
  return (((n - 1) % PHOTOS.length) + PHOTOS.length) % PHOTOS.length;
}

// Photo attitrée (d'après le nom), sinon d'après l'identifiant
function rangPrefere(id, nom) {
  const numero = Object.hasOwn(PHOTO_PAR_NOM, nom) ? PHOTO_PAR_NOM[nom] : null;
  return numero ? numero - 1 : rang(id);
}

export function photoScpi(id, nom) {
  return PHOTOS[rangPrefere(id, nom)];
}

// Photos d'une page de SCPI (identifiant -> photo), sans doublon sur la page : si deux
// SCPI tombent sur la même photo (nouvelles SCPI), la seconde prend la suivante encore libre.
export function photosPage(scpis) {
  const prises = new Set();
  const resultat = new Map();
  for (const { id, nom } of scpis) {
    let r = rangPrefere(id, nom);
    for (let essais = 0; prises.has(r) && essais < PHOTOS.length; essais++) {
      r = (r + 1) % PHOTOS.length;
    }
    prises.add(r);
    resultat.set(id, PHOTOS[r]);
  }
  return resultat;
}
