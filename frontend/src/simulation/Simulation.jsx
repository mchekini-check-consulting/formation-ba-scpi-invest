// Simulation (US-08, SCPI-257) : une ou plusieurs lignes « SCPI, nombre de parts, type
// d'investissement, durée de placement » (une durée par ligne, décision BA US-09), et le
// résultat, sous la saisie, recalculé à chaque modification (règles dans calculs.js). Lignes pré-remplies par l'adresse
// (/simulation?scpi=3:10,7:5, convention C1), lue seulement à l'ouverture. Rien n'est
// enregistré.
// US-09 (SCPI-258) : revenus « Bruts » et « Après fiscalité » (impôt calculé par le
// backend, règles US-07) et trois graphiques (barres, pays, secteurs).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { deconnecter } from '../auth.js';
import { chargerMonde as chargerMondeParDefaut } from '../fiche/carte.js';
import PageApplication from '../navigation/PageApplication.jsx';
import { absent, formaterEuros, formaterTaux, NON_COMMUNIQUE } from '../utils/format.js';
import ListeAvecRecherche from '../utils/ListeAvecRecherche.jsx';
import { estimerFiscalite, lireSimulables } from './api.js';
import {
  DUREE_MAX,
  DUREE_MIN,
  NUE_PROPRIETE,
  PLEINE_PROPRIETE,
  USUFRUIT,
  apresFiscalite,
  calculerLigne,
  calculerSimulation,
  changerDemembrement,
  changerType,
  horizon,
  lignesAEstimer,
  lireLignes,
  nouvelleLigne,
  periodes,
  revenusParAnnee,
  tauxParLigne,
  typesProposes,
} from './calculs.js';
import { Barres, Carte, Disque, Legende } from './Graphiques.jsx';
import { repartition, revenusParScpi } from './repartitions.js';
import MaFiscalite from './MaFiscalite.jsx';
import { garderSimulation, lireSimulationEnCours } from './memoire.js';
import Resultat, { MENTION } from './Resultat.jsx';
import './simulation.css';

// Textes du bloc Résultat, repris par les tests de la page
export { MESSAGE_AVEC_INFORMATIONS, MESSAGE_SANS_INFORMATIONS } from './MaFiscalite.jsx';
export { MENTION } from './Resultat.jsx';

// Délai avant de demander l'impôt au backend après une modification (saisie en cours)
const ATTENTE_ESTIMATION = 300;

const DUREES = Array.from({ length: DUREE_MAX - DUREE_MIN + 1 }, (_, i) => DUREE_MIN + i);
const ans = (n) => `${n} an${n > 1 ? 's' : ''}`;

const parts = (n) => `${n} part${n > 1 ? 's' : ''}`;

// Décote = réduction par rapport au prix en pleine propriété : celle du référentiel en
// nue-propriété, son complément en usufruit
const decotePour = (type, decote) => (type === USUFRUIT ? 100 - decote : decote);

