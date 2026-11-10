// Page Profil (maquette C), en lecture seule : ouverte par les initiales de la sidebar.
// À gauche, la carte d'identité : initiales, nom, email, profil investisseur sur une
// jauge Prudent -> Dynamique et état du dossier (KYC, profil, pièces). À droite, le
// détail des réponses du KYC et des pièces justificatives.
// Réservée aux utilisateurs connectés au KYC validé (Routeur.jsx, ExigerKycComplete).
import { useEffect, useState } from 'react';
import { deconnecter } from '../auth.js';
import { LienInterne } from '../MiseEnPage.jsx';
import PageApplication from '../navigation/PageApplication.jsx';
import { initiales } from '../navigation/identite.js';
import {
  ORDRE_PROFILS,
  chargerProfil,
  compteurPieces,
  dateLongue,
  identite,
  piecesAffichees,
  profilInvestisseur,
  rubriques,
} from './donnees.js';
import { PROFILS } from '../investisseur/profils.js';
import './profil.css';

const ERREUR_CHARGEMENT = 'Votre profil n’a pas pu être chargé. Veuillez réessayer plus tard.';

function naviguer(url) {
  window.location.assign(url);
}

// Jauge décorative : le nom du profil est écrit juste au-dessus
function Jauge({ position }) {
  return (
    <div className="profil__jauge" aria-hidden="true">
      <div className="profil__curseur">
        <span style={{ left: `${position * 50}%` }} />
      </div>
      <div className="profil__graduations">
        {ORDRE_PROFILS.map((code, i) => (
          <span key={code} className={i === position ? 'profil__graduation--active' : undefined}>
            {PROFILS[code].nom}
          </span>
        ))}
      </div>
    </div>
  );
}

function Statut({ libelle, valeur, ok }) {
  return (
    <div className="profil__statut">
      <dt>{libelle}</dt>
      <dd className={ok ? 'profil__ok' : 'profil__attente'}>
        {ok ? '✓ ' : ''}
        {valeur}
      </dd>
    </div>
  );
}

function CarteIdentite({ donnees, pieces }) {
  const { nomComplet, email } = identite(donnees);
  const profil = profilInvestisseur(donnees.profil);
  const kycValideLe = dateLongue(donnees.kyc?.valideLe);
  return (
    <aside className="profil__carte profil__identite" aria-label="Votre identité">
      <span className="profil__pastille" aria-hidden="true">
        {initiales({ nomComplet, email })}
      </span>
      <h2 className="profil__nom">{nomComplet || email}</h2>
      {nomComplet && email && <p className="profil__email">{email}</p>}

      <p className="profil__etiquette">Profil investisseur</p>
      {profil ? (
        <>
          <p className="profil__type">{profil.nom}</p>
          <Jauge position={profil.position} />
          <p className="profil__explication">{profil.explication}</p>
        </>
      ) : (
        <p className="profil__a-completer">
          Pas encore défini.{' '}
          <LienInterne to="/formulaire-investisseur">Compléter mon profil investisseur</LienInterne>
        </p>
      )}

      <dl className="profil__statuts">
        <Statut
          libelle="Connaissance client"
          ok
          valeur={kycValideLe ? `Validée le ${kycValideLe}` : 'Validée'}
        />
        <Statut
          libelle="Profil investisseur"
          ok={Boolean(profil)}
          valeur={profil ? `Validé le ${profil.valideLe}` : 'À compléter'}
        />
        {pieces && (
          <Statut
            libelle="Pièces obligatoires"
            ok={pieces.every((p) => p.fournie || !p.obligatoire)}
            valeur={`${compteurPieces(pieces)} déposées`}
          />
        )}
      </dl>
    </aside>
  );
}

function Rubrique({ id, titre, lignes }) {
  return (
    <section className="profil__carte profil__rubrique" aria-labelledby={`profil-${id}`}>
      <h2 id={`profil-${id}`}>{titre}</h2>
      <dl className="profil__fiche">
        {lignes.map((ligne) => (
          <div key={ligne.cle}>
            <dt>{ligne.libelle}</dt>
            <dd>{ligne.valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Pieces({ pieces }) {
  return (
    <section className="profil__carte profil__rubrique" aria-labelledby="profil-pieces">
      <h2 id="profil-pieces">Pièces justificatives</h2>
      {pieces ? (
        <ul className="profil__pieces">
          {pieces.map((piece) => (
            <li key={piece.type} className="profil__piece">
              <span className="profil__piece-nom">
                {piece.libelle}
                {piece.fournie && (
                  <small>
                    {piece.nomFichier}
                    {piece.deposeLe && ` · déposée le ${piece.deposeLe}`}
                  </small>
                )}
              </span>
              <span
                className={
                  piece.fournie ? 'profil__badge' : 'profil__badge profil__badge--manquante'
                }
              >
                {piece.statut}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="compte__texte">La liste de vos pièces n’est pas disponible pour le moment.</p>
      )}
    </section>
  );
}

// charger, seDeconnecter, allerA, chargerIdentite : remplacés dans les tests
export default function Profil({
  charger = chargerProfil,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
}) {
  const [donnees, setDonnees] = useState(null);
  const [alerte, setAlerte] = useState('');

  useEffect(() => {
    let actif = true;
    charger()
      .then((resultat) => actif && setDonnees(resultat))
      .catch((err) => {
        if (!actif) return;
        if (err?.status === 401) {
          allerA('/connexion');
        } else {
          setAlerte(ERREUR_CHARGEMENT);
        }
      });
    return () => {
      actif = false;
    };
  }, [charger, allerA]);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  const reponses = donnees?.kyc?.reponses ?? {};
  const pieces = donnees?.pieces ? piecesAffichees(reponses, donnees.pieces) : null;

  return (
    <PageApplication
      titre="Mon profil"
      actif="profil"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
    >
      <p className="profil__sous-titre">
        Les informations transmises à l’ouverture de votre compte. Elles ne sont pas modifiables
        pour le moment.
      </p>
      {alerte && (
        <p className="compte__alerte" role="alert">
          {alerte}
        </p>
      )}
      {donnees ? (
        <div className="profil__colonnes">
          <CarteIdentite donnees={donnees} pieces={pieces} />
          <div className="profil__details">
            {rubriques(reponses).map((rubrique) => (
              <Rubrique key={rubrique.id} {...rubrique} />
            ))}
            <Pieces pieces={pieces} />
          </div>
        </div>
      ) : (
        !alerte && <p className="compte__texte">Chargement…</p>
      )}
    </PageApplication>
  );
}
