// Bloc « Résultat » de la simulation (US-09, refonte maquette A) : deux colonnes, les
// chiffres à gauche, la contribution de chaque SCPI à droite. Selon le nombre de périodes
// de revenus : un tableau (1 période), des cartes (jusqu'à MAX_PERIODES_EN_CARTES), sinon un
// tableau de synthèse en fourchettes et un tableau « Détail par période » pleine largeur.
// N'affiche que des données déjà calculées (calculs.js, estimation fiscale du backend).
import { useId } from 'react';
import { formaterPart } from '../fiche/donnees.js';
import { absent, formaterEuros, formaterMontantCalcule, formaterTaux } from '../utils/format.js';
import { NUE_PROPRIETE, USUFRUIT, annees } from './calculs.js';

// Au-delà de ce nombre de périodes, les cartes laissent place au tableau pleine largeur
export const MAX_PERIODES_EN_CARTES = 4;

export const INFOBULLE_PART_ETRANGERE =
  'Vos revenus étrangers sont imposés dans leur pays. En France, ils augmentent le taux ' +
  'appliqué à vos autres revenus.';

export const MENTION =
  'Estimation indicative, calculée avec le dernier taux de distribution connu. ' +
  'Les performances passées ne préjugent pas des performances futures.';

const ans = (n) => `${n} an${n > 1 ? 's' : ''}`;

// Montant, fourchette { min, max } ou « … » (impôt pas encore connu)
function afficher(valeur) {
  if (valeur === null || valeur === undefined) return '…';
  if (typeof valeur === 'number') return formaterMontantCalcule(valeur);
  if (valeur.min === valeur.max) return formaterMontantCalcule(valeur.min);
  return `${formaterMontantCalcule(valeur.min)} → ${formaterMontantCalcule(valeur.max)}`;
}

// Plus petite et plus grande valeur d'une colonne des périodes (null si une est inconnue)
function fourchette(periodes, cle) {
  const valeurs = periodes.map((p) => p[cle]);
  if (valeurs.some((v) => v === null)) return null;
  return { min: Math.min(...valeurs), max: Math.max(...valeurs) };
}

// Nue-propriété dont le démembrement couvre tout le placement : aucun revenu
const sansRevenu = (l) => l.type === NUE_PROPRIETE && l.demembrement >= l.duree;

const anneesMinuscule = (debut, fin) => annees({ debut, fin }).toLowerCase();

// « Pleine propriété · années 1 à 10 », « Usufruit 3 ans · années 1 à 3 »,
// « Nue-propriété 5 ans · revenus années 6 à 10 », « Nue-propriété · démembrement 10 ans »
function libelleBadge(l) {
  if (l.type === USUFRUIT) {
    return `Usufruit ${ans(l.demembrement)} · ${anneesMinuscule(1, Math.min(l.demembrement, l.duree))}`;
  }
  if (l.type === NUE_PROPRIETE) {
    return sansRevenu(l)
      ? `Nue-propriété · démembrement ${ans(l.demembrement)}`
      : `Nue-propriété ${ans(l.demembrement)} · revenus ${anneesMinuscule(l.demembrement + 1, l.duree)}`;
  }
  return `Pleine propriété · ${anneesMinuscule(1, l.duree)}`;
}

function Badge({ ligne }) {
  const nue = ligne.type === NUE_PROPRIETE;
  return (
    <span className={`simulation__badge${nue ? ' simulation__badge--nue' : ''}`}>
      {libelleBadge(ligne)}
    </span>
  );
}

// Revenu annuel d'une SCPI « brut / après fiscalité » (taux d'impôt de la ligne)
function RevenuScpi({ ligne }) {
  if (sansRevenu(ligne)) {
    return (
      <p className="simulation__revenu-scpi simulation__revenu-scpi--aucun">
        <strong>Aucun revenu sur la durée</strong>
        <span>Pleine propriété récupérée à la fin de l’année {ligne.demembrement}</span>
      </p>
    );
  }
  const net = ligne.tauxImpot === null ? null : ligne.revenuAnnuel * (1 - ligne.tauxImpot);
  return (
    <p className="simulation__revenu-scpi">
      <strong>{afficher(ligne.revenuAnnuel)}</strong> /{' '}
      <span className="simulation__net">{afficher(net)}</span>
    </p>
  );
}

