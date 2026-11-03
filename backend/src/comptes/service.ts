import {
  EmailDejaUtilise,
  type CompteCree,
  type FournisseurIdentite,
} from '../auth/fournisseur.js';
import { HttpError } from '../logging/http-error.js';
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

// Couche service : règles de gestion de l'US-02a, puis création du compte chez le
// fournisseur d'identité et enregistrement de l'acceptation des CGU.
export function creerCompteService(
  fournisseur: FournisseurIdentite,
  cgu: DepotAcceptationsCgu,
  maintenant: () => Date = () => new Date(),
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
  async function connecter(demande: DemandeConnexion): Promise<CompteCree> {
    const email = texte(demande.email).trim().toLowerCase();
    const motDePasse = texte(demande.motDePasse);
    const compte = email && motDePasse ? await fournisseur.connecter(email, motDePasse) : null;
    if (!compte) {
      throw new HttpError(401, IDENTIFIANTS_INCORRECTS);
    }
    return compte;
  }

  return loggable('CompteService', { creer, connecter });
}

export type CompteService = ReturnType<typeof creerCompteService>;

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}
