import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import {
  EmailDejaUtilise,
  type CompteCree,
  type FournisseurIdentite,
} from '../auth/fournisseur.js';
import { HttpError } from '../logging/http-error.js';
import { businessLog, logger } from '../logging/logger.js';
import { loggable } from '../logging/service.js';
import { emailValide, reglesNonRespectees } from './mot-de-passe.js';

// Version des CGU en vigueur, enregistrée avec chaque acceptation (US-02a).
// À changer à chaque nouvelle version des CGU fournie par le juridique.
export const VERSION_CGU = '1.0';

export type DemandeCreation = {
  email?: unknown;
  motDePasse?: unknown;
  confirmation?: unknown;
  cguAcceptees?: unknown;
};

export type DemandeConnexion = { email?: unknown; motDePasse?: unknown };

export const IDENTIFIANTS_INCORRECTS = 'Email ou mot de passe incorrect';

export type DepotAcceptationsCgu = {
  enregistrer(utilisateurId: string, versionCgu: string, accepteeLe: Date): Promise<void>;
};

// US-03b : 5 échecs à la suite bloquent l'email 10 minutes. Des échecs plus vieux que
// 10 minutes sont oubliés (le compteur repart à 1).
export const ECHECS_AVANT_BLOCAGE = 5;
export const DUREE_BLOCAGE_MS = 10 * 60_000;
export const TROP_DE_TENTATIVES = 'Trop de tentatives : votre compte est bloqué.';

export type RegleBlocage = { echecsAvantBlocage: number; dureeMs: number };

// Essais de connexion par email (cle = empreinte de l'email, jamais l'email en clair).
// Chaque essai est compté AVANT la vérification du mot de passe : des essais envoyés
// en même temps ne peuvent donc pas dépasser la limite.
export type DepotTentativesConnexion = {
  // Compte l'essai en un seul calcul en base (juste avec plusieurs réplicas). Renvoie
  // la fin du blocage si l'essai est refusé (email bloqué, ou plus d'essais simultanés
  // que permis : bloqué dès maintenant), null si le mot de passe peut être vérifié.
  reserverEssai(cle: string, maintenant: Date, regle: RegleBlocage): Promise<Date | null>;
  // Mot de passe faux : l'essai reste compté ; renvoie la fin du blocage si l'email a
  // atteint la limite, null sinon
  enregistrerEchec(cle: string, maintenant: Date, regle: RegleBlocage): Promise<Date | null>;
  // Connexion réussie : compteur effacé
  effacer(cle: string): Promise<void>;
};

export type DependancesComptes = {
  cgu: DepotAcceptationsCgu;
  tentatives: DepotTentativesConnexion;
  maintenant?: () => Date;
  log?: Logger;
};

// Couche service : règles de gestion de l'US-02a, puis création du compte chez le
// fournisseur d'identité et enregistrement de l'acceptation des CGU.
export function creerCompteService(
  fournisseur: FournisseurIdentite,
  { cgu, tentatives, maintenant = () => new Date(), log = logger }: DependancesComptes,
) {
  async function creer(demande: DemandeCreation): Promise<CompteCree> {
    const email = texte(demande.email).trim().toLowerCase();
    const motDePasse = texte(demande.motDePasse);
    if (!emailValide(email)) {
      throw new HttpError(400, 'Format d’email invalide');
    }
    if (demande.cguAcceptees !== true) {
      throw new HttpError(
        400,
        'Vous devez accepter les CGU et la politique de confidentialité pour créer votre compte',
      );
    }
    const regles = reglesNonRespectees(motDePasse, email);
    if (regles.length > 0) {
      throw new HttpError(400, regles.join(' · '));
    }
    if (texte(demande.confirmation) !== motDePasse) {
      throw new HttpError(400, 'Les mots de passe ne correspondent pas');
    }
    let compte: CompteCree;
    try {
      compte = await fournisseur.creerCompte(email, motDePasse);
    } catch (err) {
      if (err instanceof EmailDejaUtilise) {
        throw new HttpError(409, err.message);
      }
      throw err;
    }
    await cgu.enregistrer(compte.utilisateur.id, VERSION_CGU, maintenant());
    return compte;
  }

  // US-03a : ouvre une session. Un seul message, quel que soit le champ faux, pour ne
  // pas révéler si un compte existe avec cet email.
  // US-03b : 5 échecs à la suite -> email bloqué 10 minutes (429 avec debloqueA), même
  // pour un email sans compte (le blocage ne révèle donc rien non plus). Pendant le
  // blocage, le mot de passe n'est pas vérifié. Champs vides : non comptés.
  async function connecter(demande: DemandeConnexion): Promise<CompteCree> {
    const email = texte(demande.email).trim().toLowerCase();
    const motDePasse = texte(demande.motDePasse);
    if (!email || !motDePasse) {
      throw new HttpError(401, IDENTIFIANTS_INCORRECTS);
    }
    const cle = empreinte(email);
    const regle = { echecsAvantBlocage: ECHECS_AVANT_BLOCAGE, dureeMs: DUREE_BLOCAGE_MS };
    const essaiRefuse = await tentatives.reserverEssai(cle, maintenant(), regle);
    if (essaiRefuse) {
      throw compteBloque(essaiRefuse);
    }
    const compte = await fournisseur.connecter(email, motDePasse);
    if (compte) {
      await tentatives.effacer(cle);
      return compte;
    }
    const nouveauBlocage = await tentatives.enregistrerEchec(cle, maintenant(), regle);
    if (nouveauBlocage) {
      const userId = await fournisseur.identifiantDe(email);
      businessLog(
        log,
        'warn',
        'service',
        'CompteService',
        'connecter',
        `compte bloqué après ${ECHECS_AVANT_BLOCAGE} échecs`,
        userId ? { userId } : { compteInconnu: true },
      );
      throw compteBloque(nouveauBlocage);
    }
    throw new HttpError(401, IDENTIFIANTS_INCORRECTS);
  }

  return loggable('CompteService', { creer, connecter });
}

export type CompteService = ReturnType<typeof creerCompteService>;

function compteBloque(fin: Date): HttpError {
  return new HttpError(429, TROP_DE_TENTATIVES, { debloqueA: fin.toISOString() });
}

// Empreinte SHA-256 de l'email normalisé : clé du compteur d'échecs sans email en clair
export function empreinte(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}