// Au moins 2 SCPI : une ligne par SCPI ; total par an quand les revenus ne changent pas
function DetailParScpi({ lignes, total }) {
  return (
    <section className="simulation__encadre" aria-labelledby="simulation-detail-scpi">
      <div className="simulation__encadre-entete">
        <h3 id="simulation-detail-scpi">Détail par SCPI</h3>
        <span>par an · brut / après fiscalité</span>
      </div>
      <ul className="simulation__scpis">
        {lignes.map((l, i) => (
          // Une même SCPI peut figurer sur deux lignes : clé = position
          <li key={i}>
            <div>
              <p className="simulation__scpi-nom">{l.nom}</p>
              <Badge ligne={l} />
            </div>
            <RevenuScpi ligne={l} />
          </li>
        ))}
      </ul>
      {total && (
        <div className="simulation__encadre-total">
          <span>Total par an</span>
          <p className="simulation__revenu-scpi">
            <strong>{afficher(total.brut)}</strong> /{' '}
            <span className="simulation__net">{afficher(total.net)}</span>
          </p>
        </div>
      )}
    </section>
  );
}

// Une seule SCPI : version compacte (maquette 2), badge à côté du titre puis ses repères sur
// une ligne de 4 colonnes ; pas de revenus par an (déjà dans le tableau de gauche)
function VotreScpi({ ligne }) {
  const { scpi } = ligne;
  return (
    <section
      className="simulation__encadre simulation__encadre--compact"
      aria-labelledby="simulation-votre-scpi"
    >
      <div className="simulation__encadre-entete">
        <h3 id="simulation-votre-scpi">Votre SCPI : {ligne.nom}</h3>
        <Badge ligne={ligne} />
      </div>
      <dl className="simulation__reperes-scpi">
        <div>
          <dt>Parts</dt>
          <dd>{ligne.parts}</dd>
        </div>
        <div>
          <dt>Prix de la part</dt>
          <dd>{formaterEuros(scpi.prixPart)}</dd>
        </div>
        <div>
          <dt>Distribution</dt>
          <dd>{formaterTaux(scpi.tauxDistribution)}</dd>
        </div>
        {/* Nue-propriété : pas de revenu avant la fin du démembrement, le délai ne joue pas */}
        {ligne.type !== NUE_PROPRIETE && (
          <div>
            <dt>Jouissance</dt>
            <dd>
              {absent(scpi.delaiJouissance) ? '0 mois (non communiqué)' : `${ligne.delai} mois`}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

// Info-bulle « i » : le texte s'affiche au survol ou au focus du bouton (clavier, toucher),
// et sert de description au bouton pour les lecteurs d'écran
function Infobulle({ libelle, texte }) {
  const id = useId();
  return (
    <span className="simulation__infobulle">
      <button type="button" aria-label={libelle} aria-describedby={id}>
        i
      </button>
      <span role="tooltip" id={id}>
        {texte}
      </span>
    </span>
  );
}

// Carte « Détail de l'impôt sur N ans » (maquettes 2 et 2 bis), colonne de droite sous
// l'encadré SCPI : somme des années (detailCumul du backend). Revenus, impôt sur le revenu
// et prélèvements sociaux de la part française et, s'il y a des revenus étrangers, de la
// part étrangère (son impôt sur le revenu est l'effet de ces revenus sur le taux ; pas de
// prélèvements sociaux), puis le total (total des revenus = revenus cumulés bruts).
function DetailParts({ detail, duree }) {
  const etrangere = detail.revenuEtranger > 0;
  const montant = (valeur) => formaterMontantCalcule(valeur);
  return (
    <section className="simulation__carte-impot" aria-labelledby="simulation-parts">
      <h3 id="simulation-parts">Détail de l’impôt sur {ans(duree)}</h3>
      {/* Écran étroit : le tableau défile horizontalement (au clavier aussi) */}
      <div className="simulation__defilement" tabIndex={0}>
        <table className="simulation__tableau simulation__parts" aria-labelledby="simulation-parts">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Part</span>
              </th>
              <th scope="col">Revenus</th>
              <th scope="col">Impôt sur le revenu</th>
              <th scope="col">Prélèv. sociaux</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Part française</th>
              <td>{montant(detail.revenuFrance)}</td>
              <td>{montant(detail.impotRevenuFrance)}</td>
              <td>{montant(detail.prelevementsSociaux)}</td>
            </tr>
            {etrangere && (
              <tr>
                <th scope="row">
                  Part étrangère{' '}
                  <Infobulle
                    libelle="Pourquoi un impôt sur la part étrangère ?"
                    texte={INFOBULLE_PART_ETRANGERE}
                  />
                </th>
                <td>{montant(detail.revenuEtranger)}</td>
                <td>{montant(detail.impotRevenuEtranger)}</td>
                <td>—</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{montant(detail.revenuFrance + detail.revenuEtranger)}</td>
              <td>{montant(detail.impotRevenuFrance + detail.impotRevenuEtranger)}</td>
              <td>{montant(detail.prelevementsSociaux)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// « 11 % → 30 % » quand la TMI change, sinon « 30 % »
function avantApres(avant, apres, formater) {
  return apres !== avant ? `${formater(avant)} → ${formater(apres)}` : formater(apres);
}

// TMI juste avant la période i (décision BA du 28/11/2026) : celle de la période précédente
// si elle a des revenus, sinon (première période, période sans revenu) celle du foyer avant
// tout loyer SCPI
function tmiAvant(periodes, i, foyer) {
  const precedente = periodes[i - 1];
  return precedente?.brut > 0 && precedente.avecScpi ? precedente.avecScpi.tmi : foyer.tmi;
}

// Règles 4 à 7 (décision BA du 28/11/2026) : TMI et taux moyen avec les revenus SCPI d'une
// période. Flèche quand la TMI change par rapport à la période d'avant (avant : tmiAvant),
// par exemple « 11 % → 30 % » quand les premiers loyers font passer à la tranche du dessus,
// « 30 % → 11 % » quand des revenus s'arrêtent ; part du revenu au-dessus du plafond quand
// la TMI monte depuis celle du foyer (plafond de sa tranche). Une seule période : sous les
// revenus ; plusieurs : dans chaque carte (colonnes du tableau au-delà de 4 périodes).
function TauxFoyer({ foyer, avecScpi, avant, encadre = false }) {
  const depassement = avant === foyer.tmi && avecScpi.tmi > avant && avecScpi.depassement;
  return (
    <dl className={`simulation__fiscal${encadre ? ' simulation__fiscal--encadre' : ''}`}>
      <div>
        <dt>TMI retenue</dt>
        <dd>
          {avantApres(avant, avecScpi.tmi, formaterPart)}
          {depassement && (
            <span className="simulation__depassement">
              {formaterEuros(Math.round(depassement.montant))} au-dessus de{' '}
              {formaterEuros(depassement.plafond)}
            </span>
          )}
        </dd>
      </div>
      <div>
        <dt>Taux moyen retenu</dt>
        <dd>{formaterTaux(avecScpi.tauxMoyen)}</dd>
      </div>
    </dl>
  );
}

// Une seule période, avec informations fiscales : TMI et taux moyen dans un petit encadré
// sous les revenus (sinon dans les cartes ou le tableau des périodes). Sans : rien, le taux
// se choisit dans le cadre « Ma fiscalité » (MaFiscalite.jsx)
function Fiscalite({ estimation }) {
  if (!estimation?.avecInformations) return null;
  const { foyer, avecScpi } = estimation;
  // Sans revenu SCPI (avecScpi absent) : la situation du foyer seule
  return (
    <TauxFoyer
      foyer={foyer}
      avecScpi={avecScpi ?? { ...foyer, depassement: null }}
      avant={foyer.tmi}
      encadre
    />
  );
}

// Changement qui ouvre une période : fin d'un usufruit (ses revenus s'arrêtent), d'une
// nue-propriété (ses revenus commencent) ou du placement d'une SCPI (ses revenus s'arrêtent)
function texteEvenement({ type, nom, annee }) {
  if (type === USUFRUIT)
    return `Fin de l’usufruit de ${nom} (année ${annee}) : ses revenus s’arrêtent`;
  if (type === NUE_PROPRIETE) {
    return `Fin du démembrement de ${nom} (année ${annee}) : ses revenus commencent`;
  }
  return `Fin du placement de ${nom} (année ${annee}) : ses revenus s’arrêtent`;
}

const scpisQuiVersent = (p) => (p.scpis.length ? p.scpis.join(', ') : 'aucune SCPI ne rapporte');

// Règle 1 : « Bruts » et « Après fiscalité » côte à côte ; impôt dans « Après fiscalité ».
// Plus de MAX_PERIODES_EN_CARTES périodes : fourchettes « min → max » selon la période
function TableauRevenus({ brut, net, duree, selonPeriode = false }) {
  const valeur = (montant) => (net ? afficher(montant) : '…');
  const selon = selonPeriode && (
    <>
      {' '}
      <span className="simulation__precision">selon la période</span>
    </>
  );
  return (
    <table className="simulation__tableau">
      <thead>
        <tr>
          <td />
          <th scope="col">Bruts</th>
          <th scope="col">
            Après fiscalité
            <span className="simulation__precision">Impôt estimé, à titre indicatif</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Revenus annuels{selon}</th>
          <td>{afficher(brut.annuel)}</td>
          <td>{valeur(net?.annuel)}</td>
        </tr>
        <tr>
          <th scope="row">Revenus mensuels{selon}</th>
          <td>{afficher(brut.mensuel)}</td>
          <td>{valeur(net?.mensuel)}</td>
        </tr>
        <tr className="simulation__cumul">
          <th scope="row">Revenus cumulés sur {ans(duree)}</th>
          <td>{afficher(brut.cumul)}</td>
          <td>{valeur(net?.cumul)}</td>
        </tr>
        <tr className="simulation__impot">
          <th scope="row">Impôt estimé annuel</th>
          <td aria-label="Sans objet" />
          <td>{valeur(net?.impot)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// 2 à MAX_PERIODES_EN_CARTES périodes : une carte par période, sur deux colonnes ; la
// dernière carte d'un nombre impair prend toute la largeur
function CartesPeriodes({ periodes, foyer }) {
  return (
    <ol className="simulation__frise">
      {periodes.map((p, i) => (
        <li key={p.debut}>
          <section className="simulation__periode" aria-label={annees(p)}>
            <h3 className="simulation__periode-titre">
              {annees(p)}
              <span>{scpisQuiVersent(p)}</span>
            </h3>
            {p.evenements.map((e) => (
              <p key={e.type + e.nom + e.annee} className="simulation__evenement">
                {texteEvenement(e)}
              </p>
            ))}
            {p.brut === 0 ? (
              <p className="simulation__aide">Aucun revenu pendant cette période</p>
            ) : (
              <table className="simulation__tableau">
                <thead>
                  <tr>
                    <td />
                    <th scope="col">Bruts</th>
                    <th scope="col">Après fiscalité</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Par an</th>
                    <td>{afficher(p.brut)}</td>
                    <td>{afficher(p.net)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Par mois</th>
                    <td>{afficher(p.mensuel)}</td>
                    <td>{afficher(p.netMensuel)}</td>
                  </tr>
                  <tr className="simulation__impot">
                    <th scope="row">Impôt / an</th>
                    <td aria-label="Sans objet" />
                    <td>{afficher(p.impot)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {foyer && p.brut > 0 && p.avecScpi && (
              <TauxFoyer foyer={foyer} avecScpi={p.avecScpi} avant={tmiAvant(periodes, i, foyer)} />
            )}
          </section>
        </li>
      ))}
    </ol>
  );
}

// Revenus cumulés sur toute la durée (cartes de période : colonne de droite)
function Cumul({ cumul, duree }) {
  return (
    <table className="simulation__tableau simulation__tableau--cumul">
      <thead>
        <tr>
          <td />
          <th scope="col">Bruts</th>
          <th scope="col">Après fiscalité</th>
        </tr>
      </thead>
      <tbody>
        <tr className="simulation__cumul">
          <th scope="row">Revenus cumulés sur {ans(duree)}</th>
          <td>{afficher(cumul.brut)}</td>
          <td>{afficher(cumul.net)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// Plus de MAX_PERIODES_EN_CARTES périodes : un tableau unique, une ligne par période, et
// entre deux lignes l'événement qui ouvre la suivante
function TableauPeriodes({ periodes, foyer }) {
  const colonnes = foyer ? 9 : 7;
  // TMI et taux moyen de la période (sans revenu : ceux du foyer) ; flèche sur la TMI quand
  // elle change par rapport à la période d'avant
  const avec = (p) => (p.brut > 0 && p.avecScpi ? p.avecScpi : foyer);
  return (
    <section className="simulation__periodes" aria-labelledby="simulation-detail-periodes">
      <h3 id="simulation-detail-periodes">Détail par période</h3>
      {/* Écran étroit : le tableau défile horizontalement (au clavier aussi) */}
      <div className="simulation__defilement" tabIndex={0}>
        <table className="simulation__tableau simulation__tableau--periodes">
          <thead>
            <tr>
              <td colSpan={2} />
              <th scope="colgroup" colSpan={2}>
                Par an
              </th>
              <th scope="colgroup" colSpan={2}>
                Par mois
              </th>
              <td colSpan={colonnes - 6} />
            </tr>
            <tr>
              <th scope="col" className="simulation__gauche">
                Période
              </th>
              <th scope="col" className="simulation__gauche">
                SCPI qui versent des revenus
              </th>
              <th scope="col">Bruts</th>
              <th scope="col">Après fiscalité</th>
              <th scope="col">Bruts</th>
              <th scope="col">Après fiscalité</th>
              <th scope="col">Impôt estimé annuel</th>
              {foyer && <th scope="col">TMI retenue</th>}
              {foyer && <th scope="col">Taux moyen retenu</th>}
            </tr>
          </thead>
          <tbody>
            {periodes.flatMap((p, i) => [
              ...(i === 0 ? [] : p.evenements).map((e) => (
                <tr key={`${p.debut}-${e.type}-${e.nom}`} className="simulation__ligne-evenement">
                  <td colSpan={colonnes}>{texteEvenement(e)}</td>
                </tr>
              )),
              <tr key={p.debut}>
                <th scope="row">{annees(p)}</th>
                <td className="simulation__scpis-periode">{scpisQuiVersent(p)}</td>
                <td>{afficher(p.brut)}</td>
                <td>{afficher(p.net)}</td>
                <td>{afficher(p.mensuel)}</td>
                <td>{afficher(p.netMensuel)}</td>
                <td className="simulation__montant-impot">{afficher(p.impot)}</td>
                {foyer && (
                  <td>{avantApres(tmiAvant(periodes, i, foyer), avec(p).tmi, formaterPart)}</td>
                )}
                {foyer && <td>{formaterTaux(avec(p).tauxMoyen)}</td>}
              </tr>,
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Aucune SCPI prise en compte (écran d'accueil) : ce qui s'affichera, en trois étapes
const ETAPES = [
  {
    titre: 'Choisissez une SCPI',
    texte: 'dans le catalogue, avec son prix de part et son taux de distribution.',
  },
  {
    titre: 'Indiquez le nombre de parts',
    texte: 'et, si la SCPI le permet, le type : pleine propriété, nue-propriété ou usufruit.',
  },
  {
    titre: 'Lisez vos revenus',
    texte: 'par an, par mois et cumulés, bruts et après fiscalité.',
  },
];

function ResultatVide() {
  return (
    <section className="simulation__resultat" aria-labelledby="simulation-resultat">
      <h2 id="simulation-resultat" className="simulation__titre">
        Résultat
      </h2>
      <div className="simulation__vide">
        <span className="simulation__icone-vide" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 19h14M8 16v-4M12 16V8M16 16v-6" />
          </svg>
        </span>
        <h3 className="simulation__vide-titre">Vos revenus s’afficheront ici</h3>
        <p className="simulation__vide-texte">
          Choisissez une SCPI et un nombre de parts : le montant investi et vos revenus, bruts et
          après impôt, se calculent automatiquement.
        </p>
      </div>
      <ol className="simulation__etapes">
        {ETAPES.map((e, i) => (
          <li key={e.titre} className="simulation__etape">
            <span className="simulation__etape-numero" aria-hidden="true">
              {i + 1}
            </span>
            <p>
              <strong>{e.titre}</strong> {e.texte}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// total : calculerSimulation ; net : apresFiscalite (null tant que l'impôt n'est pas connu) ;
// periodes : periodes() ; lignes : lignes prises en compte (nom, scpi, type, démembrement,
// durée, parts, délai, revenu annuel, taux d'impôt)
export default function Resultat({
  total,
  net,
  duree,
  periodes,
  lignes,
  estimation,
  impotIndisponible,
}) {
  if (total.lignes === 0) return <ResultatVide />;
  const cartes = periodes.length > 1 && periodes.length <= MAX_PERIODES_EN_CARTES;
  const tableau = periodes.length > MAX_PERIODES_EN_CARTES;
  const detailCumul = estimation?.avecInformations ? estimation.detailCumul : null;
  // TMI et taux moyen sans SCPI, point de départ de ceux de chaque période
  const foyer = estimation?.avecInformations ? estimation.foyer : null;

  // Colonne de droite (maquettes 2 et 2 bis) : encadré SCPI, puis la carte « Détail de
  // l'impôt sur N ans »
  let encadreScpi = null;
  if (lignes.length === 1) encadreScpi = <VotreScpi ligne={lignes[0]} />;
  if (lignes.length > 1) {
    const totalParAn =
      periodes.length <= 1 ? { brut: total.annuel, net: net ? net.annuel : null } : null;
    encadreScpi = <DetailParScpi lignes={lignes} total={totalParAn} />;
  }
  const carteImpot = detailCumul && <DetailParts detail={detailCumul} duree={duree} />;
  const droite = (encadreScpi || carteImpot) && (
    <>
      {encadreScpi}
      {carteImpot}
    </>
  );

  let revenus = <TableauRevenus brut={total} net={net} duree={duree} />;
  if (cartes) revenus = <CartesPeriodes periodes={periodes} foyer={foyer} />;
  if (tableau) {
    revenus = (
      <TableauRevenus
        selonPeriode
        duree={duree}
        brut={{
          annuel: fourchette(periodes, 'brut'),
          mensuel: fourchette(periodes, 'mensuel'),
          cumul: total.cumul,
        }}
        net={
          net && {
            annuel: fourchette(periodes, 'net'),
            mensuel: fourchette(periodes, 'netMensuel'),
            cumul: net.cumul,
            impot: fourchette(periodes, 'impot'),
          }
        }
      />
    );
  }

  return (
    <section className="simulation__resultat" aria-labelledby="simulation-resultat">
      <h2 id="simulation-resultat" className="simulation__titre">
        Résultat
      </h2>
      <div
        className={`simulation__resultat-grille${droite ? '' : ' simulation__resultat-grille--seule'}`}
      >
        {/* Haut de la colonne de gauche ; avec des cartes, l'encadré de droite commence
            sous lui, à la hauteur de la première carte */}
        <div className="simulation__resultat-haut">
          <dl className="simulation__chiffres" aria-live="polite">
            <div>
              <dt>Montant simulé</dt>
              <dd>{formaterEuros(total.montant)}</dd>
            </div>
          </dl>
          {cartes && (
            <p className="simulation__precision simulation__precision--frise">
              Après fiscalité : impôt estimé, à titre indicatif
            </p>
          )}
        </div>
        <div className="simulation__resultat-colonne simulation__resultat-gauche">
          {revenus}
          {impotIndisponible && (
            <p className="simulation__avertissement" role="status">
              Impôt estimé indisponible pour le moment.
            </p>
          )}
          {/* 2 à 4 périodes : sous les cartes, revenus cumulés sur la durée */}
          {cartes && <Cumul cumul={{ brut: total.cumul, net: net?.cumul ?? null }} duree={duree} />}
          {!cartes && !tableau && <Fiscalite estimation={estimation} />}
        </div>
        {droite && (
          <div
            className={`simulation__resultat-colonne simulation__resultat-droite${cartes ? ' simulation__resultat-droite--cartes' : ''}`}
          >
            {droite}
          </div>
        )}
      </div>
      {/* Plus de 4 périodes : détail par période en pleine largeur, sous les deux colonnes */}
      {tableau && <TableauPeriodes periodes={periodes} foyer={foyer} />}
    </section>
  );
}
