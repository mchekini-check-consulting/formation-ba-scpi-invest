// Outil de test de l'import du catalogue (dev et poste uniquement, maquette « C ·
// Console de test ») : déposer un CSV sur R2, lancer l'import, puis tout voir pour
// diagnostiquer : fichier sur R2, planification, serveur, historique complet des
// rapports d'exécution (dates à la seconde, durées, compteurs, erreurs, lignes
// rejetées) et catalogue en base avec ses tables liées.
// Ouvert sans connexion. Ailleurs qu'en dev : message, aucun appel au backend.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiBase } from '../api.js';
import { EnTete, LienInterne } from '../MiseEnPage.jsx';
import * as API from './api.js';
import { environnementDe, outilsDeTestVisibles } from './environnement.js';
import { dateHeure, duree, dureeEntre, nombre, ouiNon, relatif, taille, VIDE } from './format.js';
import './outils.css';

const STATUTS = {
  en_cours: 'En cours',
  reussi: 'Réussi',
  echec: 'Échec',
  aucun_fichier: 'Aucun fichier',
};

const COMPTEURS = [
  ['lues', 'lues'],
  ['ajoutees', 'ajoutées'],
  ['mises_a_jour', 'mises à jour'],
  ['inchangees', 'inchangées'],
  ['supprimees', 'supprimées'],
  ['rejetees', 'rejetées'],
];

const CLE = ['outils', 'import-catalogue'];

export default function ImportCatalogue({
  api = API,
  visible = outilsDeTestVisibles(),
  maintenant = () => new Date(),
}) {
  useEffect(() => {
    document.title = 'SCPI Invest+ · Import du catalogue (dev)';
  }, []);

  return (
    <div className="cadre outils">
      <EnTete actions={false} />
      {visible ? (
        <Console api={api} maintenant={maintenant} />
      ) : (
        <section className="outils__ferme">
          <h1 className="titre-section">Outil indisponible dans cet environnement</h1>
          <p>L’import du catalogue à la main n’est ouvert qu’en dev et sur le poste.</p>
          <LienInterne to="/" className="btn btn--sombre">
            Retour à l’accueil
          </LienInterne>
        </section>
      )}
    </div>
  );
}

function Console({ api, maintenant }) {
  const client = useQueryClient();
  const etat = useQuery({ queryKey: [...CLE, 'etat'], queryFn: api.lireEtat });
  const rapports = useQuery({
    queryKey: [...CLE, 'rapports'],
    queryFn: () => api.lireRapports(50),
  });
  const scpi = useQuery({ queryKey: [...CLE, 'scpi'], queryFn: api.lireCatalogue });
  const rafraichir = () => client.invalidateQueries({ queryKey: CLE });

  const [onglet, setOnglet] = useState('rapports');
  const [choisi, setChoisi] = useState(null);
  const liste = rapports.data ?? [];
  const rapport = liste.find((r) => r.id === choisi) ?? liste[0] ?? null;

  const importer = useMutation({
    mutationFn: api.lancerImport,
    onSuccess: (resultat) => setChoisi(resultat.rapport?.id ?? null),
    onSettled: rafraichir,
  });

  return (
    <div className="outils__corps">
      <aside className="outils__gauche">
        <div>
          <span className="pastille-dev">dev · outil de test</span>
          <h1>Import du catalogue</h1>
          <p className="outils__sous-titre">
            Environnement : <strong>{environnementDe() ?? 'inconnu'}</strong>
          </p>
        </div>
        <Depot api={api} apresEnvoi={rafraichir} />
        <section className="outils__action" aria-labelledby="titre-import">
          <h2 id="titre-import">2 · Import</h2>
          <button
            type="button"
            className="btn btn--bleu"
            onClick={() => importer.mutate()}
            disabled={importer.isPending}
          >
            {importer.isPending ? 'Import en cours…' : 'Lancer l’import maintenant'}
          </button>
          {importer.isPending && <Progression part={null} />}
          <ResultatImport mutation={importer} />
        </section>
        <Stockage requete={etat} maintenant={maintenant} />
        <Planification etat={etat.data} maintenant={maintenant} />
        <Serveur etat={etat.data} />
        <button type="button" className="btn btn--clair" onClick={rafraichir}>
          Actualiser
        </button>
      </aside>

      <section className="outils__droite">
        <Kpis rapport={liste[0]} nbScpi={scpi.data?.length} maintenant={maintenant} />
        <div className="outils__panneau">
          <div className="outils__barre">
            <div className="onglets" role="tablist" aria-label="Données">
              <Onglet id="rapports" actif={onglet} choisir={setOnglet}>
                Historique des imports ({liste.length})
              </Onglet>
              <Onglet id="rejets" actif={onglet} choisir={setOnglet}>
                Lignes rejetées ({rapport?.rejets?.length ?? 0})
              </Onglet>
              <Onglet id="scpi" actif={onglet} choisir={setOnglet}>
                SCPI en base ({scpi.data?.length ?? 0})
              </Onglet>
            </div>
          </div>
          {onglet === 'rapports' && (
            <Charge requete={rapports}>
              <TableRapports rapports={liste} choisi={rapport?.id} choisir={setChoisi} />
              {rapport && <DetailRapport rapport={rapport} maintenant={maintenant} />}
            </Charge>
          )}
          {onglet === 'rejets' && (
            <Charge requete={rapports}>
              <Rejets rapport={rapport} />
            </Charge>
          )}
          {onglet === 'scpi' && (
            <Charge requete={scpi}>
              <TableScpi scpis={scpi.data ?? []} />
            </Charge>
          )}
        </div>
      </section>
    </div>
  );
}

