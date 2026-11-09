// Adresse postale avec suggestions (KYC, étape « Coordonnées », pays = France) : à partir
// de 3 caractères, l'écran propose des adresses officielles (service national des adresses,
// via le backend : route /adresses). Un choix remplit adresse, code postal et ville.
// Modèle « combobox » des lecteurs d'écran : flèches haut et bas pour parcourir, Entrée
// pour choisir, Échap pour fermer. Hors France, ou si le service ne répond pas : saisie libre.
import { useEffect, useId, useState } from 'react';

const LONGUEUR_MIN = 3;

// Suggestions de la recherche en cours ; une réponse arrivée après une nouvelle frappe est
// ignorée, une panne donne une liste vide (la saisie reste libre)
function useSuggestions(recherche, actif, chercher, delai) {
  const [trouvees, setTrouvees] = useState({ pour: null, liste: [] });
  const saisie = (recherche ?? '').trim();
  const aChercher = actif && saisie.length >= LONGUEUR_MIN;
  useEffect(() => {
    if (!aChercher) return undefined;
    let courante = true;
    const minuterie = setTimeout(() => {
      chercher(saisie)
        .catch(() => [])
        .then((liste) => courante && setTrouvees({ pour: saisie, liste }));
    }, delai);
    return () => {
      courante = false;
      clearTimeout(minuterie);
    };
  }, [saisie, aChercher, chercher, delai]);
  return aChercher && trouvees.pour === saisie ? trouvees.liste : [];
}

export default function ChampAdresse({
  id,
  valeur,
  changer,
  choisir,
  actif,
  chercher,
  invalide,
  decritPar,
  autoComplete,
  delai = 250,
}) {
  const idListe = `${useId()}-liste`;
  const [recherche, setRecherche] = useState(null); // null : rien tapé depuis le dernier choix
  const suggestions = useSuggestions(recherche, actif, chercher, delai);
  const [position, setPosition] = useState(0);
  const [ferme, setFerme] = useState(false);
  const ouvert = !ferme && suggestions.length > 0;
  const idOption = (i) => `${idListe}-${i}`;

  function saisir(event) {
    changer(event.target.value);
    setRecherche(event.target.value);
    setPosition(0);
    setFerme(false);
  }

  function retenir(suggestion) {
    choisir(suggestion);
    setRecherche(null);
  }

  function parcourir(pas) {
    setPosition((i) => Math.min(Math.max(i + pas, 0), suggestions.length - 1));
  }

  const actions = {
    ArrowDown: () => parcourir(1),
    ArrowUp: () => parcourir(-1),
    Enter: () => retenir(suggestions[position]),
    Escape: () => setFerme(true),
  };

  function touche(event) {
    const action = ouvert && actions[event.key];
    if (!action) return;
    event.preventDefault(); // Entrée : ne pas envoyer le formulaire
    action();
  }

  return (
    <div className="choix-pays">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-activedescendant={ouvert ? idOption(position) : undefined}
        aria-invalid={invalide ? true : undefined}
        aria-describedby={decritPar}
        autoComplete={actif ? 'off' : autoComplete}
        value={valeur ?? ''}
        onChange={saisir}
        onKeyDown={touche}
        onBlur={() => setFerme(true)}
      />
      {ouvert && (
        <ul id={idListe} role="listbox" className="choix-pays__liste" aria-label="Adresses">
          {suggestions.map((suggestion, i) => (
            <li
              key={suggestion.libelle}
              id={idOption(i)}
              role="option"
              aria-selected={i === position}
              data-actif={i === position}
              className="choix-pays__option"
              onMouseDown={(e) => e.preventDefault()} // garde le focus dans le champ
              onClick={() => retenir(suggestion)}
              onMouseEnter={() => setPosition(i)}
            >
              {suggestion.libelle}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
