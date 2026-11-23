// Comparateur (US-04) : jusqu'à 3 SCPI côte à côte, choisies dans des listes déroulantes
// ou passées dans l'adresse (/comparaison?scpi=3,7, convention C1). La meilleure valeur
// de chaque ligne chiffrée est mise en évidence ; le revenu brut est estimé pour le
// montant saisi (jamais enregistré).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { deconnecter } from '../auth.js';
import { formaterCapitalisation } from '../catalogue/format.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import {
  absent,
  formaterEuros,
  formaterMontantCalcule,
  formaterTaux,
  NON_COMMUNIQUE,
} from '../utils/format.js';
import ListeAvecRecherche from '../utils/ListeAvecRecherche.jsx';
import { lireComparables } from './api.js';
import {
  EMPLACEMENTS,
  lireSelection,
  meilleureValeur,
  montantMinimalCommun,
  revenuEstime,
} from './calculs.js';
import './comparaison.css';

const VIDE = Array(EMPLACEMENTS).fill(null);

const ouiNon = (valeur) => (absent(valeur) ? NON_COMMUNIQUE : valeur ? 'Oui' : 'Non');
const texteOuNc = (texte) => (absent(texte) ? NON_COMMUNIQUE : texte);
const principal = (valeur) =>
  valeur ? `${valeur.libelle} (${formaterTaux(valeur.part)})` : NON_COMMUNIQUE;

function evolution({ evolutionPrix: e }) {
  if (!e) return NON_COMMUNIQUE;
  const signe = e.variation > 0 ? '+' : '';
  return `${formaterEuros(e.debut.prix)} → ${formaterEuros(e.fin.prix)} (${signe}${formaterTaux(e.variation)})`;
}

// Lignes du tableau, sous le revenu estimé. valeur + sens : ligne où la meilleure valeur
// est mise en évidence (sens 'max' : la plus haute, 'min' : la plus basse)
const LIGNES = [
  {
    libelle: 'Taux de distribution',
    valeur: (s) => s.tauxDistribution,
    sens: 'max',
    texte: (s) => formaterTaux(s.tauxDistribution),
    detail: (s) => (absent(s.tauxDistribution) || absent(s.anneeTaux) ? null : `en ${s.anneeTaux}`),
  },
  { libelle: 'Prix de part', texte: (s) => formaterEuros(s.prixPart) },
  {
    libelle: 'Évolution du prix de part sur 5 ans',
    texte: evolution,
    detail: ({ evolutionPrix: e }) => (e ? `de ${e.debut.annee} à ${e.fin.annee}` : null),
  },
  {
    libelle: 'Minimum à investir',
    valeur: (s) => s.minimum,
    sens: 'min',
    texte: (s) => formaterEuros(s.minimum),
  },
  {
    libelle: 'Capitalisation',
    valeur: (s) => s.capitalisation,
    sens: 'max',
    texte: (s) =>
      absent(s.capitalisation) ? NON_COMMUNIQUE : formaterCapitalisation(s.capitalisation),
  },
  {
    libelle: 'Frais de souscription',
    valeur: (s) => s.fraisSouscription,
    sens: 'min',
    texte: (s) => formaterTaux(s.fraisSouscription),
  },
  {
    libelle: 'Frais de gestion',
    valeur: (s) => s.fraisGestion,
    sens: 'min',
    texte: (s) => formaterTaux(s.fraisGestion),
  },
  {
    libelle: 'Délai de jouissance',
    valeur: (s) => s.delaiJouissance,
    sens: 'min',
    texte: (s) => (absent(s.delaiJouissance) ? NON_COMMUNIQUE : `${s.delaiJouissance} mois`),
  },
  { libelle: 'Fréquence des loyers', texte: (s) => texteOuNc(s.frequence) },
  { libelle: 'Démembrement', texte: (s) => ouiNon(s.demembrement) },
  { libelle: 'Versement programmé', texte: (s) => ouiNon(s.versementProgramme) },
  { libelle: 'Pays principal', texte: (s) => principal(s.paysPrincipal) },
  { libelle: 'Secteur principal', texte: (s) => principal(s.secteurPrincipal) },
];

function Cellule({ texte, detail, meilleur }) {
  return (
    <td className={meilleur ? 'comparateur__meilleur' : undefined}>
      {texte}
      {meilleur && <span className="sr-only"> (meilleure valeur)</span>}
      {detail && <small className="comparateur__detail">{detail}</small>}
    </td>
  );
}

// remplir : met dans le champ le plus petit montant accepté par toutes les SCPI choisies
function CelluleRevenu({ revenu, meilleur, remplir }) {
  switch (revenu.etat) {
    case 'sansMontant':
      return <Cellule texte="—" detail="Saisissez un montant" />;
    case 'sousMinimum':
      return (
        <Cellule
          texte="—"
          detail={
            <button type="button" className="comparateur__remplir" onClick={remplir}>
              Montant inférieur au minimum à investir ({formaterEuros(revenu.seuil)})
            </button>
          }
        />
      );
    case 'nonCommunique':
      return <Cellule texte={NON_COMMUNIQUE} />;
    default:
      return (
        <Cellule
          texte={`${formaterMontantCalcule(revenu.annuel)} par an`}
          detail={`${revenu.parts} part${revenu.parts > 1 ? 's' : ''} · ${formaterEuros(revenu.investi)} investis · ${formaterMontantCalcule(revenu.mensuel)} par mois`}
          meilleur={meilleur}
        />
      );
  }
}

