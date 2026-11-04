// Garde des écrans de l'application (US-04b, scénario 2) : le KYC est bloquant.
//   pas de session  -> page de connexion
//   KYC non validé  -> formulaire KYC (/kyc)
//   KYC validé      -> l'écran demandé
// Tout nouvel écran réservé aux utilisateurs (formulaire investisseur, Catalogue...) est
// déclaré dans Routeur.jsx à l'intérieur de <ExigerKycComplete>.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { utilisateurConnecte } from '../auth.js';
import { lireKyc } from './api.js';

function naviguer(url) {
  window.location.assign(url);
}

export default function ExigerKycComplete({
  children,
  lireUtilisateur = utilisateurConnecte,
  lire = lireKyc,
  allerA = naviguer,
}) {
  const { data: utilisateur, isError: erreurSession } = useQuery({
    queryKey: ['utilisateur-connecte'],
    queryFn: () => lireUtilisateur(),
    retry: false,
  });
  const { data: kyc, isError: erreurKyc } = useQuery({
    queryKey: ['kyc'],
    queryFn: () => lire(),
    enabled: Boolean(utilisateur),
    retry: false,
  });

  useEffect(() => {
    if (utilisateur === null) allerA('/connexion');
    else if (kyc && kyc.statut !== 'complete') allerA('/kyc');
  }, [utilisateur, kyc, allerA]);

  if (erreurSession || erreurKyc) {
    return (
      <p className="compte__alerte" role="alert">
        Le service est momentanément indisponible, réessayez dans quelques instants.
      </p>
    );
  }
  return kyc?.statut === 'complete' ? children : null;
}
