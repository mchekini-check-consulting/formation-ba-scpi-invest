// Recherche d'une SCPI par son nom (Recherche.jsx) : lancée à partir de RECHERCHE_MIN
// caractères, DELAI_RECHERCHE_MS après la dernière frappe (une seule requête par mot tapé,
// pas une par lettre). Combinée aux filtres et au tri du Catalogue (US-12) : les changer
// pendant une recherche la relance, sans toucher au texte saisi.
import { useEffect, useState } from 'react';
import { FILTRES_VIDES } from './filtres.js';
import { TRI_PAR_DEFAUT } from './tri.js';

export const RECHERCHE_MIN = 2;
export const DELAI_RECHERCHE_MS = 300;
// Nombre maximum de SCPI renvoyées par le backend (LIMITE_RECHERCHE)
export const LIMITE_RECHERCHE = 20;

// État de la recherche pour le texte saisi, les filtres et le tri. Seule la réponse à la
// dernière demande est gardée : une réponse arrivée après une nouvelle frappe, un nouveau
// filtre ou un nouveau tri est ignorée.
export function useRecherche(
  saisie,
  rechercher,
  filtres = FILTRES_VIDES,
  tri = TRI_PAR_DEFAUT,
  delai = DELAI_RECHERCHE_MS,
) {
  const texte = saisie.trim();
  const active = texte.length >= RECHERCHE_MIN;
  const demande = JSON.stringify([texte, filtres, tri]);
  const [reponse, setReponse] = useState({ demande: '', resultats: null, erreur: null });

  useEffect(() => {
    if (!active) return undefined;
    let actif = true;
    const minuteur = setTimeout(() => {
      rechercher(texte, filtres, tri)
        .then((resultats) => actif && setReponse({ demande, resultats, erreur: null }))
        .catch((erreur) => actif && setReponse({ demande, resultats: null, erreur }));
    }, delai);
    return () => {
      actif = false;
      clearTimeout(minuteur);
    };
  }, [texte, filtres, tri, demande, active, rechercher, delai]);

  const aJour = active && reponse.demande === demande;
  return {
    texte,
    active,
    enCours: active && !aJour,
    resultats: aJour ? reponse.resultats : null,
    erreur: aJour ? reponse.erreur : null,
  };
}
