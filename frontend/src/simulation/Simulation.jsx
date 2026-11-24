// Simulation (US-08, SCPI-257) : une ou plusieurs lignes « SCPI, nombre de parts, type
// d'investissement », une durée de placement, et le résultat recalculé à chaque
// modification (règles dans calculs.js). Lignes pré-remplies par l'adresse
// (/simulation?scpi=3:10,7:5, convention C1), lue seulement à l'ouverture. Rien n'est
// enregistré.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { deconnecter } from '../auth.js';
import PageApplication from '../navigation/PageApplication.jsx';
import {
  absent,
  formaterEuros,
  formaterMontantCalcule,
  formaterTaux,
  NON_COMMUNIQUE,
} from '../utils/format.js';
import ListeAvecRecherche from '../utils/ListeAvecRecherche.jsx';
import { lireSimulables } from './api.js';
import {
  DUREE_MAX,
  DUREE_MIN,
  DUREE_PAR_DEFAUT,
  NUE_PROPRIETE,
  PLEINE_PROPRIETE,
  USUFRUIT,
  calculerLigne,
  calculerSimulation,
  changerType,
  lireLignes,
  nouvelleLigne,
  typesProposes,
} from './calculs.js';
import './simulation.css';

export const MENTION =
  'Estimation indicative, calculée avec le dernier taux de distribution connu. ' +
  'Les performances passées ne préjugent pas des performances futures.';

const DUREES = Array.from({ length: DUREE_MAX - DUREE_MIN + 1 }, (_, i) => DUREE_MIN + i);
const ans = (n) => `${n} an${n > 1 ? 's' : ''}`;

const parts = (n) => `${n} part${n > 1 ? 's' : ''}`;

// Décote = réduction par rapport au prix en pleine propriété : celle du référentiel en
// nue-propriété, son complément en usufruit
const decotePour = (type, decote) => (type === USUFRUIT ? 100 - decote : decote);

// Repères de la SCPI choisie, pour savoir combien mettre : prix de part, minimum à investir
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
function Messages({ resultat, type, duree }) {
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
              <li>Aucun revenu pendant {ans(resultat.demembrement)}</li>
            ) : (
              <li>Premiers revenus dans {resultat.delai} mois</li>
            )}
            {type === USUFRUIT && <li>Revenus pendant {ans(resultat.demembrement)} seulement</li>}
          </ul>
          {/* Usufruit plus court que le placement : plus rien après la fin du démembrement */}
          {type === USUFRUIT && duree > resultat.demembrement && (
            <p className="simulation__avertissement" role="status">
              La durée de placement ({ans(duree)}) dépasse la durée de l’usufruit (
              {ans(resultat.demembrement)}) : vous ne recevrez plus aucun revenu après la fin du
              démembrement.
            </p>
          )}
        </>
      );
    default:
      return null;
  }
}

function LigneSimulation({ numero, ligne, scpi, scpis, resultat, duree, changer, retirer }) {
  const id = `simulation-ligne-${ligne.cle}`;
  const types = typesProposes(scpi);
  return (
    <li className="simulation__ligne">
      <div className="simulation__champs">
        <div className="simulation__champ simulation__champ--scpi">
          <label htmlFor={`${id}-scpi`}>SCPI de la ligne {numero}</label>
          <ListeAvecRecherche
            id={`${id}-scpi`}
            placeholder="Choisir une SCPI"
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
            value={ligne.parts}
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
              onChange={(e) => changer({ ...ligne, dureeDemembrement: Number(e.target.value) })}
            >
              {scpi.decotes.map((d) => (
                <option key={d.duree} value={d.duree}>
                  {`${ans(d.duree)} · décote ${formaterTaux(decotePour(ligne.type, d.decote))}`}
                </option>
              ))}
            </select>
          </div>
        )}
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
      </div>
      {scpi && <Reperes scpi={scpi} ligne={ligne} />}
      <Messages resultat={resultat} type={ligne.type} duree={duree} />
    </li>
  );
}

function naviguer(url) {
  window.location.assign(url);
}

export default function Simulation({
  lire = lireSimulables,
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
  const [duree, setDuree] = useState(DUREE_PAR_DEFAUT);

  useEffect(() => {
    let actif = true;
    lire()
      .then((resultat) => {
        if (!actif) return;
        setScpis(resultat);
        setLignes(lireLignes(selectionInitiale, resultat));
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

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const parId = new Map((scpis ?? []).map((s) => [s.id, s]));
  const resultats = lignes.map((l) => calculerLigne(l, parId.get(l.scpi) ?? null, duree));
  const total = calculerSimulation(resultats);

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
        <div className="simulation">
          <section className="simulation__saisie" aria-labelledby="simulation-lignes">
            <div className="simulation__entete">
              <h2 id="simulation-lignes" className="simulation__titre">
                Mes SCPI
              </h2>
              <div className="simulation__champ simulation__champ--duree">
                <label htmlFor="simulation-duree">Durée de placement</label>
                <select
                  id="simulation-duree"
                  value={duree}
                  onChange={(e) => setDuree(Number(e.target.value))}
                >
                  {DUREES.map((n) => (
                    <option key={n} value={n}>
                      {ans(n)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ol className="simulation__lignes">
              {lignes.map((ligne, i) => (
                <LigneSimulation
                  key={ligne.cle}
                  numero={i + 1}
                  ligne={ligne}
                  scpi={parId.get(ligne.scpi) ?? null}
                  scpis={scpis}
                  resultat={resultats[i]}
                  duree={duree}
                  changer={(nouvelle) => setLignes(lignes.with(i, nouvelle))}
                  retirer={() => setLignes(lignes.filter((l) => l.cle !== ligne.cle))}
                />
              ))}
            </ol>
            <button
              type="button"
              className="simulation__ajouter"
              onClick={() => setLignes([...lignes, nouvelleLigne()])}
            >
              + Ajouter une SCPI
            </button>
          </section>

          <section className="simulation__resultat" aria-labelledby="simulation-resultat">
            <h2 id="simulation-resultat" className="simulation__titre">
              Résultat
            </h2>
            <dl className="simulation__chiffres" aria-live="polite">
              <div>
                <dt>Montant simulé</dt>
                <dd>{formaterEuros(total.montant)}</dd>
              </div>
              <div>
                <dt>Revenus annuels bruts</dt>
                <dd>{formaterMontantCalcule(total.annuel)}</dd>
              </div>
              <div>
                <dt>Revenus mensuels bruts</dt>
                <dd>{formaterMontantCalcule(total.mensuel)}</dd>
              </div>
              <div className="simulation__cumul">
                <dt>Revenus bruts cumulés sur {ans(duree)}</dt>
                <dd>{formaterMontantCalcule(total.cumul)}</dd>
              </div>
            </dl>
            {total.lignes === 0 && (
              <p className="simulation__aide">
                Choisissez une SCPI et un nombre de parts pour voir vos revenus.
              </p>
            )}
            <p className="simulation__mention">{MENTION}</p>
          </section>
        </div>
      )}
    </PageApplication>
  );
}
