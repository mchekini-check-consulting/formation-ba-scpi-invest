// US-09 (SCPI-258), règles 10 à 12 : répartitions de la simulation pour les graphiques
import { couleurPays, couleurSecteur, pays } from '../fiche/donnees.js';
import { NUE_PROPRIETE, USUFRUIT } from './calculs.js';

export const PARTS_MAX = 8;
export const AUTRES = 'Autres';

// Couleurs des parts, de la plus forte à la plus faible : celles des secteurs de la fiche
// US-02 (couleurSecteur), complétées jusqu'à 8 ; « Autres » en gris
const COULEURS = [...Array.from({ length: 6 }, (_, i) => couleurSecteur(i)), '#1fb5d1', '#5b2ee6'];
const GRIS = '#b4b9c6';

const arrondir = (n) => Math.round(n * 100) / 100;

// Règle 11 : part d'un pays (ou secteur) = somme sur les lignes de (montant × part dans la
// SCPI) ÷ montant des lignes prises en compte. Règle 12 : une SCPI sans répartition est
// exclue du calcul et signalée (sansRepartition : noms). Règle 10 : de la plus forte à la
// plus faible, au-delà de 8 les plus petites réunies dans « Autres ».
// lignes : [{ scpi, montant }] (lignes « ok ») ; cle : 'pays' ou 'secteurs'
export function repartition(lignes, cle) {
  const nom = cle === 'pays' ? (libelle) => pays(libelle).nom : (libelle) => libelle;
  const avec = lignes.filter((l) => l.scpi[cle]?.length > 0 && l.montant > 0);
  const sansRepartition = [
    ...new Set(lignes.filter((l) => !(l.scpi[cle]?.length > 0)).map((l) => l.scpi.nom)),
  ];
  const total = avec.reduce((s, l) => s + l.montant, 0);
  const sommes = new Map();
  for (const { scpi, montant } of avec) {
    for (const { libelle, part } of scpi[cle]) {
      const n = nom(libelle);
      sommes.set(n, (sommes.get(n) ?? 0) + (montant * part) / 100);
    }
  }
  const triees = [...sommes]
    .map(([n, somme]) => ({ nom: n, part: total > 0 ? (somme / total) * 100 : 0 }))
    .sort((a, b) => b.part - a.part || a.nom.localeCompare(b.nom, 'fr'));
  // « Autres » du référentiel : toujours réuni avec les plus petites parts, en dernier
  const autresReferentiel = triees.filter((p) => p.nom === AUTRES);
  const nommees = triees.filter((p) => p.nom !== AUTRES);
  const gardees = nommees.slice(0, PARTS_MAX);
  const reste = [...nommees.slice(PARTS_MAX), ...autresReferentiel];
  // Pays : comme la fiche US-02 (carte), code ISO pour la carte et couleur selon la part ;
  // secteurs : couleurs du camembert de la fiche, avec un point dans la légende
  const habiller =
    cle === 'pays'
      ? (p) => ({
          ...p,
          iso: p.nom === AUTRES ? null : pays(p.nom).iso,
          couleur: couleurPays(p.part),
        })
      : (p, i) => ({ ...p, couleur: p.nom === AUTRES ? GRIS : COULEURS[i], point: true });
  const parts = gardees.map((p) => ({ ...p, part: arrondir(p.part) }));
  if (reste.length > 0) {
    parts.push({ nom: AUTRES, part: arrondir(reste.reduce((s, p) => s + p.part, 0)) });
  }
  return { parts: parts.map(habiller), sansRepartition };
}

