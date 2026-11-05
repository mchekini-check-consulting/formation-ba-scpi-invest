// Écran /kyc : destination après la création de compte (US-02a) et la connexion (US-03a).
// Formulaire KYC sans sidebar (US-04a), repris à l'étape atteinte avec les réponses déjà
// saisies (US-04b). KYC déjà validé : direction le formulaire investisseur.
// Sans session valide (expirée, fermée) : retour à l'accueil.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { deconnecter, utilisateurConnecte } from '../auth.js';
import PageCompte from '../PageCompte.jsx';
import {
  ECRAN_APRES_KYC,
  deposerPiece,
  enregistrerKyc,
  lireKyc,
  listerPieces,
  supprimerPiece,
  validerKyc,
} from './api.js';
import FormulaireKyc from './FormulaireKyc.jsx';

function naviguer(url) {
  window.location.assign(url);
}

export default function Kyc({
  lireUtilisateur = utilisateurConnecte,
  lire = lireKyc,
  enregistrer = enregistrerKyc,
  valider = validerKyc,
  lirePieces = listerPieces,
  deposer = deposerPiece,
  supprimer = supprimerPiece,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  aujourdhui,
}) {
  const utilisateurQuery = useQuery({
    queryKey: ['utilisateur-connecte'],
    queryFn: () => lireUtilisateur(),
    retry: false,
  });
  const utilisateur = utilisateurQuery.data;
  const kycQuery = useQuery({
    queryKey: ['kyc'],
    queryFn: () => lire(),
    enabled: Boolean(utilisateur),
    retry: false,
  });
  const kyc = kycQuery.data;
  // US-04c : pièces déjà déposées (reprise de l'étape « Pièces justificatives »)
  const piecesQuery = useQuery({
    queryKey: ['kyc-pieces'],
    queryFn: () => lirePieces(),
    enabled: kyc?.statut === 'en_cours',
    retry: false,
  });

  useEffect(() => {
    if (utilisateur === null) allerA('/');
  }, [utilisateur, allerA]);

  useEffect(() => {
    if (kyc?.statut === 'complete') allerA(ECRAN_APRES_KYC);
  }, [kyc, allerA]);

  useEffect(() => {
    document.title = 'SCPI Invest+ · Formulaire KYC';
  }, []);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const indisponible = utilisateurQuery.isError || kycQuery.isError || piecesQuery.isError;

  return (
    <PageCompte titre="Connaissance client (KYC)" large>
      {indisponible && (
        <p className="compte__alerte" role="alert">
          Le service est momentanément indisponible, réessayez dans quelques instants.
        </p>
      )}
      {utilisateur && (
        <>
          <p className="kyc__intro">
            La réglementation nous impose de vérifier l’identité de chaque investisseur et l’origine
            des fonds investis (lutte contre le blanchiment). Ce formulaire est obligatoire avant
            d’accéder à l’application.
          </p>
          {(kycQuery.isPending || (kyc?.statut === 'en_cours' && piecesQuery.isPending)) && (
            <p className="kyc__chargement">Chargement de votre dossier…</p>
          )}
          {kyc?.statut === 'en_cours' && piecesQuery.data && (
            <FormulaireKyc
              email={utilisateur.email}
              aujourdhui={aujourdhui}
              etapeInitiale={kyc.etape}
              reponsesInitiales={kyc.reponses}
              piecesInitiales={piecesQuery.data}
              enregistrer={enregistrer}
              valider={valider}
              deposerPiece={deposer}
              supprimerPiece={supprimer}
              apresValidation={() => allerA(ECRAN_APRES_KYC)}
            />
          )}
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
