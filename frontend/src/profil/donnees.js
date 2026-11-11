// Page Profil (lecture seule) : informations de l'investisseur réunies depuis le backend
//   GET /connaissance-client          -> réponses du KYC et date de validation
//   GET /connaissance-client/pieces   -> pièces justificatives déposées
//   GET /formulaire-investisseur/profil -> profil investisseur et date de validation
//   GET /informations-personnelles     -> e-mail du compte et historique des modifications (US-06)
// Le KYC est indispensable (la page est réservée aux KYC validés, ExigerKycComplete) ;
// les pièces et le profil investisseur sont facultatifs : leur absence n'empêche pas
// l'affichage du reste.
import { utilisateurConnecte } from '../auth.js';
import { lireProfil } from '../investisseur/api.js';
import { PROFILS } from '../investisseur/profils.js';
import { listerPieces, lireKyc } from '../kyc/api.js';
import { lireInformations } from './informations.js';
import { ETAPES, champsVisibles, reponseLisible } from '../kyc/etapes.js';
import { STATUTS, piecesAttendues } from '../kyc/pieces.js';

// Ordre de la jauge Prudent -> Dynamique (maquette C)
export const ORDRE_PROFILS = ['prudent', 'equilibre', 'dynamique'];

export async function chargerProfil({
  lireUtilisateur = utilisateurConnecte,
  lireLeKyc = lireKyc,
  lirePieces = listerPieces,
  lireLeProfil = lireProfil,
  lireLesInformations = lireInformations,
} = {}) {
  // Session expirée (401) : remontée telle quelle, l'écran renvoie vers la connexion
  const facultatif = (promesse) =>
    promesse.catch((err) => {
      if (err?.status === 401) throw err;
      return null;
    });
  const [utilisateur, kyc, pieces, profil, informations] = await Promise.all([
    facultatif(lireUtilisateur()),
    lireLeKyc(),
    facultatif(lirePieces()),
    facultatif(lireLeProfil()),
    // US-06 : e-mail du compte et historique ; absent, les blocs restent en lecture seule
    facultatif(lireLesInformations()),
  ]);
  return { utilisateur, kyc, pieces, profil, informations };
}

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// « 4 novembre 2026 » ; '' si la date est absente ou illisible
export function dateLongue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATE_LONGUE.format(date);
}

function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

// Carte d'identité (colonne de gauche)
export function identite({ utilisateur, kyc }) {
  const reponses = kyc?.reponses ?? {};
  return {
    nomComplet: [texte(reponses.prenom), texte(reponses.nom)].filter(Boolean).join(' '),
    email: utilisateur?.email ?? texte(reponses.email),
  };
}

// Profil investisseur affiché ; null s'il n'est pas encore validé
export function profilInvestisseur(profil) {
  if (!profil?.valideLe || !PROFILS[profil.profil]) return null;
  return {
    code: profil.profil,
    position: ORDRE_PROFILS.indexOf(profil.profil),
    valideLe: dateLongue(profil.valideLe),
    // US-05d : profil de plus de 24 mois ou questionnaire modifié
    aMettreAJour: profil.aMettreAJour === true,
    ...PROFILS[profil.profil],
  };
}

// Rubriques du KYC (Identité, Coordonnées, Situation, Déclarations), avec les mêmes
// libellés et la même mise en forme que le récapitulatif du KYC
export function rubriques(reponses = {}) {
  return ETAPES.filter((etape) => etape.champs.length > 0).map((etape) => ({
    id: etape.id,
    titre: etape.titre,
    lignes: champsVisibles(etape, reponses).map((champ) => ({
      cle: champ.nom,
      libelle: champ.libelle,
      valeur: reponseLisible(champ, reponses[champ.nom], reponses),
    })),
  }));
}

// Pièces demandées par le KYC ; une pièce facultative n'apparaît que si elle a été déposée
export function piecesAffichees(reponses = {}, pieces = []) {
  return piecesAttendues(reponses)
    .map((attendue) => {
      const deposee = pieces.find((p) => p.type === attendue.type);
      return {
        type: attendue.type,
        libelle: attendue.libelle,
        obligatoire: attendue.obligatoire,
        nomFichier: deposee?.nomFichier ?? '',
        deposeLe: dateLongue(deposee?.deposeLe),
        statut: deposee ? (STATUTS[deposee.statut] ?? STATUTS.deposee) : 'Non fournie',
        fournie: Boolean(deposee),
      };
    })
    .filter((piece) => piece.obligatoire || piece.fournie);
}

// « 2 / 2 » : pièces obligatoires déposées sur pièces obligatoires demandées
export function compteurPieces(liste) {
  const obligatoires = liste.filter((p) => p.obligatoire);
  return `${obligatoires.filter((p) => p.fournie).length} / ${obligatoires.length}`;
}
