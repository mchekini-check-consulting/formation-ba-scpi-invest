// Liste de suggestions sous un champ (adresse, ville) : option active à la souris ou au
// clavier, choix au clic sans perdre le focus du champ
import { idOption } from './combobox.js';

export default function ListeSuggestions({
  idListe,
  libelle,
  elements,
  position,
  cle,
  texte,
  choisir,
  survoler,
}) {
  return (
    <ul id={idListe} role="listbox" className="choix-pays__liste" aria-label={libelle}>
      {elements.map((element, i) => (
        <li
          key={cle(element)}
          id={idOption(idListe, i)}
          role="option"
          aria-selected={i === position}
          data-actif={i === position}
          className="choix-pays__option"
          onMouseDown={(e) => e.preventDefault()} // garde le focus dans le champ
          onClick={() => choisir(element)}
          onMouseEnter={() => survoler(i)}
        >
          {texte(element)}
        </li>
      ))}
    </ul>
  );
}
