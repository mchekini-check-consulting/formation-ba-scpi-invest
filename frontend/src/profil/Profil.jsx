// Page Profil (maquette C) : ouverte par les initiales de la sidebar.
// À gauche, la carte d'identité : initiales, nom, email, profil investisseur sur une
// jauge Prudent -> Dynamique et état du dossier (KYC, profil, pièces). À droite, le
// détail des réponses du KYC et des pièces justificatives.
// US-06 : blocs Coordonnées, Adresse, Situation et Pièce d'identité modifiables, un à la
// fois, appliqués dès l'enregistrement (BlocsInformations.jsx) ; RIB bientôt modifiable ;
// historique des modifications en bas de page.
// Réservée aux utilisateurs connectés au KYC validé (Routeur.jsx, ExigerKycComplete).
import { useCallback, useEffect, useState } from 'react';
import { deconnecter } from '../auth.js';
import { suggererAdresses, suggererCommunes } from '../kyc/api.js';
import { LienInterne } from '../MiseEnPage.jsx';
import { CHEMIN_MISE_A_JOUR } from '../navigation/rappel.js';
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
import { BlocIdentite, BlocModifiable, BlocRib, Historique } from './BlocsInformations.jsx';
import {
  MESSAGE_ANNULEE,
  deposerJustificatif,
  modifierInformations,
  valeursBloc,
} from './informations.js';
import './profil.css';

// Message affiché sous un bloc après l'enregistrement
const SUCCES = {
  coordonnees: 'Vos coordonnées sont enregistrées.',
  adresse:
    'Votre nouvelle adresse est enregistrée. Votre justificatif sera contrôlé par nos équipes.',
  situation: 'Votre situation est enregistrée.',
  identite: 'Votre nouvelle pièce d’identité est enregistrée. Elle sera contrôlée par nos équipes.',
};

function MessageSucces({ bloc }) {
  if (bloc !== 'situation') return SUCCES[bloc];
  return (
    <>
      {SUCCES.situation} Votre situation a changé : pensez à mettre à jour votre profil
      investisseur.{' '}
      <LienInterne to={CHEMIN_MISE_A_JOUR}>Mettre à jour mon profil investisseur</LienInterne>
    </>
  );
}

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

function statutProfil(profil) {
  if (!profil) return 'À compléter';
  if (profil.aMettreAJour) return `À mettre à jour · validé le ${profil.valideLe}`;
  return `Validé le ${profil.valideLe}`;
}

const ICONE_MISE_A_JOUR = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
  </svg>
);

