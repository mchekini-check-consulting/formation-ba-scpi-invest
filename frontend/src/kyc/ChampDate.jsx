// Saisie d'une date de naissance (KYC) plus simple que le calendrier du navigateur :
//   - au clavier : on tape les chiffres, les « / » s'ajoutent seuls (15011980 -> 15/01/1980) ;
//   - au calendrier : ouverture sur une grille de 12 années (flèches : ± 10 ans), puis le
//     mois, puis le jour. Dans la vue des jours, l'année et le mois ramènent à leur grille.
// La valeur transmise reste au format « AAAA-MM-JJ » (règles de etapes.js, backend) ;
// une saisie incomplète est transmise telle quelle, et signalée comme date invalide.
import { useEffect, useRef, useState } from 'react';
import { iso, isoVersTexte, lireIso, masquer, texteVersIso } from './dates.js';

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const ANNEE_MIN = 1900;
const AGE_PAR_DEFAUT = 35; // année proposée à l'ouverture quand rien n'est saisi

function Fleche({ sens, libelle, onClick, disabled }) {
  return (
    <button
      type="button"
      className="calendrier__fleche"
      aria-label={libelle}
      onClick={onClick}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={sens === 'avant' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  );
}

function Calendrier({ valeur, aujourdhui, choisir, fermer }) {
  const choisie = lireIso(valeur);
  const anneeMax = aujourdhui.getFullYear();
  const [vue, setVue] = useState(choisie ? 'jours' : 'annees');
  const [annee, setAnnee] = useState(choisie?.annee ?? anneeMax - AGE_PAR_DEFAUT);
  const [mois, setMois] = useState(choisie?.mois ?? 0);
  const cadre = useRef(null);

  // Fermeture : touche Échap, ou clic en dehors du calendrier
  useEffect(() => {
    const clavier = (e) => e.key === 'Escape' && fermer(true);
    const clic = (e) => cadre.current && !cadre.current.parentNode.contains(e.target) && fermer();
    document.addEventListener('keydown', clavier);
    document.addEventListener('mousedown', clic);
    return () => {
      document.removeEventListener('keydown', clavier);
      document.removeEventListener('mousedown', clic);
    };
  }, [fermer]);

  useEffect(() => {
    const cases = cadre.current;
    (
      cases?.querySelector('.calendrier__case[aria-pressed="true"]') ??
      cases?.querySelector('.calendrier__case:not([disabled])')
    )?.focus();
  }, [vue]);

  const futur = (a, m, j) => new Date(a, m, j) > aujourdhui;

  let contenu;
  if (vue === 'annees') {
    const debut = Math.floor(annee / 10) * 10 - 1;
    const annees = Array.from({ length: 12 }, (_, i) => debut + i);
    contenu = (
      <>
        <div className="calendrier__entete">
          <Fleche
            sens="avant"
            libelle="10 années plus tôt"
            onClick={() => setAnnee(annee - 10)}
            disabled={debut <= ANNEE_MIN}
          />
          <span className="calendrier__titre" aria-live="polite">
            {annees[0]} – {annees[11]}
          </span>
          <Fleche
            sens="apres"
            libelle="10 années plus tard"
            onClick={() => setAnnee(annee + 10)}
            disabled={annees[11] >= anneeMax}
          />
        </div>
        <div className="calendrier__grille calendrier__grille--3">
          {annees.map((a) => (
            <button
              key={a}
              type="button"
              className="calendrier__case"
              aria-pressed={choisie?.annee === a}
              disabled={a > anneeMax || a < ANNEE_MIN}
              onClick={() => {
                setAnnee(a);
                setVue('mois');
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </>
    );
  } else if (vue === 'mois') {
    contenu = (
      <>
        <div className="calendrier__entete">
          <Fleche
            sens="avant"
            libelle="Année précédente"
            onClick={() => setAnnee(annee - 1)}
            disabled={annee <= ANNEE_MIN}
          />
          <button
            type="button"
            className="calendrier__titre calendrier__titre--bouton"
            onClick={() => setVue('annees')}
            aria-label={`${annee}, choisir une autre année`}
          >
            {annee}
          </button>
          <Fleche
            sens="apres"
            libelle="Année suivante"
            onClick={() => setAnnee(annee + 1)}
            disabled={annee >= anneeMax}
          />
        </div>
        <div className="calendrier__grille calendrier__grille--3">
          {MOIS.map((nom, m) => (
            <button
              key={nom}
              type="button"
              className="calendrier__case"
              aria-pressed={choisie?.annee === annee && choisie?.mois === m}
              disabled={futur(annee, m, 1)}
              onClick={() => {
                setMois(m);
                setVue('jours');
              }}
            >
              {nom}
            </button>
          ))}
        </div>
      </>
    );
  } else {
    const nbJours = new Date(annee, mois + 1, 0).getDate();
    const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7; // lundi en premier
    const precedent = () => (mois === 0 ? (setMois(11), setAnnee(annee - 1)) : setMois(mois - 1));
    const suivant = () => (mois === 11 ? (setMois(0), setAnnee(annee + 1)) : setMois(mois + 1));
    contenu = (
      <>
        <div className="calendrier__entete">
          <Fleche
            sens="avant"
            libelle="Mois précédent"
            onClick={precedent}
            disabled={annee <= ANNEE_MIN && mois === 0}
          />
          <span className="calendrier__titre">
            <button
              type="button"
              className="calendrier__titre--bouton"
              onClick={() => setVue('mois')}
              aria-label={`${MOIS[mois]}, choisir un autre mois`}
            >
              {MOIS[mois]}
            </button>{' '}
            <button
              type="button"
              className="calendrier__titre--bouton"
              onClick={() => setVue('annees')}
              aria-label={`${annee}, choisir une autre année`}
            >
              {annee}
            </button>
          </span>
          <Fleche
            sens="apres"
            libelle="Mois suivant"
            onClick={suivant}
            disabled={futur(annee, mois + 1, 1)}
          />
        </div>
        <div className="calendrier__grille calendrier__grille--7">
          {JOURS.map((j) => (
            <span key={j} className="calendrier__jour-nom" aria-hidden="true">
              {j.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {Array.from({ length: decalage }, (_, i) => (
            <span key={`vide-${i}`} />
          ))}
          {Array.from({ length: nbJours }, (_, i) => i + 1).map((j) => (
            <button
              key={j}
              type="button"
              className="calendrier__case calendrier__case--jour"
              aria-label={`${j} ${MOIS[mois]} ${annee}`}
              aria-pressed={
                choisie?.annee === annee && choisie?.mois === mois && choisie?.jour === j
              }
              disabled={futur(annee, mois, j)}
              onClick={() => choisir(iso(annee, mois, j))}
            >
              {j}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div
      className="calendrier"
      role="dialog"
      aria-label="Choisir une date de naissance"
      ref={cadre}
    >
      {contenu}
    </div>
  );
}

export default function ChampDate({
  id,
  valeur,
  changer,
  aujourdhui,
  'aria-invalid': invalide,
  'aria-describedby': decrit,
}) {
  const [texte, setTexte] = useState(() => isoVersTexte(valeur));
  const [ouvert, setOuvert] = useState(false);
  const [dateDuJour] = useState(() => aujourdhui ?? new Date());
  const saisie = useRef(null);

  function taper(e) {
    const masque = masquer(e.target.value);
    setTexte(masque);
    changer(texteVersIso(masque) ?? masque);
  }

  function choisir(date) {
    setTexte(isoVersTexte(date));
    changer(date);
    setOuvert(false);
    saisie.current?.focus();
  }

  function fermer(remettreLeFocus = false) {
    setOuvert(false);
    if (remettreLeFocus) saisie.current?.focus();
  }

  return (
    <div className="champ-date">
      <div className="champ-date__ligne">
        <input
          id={id}
          ref={saisie}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="JJ/MM/AAAA"
          maxLength={10}
          value={texte}
          onChange={taper}
          aria-invalid={invalide}
          aria-describedby={decrit}
        />
        <button
          type="button"
          className="champ-date__bouton"
          aria-label="Ouvrir le calendrier"
          aria-expanded={ouvert}
          onClick={() => setOuvert(!ouvert)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
      </div>
      {ouvert && (
        <Calendrier valeur={valeur} aujourdhui={dateDuJour} choisir={choisir} fermer={fermer} />
      )}
    </div>
  );
}
