// Landing page SCPI Invest+ : présentation, fonctionnalités, simulateur, critères, étapes, FAQ
import Simulateur from './Simulateur';

const NAVIGATION = [
  { lien: '#fonctionnalites', libelle: 'Fonctionnalités' },
  { lien: '#simulateur', libelle: 'Simulateur' },
  { lien: '#etapes', libelle: 'Comment ça marche' },
  { lien: '#faq', libelle: 'FAQ' },
];

const APERCU = [
  { nom: '[SCPI de bureaux]', couleur: 'bg-menthe' },
  { nom: '[SCPI de santé]', couleur: 'bg-amber-300' },
  { nom: '[SCPI européenne]', couleur: 'bg-blue-300' },
];

const FONCTIONNALITES = [
  {
    titre: 'Rechercher',
    texte: "Filtrez les SCPI par typologie d'actifs, zone géographique, label ISR ou ticket d'entrée.",
    icone: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
  },
  {
    titre: 'Comparer',
    texte:
      'Mettez plusieurs SCPI côte à côte sur les mêmes indicateurs : rendement, frais, occupation, capitalisation.',
    icone: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    titre: 'Simuler',
    texte:
      "Estimez vos revenus potentiels selon votre montant, la durée et les frais — avant d'investir le moindre euro.",
    icone: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
      </>
    ),
  },
  {
    titre: 'Suivre',
    texte:
      "Centralisez vos parts, vos distributions et l'évolution de votre portefeuille dans un tableau de bord unique.",
    icone: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
  },
];

const CRITERES = [
  'Taux de distribution',
  "Taux d'occupation financier",
  'Frais de souscription et de gestion',
  'Délai de jouissance',
  'Capitalisation',
  "Typologie d'actifs",
  'Zone géographique',
  'Label ISR',
  "Prix de part et ticket d'entrée",
  'Société de gestion',
];

const ETAPES = [
  {
    titre: 'Définissez votre profil',
    texte:
      'Objectif, horizon, budget, sensibilité ISR : vos préférences filtrent automatiquement les SCPI pertinentes.',
  },
  {
    titre: 'Comparez et simulez',
    texte:
      'Sélectionnez vos SCPI, comparez-les sur des critères homogènes et simulez vos revenus potentiels.',
  },
  {
    titre: 'Suivez votre portefeuille',
    texte:
      'Retrouvez vos parts, vos distributions trimestrielles et vos documents dans un seul tableau de bord.',
  },
];

const FAQ = [
  {
    question: "Qu'est-ce qu'une SCPI ?",
    reponse:
      "Une Société Civile de Placement Immobilier collecte l'épargne de nombreux investisseurs pour acheter et gérer un parc immobilier (bureaux, commerces, santé, logistique…). Les loyers perçus sont redistribués aux associés au prorata de leurs parts.",
  },
  {
    question: 'Quels sont les risques ?',
    reponse:
      "Le capital n'est pas garanti, les revenus peuvent varier à la hausse comme à la baisse et la revente des parts peut prendre du temps. Il s'agit d'un placement de long terme, généralement recommandé sur 8 à 10 ans minimum.",
  },
  {
    question: "D'où viennent les données affichées ?",
    reponse:
      "[Sources de données à préciser par l'équipe : bulletins trimestriels, DIC, rapports annuels des sociétés de gestion…]",
  },
  { question: 'SCPI Invest+ est-il payant ?', reponse: '[Modèle tarifaire à préciser]' },
];

const BOUTON = 'inline-flex items-center rounded-xl font-semibold no-underline';
const SURTITRE = 'font-semibold text-sm uppercase tracking-widest';
const TITRE_H2 = 'm-0 font-titre text-3xl md:text-[44px] leading-tight tracking-tight';
const CONTENU = 'mx-auto px-4 md:px-6 py-16 md:py-24 max-w-[1200px]';

function Marque({ className = '' }) {
  return (
    <span className={`font-titre font-bold tracking-tight ${className}`}>
      SCPI Invest<span className="text-vert">+</span>
    </span>
  );
}

