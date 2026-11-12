import { describe, expect, it } from 'vitest';
import { messageRequete, type Requete } from './messages.js';

function requete(r: Partial<Requete>): Requete {
  return { httpMethod: 'GET', route: '/', chemin: '/', status: 200, params: {}, ...r };
}

describe('messageRequete', () => {
  it.each([
    [200, 'Connexion réussie'],
    [401, 'Connexion refusée, identifiants incorrects'],
    [429, 'Connexion bloquée (trop de tentatives)'],
    [400, 'Connexion : demande refusée (400)'],
    [500, 'Connexion : erreur technique (500)'],
  ])('connexion %i : %s', (status, attendu) => {
    expect(
      messageRequete(requete({ httpMethod: 'POST', route: '/comptes/connexion', status })),
    ).toBe(attendu);
  });

  it('succès sans message dédié : l’action', () => {
    expect(messageRequete(requete({ route: '/scpis/filtres' }))).toBe(
      'Chargement des filtres du catalogue',
    );
  });

  it('401 sans message dédié : session absente ou expirée', () => {
    expect(messageRequete(requete({ route: '/connaissance-client', status: 401 }))).toBe(
      'Lecture du KYC : accès refusé, session absente ou expirée',
    );
  });

  it('succès : valeurs de la route dans le message', () => {
    const message = messageRequete(
      requete({
        httpMethod: 'PUT',
        route: '/connaissance-client/pieces/:typePiece',
        params: { typePiece: 'justificatif_domicile' },
      }),
    );
    expect(message).toBe('Pièce KYC déposée (justificatif_domicile)');
  });

  it('refus : jamais la valeur reçue dans la route (non validée)', () => {
    const message = messageRequete(
      requete({
        httpMethod: 'PUT',
        route: '/connaissance-client/pieces/:typePiece',
        params: { typePiece: 'n’importe quoi' },
        status: 404,
      }),
    );
    expect(message).toBe('Pièce KYC refusée : type de pièce inconnu');
  });

  it('paramètre absent : modèle laissé tel quel', () => {
    const message = messageRequete(
      requete({ httpMethod: 'PUT', route: '/formulaire-investisseur/etapes/:etape' }),
    );
    expect(message).toBe('Étape {etape} du questionnaire enregistrée');
  });

  it('utilisateur connu : son email à la fin', () => {
    expect(
      messageRequete(requete({ route: '/comptes/moi', userId: 'u-42', email: 'jean@exemple.fr' })),
    ).toBe('Lecture du compte connecté — jean@exemple.fr');
  });

  it('paramètres de l’action entre parenthèses, avant l’utilisateur', () => {
    const message = messageRequete(
      requete({
        route: '/scpis/recherche',
        email: 'jean@exemple.fr',
        details: { recherche: 'pierre', tri: 'taux-desc', resultats: 3 },
      }),
    );
    expect(message).toBe(
      'Recherche dans le catalogue (recherche : pierre ; tri : taux-desc ; resultats : 3)' +
        ' — jean@exemple.fr',
    );
  });

  it('email inconnu : l’identifiant technique à la fin', () => {
    expect(messageRequete(requete({ route: '/comptes/moi', userId: 'u-42' }))).toBe(
      'Lecture du compte connecté — utilisateur u-42',
    );
  });

  it.each([
    ['/auth/sign-out', 'Déconnexion'],
    ['/auth/get-session', 'Vérification de session'],
    ['/auth/autre', 'Appel d’authentification'],
  ])('Better-Auth %s : %s', (chemin, attendu) => {
    expect(messageRequete(requete({ route: '/auth/*chemin', chemin }))).toBe(attendu);
  });

  it('route absente du dictionnaire : verbe, route et code', () => {
    expect(messageRequete(requete({ route: '/health', status: 503 }))).toBe('GET /health 503');
  });
});
