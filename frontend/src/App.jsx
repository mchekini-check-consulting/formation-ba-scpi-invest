// Page d'accueil SCPI Invest+ : textes de la maquette « 0 · Landing page »,
// visuel du modèle retenu « bleu éditorial » (mockups/accueil.html) ;
// présente la plateforme ; un bouton d'inscription dans le héros, la connexion dans l'en-tête
import './App.css';
import { EnTete, LienCompte, Logo } from './MiseEnPage.jsx';

// « Comment ça marche » décrit le parcours ; « Pourquoi choisir » ne garde que ce qui
// distingue la plateforme, sans répéter les étapes
const ETAPES = [
  {
    n: '01',
    titre: 'Recherchez',
    texte: 'Filtrez les SCPI selon rendement, stratégie, zone, ticket d’entrée et frais.',
  },
  {
    n: '02',
    titre: 'Comparez',
    texte: 'Jusqu’à 4 SCPI côte à côte, la meilleure valeur mise en avant.',
  },
  {
    n: '03',
    titre: 'Souscrivez',
    texte:
      'Directement auprès de la société de gestion : aucun fonds ne transite par la plateforme.',
  },
  {
    n: '04',
    titre: 'Suivez',
    texte: 'Importez vos relevés : tout votre portefeuille réuni sur un seul tableau de bord.',
  },
];

// Icônes reprises dans le panneau santé du héros et dans les avantages
const ICONE_IMPORT = (
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </>
);
const ICONE_BOUCLIER = <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;