// Revenus annuels par SCPI (barres) : brut, et après fiscalité avec le taux d'impôt de
// chaque ligne (tauxImpot, null tant que l'impôt n'est pas connu : net null), en année
// pleine. Lignes d'une même SCPI et d'un même type réunies ; chaque démembrement a sa barre
// et ses mentions (années précises, décision BA) :
//   - usufruit : revenu dès l'année 1, jusqu'à la fin du démembrement, puis aucun ;
//   - nue-propriété : revenu après la fin du démembrement, 0 s'il ne se termine pas pendant
//     le placement (« Pas de revenu »).
// Chaque ligne a sa durée de placement (décision BA) : les lignes d'une même SCPI ne sont
// réunies que si elles ont aussi la même durée.
// lignes : { scpi, type, demembrement, duree, revenuAnnuel, tauxImpot } ; cle : unique.
export function revenusParScpi(lignes) {
  const barres = new Map();
  for (const { scpi, type, demembrement = 0, duree, revenuAnnuel, tauxImpot } of lignes) {
    const demembree = type === USUFRUIT || type === NUE_PROPRIETE;
    const revenu = type === NUE_PROPRIETE && demembrement >= duree ? 0 : revenuAnnuel;
    const cle = demembree
      ? `${scpi.nom} · ${type} ${demembrement} · ${duree}`
      : `${scpi.nom} · ${duree}`;
    const barre = barres.get(cle) ?? {
      cle,
      nom: scpi.nom,
      mentions: mentions(type, demembrement, duree),
      brut: 0,
      net: 0,
    };
    barre.brut += revenu;
    barre.net =
      barre.net === null || tauxImpot === null ? null : barre.net + revenu * (1 - tauxImpot);
    barres.set(cle, barre);
  }
  return [...barres.values()]
    .map((b) => ({ ...b, brut: arrondir(b.brut), net: b.net === null ? null : arrondir(b.net) }))
    .sort((a, b) => b.brut - a.brut || a.cle.localeCompare(b.cle, 'fr'));
}

function mentions(type, demembrement, duree) {
  if (type === USUFRUIT) {
    return demembrement < duree
      ? [
          `Usufruit, de l’année 1 à l’année ${demembrement}`,
          '(fin du démembrement), puis aucun revenu',
        ]
      : [`Usufruit, de l’année 1 à l’année ${duree}`];
  }
  if (type === NUE_PROPRIETE) {
    return demembrement < duree
      ? [
          `Nue-propriété, de l’année ${demembrement + 1} à l’année ${duree}`,
          `(fin du démembrement : année ${demembrement})`,
        ]
      : [`Nue-propriété, démembrement de ${demembrement} ans`];
  }
  return [duree === 1 ? 'Année 1' : `De l’année 1 à l’année ${duree}`];
}

// Texte coupé entre deux mots en lignes d'au plus « longueur » caractères (un mot plus long
// reste entier sur sa ligne) : libellés sous les barres, à la largeur de leur colonne
export function couperTexte(texte, longueur) {
  const lignes = [];
  for (const mot of texte.split(' ')) {
    const derniere = lignes.at(-1);
    if (derniere !== undefined && `${derniere} ${mot}`.length <= longueur) {
      lignes[lignes.length - 1] = `${derniere} ${mot}`;
    } else {
      lignes.push(mot);
    }
  }
  return lignes;
}

// Nom en entier, sur deux lignes au plus (coupé entre deux mots s'il est long)
export function lignesDuNom(nom, longueur = 22) {
  if (nom.length <= longueur) return [nom];
  const mots = nom.split(' ');
  let premiere = '';
  while (mots.length > 1 && `${premiere} ${mots[0]}`.trim().length <= longueur) {
    premiere = `${premiere} ${mots.shift()}`.trim();
  }
  return premiere ? [premiere, mots.join(' ')] : [nom];
}

// Libellés sous les barres d'une SCPI, coupés à la largeur de sa colonne (caracteres par
// ligne) : nom (deux lignes au plus quand la colonne est large) et mentions du démembrement
export function libellesSousBarre(barre, caracteres) {
  return {
    nom: lignesDuNom(barre.nom).flatMap((ligne) => couperTexte(ligne, caracteres)),
    mentions: barre.mentions.flatMap((m) => couperTexte(m, caracteres)),
  };
}
