import type { IncomingHttpHeaders } from 'node:http';
import type { RequestHandler } from 'express';

// Contrat entre l'application et le fournisseur d'identité. Le reste du backend ne
// connaît que ce fichier : passer de Better-Auth à Keycloak (OIDC) revient à écrire une
// autre implémentation de FournisseurIdentite (src/auth/better-auth.ts aujourd'hui) :
//   - creerCompte : API d'administration Keycloak (ou inscription hébergée par Keycloak)
//   - connecter : flux OIDC (page de connexion hébergée par Keycloak)
//   - utilisateurConnecte : vérification du jeton "Authorization: Bearer" (JWT, clés JWKS)
// Le frontend envoie déjà la session dans l'en-tête Authorization: Bearer, comme en OIDC.

export type Utilisateur = { id: string; email: string };

export type CompteCree = { utilisateur: Utilisateur; jeton: string };

export interface FournisseurIdentite {
  creerCompte(email: string, motDePasse: string): Promise<CompteCree>;
  // Ouvre une session ; null si l'email ou le mot de passe est incorrect
  connecter(email: string, motDePasse: string): Promise<CompteCree | null>;
  utilisateurConnecte(headers: IncomingHttpHeaders): Promise<Utilisateur | null>;
}

export class EmailDejaUtilise extends Error {
  constructor() {
    super('Un compte existe déjà avec cet email');
    this.name = 'EmailDejaUtilise';
  }
}

// Routes réservées aux utilisateurs connectés : 401 sinon, l'utilisateur dans res.locals
export function exigerConnexion(fournisseur: FournisseurIdentite): RequestHandler {
  return async (req, res, next) => {
    const utilisateur = await fournisseur.utilisateurConnecte(req.headers);
    if (!utilisateur) {
      res.status(401).json({ message: 'connexion requise' });
      return;
    }
    res.locals.utilisateur = utilisateur;
    next();
  };
}
