// Catalogue des SCPI (US-08), accessible seulement une fois le profil investisseur
// validé (US-05b). Profil non validé (certification non cochée, étapes non complétées)
// -> formulaire investisseur, qui reprend là où l'utilisateur en était (écran du
// résultat du profil si les 5 étapes sont complétées). Sans session -> connexion.
// Affiché avec la sidebar de navigation, entrée Catalogue sélectionnée (US-06).
// Liste : 12 SCPI par page, triées par taux de distribution N-1 décroissant (tri fait
// par le backend), nombre total de SCPI et date de mise à jour des données.
// Filtres (US-10a, US-10b, US-10c) : panneau, pastilles des filtres actifs, appliqués par
// le backend sur tout le catalogue ; changer un filtre ramène à la première page.
// Tri (US-11) : menu « Trier par » à côté de la barre de recherche, appliqué par le backend
// sur tout le catalogue ; changer de tri garde les filtres et ramène à la première page.
// Recherche par nom (Recherche.jsx) : ses résultats remplacent la liste tant qu'elle est
// active.
import { useEffect, useId, useRef, useState } from 'react';
import { deconnecter } from '../auth.js';
import { lireQuestionnaire } from '../investisseur/api.js';
import { formulairesPassables } from '../outils/passerFormulaires.js';
import PageApplication from '../navigation/PageApplication.jsx';
import { lireFiltresCatalogue, listerScpis, rechercherScpis } from './api.js';
import { FILTRES_VIDES, memoriserFiltres, pastilles, relireFiltres } from './filtres.js';
import { BarreFiltres, PanneauFiltres } from './PanneauFiltres.jsx';
import { BarreRecherche, ResultatsRecherche } from './Recherche.jsx';
import { useRecherche } from './useRecherche.js';
import { photosPage } from './photos.js';
import { OPTIONS_TRI, TRI_PAR_DEFAUT } from './tri.js';
import './catalogue.css';
import {
  SEGMENTS,
  formaterCapitalisation,
  formaterDate,
  formaterTaux,
  formaterTexte,
  segmentsPleins,
} from './format.js';

function naviguer(url) {
  window.location.assign(url);
}

// Sans session -> connexion ; autre erreur -> message affiché
function signalerErreur(err, allerA, setAlerte) {
  if (err.status === 401) {
    allerA('/connexion');
  } else {
    setAlerte(err.message);
  }
}

// Jauge segmentée du taux : échelle fixe de 0 à 10 %, 1 segment = 1 %. Décorative : le
// taux est écrit juste au-dessus.
function JaugeTaux({ taux }) {
  const pleins = segmentsPleins(taux);
  return (
    <div className="scpi__jauge" aria-hidden="true">
      <div className="scpi__segments">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <i
            key={i}
            className={i < pleins ? 'scpi__segment scpi__segment--plein' : 'scpi__segment'}
          />
        ))}
      </div>
      <div className="scpi__echelle">
        <span>0 %</span>
        <span>5 %</span>
        <span>10 %</span>
      </div>
    </div>
  );
}

// Petites icônes décoratives (traits), lues comme rien par un lecteur d'écran
const ICONES = {
  tendance: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  immeuble: 'M5 21V4h10v17M15 9h4v12M3 21h18M8 8h4M8 12h4M8 16h4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  fleche: 'M5 12h14M13 6l6 6-6 6',
};

function Icone({ nom }) {
  return (
    <svg
      className="scpi__icone"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICONES[nom]} />
    </svg>
  );
}

// Emoji en couleur devant le libellé (décoratif, ignoré par les lecteurs d'écran)
function Info({ emoji, libelle, valeur }) {
  return (
    <div className="scpi__info">
      <dt>
        <span className="scpi__emoji" aria-hidden="true">
          {emoji}
        </span>
        {libelle}
      </dt>
      <dd className={valeur === 'N/C' ? 'scpi__nc' : undefined}>{valeur}</dd>
    </div>
  );
}

// Bouton visible mais pas encore actif : aucun effet au clic, bulle « Bientôt disponible »
// au survol et au focus clavier (aria-disabled plutôt que disabled : un bouton disabled ne
// réagit ni au survol dans tous les navigateurs, ni au clavier).
function BoutonBientot({ principal, children }) {
  const idBulle = useId();
  return (
    <span className="scpi__bouton-zone">
      <button
        type="button"
        className={principal ? 'scpi__bouton scpi__bouton--principal' : 'scpi__bouton'}
        aria-disabled="true"
        aria-describedby={idBulle}
      >
        {children}
      </button>
      <span id={idBulle} role="tooltip" className="scpi__bulle">
        Bientôt disponible
      </span>
    </span>
  );
}

