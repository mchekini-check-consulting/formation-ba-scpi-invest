// Ville avec suggestions (KYC et Mon profil, pays = France) : dès que le code postal a
// 5 chiffres, l'écran propose la ou les communes de ce code postal (service public des
// communes, via le backend : route /adresses/communes). Une seule commune : la ville se
// remplit seule si elle est vide ou ne correspond pas au code postal.
// Même modèle « combobox » que l'adresse (ChampAdresse.jsx) : flèches, Entrée, Échap.
// Hors France, ou si le service ne répond pas : saisie libre.
import { useEffect, useId, useRef, useState } from 'react';

const CODE_POSTAL = /^\d{5}$/;

// Communes du code postal ; une réponse arrivée après un autre code postal est ignorée,
// une panne donne une liste vide
function useCommunes(codePostal, actif, chercher) {
  const [trouvees, setTrouvees] = useState({ pour: null, liste: [] });
  const code = (codePostal ?? '').trim();
  const aChercher = actif && CODE_POSTAL.test(code);
  useEffect(() => {
    if (!aChercher) return undefined;
    let courante = true;
    chercher(code)
      .catch(() => [])
      .then((liste) => courante && setTrouvees({ pour: code, liste }));
    return () => {
      courante = false;
    };
  }, [code, aChercher, chercher]);
  return aChercher && trouvees.pour === code ? trouvees.liste : [];
}

export default function ChampVille({
  id,
  valeur,
  changer,
  codePostal,
  actif,
  chercher,
  invalide,
  decritPar,
  autoComplete,
}) {
  const idListe = `${useId()}-liste`;
  const communes = useCommunes(codePostal, actif, chercher);
  const [position, setPosition] = useState(0);
  const [ferme, setFerme] = useState(true);
  const remplie = useRef(null);

  // Une seule commune pour ce code postal : ville remplie si elle ne correspond pas
  // (une fois par liste reçue, pour laisser l'utilisateur corriger ensuite)
  useEffect(() => {
    if (communes.length !== 1 || remplie.current === communes) return;
    remplie.current = communes;
    if ((valeur ?? '').trim() !== communes[0]) changer(communes[0]);
  }, [communes, valeur, changer]);

  const ouvert = !ferme && communes.length > 1;
  const idOption = (i) => `${idListe}-${i}`;

  function retenir(commune) {
    changer(commune);
    setFerme(true);
  }

  const actions = {
    ArrowDown: () => setPosition((i) => Math.min(i + 1, communes.length - 1)),
    ArrowUp: () => setPosition((i) => Math.max(i - 1, 0)),
    Enter: () => retenir(communes[position]),
    Escape: () => setFerme(true),
  };

  function touche(event) {
    if (!ouvert && event.key === 'ArrowDown' && communes.length > 1) {
      event.preventDefault();
      setPosition(0);
      setFerme(false);
      return;
    }
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
        autoComplete={communes.length > 1 ? 'off' : autoComplete}
        value={valeur ?? ''}
        onChange={(e) => {
          changer(e.target.value);
          setFerme(false);
        }}
        onFocus={() => {
          setPosition(0);
          setFerme(false);
        }}
        onKeyDown={touche}
        onBlur={() => setFerme(true)}
      />
      {ouvert && (
        <ul id={idListe} role="listbox" className="choix-pays__liste" aria-label="Communes">
          {communes.map((commune, i) => (
            <li
              key={commune}
              id={idOption(i)}
              role="option"
              aria-selected={i === position}
              data-actif={i === position}
              className="choix-pays__option"
              onMouseDown={(e) => e.preventDefault()} // garde le focus dans le champ
              onClick={() => retenir(commune)}
              onMouseEnter={() => setPosition(i)}
            >
              {commune}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
