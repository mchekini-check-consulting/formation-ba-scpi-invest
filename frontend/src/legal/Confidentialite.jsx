// Page « Politique de confidentialité » (US-01b), adresse /confidentialite : 8 sections.
// Données fictives (exercice de formation), texte à valider par le juriste du projet.
import PageLegale, { Email, Externe, Tableau } from './PageLegale.jsx';

const SECTIONS = [
  {
    id: 'responsable',
    titre: '1. Qui traite vos données ?',
    contenu: (
      <>
        <p>
          Les données personnelles collectées sur la plateforme SCPI INVEST+ sont traitées par{' '}
          <strong>Ardentis Logiciels</strong>, SAS au capital de 150 000 €, 18 rue de l’Innovation,
          92130 Issy-les-Moulineaux, RCS Nanterre 912 345 678, en qualité de{' '}
          <strong>responsable de traitement</strong>.
        </p>
        <p>
          <strong>Délégué à la protection des données (DPO) :</strong> Julien Garnier,{' '}
          <Email adresse="dpo@scpi-investplus.fr" />, ou par courrier à l’adresse du siège, à
          l’attention du DPO.
        </p>
      </>
    ),
  },
  {
    id: 'donnees-collectees',
    titre: '2. Quelles données collectons-nous ?',
    contenu: (
      <>
        <p>Nous collectons uniquement les données utiles au service que vous utilisez :</p>
        <ul>
          <li>
            <strong>Compte :</strong> nom, prénom, adresse e-mail, mot de passe (stocké chiffré),
            numéro de téléphone.
          </li>
          <li>
            <strong>Identité et conformité (KYC) :</strong> date et lieu de naissance, nationalité,
            adresse, pièce d’identité, justificatif de domicile, résidence fiscale.
          </li>
          <li>
            <strong>Profil investisseur :</strong> situation professionnelle, tranche de revenus et
            de patrimoine, objectifs, horizon de placement, expérience et tolérance au risque.
          </li>
          <li>
            <strong>Portefeuille :</strong> SCPI détenues, nombre de parts, revenus perçus, et
            relevés PDF que vous importez.
          </li>
          <li>
            <strong>Souscriptions :</strong> contenu des dossiers préparés sur la plateforme et leur
            statut (envoyé, validé, refusé).
          </li>
          <li>
            <strong>Navigation :</strong> adresse IP, type d’appareil et de navigateur, pages
            consultées, avec votre accord pour la mesure d’audience.
          </li>
        </ul>
        <p>
          <strong>Aucune donnée bancaire n’est conservée par la plateforme :</strong> aucun fonds ne
          transite par la plateforme, vous réglez directement la SCPI. L’abonnement premium est payé
          via notre prestataire de paiement, qui seul traite vos données de carte.
        </p>
      </>
    ),
  },
  {
    id: 'finalites',
    titre: '3. Pourquoi utilisons-nous vos données ?',
    contenu: (
      <>
        <p>Chaque traitement repose sur une base légale prévue par le RGPD.</p>
        <Tableau
          entetes={['Finalité', 'Données utilisées', 'Base légale']}
          lignes={[
            [
              'Créer et gérer votre compte',
              'Compte',
              'Exécution du contrat (conditions générales)',
            ],
            [
              'Vérifier votre identité et lutter contre le blanchiment',
              'Identité et conformité',
              'Obligation légale',
            ],
            [
              'Adapter l’information à votre profil et vérifier l’adéquation d’une souscription',
              'Profil investisseur',
              'Obligation légale',
            ],
            [
              'Préparer et transmettre vos dossiers de souscription',
              'Compte, identité, profil, souscriptions',
              'Exécution du contrat',
            ],
            [
              'Suivre votre portefeuille et lire vos relevés importés',
              'Portefeuille',
              'Exécution du contrat',
            ],
            [
              'Vous envoyer les alertes sur les SCPI que vous suivez',
              'Compte, portefeuille',
              'Exécution du contrat',
            ],
            ['Gérer l’abonnement premium', 'Compte', 'Exécution du contrat'],
            ['Mesurer l’audience et améliorer la plateforme', 'Navigation', 'Consentement'],
            ['Vous envoyer notre lettre d’information', 'Compte (e-mail)', 'Consentement'],
            [
              'Sécuriser la plateforme et traiter vos réclamations',
              'Compte, navigation',
              'Intérêt légitime',
            ],
          ]}
        />
        <p>
          Vos données ne sont jamais vendues, ni utilisées pour vous recommander une SCPI en
          particulier.
        </p>
      </>
    ),
  },
  {
    id: 'destinataires',
    titre: '4. Qui reçoit vos données ?',
    contenu: (
      <>
        <p>Vos données sont accessibles uniquement aux personnes qui en ont besoin :</p>
        <ul>
          <li>
            <strong>Les équipes d’Ardentis Logiciels</strong> habilitées (support, conformité,
            technique).
          </li>
          <li>
            <strong>Notre partenaire agréé, Marc Delorme (CIF)</strong>, pour contrôler la
            conformité des dossiers de souscription.
          </li>
          <li>
            <strong>La société de gestion de la SCPI</strong> que vous choisissez, uniquement pour
            le dossier que vous lui envoyez.
          </li>
          <li>
            <strong>Nos prestataires techniques</strong>, qui agissent sur nos instructions :
            hébergement (Nuagis Hébergement), vérification d’identité, paiement de l’abonnement
            premium, envoi d’e-mails.
          </li>
          <li>
            <strong>Les autorités</strong> (AMF, Tracfin, administration fiscale), lorsque la loi
            l’impose.
          </li>
        </ul>
        <p>
          Nos prestataires sont liés par contrat et ne peuvent pas utiliser vos données pour leur
          propre compte.
        </p>
      </>
    ),
  },
  {
    id: 'conservation',
    titre: '5. Combien de temps les conservons-nous ?',
    contenu: (
      <>
        <Tableau
          entetes={['Données', 'Durée de conservation']}
          lignes={[
            [
              'Compte et portefeuille',
              'Tant que le compte est actif, puis 3 ans sans connexion avant suppression',
            ],
            [
              'Identité, conformité et dossiers de souscription',
              '5 ans après la fin de la relation (obligation anti-blanchiment)',
            ],
            ['Profil investisseur', '5 ans après la fin de la relation'],
            [
              'Relevés PDF importés',
              'Supprimés dès leur lecture : seules les données extraites sont conservées',
            ],
            ['Facturation de l’abonnement premium', '10 ans (obligation comptable)'],
            ['Cookies de mesure d’audience', '13 mois maximum'],
            ['Réclamations', '5 ans après leur clôture'],
          ]}
        />
        <p>À la fin de ces durées, les données sont supprimées ou rendues anonymes.</p>
      </>
    ),
  },
  {
    id: 'stockage',
    titre: '6. Où sont stockées vos données et comment sont-elles protégées ?',
    contenu: (
      <>
        <p>
          Toutes vos données sont hébergées en France par Nuagis Hébergement, à Lille. Elles ne sont
          pas transférées hors de l’Union européenne.
        </p>
        <p>Pour les protéger, nous appliquons notamment :</p>
        <ul>
          <li>le chiffrement des données, pendant leur transfert et leur stockage ;</li>
          <li>une double authentification à la connexion ;</li>
          <li>des accès limités aux seules personnes habilitées, et enregistrés ;</li>
          <li>des sauvegardes quotidiennes et des tests de sécurité réguliers.</li>
        </ul>
        <p>
          En cas de violation de données présentant un risque pour vous, nous informons la CNIL sous
          72 heures et vous prévenons dans les meilleurs délais.
        </p>
      </>
    ),
  },
  {
    id: 'droits',
    titre: '7. Quels sont vos droits ?',
    contenu: (
      <>
        <p>Vous disposez à tout moment des droits suivants sur vos données :</p>
        <ul>
          <li>
            <strong>Accès :</strong> obtenir une copie de vos données.
          </li>
          <li>
            <strong>Rectification :</strong> corriger une donnée inexacte, directement depuis votre
            espace ou sur demande.
          </li>
          <li>
            <strong>Suppression :</strong> demander l’effacement de vos données, sauf celles que la
            loi nous oblige à conserver.
          </li>
          <li>
            <strong>Opposition et limitation :</strong> vous opposer à un traitement ou en suspendre
            l’utilisation.
          </li>
          <li>
            <strong>Portabilité :</strong> récupérer vos données dans un format lisible (CSV), par
            exemple votre portefeuille.
          </li>
          <li>
            <strong>Retrait du consentement :</strong> pour la lettre d’information et les cookies
            de mesure d’audience, à tout moment.
          </li>
          <li>
            <strong>Directives après décès :</strong> indiquer ce que deviennent vos données.
          </li>
        </ul>
        <p>
          Pour exercer ces droits, écrivez à <Email adresse="dpo@scpi-investplus.fr" />. Nous
          répondons sous 1 mois et pouvons vous demander de justifier votre identité. Si vous
          estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (
          <Externe site="www.cnil.fr" />
          ).
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    titre: '8. Cookies et mises à jour',
    contenu: (
      <>
        <p>
          La plateforme dépose des cookies nécessaires à son fonctionnement (connexion, sécurité)
          et, seulement avec votre accord, des cookies de mesure d’audience. Aucun cookie
          publicitaire n’est utilisé. Vous pouvez modifier vos choix à tout moment depuis la page
          Gestion des cookies, en bas de chaque page.
        </p>
        <p>
          Cette politique peut évoluer. En cas de changement important, nous vous prévenons par
          e-mail ou par un message sur la plateforme.
        </p>
      </>
    ),
  },
];

export default function Confidentialite() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      sections={SECTIONS}
      miseAJour="3 novembre 2026"
    />
  );
}
