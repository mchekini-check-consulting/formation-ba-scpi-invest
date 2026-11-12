// Page « Conditions générales d'utilisation » (US-01b), adresse /cgu : 12 articles.
// Données fictives (exercice de formation), texte à valider par le juriste du projet.
import PageLegale, { Email, Externe } from './PageLegale.jsx';

const SECTIONS = [
  {
    id: 'article-1',
    titre: 'Article 1. Objet et acceptation',
    contenu: (
      <>
        <p>
          Les présentes conditions générales d’utilisation (CGU) encadrent l’utilisation de la
          plateforme SCPI INVEST+, éditée par <strong>Ardentis Logiciels</strong>, SAS au capital de
          150 000 €, 18 rue de l’Innovation, 92130 Issy-les-Moulineaux, RCS Nanterre 912 345 678.
        </p>
        <p>
          La création d’un compte vaut acceptation des CGU. Si vous ne les acceptez pas, vous pouvez
          consulter les pages publiques, mais pas créer de compte.
        </p>
      </>
    ),
  },
  {
    id: 'article-2',
    titre: 'Article 2. Définitions',
    contenu: (
      <ul>
        <li>
          <strong>Plateforme :</strong> le site et l’application SCPI INVEST+.
        </li>
        <li>
          <strong>Utilisateur :</strong> toute personne qui consulte la plateforme, avec ou sans
          compte.
        </li>
        <li>
          <strong>Investisseur :</strong> utilisateur titulaire d’un compte dont l’identité a été
          vérifiée.
        </li>
        <li>
          <strong>SCPI partenaire :</strong> SCPI dont la société de gestion a signé un accord avec
          Ardentis Logiciels et qui peut être souscrite depuis la plateforme.
        </li>
        <li>
          <strong>Partenaire agréé :</strong> Marc Delorme, conseiller en investissements financiers
          (CIF), qui encadre la conformité de l’activité.
        </li>
        <li>
          <strong>Abonnement premium :</strong> offre payante donnant accès à des fonctionnalités
          supplémentaires.
        </li>
      </ul>
    ),
  },
  {
    id: 'article-3',
    titre: 'Article 3. Services proposés',
    contenu: (
      <>
        <p>
          <strong>Services gratuits</strong>, accessibles avec un compte :
        </p>
        <ul>
          <li>
            le catalogue des SCPI, leurs fiches et leurs indicateurs, avec les{' '}
            <a href="/indicateurs">définitions associées</a> ;
          </li>
          <li>le comparateur de SCPI et le simulateur de revenus ;</li>
          <li>
            la préparation et l’envoi en ligne d’un dossier de souscription auprès d’une SCPI
            partenaire ;
          </li>
          <li>le suivi de votre portefeuille.</li>
        </ul>
        <p>
          <strong>Services premium</strong>, réservés aux abonnés : les fonctionnalités signalées
          par le badge « Premium » sur la plateforme. Leur liste à jour figure sur la page
          Abonnement.
        </p>
        <p>
          Ardentis Logiciels peut faire évoluer les services pour les améliorer. Une fonctionnalité
          premium ne peut pas être retirée en cours de mois déjà payé.
        </p>
      </>
    ),
  },
  {
    id: 'article-4',
    titre: 'Article 4. Compte et vérification d’identité',
    contenu: (
      <>
        <p>
          Le compte est réservé aux personnes physiques majeures, résidentes fiscales en France. Les
          personnes ayant la qualité de « US Person » au sens de la réglementation FATCA ne peuvent
          pas investir sur la plateforme, même si elles résident en France. Un seul compte est
          autorisé par personne.
        </p>
        <p>À la première connexion, l’utilisateur complète :</p>
        <ol>
          <li>
            le <strong>formulaire d’identité (KYC)</strong>, avec une pièce d’identité et un
            justificatif de domicile ;
          </li>
          <li>
            le <strong>questionnaire investisseur</strong> : situation, objectifs, horizon de
            placement, expérience et tolérance au risque.
          </li>
        </ol>
        <p>
          Ces étapes sont obligatoires avant toute souscription : la loi impose de vérifier
          l’identité de l’investisseur et l’adéquation du placement à son profil. L’utilisateur
          s’engage à fournir des informations exactes et à les mettre à jour.
        </p>
        <p>
          Les identifiants sont personnels. L’utilisateur garde son mot de passe secret et nous
          prévient sans délai en cas d’utilisation non autorisée de son compte.
        </p>
      </>
    ),
  },
  {
    id: 'article-5',
    titre: 'Article 5. Information, pas de conseil',
    contenu: (
      <>
        <p>
          SCPI INVEST+ est une plateforme d’information, de comparaison et de simulation. Les
          contenus publiés (fiches, indicateurs, comparaisons, simulations, alertes) ne constituent
          ni un conseil en investissement, ni une recommandation personnalisée.
        </p>
        <p>
          Les simulations reposent sur des hypothèses et ne garantissent aucun résultat.
          L’investisseur prend seul ses décisions, après avoir lu le document d’informations clés
          (DIC) et la note d’information de la SCPI.
        </p>
        <p>
          Notre partenaire agréé valide les parcours et les documents de souscription, et définit
          les contrôles appliqués à chaque dossier. Il ne donne pas de conseil individuel via la
          plateforme.
        </p>
      </>
    ),
  },
  {
    id: 'article-6',
    titre: 'Article 6. Souscription en ligne',
    contenu: (
      <>
        <p>La souscription se déroule en 4 étapes :</p>
        <ol>
          <li>
            l’investisseur choisit une SCPI partenaire, un nombre de parts, et prend connaissance de
            ses documents réglementaires ;
          </li>
          <li>il complète et signe électroniquement le bulletin de souscription ;</li>
          <li>
            la plateforme transmet le dossier à la société de gestion, qui l’examine et le valide ou
            le refuse ;
          </li>
          <li>
            une fois le dossier validé, l’investisseur paie <strong>directement la SCPI</strong>,
            selon les modalités indiquées par la société de gestion.
          </li>
        </ol>
        <p>
          <strong>Aucun fonds ne transite par la plateforme.</strong> La souscription est conclue
          entre l’investisseur et la SCPI : la plateforme n’en est pas partie. Les frais de
          souscription, la date d’entrée en jouissance et les conditions de retrait sont ceux de la
          SCPI, indiqués sur sa fiche et dans sa note d’information.
        </p>
        <p>
          Le statut du dossier (envoyé, validé, refusé) est visible dans l’espace de l’investisseur.
        </p>
      </>
    ),
  },
  {
    id: 'article-7',
    titre: 'Article 7. Abonnement premium',
    contenu: (
      <>
        <p>
          L’abonnement premium coûte <strong>5 € TTC par mois</strong>, payé par carte bancaire via
          notre prestataire de paiement. Il est sans engagement et se renouvelle automatiquement
          chaque mois.
        </p>
        <p>
          L’abonné peut le résilier à tout moment depuis son espace. La résiliation prend effet à la
          fin du mois en cours, déjà payé, sans frais.
        </p>
        <p>
          <strong>Droit de rétractation :</strong> l’abonné dispose de 14 jours après sa première
          souscription pour se rétracter et être remboursé. S’il demande à utiliser les services
          premium dès la souscription, le remboursement est calculé au prorata des jours restants.
        </p>
        <p>
          Toute hausse de prix est annoncée par e-mail au moins 30 jours avant de s’appliquer.
          L’abonné peut alors résilier sans frais.
        </p>
      </>
    ),
  },
  {
    id: 'article-8',
    titre: 'Article 8. Rémunération et neutralité',
    contenu: (
      <>
        <p>
          L’utilisation des services gratuits ne coûte rien à l’investisseur. Ardentis Logiciels est
          rémunérée :
        </p>
        <ul>
          <li>
            par les sociétés de gestion des SCPI partenaires, par une{' '}
            <strong>commission identique pour toutes, égale à 6 % du montant souscrit</strong>, dont
            20 % sont reversés à notre partenaire agréé ;
          </li>
          <li>par les abonnements premium.</li>
        </ul>
        <p>
          Cette commission est comprise dans les frais de souscription de la SCPI : elle ne s’ajoute
          pas au prix payé par l’investisseur. Aucune SCPI ne peut payer pour être mieux classée ou
          mise en avant. Les SCPI non partenaires sont présentées sur les mêmes indicateurs que les
          partenaires. Nos règles sont détaillées dans notre Charte de neutralité.
        </p>
      </>
    ),
  },
  {
    id: 'article-9',
    titre: 'Article 9. Engagements de l’utilisateur',
    contenu: (
      <>
        <p>L’utilisateur s’engage à :</p>
        <ul>
          <li>fournir des informations exactes et des documents authentiques ;</li>
          <li>n’importer que des relevés qui le concernent ;</li>
          <li>
            ne pas copier ni extraire en masse les données de la plateforme, y compris par des
            outils automatisés ;
          </li>
          <li>ne pas porter atteinte à la sécurité ou au fonctionnement de la plateforme.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'article-10',
    titre: 'Article 10. Responsabilité',
    contenu: (
      <>
        <p>
          Ardentis Logiciels met tout en œuvre pour que la plateforme soit accessible et que ses
          données soient exactes. Les données proviennent des documents publiés par les sociétés de
          gestion et sont mises à jour chaque nuit. En cas de différence, les documents officiels de
          la SCPI font foi.
        </p>
        <p>Ardentis Logiciels n’est pas responsable :</p>
        <ul>
          <li>des performances des SCPI, ni des pertes liées à un investissement ;</li>
          <li>
            des décisions de la société de gestion sur un dossier (validation, refus, délai) ;
          </li>
          <li>des interruptions dues à une maintenance annoncée ou à un cas de force majeure.</li>
        </ul>
        <p>
          L’investissement en SCPI comporte un risque de perte en capital, des revenus non garantis
          et une liquidité limitée. Les performances passées ne préjugent pas des performances
          futures.
        </p>
      </>
    ),
  },
  {
    id: 'article-11',
    titre: 'Article 11. Suspension et fermeture du compte',
    contenu: (
      <>
        <p>
          L’utilisateur peut fermer son compte à tout moment depuis son espace. Un dossier de
          souscription déjà transmis à une SCPI reste traité par celle-ci.
        </p>
        <p>
          Ardentis Logiciels peut suspendre ou fermer un compte en cas de non-respect des CGU, de
          fausse déclaration ou de soupçon de fraude, après en avoir informé l’utilisateur par
          e-mail, sauf urgence ou obligation légale.
        </p>
      </>
    ),
  },
  {
    id: 'article-12',
    titre: 'Article 12. Dispositions générales',
    contenu: (
      <>
        <p>
          <strong>Données personnelles et cookies.</strong> Leur traitement est décrit dans notre{' '}
          <a href="/confidentialite">Politique de confidentialité</a>.
        </p>
        <p>
          <strong>Propriété intellectuelle.</strong> Les éléments de la plateforme (textes, logo,
          interface, base de données) appartiennent à Ardentis Logiciels. L’utilisateur peut les
          consulter pour son usage personnel, sans les reproduire.
        </p>
        <p>
          <strong>Modification des CGU.</strong> Toute modification est annoncée par e-mail au moins
          30 jours avant de s’appliquer. L’utilisateur qui la refuse peut fermer son compte sans
          frais.
        </p>
        <p>
          <strong>Réclamations et médiation.</strong> Toute réclamation s’adresse à{' '}
          <Email adresse="reclamations@scpi-investplus.fr" />. En cas de désaccord persistant,
          l’utilisateur peut saisir gratuitement :
        </p>
        <ul>
          <li>
            pour l’abonnement premium : le médiateur de la consommation, Médiation Conso Services,
            12 rue des Accords, 75010 Paris, <Externe site="www.mediation-conso-services.fr" /> ;
          </li>
          <li>
            pour les souscriptions et l’information financière : le Médiateur de l’AMF, 17 place de
            la Bourse, 75082 Paris Cedex 02, <Externe site="www.amf-france.org" />.
          </li>
        </ul>
        <p>
          <strong>Droit applicable.</strong> Les CGU sont soumises au droit français. À défaut
          d’accord amiable, le litige relève des tribunaux compétents selon les règles de droit
          commun.
        </p>
      </>
    ),
  },
];

export default function Cgu() {
  return (
    <PageLegale
      titre="Conditions générales d’utilisation"
      sections={SECTIONS}
      miseAJour="4 novembre 2026"
    />
  );
}
