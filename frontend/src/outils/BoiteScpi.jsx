// Écran de test « Boîte de réception de la SCPI » (dev et poste uniquement, maquette
// « B · Boîte de réception ») : les messages que SCPI Invest publie vers la SCPI partenaire
// (topic scpi.souscription.dossier.v1, US-12), tels que la société de gestion simulée
// (backend societe-gestion) les lit dans Kafka. « Accusé de réception » (US-13) renvoie
// l'accusé à SCPI Invest (avec deux variantes pour tester les règles C3 : doublon,
// message invalide) ; la décision (US-14) viendra plus tard.
// Les messages contiennent le KYC : identité, coordonnées et email masqués par défaut.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { EnTete, LienInterne } from '../MiseEnPage.jsx';
import { date, envoyerAccuse, euros, lireMessages, MASQUE, masquer } from './boiteScpi.js';
import { outilsDeTestVisibles } from './environnement.js';
import './boite-scpi.css';
import './outils.css';

const TYPES = {
  PLEINE_PROPRIETE: 'Pleine propriété',
  NUE_PROPRIETE: 'Nue-propriété',
  USUFRUIT: 'Usufruit',
};
const LIBELLES = {
  email: 'Email',
  civilite: 'Civilité',
  nom: 'Nom',
  prenom: 'Prénom',
  nomNaissance: 'Nom de naissance',
  dateNaissance: 'Né(e) le',
  lieuNaissance: 'À',
  nationalite: 'Nationalité',
  adresse: 'Adresse',
  codePostal: 'Code postal',
  ville: 'Ville',
  pays: 'Pays',
  telephone: 'Téléphone',
  indicatif: 'Indicatif',
  situationFamiliale: 'Situation',
  profession: 'Profession',
  categorie: 'Catégorie',
  secteur: 'Secteur',
  origineFonds: 'Origine des fonds',
  ppe: 'PPE',
  residenceFiscale: 'Résidence fiscale',
  usPerson: 'US person',
};
const cle = (m) => `${m.partition}-${m.offset}`;

export default function BoiteScpi({
  lire = lireMessages,
  envoyer = envoyerAccuse,
  visible = outilsDeTestVisibles(),
}) {
  useEffect(() => {
    document.title = 'SCPI Invest+ · Boîte de réception de la SCPI (dev)';
  }, []);

  return (
    <div className="cadre outils boite-scpi">
      <EnTete actions={false} />
      {visible ? (
        <Boite lire={lire} envoyer={envoyer} />
      ) : (
        <section className="outils__ferme">
          <h1 className="titre-section">Outil indisponible dans cet environnement</h1>
          <p>La boîte de réception de la SCPI n’est ouverte qu’en dev et sur le poste.</p>
          <LienInterne to="/" className="btn btn--sombre">
            Retour à l’accueil
          </LienInterne>
        </section>
      )}
    </div>
  );
}

