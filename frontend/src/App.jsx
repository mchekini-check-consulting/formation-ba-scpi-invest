// Page d'accueil SCPI Invest+ : textes de la maquette « 0 · Landing page »,
// visuel de la maquette « Landing_v3 · version photo » ;
// présente la plateforme et donne accès à l'inscription et à la connexion
import './App.css';

// « Comment ça marche » décrit le parcours ; « Pourquoi choisir » ne garde que ce qui
// distingue la plateforme, sans répéter les étapes
const ETAPES = [
  {
    n: '1',
    titre: 'Recherchez',
    texte: 'Filtrez les SCPI selon rendement, stratégie, zone, ticket d’entrée et frais.',
  },
  {
    n: '2',
    titre: 'Comparez',
    texte: 'Jusqu’à 4 SCPI côte à côte, la meilleure valeur mise en avant.',
  },
  {
    n: '3',
    titre: 'Souscrivez',
    texte:
      'Directement auprès de la société de gestion : aucun fonds ne transite par la plateforme.',
  },
  {
    n: '4',
    titre: 'Suivez',
    texte: 'Importez vos relevés : tout votre portefeuille réuni sur un seul tableau de bord.',
  },
];

const AVANTAGES = [
  {
    titre: 'La santé des SCPI, pas seulement leur rendement',
    texte:
      'Endettement, réserves, parts en attente : un code couleur vous montre en un coup d’œil si une SCPI est solide ou à surveiller.',
    icone: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  },
  {
    titre: 'Une commission identique pour toutes',
    texte:
      'Nous percevons la même commission sur chaque SCPI partenaire. Elle est affichée, et elle n’influence donc pas le classement.',
    icone: <path d="M12 3v18M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z" />,
  },
  {
    titre: 'Indicateurs expliqués',
    texte: 'Rendement, TOF, WALT, report à nouveau : chaque indicateur est défini simplement.',
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
    texte: 'Vos PDF sont lus automatiquement, sans saisie, quelle que soit la société de gestion.',
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
    r: 'Toutes les SCPI sont présentées et comparées sur les mêmes indicateurs, avec les mêmes définitions, consultables par tous. Nous percevons la même commission sur chaque SCPI partenaire, et elle est affichée : elle n’influence donc pas le classement, qui dépend uniquement des critères que vous choisissez.',
  },
];

