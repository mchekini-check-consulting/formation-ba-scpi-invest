// Page d'accueil SCPI Invest+ (maquette « 0 · Landing page ») :
// présente la plateforme et donne accès à l'inscription et à la connexion
import './App.css';

const ETAPES = [
  {
    n: '1',
    titre: 'Recherchez',
    texte: 'Filtrez les SCPI selon vos objectifs : rendement, stratégie, zone, budget.',
  },
  {
    n: '2',
    titre: 'Comparez',
    texte: 'Mettez jusqu’à 4 SCPI côte à côte pour voir ce qui les distingue.',
  },
  {
    n: '3',
    titre: 'Souscrivez',
    texte: 'Réglez votre souscription directement auprès de la société de gestion de la SCPI.',
  },
  {
    n: '4',
    titre: 'Suivez',
    texte: 'Importez vos relevés : tout votre portefeuille réuni sur un seul tableau de bord.',
  },
];

const AVANTAGES = [
  {
    titre: 'Recherche par critères',
    texte: 'Rendement, stratégie, zone, ticket d’entrée, frais : filtrez en quelques clics.',
    icone: <path d="M3 6h18M6 12h12M10 18h4" />,
  },
  {
    titre: 'Comparateur côte à côte',
    texte: 'Jusqu’à 4 SCPI comparées sur les mêmes indicateurs, la meilleure valeur mise en avant.',
    icone: <path d="M12 20V10M18 20V4M6 20v-4" />,
  },
  {
    titre: 'Indicateurs expliqués',
    texte: 'Rendement, TOF, WALT, report à nouveau : chaque indicateur est défini simplement.',
    // Page des définitions à alimenter plus tard
    lien: { href: '/indicateurs', texte: 'Voir les définitions des indicateurs' },
    icone: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </>
    ),
  },
  {
    titre: 'Import automatique des relevés',
    texte: 'Déposez vos PDF : parts et revenus sont reconnus, sans saisie manuelle.',
    icone: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M17 8l-5-5-5 5" />
        <path d="M12 3v12" />
      </>
    ),
  },
  {
    titre: 'Votre argent reste chez vous',
    texte: 'Aucun fonds ne transite par la plateforme : vous réglez directement la SCPI.',
    icone: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  },
  {
    titre: 'Vue consolidée',
    texte: 'Valeur, revenus et répartition de toutes vos SCPI, sur un seul tableau de bord.',
    icone: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>
    ),
  },
];

const FAQ = [
  {
    q: 'Pourquoi investir en SCPI ?',
    r: 'Une SCPI permet d’investir dans l’immobilier (bureaux, commerces, santé, logistique…) sans gérer de biens soi-même. Vous achetez des parts, la société de gestion s’occupe des locataires et de l’entretien, et vous percevez une partie des loyers.',
  },
  {
    q: 'Quels sont les avantages et les risques ?',
    r: 'Côté avantages : des revenus potentiellement réguliers, une diversification sur de nombreux immeubles et locataires, et aucune gestion locative. Côté risques : une perte en capital est possible, les revenus et la valeur des parts ne sont pas garantis, et la revente des parts peut prendre du temps. C’est un placement à envisager sur le long terme.',
  },
  {
    q: 'Puis-je suivre des SCPI achetées ailleurs ?',
    r: 'Oui. Importez vos relevés en PDF : nous reconnaissons la SCPI, vos parts et vos revenus, quelle que soit la société de gestion.',
  },
  {
    q: 'Comment s’assurer que la plateforme est neutre ?',
    r: 'Toutes les SCPI sont présentées et comparées sur les mêmes indicateurs, avec les mêmes définitions, consultables par tous. Les résultats dépendent uniquement des critères que vous choisissez.',
  },
];

function naviguer(url) {
  window.location.assign(url);
}

// Ouvre l'écran de création de compte (US-02a), email déjà saisi
function adresseInscription(email) {
  const saisi = email.trim();
  return saisi ? `/inscription?email=${encodeURIComponent(saisi)}` : '/inscription';
}

function Logo({ className = '' }) {
  return (
    <span className={`logo ${className}`}>
      SCPI INVEST<span className="logo__plus">+</span>
    </span>
  );
}

