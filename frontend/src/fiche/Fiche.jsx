// Fiche d'une SCPI (US-02), à l'adresse /catalogue/<id> : ouverte par « En savoir plus »
// d'une carte du Catalogue ou directement par son adresse. Maquette validée par le BA :
// bandeau bleu (nom, société de gestion, taux, boutons), chiffres clés, frais et
// conditions, évolution (taux et prix de part), pays (carte zoomée) et secteurs,
// texte publicitaire. IBAN et BIC jamais affichés (absents de la réponse du backend).
// SCPI absente du référentiel : message « n'est plus / pas disponible » et lien vers le
// Catalogue. « Retour au catalogue » retrouve la recherche, les filtres, le tri et la page
// (gardés par le Catalogue : catalogue/etat.js et filtres.js).
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { deconnecter } from '../auth.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import { absent, formaterEuros, formaterTaux, NON_COMMUNIQUE } from '../utils/format.js';
import { lireFiche } from './api.js';
import CartePays from './CartePays.jsx';
import {
  couleurSecteur,
  DONNEES_NON_DISPONIBLES,
  formaterCapital,
  formaterCashback,
  formaterMois,
  formaterPart,
  liens,
  listePays,
  pastilles,
  texteParts,
  textePrix,
  texteTaux,
  texteVersement,
} from './donnees.js';
import { Camembert, GraphPrix, GraphTaux } from './Graphiques.jsx';
import './fiche.css';

function naviguer(url) {
  window.location.assign(url);
}

// Icônes décoratives (traits)
const ICONES = {
  prix: (
    <>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  minimum: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  capitalisation: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  delai: (
    <path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2" />
  ),
  souscription: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  gestion: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  frequence: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  reconstitution: <path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10" />,
  cashback: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </>
  ),
  versement: (
    <path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
  ),
};

function Icone({ nom }) {
  return (
    <svg
      className="fiche__icone"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONES[nom]}
    </svg>
  );
}

