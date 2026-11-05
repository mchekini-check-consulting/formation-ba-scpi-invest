// Catalogue des SCPI : écran provisoire, accessible seulement une fois le profil
// investisseur validé (US-05b). Profil non validé (certification non cochée, étapes
// non complétées) -> formulaire investisseur, qui reprend là où l'utilisateur en
// était (écran du résultat du profil si les 5 étapes sont complétées).
// Sans session -> connexion.
// Affiché avec la sidebar de navigation, entrée Catalogue sélectionnée (US-06).
import { useEffect, useState } from 'react';
import { deconnecter } from '../auth.js';
import { lireQuestionnaire } from '../investisseur/api.js';
import PageApplication from '../navigation/PageApplication.jsx';

function naviguer(url) {
  window.location.assign(url);
}

export default function Catalogue({
  lire = lireQuestionnaire,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const [etat, setEtat] = useState('chargement');
  const [alerte, setAlerte] = useState('');

  useEffect(() => {
    let actif = true;
    lire()
      .then((avancement) => {
        if (!actif) return;
        if (avancement.valide) {
          setEtat('valide');
        } else {
          allerA('/formulaire-investisseur');
        }
      })
      .catch((err) => {
        if (!actif) return;
        if (err.status === 401) {
          allerA('/connexion');
        } else {
          setAlerte(err.message);
        }
      });
    return () => {
      actif = false;
    };
  }, [lire, allerA]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  return (
    <PageApplication
      titre="Catalogue des SCPI"
      actif="catalogue"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
    >
      {alerte && (
        <p className="compte__alerte" role="alert">
          {alerte}
        </p>
      )}
      {etat === 'valide' ? (
        <>
          <p className="compte__texte">Votre profil investisseur est validé.</p>
          <p className="compte__texte">Le catalogue des SCPI sera bientôt disponible.</p>
        </>
      ) : (
        !alerte && <p className="compte__texte">Chargement…</p>
      )}
    </PageApplication>
  );
}