const LIENS_LEGAUX = [
  { href: '/mentions-legales', texte: 'Mentions légales' },
  { href: '/confidentialite', texte: 'Politique de confidentialité' },
  { href: '/cgu', texte: 'CGU' },
  { href: '/contact', texte: 'Contact' },
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

// Pictogramme d'immeubles devant le logo de l'en-tête
function LogoIcone() {
  return (
    <svg className="logo__icone" aria-hidden="true" viewBox="0 0 30 30">
      <rect x="2" y="12" width="9" height="16" rx="1.5" fill="#1e3a8a" />
      <rect x="12" y="4" width="9" height="24" rx="1.5" fill="#3b6fd4" />
      <rect x="22" y="15" width="6" height="13" rx="1.5" fill="#1e3a8a" />
    </svg>
  );
}

// Immeubles décoratifs (fenêtres, porte, toits) : skyline du bandeau d'inscription
// et groupe d'immeubles de la section « Pourquoi choisir » ; couleurs dans App.css
const VILLE = {
  largeur: 1440,
  sol: 200,
  immeubles: [
    { x: 30, largeur: 84, hauteur: 110 },
    { x: 122, largeur: 64, hauteur: 168, toit: 'antenne' },
    { x: 194, largeur: 116, hauteur: 84 },
    { x: 318, largeur: 56, hauteur: 124, toit: 'pointe' },
    { x: 892, largeur: 72, hauteur: 128, toit: 'etage' },
    { x: 972, largeur: 64, hauteur: 176, toit: 'antenne' },
    { x: 1044, largeur: 124, hauteur: 96 },
    { x: 1176, largeur: 84, hauteur: 146, toit: 'etage' },
    { x: 1268, largeur: 140, hauteur: 88 },
  ],
};

const QUARTIER = {
  largeur: 340,
  sol: 270,
  immeubles: [
    { x: 14, largeur: 92, hauteur: 150, toit: 'pointe' },
    { x: 116, largeur: 108, hauteur: 224, toit: 'antenne' },
    { x: 234, largeur: 92, hauteur: 124, toit: 'etage' },
  ],
};

// Grille de fenêtres de 8 × 10, centrée sur la façade, au-dessus du rez-de-chaussée
function fenetres({ x, largeur, hauteur }, sol) {
  const colonnes = Math.floor((largeur - 28) / 16) + 1;
  const debut = x + (largeur - (colonnes - 1) * 16 - 8) / 2;
  const liste = [];
  for (let y = sol - hauteur + 14; y <= sol - 44; y += 18) {
    for (let c = 0; c < colonnes; c += 1) {
      liste.push([debut + c * 16, y]);
    }
  }
  return liste;
}

function Toit({ x, largeur, hauteur, toit, sol }) {
  const haut = sol - hauteur;
  const milieu = x + largeur / 2;
  if (toit === 'antenne') {
    return <path className="immeubles__antenne" d={`M${milieu} ${haut}v-26`} />;
  }
  if (toit === 'pointe') {
    return <path d={`M${x} ${haut}L${milieu} ${haut - 22}L${x + largeur} ${haut}z`} />;
  }
  if (toit === 'etage') {
    return <rect x={x + largeur / 4} y={haut - 16} width={largeur / 2} height="16" />;
  }
  return null;
}

function Immeubles({ className, plan: { largeur, sol, immeubles }, recadrer = false }) {
  return (
    <svg
      className={`immeubles ${className}`}
      aria-hidden="true"
      viewBox={`0 0 ${largeur} ${sol}`}
      preserveAspectRatio={recadrer ? 'xMidYMax slice' : undefined}
    >
      {immeubles.map((i) => (
        <g key={i.x}>
          <g className="immeubles__facade">
            <rect x={i.x} y={sol - i.hauteur} width={i.largeur} height={i.hauteur} />
            <Toit {...i} sol={sol} />
          </g>
          <g className="immeubles__fenetre">
            {fenetres(i, sol).map(([fx, fy]) => (
              <rect key={`${fx}-${fy}`} x={fx} y={fy} width="8" height="10" rx="1" />
            ))}
            <rect x={i.x + i.largeur / 2 - 7} y={sol - 22} width="14" height="22" rx="1" />
          </g>
        </g>
      ))}
    </svg>
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
            <LogoIcone />
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
                Choisissez vos SCPI <span className="hero__accent">en confiance.</span> Suivez-les
                toutes au même endroit.
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
              <ul className="hero__note">
                <li>Sans engagement</li>
                <li>Aucun fonds ne transite par la plateforme</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="section section--cercles">
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
                <svg className="carte__icone" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4-4M8 11h6" />
                </svg>
                <p className="carte__avant">Avant</p>
                <h3>Trop de choix, peu de repères</h3>
                <p>Comparer rendement, frais et stratégie demande des heures de lecture.</p>
              </div>
              <div className="carte">
                <svg className="carte__icone" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3l9 16H3z" />
                  <path d="M12 10v4M12 17v.5" />
                </svg>
                <p className="carte__avant">Avant</p>
                <h3>Des indicateurs obscurs</h3>
                <p>TOF, WALT, report à nouveau : des termes techniques rarement expliqués.</p>
              </div>
              <div className="carte">
                <svg className="carte__icone" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="7" height="7" rx="1" />
                  <rect x="14" y="13" width="7" height="7" rx="1" />
                  <path d="M10 7.5h4v5.5" />
                </svg>
                <p className="carte__avant">Avant</p>
                <h3>Un portefeuille éclaté</h3>
                <p>Un espace client par société de gestion, aucune vue d’ensemble.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="section section--sombre">
          <div className="container stack">
            <div className="entete-centre">
              <p className="eyebrow eyebrow--light">Comment ça marche</p>
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

        <section id="avantages" className="section">
          <Immeubles className="decor-quartier" plan={QUARTIER} />
          <div className="container stack">
            <h2 className="titre-section intro">Pourquoi choisir SCPI INVEST+</h2>
            <div className="grille grille--avantages">
              {AVANTAGES.map((a) => (
                <div key={a.titre} className="avantage">
                  <span className="avantage__icone">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {a.icone}
                    </svg>
                  </span>
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

        <section id="faq" className="section section--blanc">
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

        <section id="inscription" className="section section--bleu">
          <Immeubles className="decor-ville" plan={VILLE} recadrer />
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
            {/* Pages légales pas encore rédigées : elles affichent « bientôt disponible » (Routeur) */}
            <nav aria-label="Liens légaux">
              <ul className="footer__nav">
                {LIENS_LEGAUX.map((l) => (
                  <li key={l.href}>
                    <a href={l.href}>{l.texte}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <p className="footer__mention">
            Les SCPI sont des placements immobiliers à long terme, présentant un risque de perte en
            capital, sans garantie de rendement ni de liquidité. Les performances passées ne
            préjugent pas des performances futures.
          </p>
          <p className="footer__mention">
            SCPI INVEST+ exerce son activité avec son partenaire agréé, Marc Delorme, conseiller en
            investissements financiers (CIF), immatriculé à l’ORIAS sous le numéro 08066027
            (www.orias.fr) et adhérent de l’AFCP, association agréée par l’Autorité des marchés
            financiers (AMF).
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
