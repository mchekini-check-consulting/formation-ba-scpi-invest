// Écran « Mon portefeuille » (/portefeuille, C1), epic SCPI-247 « Suivre son portefeuille ».
// US-20 (SCPI-267), maquette validée par le BA : bandeau bleu de la Fiche en tête de page
// (titre, nombre de SCPI et de dossiers, « Investir dans une SCPI »), puis le bloc
// « Mes investissements », chargé à l'ouverture de l'écran. Les autres blocs de l'epic
// (indicateurs, versements programmés, répartitions, revenus) viendront s'ajouter ici.
import { useEffect, useState } from 'react';
import { deconnecter } from '../auth.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import { listerInvestissements } from './api.js';
import { nombreDossiers, nombreScpis } from './investissements.js';
import MesInvestissements from './MesInvestissements.jsx';
import '../fiche/fiche.css';
import './portefeuille.css';

export const ERREUR_CHARGEMENT =
  'Vos investissements ne peuvent pas être affichés pour le moment. Réessayez dans quelques instants.';

function naviguer(url) {
  window.location.assign(url);
}

// Bandeau bleu (classes de la Fiche) ; pastilles une fois les investissements chargés
function Bandeau({ scpis }) {
  const dossiers = scpis?.reduce((total, s) => total + s.nombreDossiers, 0) ?? 0;
  return (
    <header className="fiche__bandeau portefeuille__bandeau">
      <svg className="fiche__cercles" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
        <circle cx="200" cy="200" r="190" />
        <circle cx="200" cy="200" r="140" />
        <circle cx="200" cy="200" r="90" />
      </svg>
      <div className="fiche__identite">
        <div className="fiche__nom">
          <h1 id="titre-page" className="fiche__titre">
            Mon portefeuille
          </h1>
          {scpis && scpis.length > 0 && (
            <ul className="fiche__pastilles" aria-label="Résumé">
              <li>{nombreScpis(scpis.length)}</li>
              <li>{nombreDossiers(dossiers)}</li>
            </ul>
          )}
        </div>
        <div className="fiche__actions">
          <LienInterne to="/catalogue" className="fiche__bouton fiche__bouton--principal">
            Investir dans une SCPI
          </LienInterne>
        </div>
      </div>
    </header>
  );
}

export default function Portefeuille({
  lister = listerInvestissements,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const [etat, setEtat] = useState({ scpis: null, erreur: '' });

  useEffect(() => {
    let actif = true;
    lister()
      .then(({ scpis }) => actif && setEtat({ scpis, erreur: '' }))
      .catch((err) => {
        if (!actif) return;
        if (err.status === 401) allerA('/connexion');
        else setEtat({ scpis: null, erreur: ERREUR_CHARGEMENT });
      });
    return () => {
      actif = false;
    };
  }, [lister, allerA]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const { scpis, erreur } = etat;
  return (
    <PageApplication
      titre="Mon portefeuille"
      actif="portefeuille"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
      bandeau={<Bandeau scpis={scpis} />}
    >
      {erreur && (
        <p className="compte__alerte" role="alert">
          {erreur}
        </p>
      )}
      {!scpis && !erreur && <p className="compte__texte">Chargement…</p>}
      {scpis && (
        <div className="portefeuille">
          <MesInvestissements scpis={scpis} />
        </div>
      )}
    </PageApplication>
  );
}