function Boite({ lire, envoyer }) {
  const requete = useQuery({ queryKey: ['outils', 'boite-scpi'], queryFn: () => lire() });
  const [recherche, setRecherche] = useState('');
  const [choisi, setChoisi] = useState(null);

  const messages = useMemo(() => requete.data?.messages ?? [], [requete.data]);
  const filtres = useMemo(() => {
    const texte = recherche.trim().toUpperCase();
    return messages.filter(
      (m) =>
        !texte ||
        (m.cle ?? '').toUpperCase().includes(texte) ||
        String(m.message?.codeSCPI ?? '').includes(texte),
    );
  }, [messages, recherche]);
  const ouvert = messages.find((m) => cle(m) === choisi) ?? filtres[0] ?? null;

  return (
    <section className="boite-scpi__corps">
      <div className="boite-scpi__entete">
        <div>
          <span className="pastille-dev">Outil de test — dev</span>
          <h1>Boîte de réception de la SCPI</h1>
          <p className="boite-scpi__aide">
            Ce que SCPI Invest envoie à la SCPI partenaire, tel que la société de gestion le reçoit
            dans Kafka.
          </p>
        </div>
        <div className="boite-scpi__resume">
          {requete.data && <Resume donnees={requete.data} />}
          <button
            type="button"
            className="btn btn--clair"
            onClick={() => requete.refetch()}
            disabled={requete.isFetching}
          >
            {requete.isFetching ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
      </div>

      {requete.isPending && <p className="boite-scpi__info">Chargement des messages…</p>}
      {requete.isError && (
        <p className="boite-scpi__erreur" role="alert">
          {requete.error.message} Vérifiez que le backend societe-gestion est lancé.
        </p>
      )}
      {requete.data && (
        <div className="boite-scpi__boite">
          <nav className="boite-scpi__liste" aria-label="Messages reçus">
            <div className="boite-scpi__recherche">
              <input
                type="search"
                placeholder="Rechercher un dossier (D-1041) ou un code SCPI…"
                aria-label="Rechercher un dossier ou un code SCPI"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
            {filtres.length === 0 && (
              <p className="boite-scpi__info">
                {messages.length === 0 ? 'Aucun message reçu pour l’instant.' : 'Aucun résultat.'}
              </p>
            )}
            {filtres.map((m) => (
              <Element
                key={cle(m)}
                m={m}
                actif={ouvert && cle(m) === cle(ouvert)}
                choisir={() => setChoisi(cle(m))}
              />
            ))}
          </nav>
          <section className="boite-scpi__lecture">
            {ouvert ? <Lecture key={cle(ouvert)} m={ouvert} envoyer={envoyer} /> : null}
          </section>
        </div>
      )}
    </section>
  );
}

function Resume({ donnees }) {
  const { kafka, compteurs, messages } = donnees;
  const dossiers = new Set(messages.map((m) => m.cle)).size;
  const etat = !kafka.active
    ? ['Kafka désactivé', 'off']
    : kafka.connecte
      ? ['Kafka connecté', 'on']
      : [`Kafka injoignable${kafka.erreur ? ` (${kafka.erreur})` : ''}`, 'ko'];
  return (
    <dl className="boite-scpi__chiffres-entete">
      <div>
        <dt>messages</dt>
        <dd>{compteurs.lus}</dd>
      </div>
      <div>
        <dt>dossiers</dt>
        <dd>{dossiers}</dd>
      </div>
      <div>
        <dt>doublons</dt>
        <dd>{compteurs.doublons}</dd>
      </div>
      <div>
        <dt className={`boite-scpi__etat boite-scpi__etat--${etat[1]}`}>{etat[0]}</dt>
        <dd className="boite-scpi__mono">{kafka.topic ?? '—'}</dd>
      </div>
    </dl>
  );
}

function Element({ m, actif, choisir }) {
  const msg = m.message;
  return (
    <button
      type="button"
      className={`boite-scpi__element${actif ? ' boite-scpi__element--actif' : ''}`}
      onClick={choisir}
      aria-current={actif ? 'true' : undefined}
    >
      <span className="boite-scpi__haut">
        <b>{m.cle ?? 'sans clé'}</b>
        <span>{date(m.recuLe)}</span>
      </span>
      {m.invalide ? (
        <span className="badge badge--invalide">message illisible</span>
      ) : (
        <>
          <span>{euros(msg.montant)}</span>
          <span className="boite-scpi__bas">
            <span className="badge badge--code">{msg.codeSCPI}</span>
            {TYPES[msg.typeInvestissement] ?? msg.typeInvestissement}
            {m.doublon && <span className="badge badge--doublon">doublon</span>}
          </span>
        </>
      )}
    </button>
  );
}

// Bouton visible mais inactif tant que l'US n'est pas prête (info-bulle au survol)
function Bientot({ libelle, classe, us }) {
  return (
    <span className="boite-scpi__bientot" data-info={`Disponible avec l’${us}`}>
      <button type="button" className={`btn ${classe}`} disabled>
        {libelle}
      </button>
    </span>
  );
}

const RESULTATS = {
  normal: 'Accusé de réception envoyé',
  doublon: 'Doublon envoyé (même idMessage) : SCPI Invest doit l’ignorer',
  invalide: 'Message invalide envoyé (sans dateReception) : SCPI Invest doit le rejeter',
};

function Lecture({ m, envoyer }) {
  const [details, setDetails] = useState(true);
  const msg = m.message;
  const idDossier = typeof msg?.idDossier === 'string' ? msg.idDossier : null;
  const accuse = useMutation({ mutationFn: (variante) => envoyer(idDossier, variante) });
  const bouton = (variante, libelle, classe) => (
    <button
      type="button"
      className={`btn ${classe}`}
      disabled={!idDossier || accuse.isPending}
      onClick={() => accuse.mutate(variante)}
    >
      {libelle}
    </button>
  );
  return (
    <>
      <div className="boite-scpi__titre">
        <div>
          <h2>
            {m.invalide ? 'Message illisible' : `Demande ${msg.idDossier ?? m.cle}`}
            {!m.invalide && msg.codeSCPI ? ` — SCPI ${msg.codeSCPI}` : ''}
          </h2>
          <p className="boite-scpi__meta">
            <span className="badge badge--recu">Reçu</span>
            {m.doublon && (
              <span className="badge badge--doublon">doublon : même idMessage déjà reçu</span>
            )}
            <span>reçu le {date(m.recuLe)}</span>
            <span className="boite-scpi__mono">
              partition {m.partition} · offset {m.offset}
            </span>
            {msg?.idMessage && <span className="boite-scpi__mono">idMessage {msg.idMessage}</span>}
          </p>
        </div>
        <div className="boite-scpi__actions">
          <button type="button" className="btn btn--bleu" onClick={() => setDetails((d) => !d)}>
            {details ? 'Masquer les détails' : 'Détails'}
          </button>
          {bouton('normal', 'Accusé de réception', 'btn--clair')}
          <Bientot libelle="Accepter" classe="btn--vert" us="US-14" />
          <Bientot libelle="Refuser" classe="btn--rouge" us="US-14" />
        </div>
      </div>
      <div className="boite-scpi__tests-c3">
        <span>Tester les règles C3 :</span>
        {bouton('doublon', 'Renvoyer le dernier accusé (doublon)', 'btn--lien')}
        {bouton('invalide', 'Accusé invalide', 'btn--lien')}
      </div>
      {accuse.isSuccess && (
        <p className="boite-scpi__succes" role="status">
          {RESULTATS[accuse.variables]} — idMessage{' '}
          <span className="boite-scpi__mono">{accuse.data.idMessage}</span>
        </p>
      )}
      {accuse.isError && (
        <p className="boite-scpi__erreur" role="alert">
          {accuse.error.message}
        </p>
      )}
      {m.invalide ? (
        <pre className="boite-scpi__json">{m.brut}</pre>
      ) : (
        <>
          <div className="boite-scpi__chiffres">
            <Chiffre titre="Montant" valeur={euros(msg.montant)} />
            <Chiffre titre="Parts" valeur={`${msg.nombreParts} × ${euros(msg.prixPart)}`} />
            <Chiffre
              titre="Type"
              valeur={TYPES[msg.typeInvestissement] ?? msg.typeInvestissement}
            />
            <Chiffre titre="Demandé le" valeur={date(msg.dateDemande)} />
          </div>
          {details ? (
            <Details msg={msg} />
          ) : (
            <p className="boite-scpi__info">
              Cliquez sur « Détails » pour voir le contenu complet du message.
            </p>
          )}
        </>
      )}
    </>
  );
}

function Chiffre({ titre, valeur }) {
  return (
    <div className="boite-scpi__chiffre">
      <span>{titre}</span>
      <b>{valeur}</b>
    </div>
  );
}

function Details({ msg }) {
  const [onglet, setOnglet] = useState('lisible');
  const [voir, setVoir] = useState(false);
  const affiche = voir ? msg : masquer(msg);
  const inv = affiche.investisseur ?? {};
  return (
    <div className="boite-scpi__details">
      <div className="boite-scpi__details-barre">
        <div className="boite-scpi__onglets" role="tablist">
          {[
            ['lisible', 'Vue lisible'],
            ['json', 'JSON brut'],
          ].map(([id, libelle]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={onglet === id}
              className={onglet === id ? 'actif' : ''}
              onClick={() => setOnglet(id)}
            >
              {libelle}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--clair" onClick={() => setVoir((v) => !v)}>
          {voir ? 'Masquer' : 'Afficher'} les données personnelles
        </button>
      </div>
      {voir && (
        <p className="boite-scpi__avertissement">
          Données personnelles affichées : ne pas faire de capture d’écran ni les copier hors de cet
          outil.
        </p>
      )}
      {onglet === 'json' ? (
        <pre className="boite-scpi__json">{JSON.stringify(affiche, null, 2)}</pre>
      ) : (
        <div className="boite-scpi__grille">
          <Bloc
            titre="Dossier"
            valeurs={{
              'N° dossier': msg.idDossier,
              'Code SCPI': msg.codeSCPI,
              Mode: msg.modeInvestissement,
            }}
          />
          <Bloc titre="Identité" valeurs={inv.identite} />
          <Bloc titre="Coordonnées" valeurs={{ email: inv.email, ...inv.coordonnees }} />
          <Bloc titre="Situation" valeurs={inv.situation} />
          <Bloc titre="Déclarations" valeurs={inv.declarations} />
          <Bloc
            titre="Profil investisseur"
            valeurs={
              inv.profil && {
                Profil: inv.profil.profil,
                Score: inv.profil.score,
                Questionnaire: inv.profil.versionQuestionnaire,
                Validé: date(inv.profil.valideLe),
              }
            }
            vide="aucun profil validé"
          />
          <Bloc
            titre={`Justificatifs (${msg.justificatifs?.length ?? 0})`}
            valeurs={Object.fromEntries(
              (msg.justificatifs ?? []).map((j, i) => [`${i + 1}. ${j.type}`, j.nomFichier]),
            )}
            vide="aucun justificatif"
          />
        </div>
      )}
    </div>
  );
}

function Bloc({ titre, valeurs, vide = 'non renseigné' }) {
  const entrees = Object.entries(valeurs ?? {});
  return (
    <div className="boite-scpi__bloc">
      <h4>{titre}</h4>
      {entrees.length === 0 ? (
        <span className="boite-scpi__vide">{vide}</span>
      ) : (
        <dl>
          {entrees.map(([champ, valeur]) => (
            <div key={champ}>
              <dt>{LIBELLES[champ] ?? champ}</dt>
              <dd className={valeur === MASQUE ? 'boite-scpi__masque' : undefined}>
                {valeur === null || valeur === undefined ? (
                  <span className="boite-scpi__vide">non renseigné</span>
                ) : Array.isArray(valeur) ? (
                  valeur.join(', ')
                ) : (
                  String(valeur)
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