// « Mettre à jour mon profil » ; grisé, avec son explication, moins de 24 heures après la
// dernière validation (une mise à jour au plus par 24 heures)
function BoutonMiseAJour({ profil }) {
  if (profil.miseAJourPossibleLe) {
    return (
      <>
        <button
          type="button"
          className="profil__mise-a-jour"
          disabled
          aria-describedby="profil-mise-a-jour-attente"
        >
          {ICONE_MISE_A_JOUR}
          Mettre à jour mon profil
        </button>
        <p id="profil-mise-a-jour-attente" className="profil__attente-mise-a-jour">
          Votre profil a été validé il y a moins de 24 heures. Nouvelle mise à jour possible le{' '}
          {profil.miseAJourPossibleLe}.
        </p>
      </>
    );
  }
  return (
    <LienInterne
      to={CHEMIN_MISE_A_JOUR}
      className={
        profil.aMettreAJour
          ? 'profil__mise-a-jour profil__mise-a-jour--rappel'
          : 'profil__mise-a-jour'
      }
    >
      {ICONE_MISE_A_JOUR}
      Mettre à jour mon profil
    </LienInterne>
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
          {profil.aMettreAJour && (
            <p className="profil__rappel">
              Votre profil date de plus de 2 ans ou le questionnaire a évolué. Mettez-le à jour pour
              qu’il reflète votre situation actuelle.
            </p>
          )}
          <BoutonMiseAJour profil={profil} />
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
          ok={Boolean(profil) && !profil.aMettreAJour}
          valeur={statutProfil(profil)}
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

// charger, seDeconnecter, allerA, chargerIdentite, enregistrer, deposer, chercherAdresses,
// chercherCommunes :
// remplacés dans les tests
export default function Profil({
  charger = chargerProfil,
  seDeconnecter = deconnecter,
  allerA = naviguer,
  chargerIdentite,
  enregistrer = modifierInformations,
  deposer = deposerJustificatif,
  chercherAdresses = suggererAdresses,
  chercherCommunes = suggererCommunes,
}) {
  const [donnees, setDonnees] = useState(null);
  const [alerte, setAlerte] = useState('');
  // US-06 : bloc ouvert (un seul à la fois), bloc tout juste enregistré, annulation
  const [enEdition, setEnEdition] = useState(null);
  const [enregistre, setEnregistre] = useState(null);
  const [annulation, setAnnulation] = useState('');

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

  // Modification appliquée : informations à jour tout de suite, puis tout est relu
  // (statut des pièces) ; une relecture en échec garde l'affichage déjà à jour
  const appliquer = useCallback(
    async (bloc, demande) => {
      const informations = await enregistrer(bloc, demande);
      setDonnees((d) => ({
        ...d,
        kyc: { ...d.kyc, reponses: informations.reponses },
        utilisateur: { ...d.utilisateur, email: informations.email },
        informations,
      }));
      setEnEdition(null);
      setEnregistre(bloc);
      charger()
        .then((resultat) => setDonnees(resultat))
        .catch(() => {});
    },
    [enregistrer, charger],
  );

  const reponses = donnees?.kyc?.reponses ?? {};
  const pieces = donnees?.pieces ? piecesAffichees(reponses, donnees.pieces) : null;
  const informations = donnees?.informations;
  const email = informations?.email ?? donnees?.utilisateur?.email ?? '';
  const parId = Object.fromEntries(rubriques(reponses).map((r) => [r.id, r]));
  // Blocs modifiables seulement si le backend des informations a répondu
  const modifiable = Boolean(informations);
  const proprietesBloc = (bloc) => ({
    ouvert: enEdition === bloc,
    verrouille: enEdition !== null,
    succes: enregistre === bloc ? <MessageSucces bloc={bloc} /> : null,
    ouvrir: () => {
      setEnEdition(bloc);
      setEnregistre(null);
      setAnnulation('');
    },
    fermer: () => setEnEdition(null),
    enregistrer: modifiable ? appliquer : undefined,
    deposer,
  });

  return (
    <PageApplication
      titre="Mon profil"
      actif="profil"
      seDeconnecter={quitter}
      chargerIdentite={chargerIdentite}
    >
      <p className="profil__sous-titre">
        Vos informations personnelles. Modifiez un bloc à la fois : la modification est prise en
        compte dès l’enregistrement.
      </p>
      {alerte && (
        <p className="compte__alerte" role="alert">
          {alerte}
        </p>
      )}
      {annulation && (
        <p className="compte__alerte" role="alert">
          {annulation}
        </p>
      )}
      {donnees ? (
        <div className="profil__colonnes">
          <CarteIdentite donnees={donnees} pieces={pieces} />
          <div className="profil__details">
            {parId.identite && <Rubrique {...parId.identite} />}
            {['coordonnees', 'adresse', 'situation'].map((bloc) => (
              <BlocModifiable
                key={`${bloc}-${enEdition === bloc}`}
                bloc={bloc}
                initiales={valeursBloc(bloc, reponses, email)}
                reponses={reponses}
                chercherAdresses={chercherAdresses}
                chercherCommunes={chercherCommunes}
                annuler={() => {
                  setEnEdition(null);
                  setAnnulation(MESSAGE_ANNULEE);
                }}
                {...proprietesBloc(bloc)}
              />
            ))}
            {parId.declarations && <Rubrique {...parId.declarations} />}
            <BlocRib piece={donnees.pieces?.find((p) => p.type === 'rib')} />
            <BlocIdentite pieces={donnees.pieces} {...proprietesBloc('identite')} />
            <Pieces pieces={pieces} />
            <Historique lignes={informations?.historique} />
          </div>
        </div>
      ) : (
        !alerte && <p className="compte__texte">Chargement…</p>
      )}
    </PageApplication>
  );
}
