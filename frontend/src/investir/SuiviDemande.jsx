// Suivi d'une demande (/demandes/<id>), version courte de l'US-11 (SCPI-259) : ouvert après
// « Valider ma demande » avec le message « Votre demande a été transmise… », puis
// rouvrable par son adresse. Bandeau avec le statut, résumé du dossier. La frise des
// étapes et les informations selon le statut viendront avec l'US-16.
// Dossier inexistant ou d'un autre investisseur : « Cette demande est introuvable. ».
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { deconnecter } from '../auth.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import { formaterEuros } from '../utils/format.js';
import { lireDemande } from './api.js';
import { formaterDate, libelleStatut, libelleType, MESSAGE_TRANSMISE } from './demande.js';
import { Bandeau, Icone } from './Elements.jsx';
import '../fiche/fiche.css';
import './investir.css';

function naviguer(url) {
  window.location.assign(url);
}

function Dossier({ dossier }) {
  const lignes = [
    // Ordre choisi par le BA
    ['Numéro de dossier', dossier.numero],
    ['Prix de part', formaterEuros(dossier.prixPart)],
    ['Date de la demande', formaterDate(dossier.demandeLe)],
    ['SCPI', dossier.scpiNom],
    ['Type d’investissement', libelleType(dossier.type)],
    ['Statut', libelleStatut(dossier.statut)],
    ['Nombre de parts', dossier.nombreParts],
    ['Montant', formaterEuros(dossier.montant)],
  ];
  return (
    <section
      className="fiche__carte-blanche fiche__frais investir__dossier"
      aria-labelledby="dossier"
    >
      <h2 id="dossier" className="fiche__titre-section">
        Votre dossier
      </h2>
      <dl className="investir__lignes">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="fiche__condition">
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
      {dossier && (
        <div className="fiche investir">
          {transmise && (
            <p className="investir__transmise" role="status">
              <span aria-hidden="true">
                <Icone nom="valide" />
              </span>
              {MESSAGE_TRANSMISE}
            </p>
          )}
          <Dossier dossier={dossier} />
        </div>
      )}
    </PageApplication>
  );
}
