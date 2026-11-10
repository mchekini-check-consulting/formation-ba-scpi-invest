// Recherche d'une SCPI par son nom (Recherche.jsx) : lancée à partir de RECHERCHE_MIN
// caractères, DELAI_RECHERCHE_MS après la dernière frappe (une seule requête par mot tapé,
// pas une par lettre).
import { useEffect, useState } from 'react';

export const RECHERCHE_MIN = 2;
export const DELAI_RECHERCHE_MS = 300;
// Nombre maximum de SCPI renvoyées par le backend (LIMITE_RECHERCHE)
export const LIMITE_RECHERCHE = 20;

// État de la recherche pour le texte saisi. Seule la réponse au dernier texte est gardée :
// une réponse arrivée après une nouvelle frappe est ignorée.
export function useRecherche(saisie, rechercher, delai = DELAI_RECHERCHE_MS) {
  const texte = saisie.trim();
  const active = texte.length >= RECHERCHE_MIN;
  const [reponse, setReponse] = useState({ texte: '', resultats: null, erreur: null });

  useEffect(() => {
    if (!active) return undefined;
    let actif = true;
    const minuteur = setTimeout(() => {
      rechercher(texte)
        .then((resultats) => actif && setReponse({ texte, resultats, erreur: null }))
        .catch((erreur) => actif && setReponse({ texte, resultats: null, erreur }));
    }, delai);
    return () => {
      actif = false;
      clearTimeout(minuteur);
    };
  }, [texte, active, rechercher, delai]);

  const aJour = active && reponse.texte === texte;
  return {
    texte,
    active,
    enCours: active && !aJour,
    resultats: aJour ? reponse.resultats : null,
    erreur: aJour ? reponse.erreur : null,
  };
}
