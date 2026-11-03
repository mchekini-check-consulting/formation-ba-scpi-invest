// Écran de connexion (US-03a) : email + mot de passe, icône « œil » pour l'afficher.
// Le blocage après 5 échecs et l'expiration de session relèvent de l'US-03b.
import { useState } from 'react';
import { connecter as connecterParDefaut } from '../auth.js';
import PageCompte from '../PageCompte.jsx';
import { destinationApresConnexion } from './destination.js';

function naviguer(url) {
  window.location.assign(url);
}

export default function Connexion({
  emailInitial = '',
  connecter = connecterParDefaut,
  allerA = naviguer,
}) {
  const [email, setEmail] = useState(emailInitial);
  const [motDePasse, setMotDePasse] = useState('');
  const [afficher, setAfficher] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const peutEnvoyer = email.trim() !== '' && motDePasse !== '' && !envoiEnCours;

  async function envoyer(event) {
    event.preventDefault();
    if (!peutEnvoyer) return;
    setEnvoiEnCours(true);
    setErreur('');
    try {
      const utilisateur = await connecter({ email: email.trim(), motDePasse });
      allerA(destinationApresConnexion(utilisateur));
    } catch (err) {
      setErreur(err.message);
      setEnvoiEnCours(false);
    }
  }

  function modifier(setter) {
    return (e) => {
      setter(e.target.value);
      setErreur('');
    };
  }

  return (
    <PageCompte titre="Se connecter">
      <form className="compte__form" aria-label="Connexion" onSubmit={envoyer} noValidate>
        <div className="champ">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={modifier(setEmail)}
          />
        </div>

        <div className="champ">
          <label htmlFor="mot-de-passe">Mot de passe</label>
          <div className="champ__mdp">
            <input
              id="mot-de-passe"
              type={afficher ? 'text' : 'password'}
              autoComplete="current-password"
              value={motDePasse}
              onChange={modifier(setMotDePasse)}
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
        </div>

        {erreur && (
          <p className="compte__alerte" role="alert">
            {erreur}
          </p>
        )}

        <button type="submit" className="compte__bouton" disabled={!peutEnvoyer}>
          {envoiEnCours ? 'Connexion en cours…' : 'Se connecter'}
        </button>
      </form>
      <p className="compte__lien">
        Pas encore de compte ? <a href="/inscription">Créer mon compte</a>
      </p>
    </PageCompte>
  );
}
