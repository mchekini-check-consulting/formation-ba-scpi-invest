// Liste déroulante de pays avec drapeau (US-04c : nationalité), au modèle « combobox »
// des lecteurs d'écran : on tape pour filtrer (« ita » -> Italie), flèches haut et bas
// pour parcourir, Entrée pour choisir, Échap pour fermer. Valeur = code ISO à 2 lettres
// (« FR »), celle qui est enregistrée dans les réponses du KYC ; le nom est affiché.
import 'flag-icons/css/flag-icons.min.css';
import { useEffect, useId, useRef, useState } from 'react';
import { filtrerPays, paysParCode, paysParNom } from './pays.js';

function Drapeau({ code }) {
  return <span className={`fi fi-${code.toLowerCase()} choix-pays__drapeau`} aria-hidden="true" />;
}

export default function ChoixPays({ id, valeur, changer, invalide, decritPar }) {
  const idListe = `${useId()}-liste`;
  const choisi = paysParCode(valeur);
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState(null); // null : affiche le pays choisi
  const [actif, setActif] = useState(0);
  const liste = useRef(null);

  const proposes = filtrerPays(recherche ?? '');
  const texte = recherche ?? choisi?.nom ?? valeur ?? '';

  useEffect(() => {
    if (!ouvert) return;
    liste.current?.querySelector('[data-actif="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [actif, ouvert]);

  function ouvrir() {
    const index = choisi ? filtrerPays('').findIndex((p) => p.code === choisi.code) : 0;
    setActif(Math.max(index, 0));
    setOuvert(true);
  }

  function fermer() {
    setOuvert(false);
    setRecherche(null);
  }

  function choisir(pays) {
    changer(pays.code);
    fermer();
  }

  function saisir(event) {
    setRecherche(event.target.value);
    setActif(0);
    setOuvert(true);
    if (event.target.value === '') changer('');
  }

  // Sortie du champ : un nom tapé en entier vaut choix, sinon on revient au pays choisi
  function quitter() {
    if (recherche !== null) {
      const tape = paysParNom(recherche);
      if (tape) changer(tape.code);
    }
    fermer();
  }

  function touche(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!ouvert) return ouvrir();
      const pas = event.key === 'ArrowDown' ? 1 : -1;
      return setActif((i) => Math.min(Math.max(i + pas, 0), proposes.length - 1));
    }
    if (event.key === 'Enter' && ouvert) {
      event.preventDefault(); // ne pas envoyer le formulaire
      if (proposes[actif]) choisir(proposes[actif]);
      return undefined;
    }
    if (event.key === 'Escape' && ouvert) {
      event.preventDefault();
      fermer();
    }
    return undefined;
  }

  const idOption = (code) => `${idListe}-${code}`;

  return (
    <div className="choix-pays">
      <div className="choix-pays__saisie">
        {choisi && recherche === null && <Drapeau code={choisi.code} />}
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={ouvert}
          aria-controls={idListe}
          aria-activedescendant={
            ouvert && proposes[actif] ? idOption(proposes[actif].code) : undefined
          }
          aria-invalid={invalide ? true : undefined}
          aria-describedby={decritPar}
          placeholder="Choisir un pays…"
          className={choisi && recherche === null ? 'choix-pays__champ--drapeau' : undefined}
          value={texte}
          onChange={saisir}
          onFocus={(e) => e.target.select()}
          onClick={(e) => {
            if (ouvert) return fermer();
            e.target.select(); // ce qui est tapé remplace le pays affiché
            return ouvrir();
          }}
          onKeyDown={touche}
          onBlur={quitter}
        />
      </div>
      {ouvert && (
        <ul ref={liste} id={idListe} role="listbox" className="choix-pays__liste">
          {proposes.length === 0 && <li className="choix-pays__vide">Aucun pays trouvé</li>}
          {proposes.map((pays, i) => (
            <li
              key={pays.code}
              id={idOption(pays.code)}
              role="option"
              aria-selected={choisi?.code === pays.code}
              data-actif={i === actif}
              className="choix-pays__option"
              onMouseDown={(e) => e.preventDefault()} // garde le focus dans le champ
              onClick={() => choisir(pays)}
              onMouseEnter={() => setActif(i)}
            >
              <Drapeau code={pays.code} />
              {pays.nom}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