// Repères de la SCPI choisie, pour savoir combien mettre : prix de part, dernier taux de
// distribution connu (demande BA), minimum à investir
// (et le nombre de parts qui l'atteint : une part ne se divise pas), délai de jouissance
// retenu par la simulation (absent du référentiel : 0 mois, règle 6) ; en démembrement,
// la part du prix payée pour la durée choisie
function Reperes({ scpi, ligne }) {
  const choisie =
    ligne.type === PLEINE_PROPRIETE
      ? undefined
      : scpi.decotes?.find((d) => d.duree === ligne.dureeDemembrement);
  const minimum = absent(scpi.minimum)
    ? NON_COMMUNIQUE
    : formaterEuros(scpi.minimum) +
      (absent(scpi.prixPart) || scpi.prixPart <= 0
        ? ''
        : ` (soit ${parts(Math.max(1, Math.ceil(scpi.minimum / scpi.prixPart - 1e-9)))})`);
  return (
    <dl className="simulation__reperes">
      <div>
        <dt>Prix de la part</dt>
        <dd>{formaterEuros(scpi.prixPart)}</dd>
      </div>
      <div>
        <dt>Dernier taux de distribution</dt>
        <dd>{formaterTaux(scpi.tauxDistribution)}</dd>
      </div>
      <div>
        <dt>Minimum à investir</dt>
        <dd>{minimum}</dd>
      </div>
      {/* Nue-propriété : pas de revenu avant la fin du démembrement, le délai ne joue pas */}
      {ligne.type !== NUE_PROPRIETE && (
        <div>
          <dt>Délai de jouissance retenu</dt>
          <dd>
            {absent(scpi.delaiJouissance)
              ? '0 mois (non communiqué)'
              : `${scpi.delaiJouissance} mois`}
          </dd>
        </div>
      )}
      {choisie && (
        <div>
          <dt>Vous payez</dt>
          <dd>{formaterTaux(100 - decotePour(ligne.type, choisie.decote))} du prix de la part</dd>
        </div>
      )}
    </dl>
  );
}

// Message sous une ligne, selon son résultat
function Messages({ resultat, type }) {
  switch (resultat.etat) {
    case 'sousMinimum':
      return (
        <p className="simulation__avertissement" role="status">
          En dessous du minimum de souscription ({formaterEuros(resultat.minimum)})
        </p>
      );
    case 'partsInvalides':
      return (
        <p className="simulation__avertissement" role="status">
          Saisissez un nombre entier de parts, au moins 1
        </p>
      );
    case 'nonCommunique':
      return (
        <p className="simulation__avertissement" role="status">
          Prix de part ou taux de distribution non communiqué : ligne non prise en compte
        </p>
      );
    case 'ok':
      return (
        <>
          <ul className="simulation__infos">
            <li>Montant : {formaterEuros(resultat.montant)}</li>
            {type === NUE_PROPRIETE ? (
              <li className="simulation__sans-revenu">
                Aucun revenu pendant {ans(resultat.demembrement)}
              </li>
            ) : (
              <li>Premiers revenus dans {resultat.delai} mois</li>
            )}
            {type === USUFRUIT && <li>Revenus pendant {ans(resultat.demembrement)} seulement</li>}
          </ul>
        </>
      );
    default:
      return null;
  }
}