function Onglet({ id, actif, choisir, children }) {
  return (
    <button type="button" role="tab" aria-selected={actif === id} onClick={() => choisir(id)}>
      {children}
    </button>
  );
}

// Chargement, erreur (avec le code HTTP), ou le contenu
function Charge({ requete, children }) {
  if (requete.isPending) return <p className="outils__info">Chargement…</p>;
  if (requete.isError) return <Erreur erreur={requete.error} />;
  return children;
}

function Erreur({ erreur }) {
  return (
    <p className="outils__erreur" role="alert">
      {erreur.message}
      {erreur.status !== undefined && <span> (HTTP {erreur.status || 'injoignable'})</span>}
    </p>
  );
}

function Progression({ part }) {
  return (
    <div
      className={part === null ? 'progression progression--continue' : 'progression'}
      role="progressbar"
      aria-valuenow={part === null ? undefined : Math.round(part * 100)}
    >
      <i style={part === null ? undefined : { width: `${part * 100}%` }} />
    </div>
  );
}

function Depot({ api, apresEnvoi }) {
  const [fichier, setFichier] = useState(null);
  const [part, setPart] = useState(0);
  const envoi = useMutation({
    mutationFn: (f) => api.deposerCsv(f, setPart),
    onSettled: apresEnvoi,
  });
  const choisir = (f) => {
    if (!f) return;
    setFichier(f);
    setPart(0);
    envoi.reset();
  };
  return (
    <section className="outils__action" aria-labelledby="titre-depot">
      <h2 id="titre-depot">1 · Fichier CSV</h2>
      <label
        className="outils__depot"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          choisir(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Fichier CSV"
          onChange={(e) => choisir(e.target.files[0])}
        />
        {fichier ? (
          <span>
            <strong>{fichier.name}</strong> · {taille(fichier.size)}
            <br />
            <small>modifié le {dateHeure(fichier.lastModified)}</small>
          </span>
        ) : (
          <span>Glissez un fichier .csv ou cliquez pour le choisir</span>
        )}
      </label>
      <button
        type="button"
        className="btn btn--clair"
        disabled={!fichier || envoi.isPending}
        onClick={() => envoi.mutate(fichier)}
      >
        {envoi.isPending ? 'Envoi…' : 'Envoyer sur R2'}
      </button>
      {envoi.isPending && <Progression part={part} />}
      {envoi.isSuccess && (
        <Confirmation titre="Fichier envoyé sur R2" suite="Vous pouvez maintenant lancer l’import.">
          <Infos
            lignes={[
              ['Emplacement', `${envoi.data.bucket}/${envoi.data.cle}`],
              ['Taille', taille(envoi.data.taille)],
              ['Envoyé le', dateHeure(envoi.data.deposeLe)],
            ]}
          />
        </Confirmation>
      )}
      {envoi.isError && <Erreur erreur={envoi.error} />}
    </section>
  );
}

// Titre selon le statut du rapport ; pas de rapport (base injoignable) : selon l'erreur
const RESULTATS = {
  reussi: ['ok', 'Catalogue importé'],
  echec: ['ko', 'Import refusé : catalogue inchangé'],
  aucun_fichier: ['ko', 'Aucun fichier à importer sur R2'],
  en_cours: ['ko', 'Import interrompu avant la fin'],
};

function ResultatImport({ mutation }) {
  if (mutation.isError) return <Erreur erreur={mutation.error} />;
  if (!mutation.isSuccess) return null;
  const { erreur, dureeMs, rapport } = mutation.data;
  const statut = rapport?.statut ?? (erreur ? 'echec' : 'reussi');
  const [ton, titre] = RESULTATS[statut] ?? ['ko', STATUTS[statut] ?? statut];
  const lignes = [];
  if (rapport && statut === 'reussi') {
    lignes.push(
      ['Lignes lues', rapport.lues],
      ['Ajoutées', rapport.ajoutees],
      ['Mises à jour', rapport.mises_a_jour],
      ['Inchangées', rapport.inchangees],
      ['Supprimées', rapport.supprimees],
      ['Rejetées', rapport.rejetees],
    );
  }
  if (erreur) lignes.push(['Motif', erreur]);
  lignes.push(['Durée', duree(dureeMs)]);
  if (rapport) lignes.push(['Rapport', `n° ${rapport.id}`]);
  return (
    <Confirmation
      ton={ton}
      titre={titre}
      suite={rapport?.rejetees > 0 ? 'Détail dans l’onglet « Lignes rejetées ».' : undefined}
    >
      <Infos lignes={lignes} />
    </Confirmation>
  );
}

// Message de fin d'une action : titre avec ✓ (ok) ou ✗ (ko), détail, prochaine étape
function Confirmation({ ton = 'ok', titre, suite, children }) {
  return (
    <div className={`confirmation confirmation--${ton}`} role="status">
      <p className="confirmation__titre">
        <span aria-hidden="true">{ton === 'ok' ? '✓' : '✗'}</span> {titre}
      </p>
      {children}
      {suite && <p className="confirmation__suite">{suite}</p>}
    </div>
  );
}

function Statut({ statut }) {
  return <span className={`statut statut--${statut}`}>{STATUTS[statut] ?? statut}</span>;
}

// Paires libellé / valeur des blocs de la colonne de gauche
function Infos({ lignes }) {
  return (
    <dl className="outils__infos">
      {lignes.map(([libelle, valeur]) => (
        <div key={libelle}>
          <dt>{libelle}</dt>
          <dd>{valeur ?? VIDE}</dd>
        </div>
      ))}
    </dl>
  );
}

function Quand({ iso, maintenant }) {
  if (!iso) return VIDE;
  return (
    <time dateTime={iso} title={iso}>
      {dateHeure(iso)} <small>({relatif(iso, maintenant())})</small>
    </time>
  );
}

function Stockage({ requete, maintenant }) {
  const { data, isError, error } = requete;
  return (
    <section className="outils__bloc" aria-labelledby="titre-stockage">
      <h2 id="titre-stockage">Fichier sur R2</h2>
      {isError && <Erreur erreur={error} />}
      {data && !data.stockage.configure && (
        <p className="outils__erreur-texte">{data.stockage.raison}</p>
      )}
      {data?.stockage.configure && (
        <Infos
          lignes={[
            ['Service', data.stockage.endpoint],
            ['Fichier', `${data.stockage.bucket}/${data.stockage.cle}`],
            ['Présent', presence(data.fichier)],
            ['Taille', taille(data.fichier?.taille)],
            ['Modifié le', <Quand key="m" iso={data.fichier?.modifieLe} maintenant={maintenant} />],
            ['ETag', data.fichier?.etag],
            ['Type', data.fichier?.typeContenu],
            [
              'Après import',
              data.stockage.supprimerSource ? 'archivé puis supprimé' : 'archivé, gardé en place',
            ],
          ]}
        />
      )}
    </section>
  );
}

function presence(fichier) {
  if (!fichier) return VIDE;
  if (fichier.present === null) return `erreur : ${fichier.erreur}`;
  return fichier.present ? 'Oui' : 'Non, aucun fichier';
}

function Planification({ etat, maintenant }) {
  if (!etat) return null;
  const p = etat.planification;
  return (
    <section className="outils__bloc" aria-labelledby="titre-planif">
      <h2 id="titre-planif">Import automatique</h2>
      {p ? (
        <Infos
          lignes={[
            ['Horaire (cron)', <code key="h">{p.horaire}</code>],
            ['Fuseau', p.fuseau],
            ['Prochain', <Quand key="p" iso={p.prochain} maintenant={maintenant} />],
          ]}
        />
      ) : (
        <p className="outils__info">Désactivé (variables R2 absentes).</p>
      )}
    </section>
  );
}

function Serveur({ etat }) {
  if (!etat) return null;
  const s = etat.serveur;
  return (
    <section className="outils__bloc" aria-labelledby="titre-serveur">
      <h2 id="titre-serveur">Backend</h2>
      <Infos
        lignes={[
          ['Adresse', apiBase()],
          ['Heure du serveur', dateHeure(s.heure)],
          ['Démarré le', dateHeure(s.demarreLe)],
          ['Pod', s.pod],
          ['Fuseau du serveur', s.fuseau],
        ]}
      />
    </section>
  );
}

function Kpis({ rapport, nbScpi, maintenant }) {
  return (
    <div className="outils__kpis">
      <div>
        <strong>{nombre(nbScpi)}</strong>
        <span>SCPI en base</span>
      </div>
      <div>
        <strong>{rapport ? <Statut statut={rapport.statut} /> : VIDE}</strong>
        <span>
          dernier import
          {rapport && (
            <>
              {' '}
              · {dateHeure(rapport.debut)} ({relatif(rapport.debut, maintenant())})
            </>
          )}
        </span>
      </div>
      <div>
        <strong>{rapport ? rapport.ajoutees + rapport.mises_a_jour : VIDE}</strong>
        <span>ajoutées ou mises à jour</span>
      </div>
      <div>
        <strong>{rapport ? rapport.rejetees : VIDE}</strong>
        <span>lignes rejetées</span>
      </div>
    </div>
  );
}

function TableRapports({ rapports, choisi, choisir }) {
  if (rapports.length === 0) return <p className="outils__info">Aucun import enregistré.</p>;
  return (
    <div className="outils__tableau">
      <table>
        <thead>
          <tr>
            <th scope="col">N°</th>
            <th scope="col">Début</th>
            <th scope="col">Fin</th>
            <th scope="col">Durée</th>
            <th scope="col">Fichier</th>
            <th scope="col">Statut</th>
            {COMPTEURS.map(([cle, libelle]) => (
              <th key={cle} scope="col" className="num">
                {libelle}
              </th>
            ))}
            <th scope="col">Erreur</th>
          </tr>
        </thead>
        <tbody>
          {rapports.map((r) => (
            <tr
              key={r.id}
              aria-selected={r.id === choisi}
              onClick={() => choisir(r.id)}
              className="cliquable"
            >
              <td>{r.id}</td>
              <td>{dateHeure(r.debut)}</td>
              <td>{dateHeure(r.fin)}</td>
              <td>{r.fin ? dureeEntre(r.debut, r.fin) : 'pas terminé'}</td>
              <td>{r.fichier ?? VIDE}</td>
              <td>
                <Statut statut={r.statut} />
              </td>
              {COMPTEURS.map(([cle]) => (
                <td key={cle} className="num">
                  {r[cle]}
                </td>
              ))}
              <td className="outils__erreur-cellule" title={r.erreur ?? undefined}>
                {r.erreur ?? VIDE}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailRapport({ rapport, maintenant }) {
  return (
    <section className="outils__detail" aria-label={`Rapport n° ${rapport.id}`}>
      <h3>
        Rapport n° {rapport.id} <Statut statut={rapport.statut} />
      </h3>
      <Infos
        lignes={[
          ['Début', <Quand key="d" iso={rapport.debut} maintenant={maintenant} />],
          ['Fin', <Quand key="f" iso={rapport.fin} maintenant={maintenant} />],
          ['Durée', rapport.fin ? dureeEntre(rapport.debut, rapport.fin) : 'pas terminé'],
          ['Fichier', rapport.fichier],
          ...COMPTEURS.map(([cle, libelle]) => [libelle, rapport[cle]]),
          ['Erreur', rapport.erreur],
        ]}
      />
      <Rejets rapport={rapport} />
      <details>
        <summary>Données brutes (JSON)</summary>
        <pre>{JSON.stringify(rapport, null, 2)}</pre>
      </details>
    </section>
  );
}

function Rejets({ rapport }) {
  const rejets = rapport?.rejets ?? [];
  if (rejets.length === 0) {
    return (
      <p className="outils__info">
        Aucune ligne rejetée{rapport && ` (rapport n° ${rapport.id})`}.
      </p>
    );
  }
  return (
    <div className="outils__tableau">
      <table aria-label={`Lignes rejetées du rapport n° ${rapport.id}`}>
        <thead>
          <tr>
            <th scope="col" className="num">
              Ligne
            </th>
            <th scope="col">SCPI</th>
            <th scope="col">Motif</th>
          </tr>
        </thead>
        <tbody>
          {rejets.map((r, i) => (
            <tr key={`${r.ligne}-${i}`}>
              <td className="num">{r.ligne}</td>
              <td>{r.nom ?? VIDE}</td>
              <td>{r.motif}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Valeurs par année, de la plus récente à la plus ancienne : « 2025 : 5,1 · 2024 : 4,9 »
function parAnnee(lignes = [], champ, suffixe = '') {
  if (lignes.length === 0) return VIDE;
  return [...lignes]
    .sort((a, b) => (b.annee ?? 0) - (a.annee ?? 0))
    .map((l) => `${l.annee ?? '?'} : ${nombre(l[champ])}${suffixe}`)
    .join(' · ');
}

function repartition(lignes = [], champ) {
  if (lignes.length === 0) return VIDE;
  return lignes.map((l) => `${l[champ]} ${nombre(l.pourcentage)} %`).join(' · ');
}

const COLONNES_SCPI = [
  ['Nom', (s) => <strong>{s.nom}</strong>],
  ['Gérant', (s) => s.gerant ?? VIDE],
  ['Taux de distribution', (s) => parAnnee(s.taux_distribution, 'taux', ' %')],
  ['Prix de la part', (s) => parAnnee(s.prix_part, 'prix', ' €')],
  ['Valeur de reconstitution', (s) => parAnnee(s.valeur_reconstitution, 'valeur', ' €')],
  [
    'Ticket min.',
    (s) => (s.minimum_souscription === null ? VIDE : `${nombre(s.minimum_souscription)} €`),
  ],
  ['Capitalisation', (s) => (s.capitalisation === null ? VIDE : `${nombre(s.capitalisation)} €`)],
  [
    'Frais souscr.',
    (s) => (s.frais_souscription === null ? VIDE : `${nombre(s.frais_souscription)} %`),
  ],
  ['Frais gestion', (s) => (s.frais_gestion === null ? VIDE : `${nombre(s.frais_gestion)} %`)],
  ['Délai jouissance', (s) => (s.delai_jouissance === null ? VIDE : `${s.delai_jouissance} mois`)],
  ['Fréquence', (s) => s.frequence ?? VIDE],
  ['Localisation', (s) => repartition(s.localisation, 'pays')],
  ['Secteurs', (s) => repartition(s.secteurs, 'secteur')],
  ['Démembrement', (s) => ouiNon(s.demembrement)],
  [
    'Décote démembrement',
    (s) =>
      s.decote_demembrement?.length
        ? s.decote_demembrement.map((d) => `${d.duree} ans : ${d.decote} %`).join(' · ')
        : VIDE,
  ],
  ['Cashback', (s) => nombre(s.cashback)],
  ['Versement programmé', (s) => ouiNon(s.versement_programme)],
  ['IBAN', (s) => s.iban ?? VIDE],
  ['BIC', (s) => s.bic ?? VIDE],
  ['Publicité', (s) => s.publicite ?? VIDE],
  ['Mise à jour', (s) => dateHeure(s.mise_a_jour)],
  [
    'Empreinte',
    (s) => (s.empreinte ? <code title={s.empreinte}>{s.empreinte.slice(0, 10)}…</code> : VIDE),
  ],
];

function TableScpi({ scpis }) {
  const [filtre, setFiltre] = useState('');
  const [choisie, setChoisie] = useState(null);
  const f = filtre.trim().toLowerCase();
  const visibles = f ? scpis.filter((s) => JSON.stringify(s).toLowerCase().includes(f)) : scpis;
  const detail = scpis.find((s) => s.id === choisie);
  return (
    <>
      <input
        className="outils__recherche"
        type="search"
        placeholder="Rechercher (nom, gérant, IBAN…)"
        aria-label="Rechercher une SCPI"
        value={filtre}
        onChange={(e) => setFiltre(e.target.value)}
      />
      {visibles.length === 0 ? (
        <p className="outils__info">
          {scpis.length === 0 ? 'Aucune SCPI en base.' : 'Aucune SCPI ne correspond.'}
        </p>
      ) : (
        <div className="outils__tableau">
          <table aria-label="SCPI en base">
            <thead>
              <tr>
                {COLONNES_SCPI.map(([libelle]) => (
                  <th key={libelle} scope="col">
                    {libelle}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((s) => (
                <tr
                  key={s.id}
                  className="cliquable"
                  aria-selected={s.id === choisie}
                  onClick={() => setChoisie(s.id)}
                >
                  {COLONNES_SCPI.map(([libelle, valeur]) => (
                    <td key={libelle}>{valeur(s)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <details className="outils__detail" open>
          <summary>Données brutes de {detail.nom} (JSON)</summary>
          <pre>{JSON.stringify(detail, null, 2)}</pre>
        </details>
      )}
    </>
  );
}