function App({ allerA = naviguer }) {
  function inscrire(event) {
    event.preventDefault();
    allerA(adresseInscription(event.currentTarget.elements.email.value));
  }

  return (
    <div className="landing">
      <header className="header">
        <div className="container header__inner">
          <a href="/" className="logo-lien" aria-label="SCPI Invest+ — accueil">
            <Logo />
          </a>
          <nav aria-label="Navigation" className="header__nav">
            <a href="#fonctionnement">Comment ça marche</a>
            <a href="#avantages">Avantages</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="actions">
            <a href="/connexion" className="btn btn--outline">
              Se connecter
            </a>
            <a href="/inscription" className="btn btn--primary">
              Créer mon compte
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__text">
              <p className="eyebrow eyebrow--light">La plateforme des investisseurs en SCPI</p>
              <h1 className="hero__title">
                Choisissez vos SCPI en confiance. Suivez-les toutes au même endroit.
              </h1>
              <p className="hero__lead">
                Comparez les SCPI selon vos critères, comprenez leurs indicateurs et regroupez tout
                votre portefeuille grâce à l’import automatique de vos relevés.
              </p>
              <div className="actions">
                <a href="/inscription" className="btn btn--primary btn--lg">
                  Créer mon compte
                </a>
                <a href="/connexion" className="btn btn--outline btn--lg">
                  J’ai déjà un compte
                </a>
              </div>
              <p className="hero__note">
                Sans engagement · Aucun fonds ne transite par la plateforme
              </p>
            </div>
          </div>
        </section>

        <section className="section section--gris">
          <div className="container stack">
            <div className="intro">
              <h2 className="titre-section">Investir en SCPI ne devrait pas être un casse-tête.</h2>
              <p className="intro__texte">
                Des centaines de SCPI, des indicateurs difficiles à comparer, des relevés éparpillés
                chez plusieurs sociétés de gestion… SCPI INVEST+ remet de la clarté à chaque étape.
              </p>
            </div>
            <div className="grille">
              <div className="carte">
                <p className="carte__avant">Avant</p>
                <h3>Trop de choix, peu de repères</h3>
                <p>Comparer rendement, frais et stratégie demande des heures de lecture.</p>
              </div>
              <div className="carte">
                <p className="carte__avant">Avant</p>
                <h3>Des indicateurs obscurs</h3>
                <p>TOF, WALT, report à nouveau : des termes techniques rarement expliqués.</p>
              </div>
              <div className="carte">
                <p className="carte__avant">Avant</p>
                <h3>Un portefeuille éclaté</h3>
                <p>Un espace client par société de gestion, aucune vue d’ensemble.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="section">
          <div className="container stack">
            <div className="entete-centre">
              <p className="eyebrow">Comment ça marche</p>
              <h2 className="titre-section">De la recherche au suivi, en 4 étapes</h2>
            </div>
            <ol className="etapes">
              {ETAPES.map((e) => (
                <li key={e.n} className="etape">
                  <span className="etape__numero">{e.n}</span>
                  <h3>{e.titre}</h3>
                  <p>{e.texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="avantages" className="section section--sombre">
          <div className="container stack">
            <h2 className="titre-section intro">Pourquoi choisir SCPI INVEST+</h2>
            <div className="grille">
              {AVANTAGES.map((a) => (
                <div key={a.titre} className="avantage">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {a.icone}
                  </svg>
                  <h3>{a.titre}</h3>
                  <p>{a.texte}</p>
                  {a.lien && (
                    <a href={a.lien.href} className="avantage__lien">
                      {a.lien.texte} →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="section">
          <div className="container container--etroit faq">
            <h2 className="titre-section faq__titre">Questions fréquentes</h2>
            {FAQ.map((f) => (
              <details key={f.q} className="faq__item">
                <summary>{f.q}</summary>
                <p>{f.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="inscription" className="section section--teal">
          <div className="container container--etroit inscription">
            <h2 className="inscription__titre">Prêt à investir plus sereinement ?</h2>
            <p className="inscription__texte">
              Créez votre compte en 2 minutes et importez votre premier relevé.
            </p>
            <form className="inscription__form" aria-label="Inscription" onSubmit={inscrire}>
              <label htmlFor="email" className="sr-only">
                Adresse e-mail
              </label>
              <input id="email" type="email" placeholder="Votre adresse e-mail" />
              <button type="submit">Créer mon compte</button>
            </form>
            <p className="inscription__connexion">
              Déjà inscrit ? <a href="/connexion">Se connecter</a>
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__haut">
            <Logo className="logo--footer" />
            {/* Pages légales pas encore rédigées : simples intitulés en attendant */}
            <ul className="footer__nav">
              <li>Mentions légales</li>
              <li>Politique de confidentialité</li>
              <li>CGU</li>
              <li>Contact</li>
            </ul>
          </div>
          <p className="footer__mention">
            Les SCPI sont des placements immobiliers à long terme, présentant un risque de perte en
            capital, sans garantie de rendement ni de liquidité. Les performances passées ne
            préjugent pas des performances futures. [STATUT RÉGLEMENTAIRE ET N° ORIAS]
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
