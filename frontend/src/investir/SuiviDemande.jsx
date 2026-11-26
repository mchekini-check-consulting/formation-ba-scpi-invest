// Suivi d'une demande (/demandes/<id>) : US-11 (SCPI-259) puis US-16 (SCPI-264). Ouvert
// après « Valider ma demande » avec le message « Votre demande a été transmise… », puis
// rouvrable par son adresse. Écran adapté à l'étape (choix du BA) :
//   - juste après la validation : bandeau, message vert et dossier ;
//   - demande envoyée, reçue, refusée ou investissement actif : la même chose avec la frise
//     (règle 2) ; message selon le statut : accusé de réception, motif du refus avec un
//     lien vers le catalogue, date de jouissance (règle 3) (maquettes K et M) ;
//   - acceptée, en attente de paiement : maquette F, frise et trois cartes « Prochaine
//     étape », virement (montant, IBAN, BIC, référence, boutons Copier), dossier.
// Dossier (règle 1) : ordre choisi par le BA à l'US-11.
// Statut lu au chargement de la page (règle 4). Dossier inexistant ou d'un autre
// investisseur : « Cette demande est introuvable. » (règle 5).
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { deconnecter } from '../auth.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import { formaterEuros, NON_COMMUNIQUE } from '../utils/format.js';
import { lireDemande } from './api.js';
import {
  CONSIGNES_VIREMENT,
  etapesFrise,
  formaterDate,
  libelleStatut,
  libelleType,
  MESSAGE_TRANSMISE,
  messageDemandeRecue,
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

function Lignes({ lignes }) {
  return (
    <dl className="suivi__lignes">
      {lignes.map(([libelle, valeur]) => (
        <div key={libelle} className="suivi__ligne">
          <dt>{libelle}</dt>
          <dd>{valeur}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProchaineEtape({ statut }) {
  return (
    <section className="suivi__carte" aria-labelledby="prochaine-etape">
      <Tuile nom="suite" ton="bleu" />
      <h2 id="prochaine-etape" className="suivi__titre">
        Prochaine étape
      </h2>
      <p className="suivi__texte">{texteProchaineEtape(statut)}</p>
      {statut === 'acceptee_attente_paiement' && (
        <ol className="suivi__consignes">
          {CONSIGNES_VIREMENT.map((consigne, i) => (
            <li key={consigne}>
              <span className="suivi__numero" aria-hidden="true">
                {i + 1}
              </span>
              {consigne}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Règle 3, dossier accepté : montant à virer, IBAN, BIC et référence, chacun copiable
function CarteVirement({ paiement, copier }) {
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
    <section className="suivi__carte suivi__carte--large" aria-labelledby="carte-statut">
      <Tuile nom="virement" ton="vert" />
      <p className="suivi__surtitre">Ce qui est attendu de vous</p>
      <h2 id="carte-statut" className="suivi__titre">
        Effectuez votre virement
      </h2>
      <p className="suivi__montant">
        <span>Montant à virer</span>
        <strong>{formaterEuros(paiement.montant)}</strong>
      </p>
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
      <p className="suivi__note">
        Indiquez la référence dans le libellé du virement. Le statut passera à « Investissement
        actif » quand la SCPI aura reçu votre paiement.
      </p>
    </section>
  );
}

// Message de l'écran simple (règle 3), vert sauf pour un refus (maquettes K et M)
function MessageStatut({ dossier, transmise }) {
  if (!transmise && dossier.statut === 'refusee') {
    return (
      <div className="investir__transmise suivi__message--refus" role="status">
        <span aria-hidden="true">
          <Icone nom="alerte" />
        </span>
        <p>
          La SCPI n’a pas accepté votre demande. Motif :{' '}
          <strong>{dossier.motifRefus ?? NON_COMMUNIQUE}</strong>.
        </p>
        <LienInterne to="/catalogue" className="suivi__message-lien">
          Choisir une autre SCPI →
        </LienInterne>
      </div>
    );
  }
  let message = MESSAGE_TRANSMISE;
  let date = null;
  if (!transmise && dossier.statut === 'investissement_actif') {
    message = 'Votre investissement est actif : vos parts vous appartiennent.';
    if (dossier.jouissanceLe) date = formaterDate(dossier.jouissanceLe);
  } else if (!transmise && dossier.statut === 'demande_recue' && dossier.accuseReceptionLe) {
    message = messageDemandeRecue(formaterDate(dossier.accuseReceptionLe));
  }
  return (
    <div className="investir__transmise" role="status">
      <span aria-hidden="true">
        <Icone nom="valide" />
      </span>
      <p>
        {message}
        {date && (
          <>
            {' '}
            Date d’entrée en jouissance : <strong>{date}</strong>.
          </>
        )}
      </p>
    </div>
  );
}

// Règle 1 : le dossier (ordre choisi par le BA à l'US-11), avec l'accusé de réception s'il
// est connu
function Dossier({ dossier, simple = false }) {
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
      {!simple && <Tuile nom="dossier" ton="sable" />}
      <h2 id="dossier" className="suivi__titre">
        Votre dossier
      </h2>
      <Lignes lignes={lignes} />
    </section>
  );
}

// Écran adapté à l'étape (choix du BA) : écran complet (maquette F : frise et trois cartes)
// seulement quand l'investisseur a un virement à faire. Sinon écran simple : message et
// dossier, avec la frise sauf juste après « Valider ma demande ».
function ecranComplet(dossier, transmise) {
  return !transmise && dossier.statut === 'acceptee_attente_paiement' && dossier.paiement;
}

export default function SuiviDemande({
  lire = lireDemande,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
  copier = copierTexte,
}) {
  const { id } = useParams();
  const transmise = useLocation().state?.transmise === true;
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
      pastilleClasse="investir__statut"
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
      {dossier && !ecranComplet(dossier, transmise) && (
        <div className="fiche investir suivi--simple">
          {!transmise && <Frise dossier={dossier} />}
          <MessageStatut dossier={dossier} transmise={transmise} />
          <Dossier dossier={dossier} simple />
        </div>
      )}
      {dossier && ecranComplet(dossier, transmise) && (
        <div className="fiche investir">
          <Frise dossier={dossier} />
          <div className="suivi__cartes">
            <ProchaineEtape statut={dossier.statut} />
            <CarteVirement paiement={dossier.paiement} copier={copier} />
            <Dossier dossier={dossier} />
          </div>
        </div>
      )}
    </PageApplication>
  );
}
