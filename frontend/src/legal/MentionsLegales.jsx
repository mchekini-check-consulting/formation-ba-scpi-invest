// Page « Mentions légales » (US-01b), adresse /mentions-legales : 10 sections.
// Données fictives (exercice de formation), texte à valider par le juriste du projet.
import PageLegale, { Email, Externe } from './PageLegale.jsx';

const SECTIONS = [
  {
    id: 'editeur',
    titre: '1. Éditeur de la plateforme',
    contenu: (
      <>
        <p>La plateforme SCPI INVEST+ est éditée par :</p>
        <p>
          <strong>Ardentis Logiciels</strong>, société par actions simplifiée (SAS) au capital de
          150 000 €
          <br />
          Siège social : 18 rue de l’Innovation, 92130 Issy-les-Moulineaux
          <br />
          Immatriculée au RCS de Nanterre sous le numéro 912 345 678
          <br />
          N° de TVA intracommunautaire : FR 42 912 345 678
          <br />
          Téléphone : 01 46 00 12 34 · E-mail : <Email adresse="contact@scpi-investplus.fr" />
        </p>
        <p>
          <strong>Directrice de la publication :</strong> Claire Moreau, présidente d’Ardentis
          Logiciels
        </p>
      </>
    ),
  },
  {
    id: 'hebergement',
    titre: '2. Hébergement',
    contenu: (
      <p>
        La plateforme est hébergée par <strong>Nuagis Hébergement SAS</strong>, 7 allée des
        Serveurs, 59000 Lille, tél. 03 20 00 45 67. Toutes les données sont hébergées en France, au
        sein de l’Union européenne.
      </p>
    ),
  },
  {
    id: 'activite',
    titre: '3. Activité réglementée et partenaire agréé',
    contenu: (
      <>
        <p>
          SCPI INVEST+ est une plateforme d’information, de comparaison et de simulation sur les
          SCPI. Elle prépare la souscription en ligne auprès de SCPI partenaires.
        </p>
        <p>
          Cette activité est exercée avec <strong>notre partenaire agréé, Marc Delorme</strong>,
          conseiller en investissements financiers (CIF) exerçant en entrepreneur individuel, 5 rue
          du Patrimoine, 75008 Paris :
        </p>
        <ul>
          <li>
            immatriculé à l’ORIAS sous le numéro 08 066 027 (<Externe site="www.orias.fr" />) ;
          </li>
          <li>
            adhérent de l’Association française des conseillers patrimoniaux (AFCP), association
            agréée par l’Autorité des marchés financiers (AMF) ;
          </li>
          <li>
            titulaire d’une assurance de responsabilité civile professionnelle auprès de Prévalis
            Assurances, contrat n° RCP-2026-0457.
          </li>
        </ul>
        <p>
          Notre partenaire agréé valide les parcours et les documents de souscription de la
          plateforme, définit les contrôles appliqués à chaque dossier et en vérifie régulièrement
          le respect. Il reste responsable de la conformité de l’activité devant l’AMF.
        </p>
        <p>
          <strong>Absence de conseil.</strong> Les informations, comparaisons et simulations
          publiées sur la plateforme ne constituent ni un conseil en investissement, ni une
          recommandation personnalisée. L’utilisateur reste seul responsable de ses décisions
          d’investissement.
        </p>
        <p>
          <strong>Rémunération.</strong> SCPI INVEST+ est rémunérée par les sociétés de gestion des
          SCPI partenaires, sous la forme d’une commission identique pour toutes, égale à 6 % du
          montant souscrit. 20 % de cette commission sont reversés à notre partenaire agréé. Aucune
          SCPI ne peut acheter une meilleure place dans les classements. Nos règles sont détaillées
          dans notre Charte de neutralité.
        </p>
        <p>
          <strong>Aucun fonds ne transite par la plateforme.</strong> Le paiement des souscriptions
          est effectué directement par l’investisseur auprès de la SCPI, une fois son dossier
          validé.
        </p>
      </>
    ),
  },
  {
    id: 'risques',
    titre: '4. Avertissement sur les risques',
    contenu: (
      <>
        <p>L’investissement en parts de SCPI comporte des risques, notamment :</p>
        <ul>
          <li>un risque de perte en capital ;</li>
          <li>des revenus non garantis, qui peuvent varier à la hausse comme à la baisse ;</li>
          <li>
            une liquidité limitée : la revente des parts n’est pas garantie et peut prendre
            plusieurs mois.
          </li>
        </ul>
        <p>
          Les SCPI sont des placements de long terme : la durée de placement recommandée est
          généralement de 8 à 10 ans. Les performances passées ne préjugent pas des performances
          futures. Avant toute souscription, l’investisseur doit prendre connaissance du document
          d’informations clés (DIC) et de la note d’information de la SCPI, disponibles sur chaque
          fiche.
        </p>
      </>
    ),
  },
  {
    id: 'sources',
    titre: '5. Sources et exactitude des données',
    contenu: (
      <p>
        Les données affichées proviennent des documents publiés par les sociétés de gestion :
        bulletins d’information, rapports annuels, DIC. Elles sont mises à jour chaque nuit, mais
        peuvent comporter des décalages ou des erreurs. En cas de différence, les documents
        officiels de la SCPI font foi.
      </p>
    ),
  },
  {
    id: 'donnees-personnelles',
    titre: '6. Données personnelles',
    contenu: (
      <>
        <p>
          Les données personnelles collectées sur la plateforme sont traitées par Ardentis
          Logiciels, responsable de traitement, conformément au Règlement général sur la protection
          des données (RGPD). Les finalités, la durée de conservation et vos droits (accès,
          rectification, suppression, opposition, portabilité) sont détaillés dans notre{' '}
          <a href="/confidentialite">Politique de confidentialité</a>.
        </p>
        <p>
          Délégué à la protection des données : Julien Garnier,{' '}
          <Email adresse="dpo@scpi-investplus.fr" />. Vous pouvez également adresser une réclamation
          à la CNIL (<Externe site="www.cnil.fr" />
          ).
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    titre: '7. Cookies',
    contenu: (
      <p>
        La plateforme utilise des cookies nécessaires à son fonctionnement et, avec votre accord,
        des cookies de mesure d’audience. Vous pouvez modifier vos choix à tout moment depuis la
        page Gestion des cookies, accessible en bas de chaque page.
      </p>
    ),
  },
  {
    id: 'propriete',
    titre: '8. Propriété intellectuelle',
    contenu: (
      <>
        <p>
          L’ensemble des éléments de la plateforme (textes, logo, interface, base de données) est la
          propriété d’Ardentis Logiciels. Toute reproduction, même partielle, sans autorisation
          écrite est interdite.
        </p>
        <p>
          <strong>Crédits photos :</strong> photographies issues d’Unsplash, utilisées sous licence
          Unsplash. Le nom de chaque photographe est indiqué au survol de l’image.
        </p>
      </>
    ),
  },
  {
    id: 'reclamations',
    titre: '9. Réclamations et médiation',
    contenu: (
      <>
        <p>
          Pour toute réclamation, écrivez à <Email adresse="reclamations@scpi-investplus.fr" /> ou à
          l’adresse du siège. Nous accusons réception sous 10 jours ouvrables et répondons sous 2
          mois maximum.
        </p>
        <p>
          En cas de désaccord persistant, vous pouvez saisir gratuitement le Médiateur de l’AMF :
          Autorité des marchés financiers, Le Médiateur, 17 place de la Bourse, 75082 Paris Cedex
          02, ou en ligne sur <Externe site="www.amf-france.org" />.
        </p>
      </>
    ),
  },
  {
    id: 'droit',
    titre: '10. Droit applicable',
    contenu: (
      <p>
        Les présentes mentions légales sont soumises au droit français. Tout litige relève de la
        compétence des tribunaux de Nanterre.
      </p>
    ),
  },
];

export default function MentionsLegales() {
  return <PageLegale titre="Mentions légales" sections={SECTIONS} miseAJour="2 novembre 2026" />;
}