function CarteScpi({ scpi, anneeTaux, photo }) {
  return (
    <li className="scpi">
      {/* Photo décorative (le nom de la SCPI est juste dessous) : pas un bien réel de la SCPI */}
      <div className="scpi__photo">
        <img src={photo} alt="" loading="lazy" decoding="async" />
      </div>
      <h2 className="scpi__nom">{scpi.nom}</h2>
      <p className="scpi__gerant">{formaterTexte(scpi.gerant)}</p>
      <div className="scpi__taux">
        <p className="scpi__taux-titre">
          <Icone nom="tendance" />
          Taux de distribution {anneeTaux}
        </p>
        <p
          className={
            scpi.tauxDistribution == null ? 'scpi__taux-valeur scpi__nc' : 'scpi__taux-valeur'
          }
        >
          {formaterTaux(scpi.tauxDistribution)}
        </p>
        <JaugeTaux taux={scpi.tauxDistribution} />
      </div>
      <dl className="scpi__infos">
        <Info emoji="📍" libelle="Principal pays" valeur={formaterTexte(scpi.zoneGeographique)} />
        <Info emoji="🏢" libelle="Secteur principal" valeur={formaterTexte(scpi.categorie)} />
        <Info
          emoji="💳"
          libelle="Capitalisation"
          valeur={formaterCapitalisation(scpi.capitalisation)}
        />
      </dl>
      {/* Boutons affichés mais pas encore actifs (fonctionnalités à venir) */}
      <div className="scpi__actions">
        <BoutonBientot>
          <Icone nom="info" />
          En savoir plus
        </BoutonBientot>
        <BoutonBientot principal>
          Investir
          <Icone nom="fleche" />
        </BoutonBientot>
      </div>
    </li>
  );
}