function Bandeau({ fiche }) {
  const adresses = liens(fiche);
  const taux = fiche.tauxDistribution;
  return (
    <header className="fiche__bandeau">
      <LienInterne to="/catalogue" className="fiche__retour">
        <span className="fiche__retour-fleche" aria-hidden="true">
          ←
        </span>
        Retour au catalogue
      </LienInterne>
      <div className="fiche__identite">
        <div className="fiche__nom">
          <p className="fiche__gerant">
            Société de gestion · <strong>{fiche.gerant ?? NON_COMMUNIQUE}</strong>
          </p>
          <h1 id="titre-page" className="fiche__titre">
            {fiche.nom}
          </h1>
          {pastilles(fiche).length > 0 && (
            <ul className="fiche__pastilles">
              {pastilles(fiche).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="fiche__taux">
          {/* Cercles décoratifs centrés sur le taux */}
          <svg
            className="fiche__cercles"
            viewBox="0 0 400 400"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="200" cy="200" r="190" />
            <circle cx="200" cy="200" r="140" />
            <circle cx="200" cy="200" r="90" />
          </svg>
          <p>Taux de distribution{taux ? ` ${taux.annee}` : ''}</p>
          <p className={taux ? 'fiche__taux-valeur' : 'fiche__taux-valeur fiche__nc'}>
            {taux ? formaterTaux(taux.valeur) : NON_COMMUNIQUE}
          </p>
        </div>
      </div>
      <nav className="fiche__actions" aria-label="Actions sur la SCPI">
        <LienInterne to={adresses.investir} className="fiche__bouton fiche__bouton--principal">
          Investir →
        </LienInterne>
        <LienInterne to={adresses.comparer} className="fiche__bouton">
          Comparer
        </LienInterne>
        <LienInterne to={adresses.simuler} className="fiche__bouton">
          Simuler
        </LienInterne>
        {adresses.versement && (
          <LienInterne to={adresses.versement} className="fiche__bouton">
            Programmer un versement
          </LienInterne>
        )}
      </nav>
    </header>
  );
}

function Chiffre({ icone, libelle, valeur, detail }) {
  return (
    <div className={`fiche__chiffre fiche__chiffre--${icone}`}>
      <span className="fiche__chiffre-icone">
        <Icone nom={icone} />
      </span>
      <div>
        <dt>{libelle}</dt>
        <dd
          className={
            valeur === NON_COMMUNIQUE ? 'fiche__chiffre-valeur fiche__nc' : 'fiche__chiffre-valeur'
          }
        >
          {valeur}
        </dd>
        {detail && <dd className="fiche__chiffre-detail">{detail}</dd>}
      </div>
    </div>
  );
}

function ChiffresCles({ fiche }) {
  return (
    <dl className="fiche__chiffres" aria-label="Chiffres clés">
      <Chiffre
        icone="prix"
        libelle="Prix de part"
        valeur={fiche.prixPart ? formaterEuros(fiche.prixPart.valeur) : NON_COMMUNIQUE}
        detail={fiche.prixPart ? `en ${fiche.prixPart.annee}` : null}
      />
      <Chiffre
        icone="minimum"
        libelle="Minimum à investir"
        valeur={formaterEuros(fiche.minimum)}
        detail={texteParts(fiche.minimumParts)}
      />
      <Chiffre
        icone="capitalisation"
        libelle="Capitalisation"
        valeur={formaterCapital(fiche.capitalisation)}
        detail="taille de la SCPI"
      />
      <Chiffre
        icone="delai"
        libelle="Délai de jouissance"
        valeur={formaterMois(fiche.delaiJouissance)}
        detail="avant les premiers revenus"
      />
    </dl>
  );
}

function Condition({ icone, libelle, valeur }) {
  return (
    <div className={`fiche__condition fiche__condition--${icone}`}>
      <dt>
        <span className="fiche__condition-icone">
          <Icone nom={icone} />
        </span>
        {libelle}
      </dt>
      <dd className={valeur === NON_COMMUNIQUE ? 'fiche__nc' : undefined}>{valeur}</dd>
    </div>
  );
}

function FraisEtConditions({ fiche }) {
  const reconstitution = fiche.valeurReconstitution;
  return (
    <section className="fiche__carte-blanche fiche__frais" aria-labelledby="fiche-frais">
      <h2 id="fiche-frais" className="fiche__titre-section">
        Frais et conditions
      </h2>
      <dl className="fiche__conditions">
        <Condition
          icone="souscription"
          libelle="Frais de souscription"
          valeur={formaterTaux(fiche.fraisSouscription)}
        />
        <Condition
          icone="gestion"
          libelle="Frais de gestion"
          valeur={formaterTaux(fiche.fraisGestion)}
        />
        <Condition
          icone="frequence"
          libelle="Fréquence des revenus"
          valeur={fiche.frequence ?? NON_COMMUNIQUE}
        />
        <Condition
          icone="reconstitution"
          libelle="Valeur de reconstitution"
          valeur={reconstitution ? formaterEuros(reconstitution.valeur) : NON_COMMUNIQUE}
        />
        <Condition icone="cashback" libelle="Cashback" valeur={formaterCashback(fiche.cashback)} />
        <Condition icone="versement" libelle="Versement programmé" valeur={texteVersement(fiche)} />
      </dl>
    </section>
  );
}

// Règles 10 et 12 : graphique à partir de deux années ; une seule : valeur et année ;
// aucune : « Données non disponibles »
function Historique({ titre, valeurs, texte, Graphique, classe }) {
  const periode = valeurs.length > 1 ? ` · ${valeurs[0].annee} – ${valeurs.at(-1).annee}` : '';
  let contenu;
  if (valeurs.length === 0) {
    contenu = <p className="fiche__vide">{DONNEES_NON_DISPONIBLES}</p>;
  } else if (valeurs.length === 1) {
    contenu = (
      <p className="fiche__valeur-seule">
        <strong>{texte(valeurs[0])}</strong> en {valeurs[0].annee}
      </p>
    );
  } else {
    contenu = <Graphique valeurs={valeurs} />;
  }
  return (
    <figure className={`fiche__historique ${classe}`}>
      <figcaption>
        <strong>{titre}</strong>
        {periode}
      </figcaption>
      {contenu}
    </figure>
  );
}

function Evolution({ fiche }) {
  return (
    <section className="fiche__carte-blanche" aria-labelledby="fiche-evolution">
      <h2 id="fiche-evolution" className="fiche__titre-section">
        Évolution
      </h2>
      <div className="fiche__historiques">
        <Historique
          titre="Taux de distribution"
          valeurs={fiche.historiqueTaux}
          texte={texteTaux}
          Graphique={GraphTaux}
          classe="fiche__historique--taux"
        />
        <Historique
          titre="Prix de part"
          valeurs={fiche.historiquePrix}
          texte={textePrix}
          Graphique={GraphPrix}
          classe="fiche__historique--prix"
        />
      </div>
    </section>
  );
}

function ListeParts({ parts, etiquette }) {
  return (
    <ul className="fiche__parts" aria-label={etiquette}>
      {parts.map((p) => (
        <li key={p.nom}>
          <span className="fiche__part-texte">
            <span>
              {p.point && (
                <span
                  className="fiche__point"
                  style={{ background: p.couleur }}
                  aria-hidden="true"
                />
              )}
              {p.nom}
            </span>
            <strong>{formaterPart(p.part)}</strong>
          </span>
          <span className="fiche__jauge" aria-hidden="true">
            <span style={{ width: `${Math.min(p.part, 100)}%`, background: p.couleur }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Repartitions({ fiche, chargerMonde }) {
  const pays = useMemo(() => listePays(fiche.repartitionGeographique), [fiche]);
  const secteurs = fiche.repartitionSectorielle.map((s, i) => ({
    nom: s.libelle,
    part: s.part,
    couleur: couleurSecteur(i),
    point: true,
  }));
  return (
    <div className="fiche__repartitions">
      <section className="fiche__carte-blanche" aria-labelledby="fiche-pays">
        <div className="fiche__entete-section">
          <h2 id="fiche-pays" className="fiche__titre-section">
            Répartition géographique
          </h2>
          {pays.length > 0 && <p>{pays.length} pays</p>}
        </div>
        {pays.length === 0 ? (
          <p className="fiche__vide">{DONNEES_NON_DISPONIBLES}</p>
        ) : (
          <>
            <div className="fiche__zone-carte fiche__zone-carte--pays">
              <CartePays pays={pays} charger={chargerMonde} />
            </div>
            <ListeParts parts={pays} etiquette="Part de chaque pays" />
          </>
        )}
      </section>
      <section className="fiche__carte-blanche" aria-labelledby="fiche-secteurs">
        <h2 id="fiche-secteurs" className="fiche__titre-section">
          Répartition sectorielle
        </h2>
        {secteurs.length === 0 ? (
          <p className="fiche__vide">{DONNEES_NON_DISPONIBLES}</p>
        ) : (
          <>
            <div className="fiche__zone-carte">
              <Camembert parts={secteurs} />
            </div>
            <ListeParts parts={secteurs} etiquette="Part de chaque secteur" />
          </>
        )}
      </section>
    </div>
  );
}

// Règle 4 : texte du référentiel tel quel, dans un bloc à part ; sans texte, pas de bloc
function Publicite({ texte }) {
  if (absent(texte)) return null;
  return (
    <aside className="fiche__publicite" aria-labelledby="fiche-publicite">
      <p id="fiche-publicite" className="fiche__publicite-titre">
        Communication à caractère promotionnel
      </p>
      <p>{texte}</p>
    </aside>
  );
}

// Règle 8 : SCPI absente du référentiel
function Absente({ message }) {
  return (
    <div className="fiche__absente">
      <h1 id="titre-page" className="application__titre">
        {message}
      </h1>
      <LienInterne to="/catalogue" className="compte__bouton">
        Retour au catalogue
      </LienInterne>
    </div>
  );
}

export default function Fiche({
  lire = lireFiche,
  chargerMonde,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const { id } = useParams();
  const [etat, setEtat] = useState({ id: null, fiche: null, absente: null, alerte: '' });

  useEffect(() => {
    let actif = true;
    lire(id)
      .then((fiche) => actif && setEtat({ id, fiche, absente: null, alerte: '' }))
      .catch((err) => {
        if (!actif) return;
        if (err.status === 401) allerA('/connexion');
        else if (err.status === 404) setEtat({ id, fiche: null, absente: err.message, alerte: '' });
        else setEtat({ id, fiche: null, absente: null, alerte: err.message });
      });
    return () => {
      actif = false;
    };
  }, [id, lire, allerA]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const aJour = etat.id === id;
  const { fiche, absente, alerte } = aJour ? etat : { fiche: null, absente: null, alerte: '' };
  let bandeau;
  if (fiche) bandeau = <Bandeau fiche={fiche} />;
  else if (absente) bandeau = <Absente message={absente} />;

  return (
    <PageApplication
      titre="Fiche SCPI"
      actif="catalogue"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
      bandeau={bandeau}
    >
      {alerte && (
        <p className="compte__alerte" role="alert">
          {alerte}
        </p>
      )}
      {!fiche && !absente && !alerte && <p className="compte__texte">Chargement…</p>}
      {fiche && (
        <div className="fiche">
          <Publicite texte={fiche.publicite} />
          <ChiffresCles fiche={fiche} />
          <FraisEtConditions fiche={fiche} />
          <Evolution fiche={fiche} />
          <Repartitions fiche={fiche} chargerMonde={chargerMonde} />
        </div>
      )}
    </PageApplication>
  );
}
