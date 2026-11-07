// Photo d'illustration de chaque carte du Catalogue : 52 photos d'architecture libres de
// droits (CC0, sources dans photos/CREDITS.md). Elles ne représentent pas les biens réels
// des SCPI. Chaque SCPI garde toujours la même photo, choisie d'après son identifiant :
// 52 SCPI d'identifiants qui se suivent -> 52 photos différentes.
const fichiers = import.meta.glob('./photos/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const PHOTOS = Object.keys(fichiers)
  .sort((a, b) => a.localeCompare(b))
  .map((chemin) => fichiers[chemin]);

function rang(id) {
  const n = Number.isInteger(id) ? id : 0;
  return (((n - 1) % PHOTOS.length) + PHOTOS.length) % PHOTOS.length;
}

export function photoScpi(id) {
  return PHOTOS[rang(id)];
}

// Photos d'une page de SCPI (identifiant -> photo), sans doublon sur la page : si deux
// SCPI tombent sur la même photo (identifiants espacés de 52, ou trous laissés par les
// imports), la seconde prend la photo suivante encore libre.
export function photosPage(scpis) {
  const prises = new Set();
  const resultat = new Map();
  for (const { id } of scpis) {
    let r = rang(id);
    for (let essais = 0; prises.has(r) && essais < PHOTOS.length; essais++) {
      r = (r + 1) % PHOTOS.length;
    }
    prises.add(r);
    resultat.set(id, PHOTOS[r]);
  }
  return resultat;
}
