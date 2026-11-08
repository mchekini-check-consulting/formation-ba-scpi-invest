// Raccourci de test, sur le poste seulement : avec VITE_PASSER_FORMULAIRES=true dans
// frontend/.env.development.local (fichier jamais commité), le KYC et le formulaire
// investisseur ne sont plus exigés pour ouvrir le Catalogue. La connexion reste exigée.
// Sans effet dans une image construite (dev, qualif, preprod, prod) : env.DEV y vaut false.
export function formulairesPassables(env = import.meta.env) {
  return Boolean(env.DEV) && env.VITE_PASSER_FORMULAIRES === 'true';
}
