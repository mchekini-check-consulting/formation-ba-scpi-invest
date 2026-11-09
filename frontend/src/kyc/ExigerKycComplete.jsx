// Garde des écrans de l'application (US-04b, scénario 2) : le KYC est bloquant.
//   pas de session  -> page de connexion (session expirée : le routeur s'en charge)
//   KYC non validé  -> formulaire KYC (/kyc)
//   KYC validé      -> l'écran demandé
//   raccourci de test du poste (outils/passerFormulaires.js) : KYC non exigé
// Tout nouvel écran réservé aux utilisateurs (formulaire investisseur, Catalogue...) est
// déclaré dans Routeur.jsx à l'intérieur de <ExigerKycComplete>.
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { sessionExpiree as sessionExpireeParDefaut, utilisateurConnecte } from '../auth.js';
import { formulairesPassables } from '../outils/passerFormulaires.js';
import { lireKyc } from './api.js';

function naviguer(url) {
  window.location.assign(url);
}

export default function ExigerKycComplete({
  children,
  lireUtilisateur = utilisateurConnecte,
  lire = lireKyc,
  allerA = naviguer,
  passer = formulairesPassables(),
  sessionExpiree = sessionExpireeParDefaut,
}) {
  const { data: utilisateur, isError: erreurSession } = useQuery({
    queryKey: ['utilisateur-connecte'],
    queryFn: () => lireUtilisateur(),
    retry: false,
  });
  const { data: kyc, isError: erreurKyc } = useQuery({
    queryKey: ['kyc'],
    queryFn: () => lire(),
    enabled: Boolean(utilisateur) && !passer,
    retry: false,
  });

  useEffect(() => {
    // Session expirée : le routeur ouvre déjà l'écran de connexion ; un rechargement de
    // la page ici effacerait le message « session expirée »
    if (utilisateur === null) {
      if (!sessionExpiree()) allerA('/connexion');
    } else if (kyc && kyc.statut !== 'complete') allerA('/connaissance-client');
  }, [utilisateur, kyc, allerA, sessionExpiree]);

  if (erreurSession || erreurKyc) {
    return (
      <p className="compte__alerte" role="alert">
        Le service est momentanément indisponible, réessayez dans quelques instants.
      </p>
    );
  }
  if (passer) return utilisateur ? children : null;
  return kyc?.statut === 'complete' ? children : null;
}
