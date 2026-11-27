// Bloc « Mes investissements » du portefeuille (US-20, SCPI-267), maquette validée par le BA
// (style de la Fiche SCPI) : une carte par SCPI avec sa photo du Catalogue et ses chiffres
// en tuiles colorées, qui se déplie sur le tableau de ses dossiers.
//   règle 1 : nom, société de gestion, nombre de dossiers, montant investi, nombre de parts,
//     revenus mensuels (les trois derniers sur les seuls investissements actifs, calculés
//     par le backend) ;
//   règle 2 : ordre reçu du backend (montant investi décroissant) ;
//   règle 3 : une carte se déplie pour afficher ses dossiers, du plus récent au plus ancien ;
//   règle 4 : chaque dossier mène à son suivi (/demandes/<id>, C1).
import { useMemo, useState } from 'react';
import { photosPage } from '../catalogue/photos.js';
import { Icone } from '../investir/Elements.jsx';
import { formaterDate, libelleType } from '../investir/demande.js';
import { LienInterne } from '../MiseEnPage.jsx';
import { formaterEuros, formaterMontantCalcule, NON_COMMUNIQUE } from '../utils/format.js';
import {
  AUCUN_INVESTISSEMENT,
  detailDossier,
  libelleModeCourt,
  libelleStatutCourt,
} from './investissements.js';

// Chiffre d'une SCPI : tuile en dégradé (comme les chiffres clés de la Fiche), libellé, valeur
function Chiffre({ icone, ton, libelle, valeur }) {
  return (
    <span className="portefeuille__chiffre">
      <span className={`portefeuille__tuile portefeuille__tuile--${ton}`} aria-hidden="true">
        <Icone nom={icone} />
      </span>
      <span className="portefeuille__chiffre-texte">
        <span>{libelle}</span>
        <strong>{valeur}</strong>
      </span>
    </span>
  );
}

function Dossiers({ scpi, id }) {
  return (
    <div id={id} className="portefeuille__dossiers">
      <table aria-label={`Dossiers ${scpi.scpiNom}`}>
        <thead>
          <tr>
            <th scope="col">Dossier</th>
            <th scope="col">Demande du</th>
            <th scope="col">Mode</th>
            <th scope="col">Type</th>
            <th scope="col" className="portefeuille__nombre">
              Parts
            </th>
            <th scope="col" className="portefeuille__nombre">
              Montant
            </th>
            <th scope="col">Statut</th>
            <th scope="col">Information</th>
          </tr>
        </thead>
        <tbody>
          {scpi.dossiers.map((dossier) => (
            <tr key={dossier.id}>
              <td>
                <LienInterne to={`/demandes/${dossier.id}`} className="portefeuille__numero">
                  {dossier.numero}
                </LienInterne>
              </td>
              <td>{formaterDate(dossier.demandeLe)}</td>
              <td>{libelleModeCourt(dossier.mode)}</td>
              <td>{libelleType(dossier.type)}</td>
              <td className="portefeuille__nombre">{dossier.nombreParts}</td>
              <td className="portefeuille__nombre">{formaterEuros(dossier.montant)}</td>
              <td>
                <span className={`portefeuille__statut portefeuille__statut--${dossier.statut}`}>
                  {libelleStatutCourt(dossier.statut)}
                </span>
              </td>
              <td className="portefeuille__detail">{detailDossier(dossier) ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CarteScpi({ scpi, photo }) {
  const [ouverte, setOuverte] = useState(false);
  const idDossiers = `dossiers-scpi-${scpi.scpiId}`;
  return (
    <li className={`portefeuille__scpi${ouverte ? ' portefeuille__scpi--ouverte' : ''}`}>
      <button
        type="button"
        className="portefeuille__entete-scpi"
        aria-expanded={ouverte}
        aria-controls={idDossiers}
        onClick={() => setOuverte((o) => !o)}
      >
        {/* Photo d'illustration du Catalogue (ne représente pas les biens de la SCPI) */}
        <img className="portefeuille__photo" src={photo} alt="" loading="lazy" />
        <span className="portefeuille__nom">
          <strong>{scpi.scpiNom}</strong>
          <span className="portefeuille__gerant">{scpi.gerant ?? NON_COMMUNIQUE}</span>
        </span>
        <Chiffre icone="dossier" ton="violet" libelle="Dossiers" valeur={scpi.nombreDossiers} />
        <Chiffre
          icone="minimum"
          ton="turquoise"
          libelle="Montant investi"
          valeur={formaterEuros(scpi.montantInvesti)}
        />
        <Chiffre icone="pleine_propriete" ton="orange" libelle="Parts" valeur={scpi.nombreParts} />
        <Chiffre
          icone="horloge"
          ton="rose"
          libelle="Revenus / mois"
          valeur={formaterMontantCalcule(scpi.revenusMensuels)}
        />
        <svg
          className="portefeuille__chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d={ouverte ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
        </svg>
      </button>
      {ouverte && <Dossiers scpi={scpi} id={idDossiers} />}
    </li>
  );
}

export default function MesInvestissements({ scpis }) {
  // Même photo que dans le Catalogue (d'après le nom), sans doublon dans la liste
  const photos = useMemo(
    () => photosPage(scpis.map((s) => ({ id: s.scpiId, nom: s.scpiNom }))),
    [scpis],
  );
  return (
    <section className="portefeuille__bloc" aria-labelledby="mes-investissements">
      {/* Titre pour les lecteurs d'écran : le bandeau tient lieu de titre à l'écran */}
      <h2 id="mes-investissements" className="sr-only">
        Mes investissements
      </h2>
      {scpis.length === 0 ? (
        <div className="portefeuille__vide">
          <p className="compte__texte">{AUCUN_INVESTISSEMENT}</p>
          <LienInterne to="/catalogue" className="compte__bouton">
            Découvrir le catalogue
          </LienInterne>
        </div>
      ) : (
        <ul className="portefeuille__scpis">
          {scpis.map((scpi) => (
            <CarteScpi key={scpi.scpiId} scpi={scpi} photo={photos.get(scpi.scpiId)} />
          ))}
        </ul>
      )}
    </section>
  );
}
