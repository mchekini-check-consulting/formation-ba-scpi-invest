// Suivi d'une demande (/demandes/<id>) : US-11 (SCPI-259), US-16 (SCPI-264) puis sa
// correction. Ouvert après « Valider ma demande », puis rouvrable par son adresse.
// Un seul écran pour toutes les étapes (maquettes validées par le BA, style de la Fiche) :
// frise (règle 2), puis trois cartes :
//   - « Prochaine étape » : ce qui va se passer, texte et étapes numérotées selon le statut ;
//   - au centre, la carte du statut : les faits du dossier (dates, montant, motif du refus,
//     coordonnées du virement avec boutons Copier, date de jouissance) (règle 3) ;
//   - « Votre dossier » (règle 1) : ordre choisi par le BA à l'US-11.
// Statut lu au chargement de la page (règle 4). Dossier inexistant ou d'un autre
// investisseur : « Cette demande est introuvable. » (règle 5).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { deconnecter } from '../auth.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import { formaterEuros, NON_COMMUNIQUE } from '../utils/format.js';
import { lireDemande } from './api.js';
import {
  AUCUNE_ACTION,
  consignesProchaineEtape,
  etapesFrise,
  formaterDate,
  libelleStatut,
  libelleType,
  texteProchaineEtape,
} from './demande.js';
import { Bandeau, Icone } from './Elements.jsx';
import '../fiche/fiche.css';
import './investir.css';

function naviguer(url) {
  window.location.assign(url);
}

function copierTexte(texte) {
  return navigator.clipboard.writeText(texte);
}

const ETATS_ETAPE = { franchie: 'Franchie', en_cours: 'Étape en cours', a_venir: 'À venir' };

// Date connue d'une étape franchie : demande (envoyée), accusé de réception (reçue)
function dateEtape(id, dossier) {
  if (id === 'demande_envoyee') return dossier.demandeLe;
  if (id === 'demande_recue') return dossier.accuseReceptionLe;
  return null;
}

const dateOuNc = (iso) => (iso ? formaterDate(iso) : NON_COMMUNIQUE);