function LigneSimulation({ numero, ligne, scpi, scpis, resultat, changer, retirer, retirable }) {
  const id = `simulation-ligne-${ligne.cle}`;
  const types = typesProposes(scpi);
  return (
    <li className="simulation__ligne">
      <div className="simulation__champs">
        <div className="simulation__champ simulation__champ--scpi">
          <label htmlFor={`${id}-scpi`}>
            SCPI<span className="sr-only"> de la ligne {numero}</span>
          </label>
          <ListeAvecRecherche
            id={`${id}-scpi`}
            placeholder="Rechercher une SCPI du catalogue…"
            vide="Aucune SCPI trouvée"
            valeur={ligne.scpi}
            changer={(choisie) =>
              changer({ ...ligne, scpi: choisie, type: PLEINE_PROPRIETE, dureeDemembrement: null })
            }
            options={scpis.map((s) => ({ cle: s.id, libelle: s.nom }))}
          />
        </div>
        <div className="simulation__champ simulation__champ--parts">
          <label htmlFor={`${id}-parts`}>Nombre de parts</label>
          <input
            id={`${id}-parts`}
            inputMode="numeric"
            disabled={!scpi}
            placeholder="—"
            value={scpi ? ligne.parts : ''}
            onChange={(e) => changer({ ...ligne, parts: e.target.value.replace(/[^\d]/g, '') })}
          />
        </div>
        <div className="simulation__champ">
          <label htmlFor={`${id}-type`}>Type d’investissement</label>
          <select
            id={`${id}-type`}
            value={ligne.type}
            disabled={!scpi}
            onChange={(e) => changer(changerType(ligne, e.target.value, scpi))}
          >
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.libelle}
              </option>
            ))}
          </select>
        </div>
        {ligne.type !== PLEINE_PROPRIETE && (
          <div className="simulation__champ">
            <label htmlFor={`${id}-demembrement`}>Durée du démembrement</label>
            <select
              id={`${id}-demembrement`}
              value={ligne.dureeDemembrement}
              onChange={(e) => changer(changerDemembrement(ligne, Number(e.target.value)))}
            >
              {scpi.decotes.map((d) => (
                <option key={d.duree} value={d.duree}>
                  {`${ans(d.duree)} · décote ${formaterTaux(decotePour(ligne.type, d.decote))}`}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* Usufruit : pas de durée de placement, c'est celle du démembrement */}
        {ligne.type !== USUFRUIT && (
          <div className="simulation__champ simulation__champ--duree">
            <label htmlFor={`${id}-duree`}>Durée de placement</label>
            <select
              id={`${id}-duree`}
              value={ligne.duree}
              onChange={(e) => changer({ ...ligne, duree: Number(e.target.value) })}
            >
              {DUREES.map((n) => (
                <option key={n} value={n}>
                  {ans(n)}
                </option>
              ))}
            </select>
          </div>
        )}
        {retirable && (
          <button
            type="button"
            className="simulation__retirer"
            aria-label={`Retirer la ligne ${numero}`}
            title="Retirer la ligne"
            onClick={retirer}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      {scpi && <Reperes scpi={scpi} ligne={ligne} />}
      <Messages resultat={resultat} type={ligne.type} />
    </li>
  );
}

// Règles 10 à 12 : graphiques des lignes prises en compte, présentés comme sur la fiche
// US-02 : carte des pays, camembert des secteurs, légendes en pastilles
function Repartition({
  id,
  titre,
  compte,
  objet,
  repartition: { parts, sansRepartition },
  children,
}) {
  return (
    <section className="fiche__carte-blanche" aria-labelledby={id}>
      <div className="fiche__entete-section">
        <h2 id={id} className="fiche__titre-section">
          {titre}
        </h2>
        {compte && parts.length > 0 && <p>{compte(parts)}</p>}
      </div>
      {parts.length === 0 ? (
        <p className="fiche__vide">Données non disponibles</p>
      ) : (
        <>
          {children}
          <Legende parts={parts} etiquette={titre} />
        </>
      )}
      {sansRepartition.length > 0 && (
        <p className="simulation__note">
          Sans {objet}, non prise{sansRepartition.length > 1 ? 's' : ''} en compte :{' '}
          {sansRepartition.join(', ')}
        </p>
      )}
    </section>
  );
}

function GraphiquesSimulation({ lignes, chargerMonde }) {
  const barres = revenusParScpi(lignes);
  // Recalculées seulement quand les SCPI ou les montants changent (la carte se redessine)
  const cle = JSON.stringify(lignes.map((l) => [l.scpi.id, l.montant]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pays = useMemo(() => repartition(lignes, 'pays'), [cle]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const secteurs = useMemo(() => repartition(lignes, 'secteurs'), [cle]);
  return (
    <div className="simulation__graphiques">
      <section className="fiche__carte-blanche" aria-labelledby="simulation-g-revenus">
        <div className="fiche__entete-section">
          <h2 id="simulation-g-revenus" className="fiche__titre-section">
            Revenus annuels par SCPI
          </h2>
        </div>
        {barres.length === 0 ? (
          <p className="fiche__vide">Aucun revenu en année pleine</p>
        ) : (
          <Barres barres={barres} />
        )}
      </section>
      <div className="fiche__repartitions">
        <Repartition
          id="simulation-g-pays"
          titre="Répartition géographique"
          compte={(parts) => `${parts.filter((p) => p.iso !== null).length} pays`}
          objet="répartition géographique"
          repartition={pays}
        >
          <Carte parts={pays.parts} charger={chargerMonde} />
        </Repartition>
        <Repartition
          id="simulation-g-secteurs"
          titre="Répartition sectorielle"
          objet="répartition sectorielle"
          repartition={secteurs}
        >
          <Disque parts={secteurs.parts} />
        </Repartition>
      </div>
    </div>
  );
}

// Simulation en cours à reprendre en revenant sur l'écran : toujours par le menu (adresse
// sans ?scpi=) ; avec ?scpi= (« Simuler » d'une fiche ou du catalogue), seulement si elle a
// été ouverte avec la même adresse (retour arrière du navigateur) ; null sinon
function reprise(origine) {
  const enCours = lireSimulationEnCours();
  if (!enCours) return null;
  return origine === null || enCours.origine === origine ? enCours : null;
}

function naviguer(url) {
  window.location.assign(url);
}

export default function Simulation({
  lire = lireSimulables,
  estimer = estimerFiscalite,
  chargerMonde = chargerMondeParDefaut,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const [parametres] = useSearchParams();
  // Les lignes de l'adresse ne sont lues qu'à l'ouverture
  const [selectionInitiale] = useState(() => parametres.get('scpi'));
  const [scpis, setScpis] = useState(null);
  const [alerte, setAlerte] = useState('');
  const [lignes, setLignes] = useState([]);
  // Taux choisi sans informations fiscales (null : celui du backend, 30 %) ; non enregistré
  const [taux, setTaux] = useState(() => reprise(selectionInitiale)?.taux ?? null);
  // Dernière estimation reçue, et la demande à laquelle elle répond
  const [estimation, setEstimation] = useState(null);
  const [erreurFiscale, setErreurFiscale] = useState(null);

  useEffect(() => {
    let actif = true;
    lire()
      .then((resultat) => {
        if (!actif) return;
        setScpis(resultat);
        // Simulation en cours reprise (retour sur l'écran), sinon lignes de l'adresse
        setLignes(reprise(selectionInitiale)?.lignes ?? lireLignes(selectionInitiale, resultat));
      })
      .catch((err) => {
        if (!actif) return;
        if (err.status === 401) allerA('/connexion');
        else setAlerte(err.message);
      });
    return () => {
      actif = false;
    };
  }, [lire, allerA, selectionInitiale]);

  // Simulation gardée à chaque modification, pour la retrouver en revenant sur l'écran
  useEffect(() => {
    if (scpis) garderSimulation({ origine: selectionInitiale, lignes, taux });
  }, [scpis, selectionInitiale, lignes, taux]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const parId = new Map((scpis ?? []).map((s) => [s.id, s]));
  const resultats = lignes.map((l) => calculerLigne(l, parId.get(l.scpi) ?? null));
  const total = calculerSimulation(resultats);
  // Lignes prises en compte (sans impôt) et leurs périodes de revenus
  const lignesBase = lignes
    .map((l, i) => ({ ligne: l, scpi: parId.get(l.scpi), resultat: resultats[i] }))
    .filter(({ resultat }) => resultat.etat === 'ok')
    .map(({ ligne, scpi, resultat }) => ({
      scpi,
      nom: scpi.nom,
      type: ligne.type,
      demembrement: resultat.demembrement,
      duree: ligne.duree,
      parts: Number(ligne.parts),
      delai: resultat.delai,
      montant: resultat.montant,
      revenuAnnuel: resultat.revenuAnnuel,
    }));
  const periodesBrutes = periodes(lignesBase);
  // Impôt calculé par le backend sur le total des revenus de chaque période, et année par
  // année pour le cumul (changement de TMI, année 1 réduite par le délai de jouissance)
  const demande = {
    lignes: lignesAEstimer(lignes, resultats),
    periodes: periodesBrutes.map((p) => p.revenus),
    annees: revenusParAnnee(lignesBase),
  };
  const cle = JSON.stringify({ demande, taux });

  // Impôt des lignes prises en compte (règle 3 : calcul US-07 du backend), redemandé à
  // chaque modification, un court instant après la dernière
  useEffect(() => {
    if (!scpis) return undefined;
    let actif = true;
    const minuterie = setTimeout(() => {
      const { demande: corps, taux: tauxChoisi } = JSON.parse(cle);
      estimer(corps, tauxChoisi)
        .then((donnees) => {
          if (actif) setEstimation({ cle, donnees });
        })
        .catch((err) => {
          if (!actif) return;
          if (err.status === 401) allerA('/connexion');
          else setErreurFiscale(cle);
        });
    }, ATTENTE_ESTIMATION);
    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
  }, [scpis, cle, estimer, allerA]);

  const aJour = estimation?.cle === cle;
  const donnees = aJour ? estimation.donnees : null;
  const net = donnees ? apresFiscalite(donnees) : null;
  const lesPeriodes = donnees ? periodes(lignesBase, donnees.periodes) : periodesBrutes;
  // Taux d'impôt de chaque ligne (détail par SCPI, graphiques), une fois l'impôt connu
  const tauxLignes = tauxParLigne(lignesBase.length, lesPeriodes, donnees?.periodes);
  const lignesOk = lignesBase.map((l, i) => ({ ...l, tauxImpot: tauxLignes[i] }));

  // Fin de la simulation : la plus longue durée de placement
  const duree = horizon(lignesOk.length ? lignesOk : lignes);
  // Écran d'accueil : une seule ligne, sans SCPI choisie (ni croix, ni « Ajouter »)
  const accueil = lignes.length === 1 && lignes[0].scpi === null;

  return (
    <PageApplication
      titre="Simuler"
      actif="simulation"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
    >
      {alerte && (
        <p className="compte__alerte" role="alert">
          {alerte}
        </p>
      )}
      {!scpis ? (
        !alerte && <p className="compte__texte">Chargement…</p>
      ) : (
        <div className="simulation__page">
          <p className="simulation__intro">
            Estimez les revenus d’un investissement en SCPI, avant et après impôt.
          </p>
          <div className="simulation">
            <section className="simulation__saisie" aria-labelledby="simulation-lignes">
              <h2 id="simulation-lignes" className="simulation__titre">
                Mes SCPI
              </h2>
              <ol className="simulation__lignes">
                {lignes.map((ligne, i) => (
                  <LigneSimulation
                    key={ligne.cle}
                    numero={i + 1}
                    ligne={ligne}
                    scpi={parId.get(ligne.scpi) ?? null}
                    scpis={scpis}
                    resultat={resultats[i]}
                    changer={(nouvelle) => setLignes(lignes.with(i, nouvelle))}
                    retirer={() => setLignes(lignes.filter((l) => l.cle !== ligne.cle))}
                    retirable={!accueil}
                  />
                ))}
              </ol>
              {lignes.some((l) => l.scpi === null) && (
                <p className="simulation__aide simulation__aide--saisie">
                  Le nombre de parts et le type d’investissement se débloquent une fois la SCPI
                  choisie.
                </p>
              )}
              {!accueil && (
                <button
                  type="button"
                  className="simulation__ajouter"
                  onClick={() => setLignes([...lignes, nouvelleLigne()])}
                >
                  + Ajouter une SCPI
                </button>
              )}
            </section>

            <MaFiscalite estimation={estimation?.donnees} taux={taux} choisirTaux={setTaux} />

            <Resultat
              total={total}
              net={net}
              duree={duree}
              periodes={lesPeriodes}
              lignes={lignesOk}
              estimation={estimation?.donnees}
              impotIndisponible={erreurFiscale === cle}
            />
          </div>
          {lignesOk.length > 0 && (
            <GraphiquesSimulation lignes={lignesOk} chargerMonde={chargerMonde} />
          )}
          <p className="simulation__mention">{MENTION}</p>
        </div>
      )}
    </PageApplication>
  );
}