// Ligne chiffrée : chaque SCPI choisie, la meilleure mise en évidence ; emplacement vide : —
function Ligne({ libelle, choisies, valeurs, sens, cellule }) {
  const meilleure = sens ? meilleureValeur(valeurs, sens) : null;
  return (
    <tr>
      <th scope="row">{libelle}</th>
      {choisies.map((scpi, i) =>
        scpi ? (
          cellule(scpi, i, meilleure !== null && valeurs[i] === meilleure)
        ) : (
          <td key={i} className="comparateur__vide">
            —
          </td>
        ),
      )}
    </tr>
  );
}

function naviguer(url) {
  window.location.assign(url);
}

export default function Comparateur({
  lire = lireComparables,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const [parametres] = useSearchParams();
  const naviguerDansLaPage = useNavigate();
  // La sélection de l'adresse n'est lue qu'à l'ouverture
  const [selectionInitiale] = useState(() => parametres.get('scpi'));
  const [scpis, setScpis] = useState(null);
  const [alerte, setAlerte] = useState('');
  const [emplacements, setEmplacements] = useState(VIDE);
  const [saisie, setSaisie] = useState('');
  const champMontant = useRef(null);

  useEffect(() => {
    let actif = true;
    lire()
      .then((resultat) => {
        if (!actif) return;
        setScpis(resultat);
        setEmplacements(lireSelection(selectionInitiale, resultat));
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

  // L'adresse suit la sélection : elle peut être partagée ou rechargée. Écrite telle
  // quelle (?scpi=3,7, C1) : les paramètres de React Router encoderaient la virgule.
  function choisir(nouveaux) {
    setEmplacements(nouveaux);
    const ids = nouveaux.filter((id) => id !== null);
    naviguerDansLaPage({ search: ids.length ? `?scpi=${ids.join(',')}` : '' }, { replace: true });
  }

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const parId = new Map((scpis ?? []).map((s) => [s.id, s]));
  const choisies = emplacements.map((id) => parId.get(id) ?? null);
  const nombre = choisies.filter(Boolean).length;
  const montant = saisie === '' ? null : Number(saisie);
  const revenus = choisies.map((s) => (s ? revenuEstime(montant, s) : null));
  const remplirMinimum = () =>
    setSaisie(String(montantMinimalCommun(choisies.filter(Boolean)) ?? ''));

  return (
    <PageApplication
      titre="Comparer"
      actif="comparaison"
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
        <>
          {/* Au-dessus du tableau : « Vider la sélection » à droite ; dessous, le montant à
              droite et l'avertissement à sa gauche, sur la même ligne : quand il disparaît,
              rien ne bouge */}
          <div className="comparateur__outils">
            <button type="button" className="comparateur__vider" onClick={() => choisir(VIDE)}>
              Vider la sélection
            </button>
            <div className="comparateur__ligne">
              {nombre < 2 && (
                <p className="comparateur__info">Choisissez au moins 2 SCPI pour les comparer.</p>
              )}
              <div className="comparateur__montant">
                <label htmlFor="comparateur-montant">Montant à simuler</label>
                <div className="comparateur__saisie">
                  <input
                    ref={champMontant}
                    id="comparateur-montant"
                    inputMode="numeric"
                    placeholder="Exemple : 10000 €"
                    value={saisie}
                    onChange={(e) => setSaisie(e.target.value.replace(/\D/g, ''))}
                  />
                  {saisie && (
                    <button
                      type="button"
                      className="comparateur__effacer"
                      aria-label="Effacer le montant"
                      title="Effacer le montant"
                      onClick={() => {
                        setSaisie('');
                        champMontant.current.focus();
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="comparateur__defilement">
            <table className="comparateur__tableau">
              <thead>
                <tr>
                  <td />
                  {emplacements.map((id, i) => (
                    <th key={i} scope="col">
                      <label className="sr-only" htmlFor={`comparateur-scpi-${i}`}>
                        SCPI n° {i + 1}
                      </label>
                      <ListeAvecRecherche
                        id={`comparateur-scpi-${i}`}
                        placeholder="Choisir une SCPI"
                        vide="Aucune SCPI trouvée"
                        effacer={`Retirer ${parId.get(id)?.nom ?? 'la SCPI'} de la comparaison`}
                        valeur={id}
                        changer={(choisi) => choisir(emplacements.with(i, choisi))}
                        options={scpis.map((s) => {
                          const prise = s.id !== id && emplacements.includes(s.id);
                          return {
                            cle: s.id,
                            libelle: prise ? `${s.nom} (déjà choisie)` : s.nom,
                            desactivee: prise,
                          };
                        })}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Ligne
                  libelle="Revenu annuel brut estimé"
                  choisies={choisies}
                  valeurs={revenus.map((r) => (r?.etat === 'ok' ? r.annuel : null))}
                  sens="max"
                  cellule={(_, i, meilleur) => (
                    <CelluleRevenu
                      key={i}
                      revenu={revenus[i]}
                      meilleur={meilleur}
                      remplir={remplirMinimum}
                    />
                  )}
                />
                {LIGNES.map(({ libelle, valeur, sens, texte, detail }) => (
                  <Ligne
                    key={libelle}
                    libelle={libelle}
                    choisies={choisies}
                    valeurs={choisies.map((s) => (s && valeur ? valeur(s) : null))}
                    sens={sens}
                    cellule={(s, i, meilleur) => (
                      <Cellule key={i} texte={texte(s)} detail={detail?.(s)} meilleur={meilleur} />
                    )}
                  />
                ))}
                <tr>
                  <td />
                  {choisies.map((s, i) => (
                    <td key={i}>
                      {s && (
                        <div className="comparateur__actions">
                          <LienInterne
                            to={`/simulation?scpi=${s.id}:1`}
                            className="comparateur__lien"
                          >
                            Simuler
                          </LienInterne>
                          <LienInterne
                            to={`/investir/${s.id}`}
                            className="comparateur__lien comparateur__lien--principal"
                          >
                            Investir
                          </LienInterne>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageApplication>
  );
}
