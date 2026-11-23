// Liste déroulante avec champ de recherche, au modèle « combobox » des lecteurs d'écran :
// on tape pour filtrer (accents et majuscules ignorés, les libellés qui commencent par le
// texte en premier), flèches haut et bas pour parcourir, Entrée pour choisir, Échap pour
// fermer. Option désactivée : affichée, jamais choisie.
// Même comportement que ChoixPays (kyc/), qui garde ses drapeaux : à réunir plus tard.
import { useEffect, useId, useRef, useState } from 'react';
import './liste-recherche.css';

const normaliser = (texte) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function filtrer(options, texte) {
  const cherche = normaliser(texte);
  if (!cherche) return options;
  const debut = (o) => (normaliser(o.libelle).startsWith(cherche) ? 0 : 1);
  return options
    .filter((o) => normaliser(o.libelle).includes(cherche))
    .sort((a, b) => debut(a) - debut(b));
}

// options : [{ cle, libelle, desactivee }] ; valeur : clé choisie (null : aucune)
// changer(clé ou null) : appelé au choix d'une option, et avec null quand le champ est vidé
// effacer : libellé du bouton « poubelle » qui retire l'option choisie (absent : pas de bouton)
export default function ListeAvecRecherche({
  id,
  options,
  valeur,
  changer,
  placeholder,
  vide = 'Aucun résultat',
  effacer,
}) {
  const idListe = `${useId()}-liste`;
  const choisie = options.find((o) => o.cle === valeur) ?? null;
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState(null); // null : affiche l'option choisie
  const [actif, setActif] = useState(0);
  const liste = useRef(null);
  const champ = useRef(null);

  const proposees = filtrer(options, recherche ?? '');
  const idOption = (i) => `${idListe}-${i}`;

  useEffect(() => {
    if (!ouvert) return;
    liste.current?.querySelector('[data-actif="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [actif, ouvert]);

  function ouvrir() {
    setActif(Math.max(options.indexOf(choisie), 0));
    setOuvert(true);
  }

  function fermer() {
    setOuvert(false);
    setRecherche(null);
  }

  function choisir(option) {
    if (option.desactivee) return;
    changer(option.cle);
    fermer();
  }

  function saisir(event) {
    setRecherche(event.target.value);
    setActif(0);
    setOuvert(true);
    if (event.target.value === '') changer(null);
  }

  // Sortie du champ : un libellé tapé en entier vaut choix, sinon on revient à l'option
  // choisie
  function quitter() {
    if (recherche !== null) {
      const tapee = options.find((o) => normaliser(o.libelle) === normaliser(recherche));
      if (tapee) choisir(tapee);
    }
    fermer();
  }

  function touche(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!ouvert) return ouvrir();
      const pas = event.key === 'ArrowDown' ? 1 : -1;
      return setActif((i) => Math.min(Math.max(i + pas, 0), proposees.length - 1));
    }
    if (event.key === 'Enter' && ouvert) {
      event.preventDefault(); // ne pas envoyer de formulaire
      if (proposees[actif]) choisir(proposees[actif]);
    } else if (event.key === 'Escape' && ouvert) {
      event.preventDefault();
      fermer();
    }
    return undefined;
  }

  return (
    <div
      className={
        effacer && choisie ? 'liste-recherche liste-recherche--effacable' : 'liste-recherche'
      }
    >
      <input
        ref={champ}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-activedescendant={ouvert && proposees[actif] ? idOption(actif) : undefined}
        placeholder={placeholder}
        className="liste-recherche__champ"
        value={recherche ?? choisie?.libelle ?? ''}
        onChange={saisir}
        onClick={(e) => {
          if (ouvert) return fermer();
          e.target.select(); // ce qui est tapé remplace l'option affichée
          return ouvrir();
        }}
        onKeyDown={touche}
        onBlur={quitter}
      />
      {/* Flèche : même effet qu'un clic dans le champ (clavier : flèches du champ) */}
      <span
        className="liste-recherche__fleche"
        aria-hidden="true"
        onMouseDown={(e) => {
          e.preventDefault(); // garde le focus dans le champ
          champ.current.focus();
          if (ouvert) fermer();
          else ouvrir();
        }}
      >
        <svg viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
      {effacer && choisie && (
        <button
          type="button"
          className="liste-recherche__effacer"
          aria-label={effacer}
          title={effacer}
          onClick={() => {
            changer(null);
            fermer();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      )}
      {ouvert && (
        <ul ref={liste} id={idListe} role="listbox" className="liste-recherche__liste">
          {proposees.length === 0 && <li className="liste-recherche__vide">{vide}</li>}
          {proposees.map((option, i) => (
            <li
              key={option.cle}
              id={idOption(i)}
              role="option"
              aria-selected={option === choisie}
              aria-disabled={option.desactivee ? true : undefined}
              data-actif={i === actif}
              className="liste-recherche__option"
              onMouseDown={(e) => e.preventDefault()} // garde le focus dans le champ
              onClick={() => choisir(option)}
              onMouseEnter={() => setActif(i)}
            >
              {option.libelle}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
