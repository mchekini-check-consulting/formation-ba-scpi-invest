// Écran où reprendre le parcours après la connexion (US-03a, scénarios 1 à 3) :
// KYC non commencé ou non terminé -> /kyc ; KYC et formulaire investisseur terminés
// -> Catalogue. Le KYC (US-04a), le formulaire investisseur et le Catalogue ne sont pas
// encore réalisés : aucun utilisateur ne peut encore les avoir terminés, d'où /kyc.
export function destinationApresConnexion() {
  return '/kyc';
}
