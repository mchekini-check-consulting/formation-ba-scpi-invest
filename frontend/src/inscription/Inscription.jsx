// Écran de création de compte (US-02a, règles du mot de passe US-02b)
import { useState } from 'react';
import { creerCompte } from '../auth.js';
import PageCompte from '../PageCompte.jsx';
import { REGLES, REGLES_A_COCHER, emailValide, reglesNonRespectees } from './mot-de-passe.js';

const MESSAGE_CGU =
  'Vous devez accepter les CGU et la politique de confidentialité pour créer votre compte';

function naviguer(url) {
  window.location.assign(url);
}

export default function Inscription({
  emailInitial = '',
  origine,
  creer = creerCompte,
  allerA = naviguer,
}) {
  const [email, setEmail] = useState(emailInitial);
  const [emailQuitte, setEmailQuitte] = useState(emailInitial !== '');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [cguAcceptees, setCguAcceptees] = useState(false);
  const [afficher, setAfficher] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurServeur, setErreurServeur] = useState('');

  const emailOk = emailValide(email);
  const nonRespectees = reglesNonRespectees(motDePasse, email);
  const interdits = nonRespectees.filter((cle) => !REGLES_A_COCHER.includes(cle));
  const confirmationOk = confirmation !== '' && confirmation === motDePasse;
  const champsOk = emailOk && nonRespectees.length === 0 && confirmationOk;
  const peutEnvoyer = champsOk && cguAcceptees && !envoiEnCours;

  async function envoyer(event) {
    event.preventDefault();
    if (!peutEnvoyer) return;
    setEnvoiEnCours(true);
    setErreurServeur('');
    try {
      await creer({ email: email.trim(), motDePasse, confirmation, cguAcceptees });
      allerA('/connaissance-client');
    } catch (err) {
      setErreurServeur(err.message);
      setEnvoiEnCours(false);
    }
  }

  return (
    <PageCompte titre="Créer mon compte" origine={origine}>
      <form className="compte__form" aria-label="Création de compte" onSubmit={envoyer} noValidate>
        <div className="champ">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErreurServeur('');
            }}
            onBlur={() => setEmailQuitte(true)}
            aria-invalid={emailQuitte && !emailOk}
            aria-describedby="email-erreur"
          />
          <p id="email-erreur" className="champ__erreur" role="alert">
            {emailQuitte && email !== '' && !emailOk ? 'Format d’email invalide' : ''}
          </p>
        </div>

        <div className="champ">
          <label htmlFor="mot-de-passe">Mot de passe</label>
          <div className="champ__mdp">
            <input
              id="mot-de-passe"
              type={afficher ? 'text' : 'password'}
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              aria-describedby="regles"
            />
            <button
              type="button"
              className="champ__oeil"
              onClick={() => setAfficher(!afficher)}
              aria-label={afficher ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={afficher}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
                {afficher && <path d="M3 3l18 18" />}
              </svg>
            </button>
          </div>
          <ul id="regles" className="regles" aria-label="Règles du mot de passe">
            {REGLES_A_COCHER.map((cle) => {
              const saisi = motDePasse !== '';
              const ok = saisi && !nonRespectees.includes(cle);
              const etat = ok ? 'regle--ok' : saisi ? 'regle--ko' : '';
              return (
                <li key={cle} className={`regle ${etat}`.trim()}>
                  <span aria-hidden="true">{ok ? '✓' : saisi ? '✗' : '•'}</span> {REGLES[cle]}
                  <span className="sr-only">{ok ? ' : respectée' : ' : non respectée'}</span>
                </li>
              );
            })}
          </ul>
          {motDePasse !== '' &&
            interdits.map((cle) => (
              <p key={cle} className="champ__erreur" role="alert">
                {REGLES[cle]}
              </p>
            ))}
        </div>

        <div className="champ">
          <label htmlFor="confirmation">Confirmation du mot de passe</label>
          <input
            id="confirmation"
            type={afficher ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            aria-describedby="confirmation-erreur"
          />
          <p id="confirmation-erreur" className="champ__erreur" role="alert">
            {confirmation !== '' && !confirmationOk ? 'Les mots de passe ne correspondent pas' : ''}
          </p>
        </div>

        <div className="champ">
          <label className="case">
            <input
              type="checkbox"
              checked={cguAcceptees}
              onChange={(e) => setCguAcceptees(e.target.checked)}
              aria-describedby="cgu-erreur"
            />
            <span>
              J’accepte les{' '}
              <a href="/cgu" target="_blank" rel="noopener">
                CGU
              </a>{' '}
              et je reconnais avoir pris connaissance de la{' '}
              <a href="/confidentialite" target="_blank" rel="noopener">
                politique de confidentialité
              </a>
            </span>
          </label>
          <p id="cgu-erreur" className="champ__erreur" role="alert">
            {champsOk && !cguAcceptees ? MESSAGE_CGU : ''}
          </p>
        </div>

        {erreurServeur && (
          <p className="compte__alerte" role="alert">
            {erreurServeur}
          </p>
        )}

        <button type="submit" className="compte__bouton" disabled={!peutEnvoyer}>
          {envoiEnCours ? 'Création en cours…' : 'Créer mon compte'}
        </button>
      </form>
      <p className="compte__lien">
        Déjà inscrit ? <a href="/connexion">Se connecter</a>
      </p>
    </PageCompte>
  );
}
