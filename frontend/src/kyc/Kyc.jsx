// Écran /kyc : destination après la création de compte (US-02a) et la connexion (US-03a).
// Affiche le formulaire KYC à l'étape 1 (US-04a, SCPI-21), sans sidebar, avec l'email du
// compte prérempli. Sans session valide (expirée, fermée) : retour à l'accueil.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { deconnecter, utilisateurConnecte } from '../auth.js';
import PageCompte from '../PageCompte.jsx';
import FormulaireKyc from './FormulaireKyc.jsx';

function naviguer(url) {
  window.location.assign(url);
}

export default function Kyc({
  lireUtilisateur = utilisateurConnecte,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  aujourdhui,
}) {
  const { data: utilisateur, isError } = useQuery({
    queryKey: ['utilisateur-connecte'],
    queryFn: () => lireUtilisateur(),
    retry: false,
  });

  useEffect(() => {
    if (utilisateur === null) allerA('/');
  }, [utilisateur, allerA]);

  useEffect(() => {
    document.title = 'SCPI Invest+ · Formulaire KYC';
  }, []);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  return (
    <PageCompte titre="Connaissance client (KYC)" large>
      {isError && (
        <p className="compte__alerte" role="alert">
          Le service est momentanément indisponible, réessayez dans quelques instants.
        </p>
      )}
      {utilisateur && (
        <>
          <p className="kyc__intro">
            La réglementation nous impose de vérifier l’identité de chaque investisseur et l’origine
            des fonds investis (lutte contre le blanchiment). Ce formulaire est obligatoire avant
            toute souscription.
          </p>
          <FormulaireKyc email={utilisateur.email} aujourdhui={aujourdhui} />
          <p className="kyc__deconnexion">
            Connecté avec l’adresse <strong>{utilisateur.email}</strong>.{' '}
            <button type="button" className="kyc__lien-bouton" onClick={quitter}>
              Se déconnecter
            </button>
          </p>
        </>
      )}
    </PageCompte>
  );
}