// Menu de tri (US-11) : le tri actif reste affiché dans la liste
function MenuTri({ tri, onChange }) {
  const id = useId();
  return (
    <div className="tri-catalogue">
      <label htmlFor={id} className="tri-catalogue__libelle">
        Trier par
      </label>
      <select
        id={id}
        className="tri-catalogue__liste"
        value={tri}
        onChange={(e) => onChange(e.target.value)}
      >
        {OPTIONS_TRI.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pagination({ page, nombrePages, allerPage }) {
  if (nombrePages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination du catalogue">
      <button
        type="button"
        className="compte__bouton compte__bouton--secondaire"
        disabled={page <= 1}
        onClick={() => allerPage(page - 1)}
      >
        Précédent
      </button>
      <span className="pagination__position" aria-live="polite">
        Page {page} sur {nombrePages}
      </span>
      <button
        type="button"
        className="compte__bouton compte__bouton--secondaire"
        disabled={page >= nombrePages}
        onClick={() => allerPage(page + 1)}
      >
        Suivant
      </button>
    </nav>
  );
}

// En-tête figé en haut de l'écran : sous-titre, puis nombre de SCPI et date de mise à
// jour une fois la liste chargée
function EnteteCatalogue({ donnees, filtre }) {
  return (
    <>
      <p className="catalogue__sous-titre">Découvrez notre sélection de SCPI partenaires</p>
      {donnees && (
        <div className="catalogue__entete">
          <p className="catalogue__total">
            <Icone nom="immeuble" />
            {filtre
              ? `${donnees.total} SCPI correspondant à vos critères`
              : `${donnees.total} SCPI disponibles`}
          </p>
          <p className="catalogue__maj">
            Données mises à jour le {formaterDate(donnees.misAJourLe)}
          </p>
        </div>
      )}
    </>
  );
}

function AucunResultat({ filtre, reinitialiser }) {
  if (!filtre) {
    return <p className="compte__texte">Aucune SCPI n’est disponible pour le moment.</p>;
  }
  return (
    <div className="catalogue__aucun">
      <p className="compte__texte">Aucune SCPI ne correspond à vos critères.</p>
      <button type="button" className="compte__bouton" onClick={reinitialiser}>
        Réinitialiser les filtres
      </button>
    </div>
  );
}

// Cartes des SCPI, pour la liste du Catalogue comme pour les résultats de la recherche
function Cartes({ scpis, anneeTaux }) {
  const photos = photosPage(scpis);
  return (
    <ul className="catalogue__liste">
      {scpis.map((scpi) => (
        <CarteScpi key={scpi.id} scpi={scpi} anneeTaux={anneeTaux} photo={photos.get(scpi.id)} />
      ))}
    </ul>
  );
}

function ListeScpis({ donnees, allerPage, filtre, reinitialiser }) {
  return (
    <>
      {donnees.total === 0 ? (
        <AucunResultat filtre={filtre} reinitialiser={reinitialiser} />
      ) : (
        <Cartes scpis={donnees.scpis} anneeTaux={donnees.anneeTaux} />
      )}
      <Pagination page={donnees.page} nombrePages={donnees.nombrePages} allerPage={allerPage} />
    </>
  );
}

export default function Catalogue({
  lire = lireQuestionnaire,
  lister = listerScpis,
  lireFiltres = lireFiltresCatalogue,
  rechercher = rechercherScpis,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
  passer = formulairesPassables(),
}) {
  // Raccourci de test du poste : profil investisseur non exigé
  const [valide, setValide] = useState(passer);
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState(null);
  const [alerte, setAlerte] = useState('');
  const [filtres, setFiltres] = useState(relireFiltres);
  const [tri, setTri] = useState(TRI_PAR_DEFAUT);
  const [options, setOptions] = useState(null);
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const boutonFiltres = useRef(null);
  const filtre = pastilles(filtres, options).length > 0;
  const [saisie, setSaisie] = useState('');
  const recherche = useRecherche(saisie, rechercher);
  const sessionExpiree = recherche.erreur?.status === 401;

  // Session expirée pendant une recherche : connexion, comme pour la liste
  useEffect(() => {
    if (sessionExpiree) allerA('/connexion');
  }, [sessionExpiree, allerA]);

  useEffect(() => {
    if (passer) return undefined;
    let actif = true;
    lire()
      .then((avancement) => {
        if (!actif) return;
        if (avancement.valide) {
          setValide(true);
        } else {
          allerA('/formulaire-investisseur');
        }
      })
      .catch((err) => actif && signalerErreur(err, allerA, setAlerte));
    return () => {
      actif = false;
    };
  }, [lire, allerA, passer]);

  useEffect(() => {
    if (!valide) return undefined;
    let actif = true;
    lister(page, filtres, tri)
      .then((resultat) => {
        if (!actif) return;
        setAlerte('');
        setDonnees(resultat);
      })
      .catch((err) => actif && signalerErreur(err, allerA, setAlerte));
    return () => {
      actif = false;
    };
  }, [valide, page, filtres, tri, lister, allerA]);

  // Valeurs du panneau ; indisponibles : le panneau le dit, la liste reste affichée
  useEffect(() => {
    if (!valide) return undefined;
    let actif = true;
    lireFiltres()
      .then((resultat) => actif && setOptions(resultat))
      .catch(() => actif && setOptions(null));
    return () => {
      actif = false;
    };
  }, [valide, lireFiltres]);

  function changerFiltres(nouveaux) {
    setFiltres(nouveaux);
    memoriserFiltres(nouveaux);
    setPage(1);
  }

  function changerTri(nouveau) {
    setTri(nouveau);
    setPage(1);
  }

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  function allerPage(nouvelle) {
    setPage(nouvelle);
    window.scrollTo?.({ top: 0 });
  }

  return (
    <PageApplication
      titre="Catalogue SCPI"
      actif="catalogue"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
      entete={<EnteteCatalogue donnees={donnees} filtre={filtre} />}
    >
      {/* Filtres à gauche, menu de tri (US-11) puis recherche tout à droite, sur la même
          ligne */}
      {valide && (
        <div className="catalogue__outils">
          <BarreFiltres
            filtres={filtres}
            options={options}
            onChange={changerFiltres}
            onOuvrir={() => setPanneauOuvert(true)}
            refBouton={boutonFiltres}
            ouvert={panneauOuvert}
          />
          <MenuTri tri={tri} onChange={changerTri} />
          <BarreRecherche valeur={saisie} onChange={setSaisie} />
        </div>
      )}
      {panneauOuvert && (
        <PanneauFiltres
          filtres={filtres}
          options={options}
          total={donnees?.total}
          onChange={changerFiltres}
          onFermer={() => setPanneauOuvert(false)}
          retour={boutonFiltres}
        />
      )}
      {alerte && (
        <p className="compte__alerte" role="alert">
          {alerte}
        </p>
      )}
      {recherche.active ? (
        <ResultatsRecherche
          recherche={recherche}
          effacer={() => setSaisie('')}
          afficherCartes={({ scpis, anneeTaux }) => <Cartes scpis={scpis} anneeTaux={anneeTaux} />}
        />
      ) : donnees ? (
        <ListeScpis
          donnees={donnees}
          allerPage={allerPage}
          filtre={filtre}
          reinitialiser={() => changerFiltres(FILTRES_VIDES)}
        />
      ) : (
        !alerte && <p className="compte__texte">Chargement…</p>
      )}
    </PageApplication>
  );
}