function App() {
  return (
    <div className="bg-fond min-h-svh font-sans text-encre leading-relaxed">
      <header className="border-bord border-b">
        <nav
          aria-label="Navigation principale"
          className="flex flex-wrap justify-between items-center gap-4 mx-auto px-4 md:px-6 py-4.5 max-w-[1200px]"
        >
          <a href="#top" className="flex items-center gap-2.5 text-encre no-underline">
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" className="fill-encre" />
              <path
                d="M9 21V13M14 21V10M19 21V15M23 11v6M20 14h6"
                className="stroke-menthe"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            <Marque className="text-xl" />
          </a>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 font-medium text-[15px]">
            {NAVIGATION.map(({ lien, libelle }) => (
              <a key={lien} href={lien} className="text-slate-700 hover:text-vert no-underline">
                {libelle}
              </a>
            ))}
            <a href="#inscription" className={`${BOUTON} bg-encre px-5 min-h-11 text-white`}>
              Créer mon compte
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section id="top" className={`${CONTENU} flex flex-wrap items-center gap-16`}>
          <div className="flex flex-col gap-7 min-w-0 basis-[480px] grow">
            <span className="self-start bg-vert-pale px-3.5 py-1.5 rounded-full font-semibold text-vert-fonce text-sm">
              L&apos;investissement en SCPI, enfin simplifié
            </span>
            <h1 className="m-0 font-titre text-[40px] md:text-[64px] leading-[1.05] tracking-tighter">
              Toutes vos SCPI.
              <br />
              Un seul point d&apos;entrée.
            </h1>
            <p className="m-0 max-w-[540px] text-texte text-lg md:text-[19px]">
              Recherchez, comparez, simulez et suivez vos investissements en SCPI depuis une seule
              application — avec des critères clairs pour décider en connaissance de cause.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <a href="#inscription" className={`${BOUTON} bg-vert hover:bg-vert-fonce px-6.5 min-h-13 text-white`}>
                Commencer gratuitement
              </a>
              <a
                href="#simulateur"
                className={`${BOUTON} border-[1.5px] border-encre px-6.5 min-h-13 text-encre`}
              >
                Essayer le simulateur
              </a>
            </div>
            <p className="m-0 text-discret text-sm">Sans engagement · [Mention tarifaire à préciser]</p>
          </div>

          <div
            role="img"
            aria-label="Aperçu de l'application : un portefeuille de trois SCPI dont la valeur progresse"
            className="flex flex-col gap-4 bg-encre shadow-2xl p-5 md:p-7 rounded-3xl min-w-0 basis-[440px] grow"
          >
            <div className="flex justify-between text-slate-300 text-sm">
              <span className="font-semibold text-white">Mon portefeuille</span>
              <span>Mis à jour [date]</span>
            </div>
            <div className="flex flex-col gap-1.5 bg-encre-clair p-5 rounded-2xl">
              <span className="text-[13px] text-slate-400">Valeur estimée</span>
              <span className="font-titre font-semibold text-[34px] text-white">[Montant] €</span>
              <svg viewBox="0 0 320 70" width="100%" height="70" aria-hidden="true">
                <path
                  d="M0 60 L40 54 L80 56 L120 44 L160 46 L200 34 L240 30 L280 22 L320 14"
                  className="stroke-menthe"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-2.5">
              {APERCU.map(({ nom, couleur }) => (
                <div
                  key={nom}
                  className="flex justify-between items-center gap-3 bg-encre-clair px-4 py-3.5 rounded-xl text-[15px] text-white"
                >
                  <span className="flex items-center gap-3">
                    <span className={`rounded-[3px] size-2.5 ${couleur}`} />
                    {nom}
                  </span>
                  <span className="text-slate-300">[x] parts</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="bg-white border-bord border-y">
          <div className={`${CONTENU} flex flex-col gap-12`}>
            <div className="flex flex-col gap-3.5 max-w-[680px]">
              <span className={`${SURTITRE} text-vert`}>Fonctionnalités</span>
              <h2 className={TITRE_H2}>Quatre outils, un seul parcours</h2>
              <p className="m-0 text-texte text-lg">
                Fini les onglets ouverts sur dix sites de sociétés de gestion. SCPI Invest+ réunit
                tout ce qu&apos;il faut pour choisir et piloter vos SCPI.
              </p>
            </div>
            <div className="flex flex-wrap gap-5">
              {FONCTIONNALITES.map(({ titre, texte, icone }) => (
                <article
                  key={titre}
                  className="flex flex-col gap-3.5 bg-fond p-7 border border-bord rounded-2xl min-w-0 basis-60 grow"
                >
                  <span className="flex justify-center items-center bg-vert-pale rounded-xl size-12">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="fill-none stroke-2 stroke-vert size-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {icone}
                    </svg>
                  </span>
                  <h3 className="m-0 font-titre text-[21px]">{titre}</h3>
                  <p className="m-0 text-texte">{texte}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="simulateur" className={`${CONTENU} flex flex-wrap items-start gap-14`}>
          <div className="flex flex-col gap-4 min-w-0 basis-[360px] grow">
            <span className={`${SURTITRE} text-vert`}>Simulateur</span>
            <h2 className={TITRE_H2}>Combien pourrait vous rapporter votre SCPI ?</h2>
            <p className="m-0 text-texte text-lg">
              Ajustez vos hypothèses et voyez immédiatement l&apos;effet des frais de souscription et
              de la durée de détention.
            </p>
            <p className="m-0 text-discret text-sm">
              Simulation indicative, avant fiscalité. Le taux de distribution est une hypothèse que
              vous choisissez : les revenus d&apos;une SCPI ne sont pas garantis.
            </p>
          </div>
          <Simulateur />
        </section>

        <section className="bg-encre text-white">
          <div className={`${CONTENU} flex flex-wrap items-center gap-14`}>
            <div className="flex flex-col gap-4 min-w-0 basis-[360px] grow">
              <span className={`${SURTITRE} text-menthe`}>Comparateur</span>
              <h2 className={TITRE_H2}>Les bons critères, au même endroit</h2>
              <p className="m-0 text-slate-300 text-lg">
                Le rendement ne fait pas tout. SCPI Invest+ affiche les indicateurs qui comptent
                vraiment pour juger la solidité d&apos;une SCPI.
              </p>
            </div>
            <ul className="flex flex-wrap gap-3 m-0 p-0 min-w-0 basis-[520px] grow list-none">
              {CRITERES.map((critere) => (
                <li key={critere} className="px-4.5 py-3 border border-slate-600 rounded-full font-medium">
                  {critere}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="etapes" className={`${CONTENU} flex flex-col gap-12`}>
          <div className="flex flex-col gap-3.5 max-w-[680px]">
            <span className={`${SURTITRE} text-vert`}>Comment ça marche</span>
            <h2 className={TITRE_H2}>De la recherche au suivi, en trois étapes</h2>
          </div>
          <ol className="flex flex-wrap gap-5 m-0 p-0 list-none">
            {ETAPES.map(({ titre, texte }, index) => (
              <li
                key={titre}
                className="flex flex-col gap-3 pt-6 border-encre border-t-2 min-w-0 basis-[280px] grow"
              >
                <span className="font-titre font-bold text-[15px] text-vert">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="m-0 font-titre text-[22px]">{titre}</h3>
                <p className="m-0 text-texte">{texte}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="bg-white border-bord border-y">
          <div className="flex flex-col gap-8 mx-auto px-4 md:px-6 py-16 md:py-24 max-w-[860px]">
            <h2 className={TITRE_H2}>Questions fréquentes</h2>
            <div className="flex flex-col gap-3">
              {FAQ.map(({ question, reponse }) => (
                <details key={question} className="bg-fond px-5.5 py-4.5 border border-bord rounded-2xl">
                  <summary className="font-semibold text-[17px] cursor-pointer">{question}</summary>
                  <p className="mt-3 mb-0 text-texte">{reponse}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="inscription" className={CONTENU}>
          <div className="flex flex-wrap justify-between items-center gap-8 bg-vert px-6 md:px-12 py-10 md:py-14 rounded-[28px] text-white">
            <div className="flex flex-col gap-3 min-w-0 basis-[420px] grow">
              <h2 className="m-0 font-titre text-[28px] md:text-[40px] leading-tight tracking-tight">
                Prêt à y voir plus clair dans vos SCPI ?
              </h2>
              <p className="m-0 text-emerald-100 text-lg">
                Créez votre compte et lancez votre première comparaison en quelques minutes.
              </p>
            </div>
            <form className="flex flex-wrap gap-3 min-w-0 basis-[380px] grow" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="cta-email" className="sr-only">
                Adresse e-mail
              </label>
              <input
                id="cta-email"
                type="email"
                placeholder="votre@email.fr"
                className="bg-white px-4.5 border-0 rounded-xl min-w-0 min-h-13 text-encre text-base basis-56 grow"
              />
              <button
                type="submit"
                className="bg-encre px-6 border-0 rounded-xl min-h-13 font-semibold text-base text-white cursor-pointer"
              >
                Créer mon compte
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-bord border-t">
        <div className="flex flex-col gap-6 mx-auto px-4 md:px-6 py-12 max-w-[1200px]">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <Marque className="text-lg" />
            <div className="flex flex-wrap gap-6 text-[15px]">
              <a href="#top" className="text-vert">Mentions légales</a>
              <a href="#top" className="text-vert">Confidentialité</a>
              <a href="#top" className="text-vert">Contact</a>
            </div>
          </div>
          <p className="m-0 max-w-[900px] text-[13px] text-discret">
            Investir en SCPI comporte des risques, notamment de perte en capital et de liquidité. Les
            performances passées ne préjugent pas des performances futures et les revenus ne sont pas
            garantis. Les informations présentées ne constituent pas un conseil en investissement.
          </p>
          <p className="m-0 text-[13px] text-discret">© 2026 SCPI Invest+ — Projet d&apos;équipe</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