// Grille éditoriale : un grand bloc bleu ciel, un bloc sombre, puis trois cartes
const AVANTAGES = [
  {
    style: 'grand',
    titre: 'La santé des SCPI, pas seulement leur rendement',
    texte:
      'Endettement, réserves, parts en attente : un code couleur vous montre en un coup d’œil si une SCPI est solide ou à surveiller.',
    icone: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    jauges: [
      { texte: 'Solide', couleur: 'var(--vert)' },
      { texte: 'À surveiller', couleur: 'var(--orange)' },
    ],
  },
  {
    style: 'sombre',
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
    icone: ICONE_IMPORT,
  },
  {
    titre: 'Votre argent reste chez vous',
    texte: 'Aucun fonds ne transite par la plateforme : vous réglez directement la SCPI.',
    icone: ICONE_BOUCLIER,
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

const MENU = [
  { href: '#fonctionnement', texte: 'Comment ça marche' },
  { href: '#avantages', texte: 'Avantages' },
  { href: '#faq', texte: 'FAQ' },
];

const AVANT = [
  {
    titre: 'Trop de choix, peu de repères',
    texte: 'Comparer rendement, frais et stratégie demande des heures de lecture.',
    icone: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4M8 11h6" />
      </>
    ),
  },
  {
    titre: 'Des indicateurs obscurs',
    texte: 'TOF, WALT, report à nouveau : des termes techniques rarement expliqués.',
    icone: (
      <>
        <path d="M12 3l9 16H3z" />
        <path d="M12 10v4M12 17v.5" />
      </>
    ),
  },
  {
    titre: 'Un portefeuille éclaté',
    texte: 'Un espace client par société de gestion, aucune vue d’ensemble.',
    icone: (
      <>
        <rect x="3" y="4" width="7" height="7" rx="1" />
        <rect x="14" y="13" width="7" height="7" rx="1" />
        <path d="M10 7.5h4v5.5" />
      </>
    ),
  },
];

const CHIFFRES = [
  { valeur: '4', texte: 'SCPI comparées côte à côte' },
  { valeur: '37', texte: 'indicateurs définis simplement' },
  { valeur: '1', texte: 'commission identique pour toutes les SCPI partenaires' },
  { valeur: '0 €', texte: 'ne transite par la plateforme' },
];

const SANTE = [
  { critere: 'Endettement', etat: 'ok', texte: 'Solide' },
  { critere: 'Réserves', etat: 'ok', texte: 'Solide' },
  { critere: 'Parts en attente', etat: 'alerte', texte: 'À surveiller' },
];

function Coche() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function Icone({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

// Panneau sombre « santé des SCPI », posé sur la photo de fond du héros
function Sante() {
  return (
    <div className="heros__sante">
      <span className="etiquette">Santé des SCPI</span>
      <p className="heros__sante-titre">Solide ou à surveiller, en un coup d’œil.</p>
      <ul className="sante">
        {SANTE.map((l) => (
          <li key={l.critere} className="sante__ligne">
            {l.critere} <span className={`feu feu--${l.etat}`}>{l.texte}</span>
          </li>
        ))}
      </ul>
      <div className="heros__sante-bas">
        <p className="mini">
          <span className="mini__icone">
            <Icone>{ICONE_IMPORT}</Icone>
          </span>
          Vos PDF sont lus automatiquement, sans saisie.
        </p>
        <p className="mini">
          <span className="mini__icone">
            <Icone>{ICONE_BOUCLIER}</Icone>
          </span>
          Vous réglez directement la SCPI.
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="cadre accueil">
      <EnTete menu={MENU} />

      <main>
        {/* Héros : photo de l'immeuble en fond, texte à gauche, santé des SCPI à droite */}
        <section className="panneau heros">
          <div className="heros__fond" aria-hidden="true">
            <div className="heros__bloc" />
          </div>
          <div className="heros__grille">
            <div>
              <p className="surtitre">La plateforme des investisseurs en SCPI</p>
              <h1 className="titre">
                Choisissez vos SCPI <em>en confiance.</em> Suivez-les toutes au même endroit.
              </h1>
              <p className="heros__chapeau">
                Comparez les SCPI selon vos critères, comprenez leurs indicateurs et regroupez tout
                votre portefeuille grâce à l’import automatique de vos relevés.
              </p>
              <div className="heros__cta">
                <LienCompte
                  vers="inscription"
                  origine="heros-inscription"
                  className="btn btn--bleu btn--lg"
                  fleche
                >
                  Créer mon compte
                </LienCompte>
              </div>
              <ul className="heros__notes">
                <li>
                  <Coche />
                  Sans engagement
                </li>
                <li>
                  <Coche />
                  Aucun fonds ne transite par la plateforme
                </li>
              </ul>
            </div>
            <Sante />
          </div>
        </section>

        <ul className="chiffres">
          {CHIFFRES.map((c) => (
            <li key={c.valeur} className="chiffre">
              <strong>{c.valeur}</strong>
              <span>{c.texte}</span>
            </li>
          ))}
        </ul>

        <section className="section section--probleme">
          <div className="intro">
            <h2 className="titre-section">
              Investir en SCPI ne devrait pas être <em>un casse-tête.</em>
            </h2>
            <p>
              Des centaines de SCPI, des indicateurs difficiles à comparer, des relevés éparpillés
              chez plusieurs sociétés de gestion… SCPI INVEST+ remet de la clarté à chaque étape.
            </p>
          </div>
          <div className="avant">
            {AVANT.map((a) => (
              <div key={a.titre} className="carte">
                <div className="carte__haut">
                  <span className="carte__icone">
                    <Icone>{a.icone}</Icone>
                  </span>
                  <span className="carte__avant">Avant</span>
                </div>
                <h3>{a.titre}</h3>
                <p>{a.texte}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fonctionnement" className="etapes-bloc">
          <p className="surtitre">Comment ça marche</p>
          <h2 className="titre-section">
            De la recherche au suivi, <em>en 4 étapes</em>
          </h2>
          <ol className="etapes">
            {ETAPES.map((e, i) => (
              <li key={e.n} className="etape">
                <span className="etape__n" aria-hidden="true">
                  {e.n}
                </span>
                <div className="etape__trait">
                  <i style={{ width: `${((i + 1) / ETAPES.length) * 100}%` }} />
                </div>
                <h3>{e.titre}</h3>
                <p>{e.texte}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="avantages" className="section panneau section--avantages">
          <p className="surtitre">Avantages</p>
          <h2 className="titre-section">
            Pourquoi choisir <em>SCPI INVEST+</em>
          </h2>
          <div className="avantages">
            {AVANTAGES.map((a) => (
              <div key={a.titre} className={a.style ? `avantage avantage--${a.style}` : 'avantage'}>
                <span className="avantage__icone">
                  <Icone>{a.icone}</Icone>
                </span>
                <h3>{a.titre}</h3>
                <p>{a.texte}</p>
                {a.jauges && (
                  <ul className="jauges">
                    {a.jauges.map((j) => (
                      <li key={j.texte} style={{ '--c': j.couleur }}>
                        {j.texte}
                      </li>
                    ))}
                  </ul>
                )}
                {a.lien && (
                  <a href={a.lien.href} className="avantage__lien">
                    {a.lien.texte} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="section section--faq">
          <div className="faq">
            <div className="faq__titre">
              <p className="surtitre">FAQ</p>
              <h2 className="titre-section">
                Questions <em>fréquentes</em>
              </h2>
            </div>
            <div>
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="pied">
        <div className="pied__haut">
          <span className="logo">
            <Logo clair />
          </span>
          <nav aria-label="Liens légaux">
            <ul className="pied__liens">
              {LIENS_LEGAUX.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.texte}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="pied__mention">
          Les SCPI sont des placements immobiliers à long terme, présentant un risque de perte en
          capital, sans garantie de rendement ni de liquidité. Les performances passées ne préjugent
          pas des performances futures.
        </p>
        <p className="pied__mention">
          SCPI INVEST+ exerce son activité avec son partenaire agréé, Marc Delorme, conseiller en
          investissements financiers (CIF), immatriculé à l’ORIAS sous le numéro 08066027
          (www.orias.fr) et adhérent de l’AFCP, association agréée par l’Autorité des marchés
          financiers (AMF).
        </p>
      </footer>
    </div>
  );
}

export default App;
