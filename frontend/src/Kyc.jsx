// Destination après la création de compte (US-02a) et la connexion (US-03a), d'où un
// titre qui convient aux deux. Le formulaire KYC lui-même est
// porté par l'US-04a : en attendant, cet écran confirme la connexion et permet de se
// déconnecter. Sans session valide (expirée, fermée) : retour à l'accueil.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { deconnecter, utilisateurConnecte } from './auth.js';
import PageCompte from './PageCompte.jsx';

function naviguer(url) {
  window.location.assign(url);
}

export default function Kyc({
  lireUtilisateur = utilisateurConnecte,
  seDeconnecter = deconnecter,
  allerA = naviguer,
}) {
  const { data: utilisateur, isError } = useQuery({
    queryKey: ['utilisateur-connecte'],
    queryFn: () => lireUtilisateur(),
    retry: false,
  });

  useEffect(() => {
    if (utilisateur === null) allerA('/');
  }, [utilisateur, allerA]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  return (
    <PageCompte titre="Bienvenue dans votre espace">
      {isError && (
        <p className="compte__alerte" role="alert">
          Le service est momentanément indisponible, réessayez dans quelques instants.
        </p>
      )}
      {utilisateur && (
        <>
          <p className="compte__texte">
            Vous êtes connecté avec l’adresse <strong>{utilisateur.email}</strong>.
          </p>
          <p className="compte__texte">
            Prochaine étape : le formulaire KYC (connaissance client), bientôt disponible.
          </p>
          <button
            type="button"
            className="compte__bouton compte__bouton--secondaire"
            onClick={quitter}
          >
            Se déconnecter
          </button>
        </>
      )}
    </PageCompte>
  );
}