// Règle 2 : étapes franchies, étape en cours, étapes à venir
function Frise({ dossier }) {
  return (
    <section className="suivi__carte investir__suivi" aria-labelledby="avancement">
      <h2 id="avancement" className="suivi__titre">
        Avancement de ma demande
      </h2>
      <ol className="investir__frise">
        {etapesFrise(dossier.statut).map((etape) => {
          const date = etape.etat === 'franchie' ? dateEtape(etape.id, dossier) : null;
          return (
            <li
              key={etape.id}
              className={`investir__etape investir__etape--${etape.etat} investir__etape--${etape.id}`}
              aria-current={etape.etat === 'en_cours' ? 'step' : undefined}
            >
              <span className="investir__etape-point" aria-hidden="true">
                {etape.etat === 'franchie' && <Icone nom="valide" />}
              </span>
              <span className="investir__etape-libelle">{etape.libelle}</span>
              <span className="investir__etape-detail">
                <span className="investir__etape-etat">{ETATS_ETAPE[etape.etat]}</span>
                {date && <span className="investir__etape-date"> · {formaterDate(date)}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Tuile({ nom, ton }) {
  return (
    <span className={`suivi__tuile suivi__tuile--${ton}`} aria-hidden="true">
      <Icone nom={nom} />
    </span>
  );
}

// En-tête d'une carte : tuile en dégradé (comme les chiffres clés de la Fiche), surtitre
// éventuel et titre
function Entete({ id, icone, ton, surtitre, titre }) {
  return (
    <div className="suivi__entete">
      <Tuile nom={icone} ton={ton} />
      <div>
        {surtitre && <p className={`suivi__surtitre suivi__surtitre--${ton}`}>{surtitre}</p>}
        <h2 id={id} className="suivi__titre">
          {titre}
        </h2>
      </div>
    </div>
  );
}

function ProchaineEtape({ statut }) {
  return (
    <section className="suivi__carte" aria-labelledby="prochaine-etape">
      <Entete id="prochaine-etape" icone="suite" ton="violet" titre="Prochaine étape" />
      <p className="suivi__texte">{texteProchaineEtape(statut)}</p>
      <ol className="suivi__consignes">
        {consignesProchaineEtape(statut).map((consigne, i) => (
          <li key={consigne}>
            <span className="suivi__numero" aria-hidden="true">
              {i + 1}
            </span>
            {consigne}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Montant({ libelle, valeur, ton }) {
  return (
    <p className={`suivi__montant suivi__montant--${ton}`}>
      <span>{libelle}</span>
      <strong>{formaterEuros(valeur)}</strong>
    </p>
  );
}

// Lignes de faits de la carte du statut : petite icône colorée, libellé, valeur (comme les
// conditions de la Fiche)
function Faits({ faits }) {
  return (
    <dl className="suivi__faits">
      {faits.map(([icone, ton, libelle, valeur]) => (
        <div key={libelle} className="suivi__fait">
          <dt>
            <span className={`suivi__fait-icone suivi__fait-icone--${ton}`} aria-hidden="true">
              <Icone nom={icone} />
            </span>
            {libelle}
          </dt>
          <dd>{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

// Coordonnées du virement, chacune copiable
function Coordonnees({ paiement, copier }) {
  const [copie, setCopie] = useState('');
  const coordonnees = [
    ['IBAN', paiement.iban, 'Copier l’IBAN'],
    ['BIC', paiement.bic, 'Copier le BIC'],
    ['Référence à indiquer', paiement.reference, 'Copier la référence'],
  ];

  function copierValeur(libelle, valeur) {
    Promise.resolve(copier(valeur)).then(
      () => setCopie(libelle),
      () => setCopie(''),
    );
  }

  return (
    <dl className="suivi__coordonnees">
      {coordonnees.map(([libelle, valeur, action]) => (
        <div key={libelle} className="suivi__coordonnee">
          <div>
            <dt>{libelle}</dt>
            <dd>{valeur ?? NON_COMMUNIQUE}</dd>
          </div>
          {valeur && (
            <button
              type="button"
              className="suivi__copier"
              aria-label={action}
              onClick={() => copierValeur(libelle, valeur)}
            >
              {copie === libelle ? 'Copié' : 'Copier'}
            </button>
          )}
        </div>
      ))}
    </dl>
  );
}

const FAIT_ENVOYEE = (dossier) => [
  'valide',
  'turquoise',
  'Envoyée à la SCPI',
  formaterDate(dossier.demandeLe),
];

// Règle 3 : la carte du centre, selon le statut
function CarteStatut({ dossier, copier }) {
  const entete = { id: 'carte-statut' };
  let corps;
  switch (dossier.statut) {
    case 'demande_recue':
      Object.assign(entete, {
        icone: 'loupe',
        ton: 'bleu',
        surtitre: 'Où en est votre demande',
        titre: 'La SCPI étudie votre demande',
      });
      corps = (
        <>
          <Montant libelle="Montant demandé" valeur={dossier.montant} ton="bleu" />
          <Faits
            faits={[
              FAIT_ENVOYEE(dossier),
              ['valide', 'turquoise', 'Reçue par la SCPI', dateOuNc(dossier.accuseReceptionLe)],
              ['horloge', 'bleu', 'Décision de la SCPI', 'En cours d’étude'],
            ]}
          />
          <p className="suivi__note">{AUCUNE_ACTION}</p>
        </>
      );
      break;
    case 'acceptee_attente_paiement': {
      const paiement = dossier.paiement ?? {
        montant: dossier.montant,
        iban: null,
        bic: null,
        reference: null,
      };
      Object.assign(entete, {
        icone: 'virement',
        ton: 'turquoise',
        surtitre: 'Ce qui est attendu de vous',
        titre: 'Effectuez votre virement',
      });
      corps = (
        <>
          <Montant libelle="Montant à virer" valeur={paiement.montant} ton="turquoise" />
          <Coordonnees paiement={paiement} copier={copier} />
        </>
      );
      break;
    }
    case 'refusee':
      Object.assign(entete, {
        icone: 'alerte',
        ton: 'rose',
        surtitre: 'Décision de la SCPI',
        titre: 'Votre demande n’a pas été acceptée',
      });
      corps = (
        <>
          <p className="suivi__motif">
            <span>Motif du refus</span>
            <strong>{dossier.motifRefus ?? NON_COMMUNIQUE}</strong>
          </p>
          <Faits faits={[['virement', 'orange', 'Virement à faire', 'Aucun']]} />
          <LienInterne to="/catalogue" className="suivi__bouton">
            Choisir une autre SCPI →
          </LienInterne>
        </>
      );
      break;
    case 'investissement_actif':
      Object.assign(entete, {
        icone: 'valide',
        ton: 'turquoise',
        surtitre: 'Votre investissement',
        titre: 'Votre investissement est actif',
      });
      corps = (
        <>
          <Montant libelle="Montant investi" valeur={dossier.montant} ton="turquoise" />
          <Faits
            faits={[
              ['virement', 'turquoise', 'Paiement reçu par la SCPI', 'Oui'],
              ['usufruit', 'violet', 'Date d’entrée en jouissance', dateOuNc(dossier.jouissanceLe)],
              ['pleine_propriete', 'bleu', 'Parts détenues', dossier.nombreParts],
            ]}
          />
        </>
      );
      break;
    default:
      // Demande envoyée (et statut inconnu de l'écran : rien de plus n'est affirmé)
      Object.assign(entete, {
        icone: 'envoi',
        ton: 'bleu',
        surtitre: 'Où en est votre demande',
        titre:
          dossier.statut === 'demande_envoyee'
            ? 'Votre demande a été transmise'
            : libelleStatut(dossier.statut),
      });
      corps = (
        <>
          <Montant libelle="Montant demandé" valeur={dossier.montant} ton="bleu" />
          {dossier.statut === 'demande_envoyee' && (
            <>
              <Faits
                faits={[
                  FAIT_ENVOYEE(dossier),
                  ['horloge', 'bleu', 'Accusé de réception', 'En attente'],
                ]}
              />
              <p className="suivi__note">{AUCUNE_ACTION}</p>
            </>
          )}
        </>
      );
  }
  return (
    <section className="suivi__carte suivi__carte--large" aria-labelledby="carte-statut">
      <Entete {...entete} />
      {corps}
    </section>
  );
}

// Règle 1 : le dossier (ordre choisi par le BA à l'US-11), avec l'accusé de réception s'il
// est connu
function Dossier({ dossier }) {
  const lignes = [
    ['Numéro de dossier', dossier.numero],
    ['Prix de part', formaterEuros(dossier.prixPart)],
    ['Date de la demande', formaterDate(dossier.demandeLe)],
    ['SCPI', dossier.scpiNom],
    ['Type d’investissement', libelleType(dossier.type)],
    ['Statut', libelleStatut(dossier.statut)],
    ['Nombre de parts', dossier.nombreParts],
    ['Montant', formaterEuros(dossier.montant)],
  ];
  if (dossier.accuseReceptionLe) {
    lignes.push(['Accusé de réception', formaterDate(dossier.accuseReceptionLe)]);
  }
  return (
    <section className="suivi__carte" aria-labelledby="dossier">
      <Entete id="dossier" icone="dossier" ton="orange" titre="Votre dossier" />
      <dl className="suivi__lignes">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="suivi__ligne">
            <dt>{libelle}</dt>
            <dd>{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function SuiviDemande({
  lire = lireDemande,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
  copier = copierTexte,
}) {
  const { id } = useParams();
  const [etat, setEtat] = useState({ id: null, dossier: null, erreur: '' });

  useEffect(() => {
    let actif = true;
    lire(id)
      .then((dossier) => actif && setEtat({ id, dossier, erreur: '' }))
      .catch((err) => {
        if (!actif) return;
        if (err.status === 401) allerA('/connexion');
        else setEtat({ id, dossier: null, erreur: err.message });
      });
    return () => {
      actif = false;
    };
  }, [id, lire, allerA]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const { dossier, erreur } = etat.id === id ? etat : { dossier: null, erreur: '' };
  const bandeau = dossier && (
    <Bandeau
      retour={{ to: '/catalogue', libelle: 'Retour au catalogue' }}
      gerant={dossier.gerant}
      titre={`Suivi de ma demande · ${dossier.scpiNom}`}
      pastille={libelleStatut(dossier.statut)}
      pastilleClasse={`investir__statut investir__statut--${dossier.statut}`}
      montant={dossier.montant}
    />
  );

  return (
    <PageApplication
      titre="Suivi de ma demande"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
      bandeau={bandeau}
    >
      {erreur && (
        <div className="fiche__absente">
          <p className="compte__alerte" role="alert">
            {erreur}
          </p>
          <LienInterne to="/catalogue" className="compte__bouton">
            Retour au catalogue
          </LienInterne>
        </div>
      )}
      {!dossier && !erreur && <p className="compte__texte">Chargement…</p>}
      {dossier && (
        <div className="fiche investir">
          <Frise dossier={dossier} />
          <div className="suivi__cartes">
            <ProchaineEtape statut={dossier.statut} />
            <CarteStatut dossier={dossier} copier={copier} />
            <Dossier dossier={dossier} />
          </div>
        </div>
      )}
    </PageApplication>
  );
}
