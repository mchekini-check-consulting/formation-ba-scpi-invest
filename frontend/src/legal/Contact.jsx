// Page « Contact » (US-01b), adresse /contact : 2 sections, sans formulaire.
// Données fictives (exercice de formation).
import PageLegale, { Email, Tableau } from './PageLegale.jsx';

const SECTIONS = [
  {
    id: 'nous-contacter',
    titre: '1. Nous contacter',
    contenu: (
      <>
        <p>
          Une question sur la plateforme, votre compte ou un dossier de souscription ? Notre équipe
          vous répond.
        </p>
        <ul>
          <li>
            <strong>E-mail :</strong> <Email adresse="contact@scpi-investplus.fr" />
          </li>
          <li>
            <strong>Téléphone :</strong> <a href="tel:+33146001234">01 46 00 12 34</a> (appel non
            surtaxé), du lundi au vendredi, de 9 h à 18 h
          </li>
          <li>
            <strong>Courrier :</strong> SCPI INVEST+ – Ardentis Logiciels, 18 rue de l’Innovation,
            92130 Issy-les-Moulineaux
          </li>
        </ul>
        <p>Nous répondons aux e-mails sous 2 jours ouvrés.</p>
        <p>
          <strong>À savoir :</strong> notre équipe répond aux questions sur le fonctionnement de la
          plateforme et des SCPI, mais ne donne pas de conseil en investissement. Pour un dossier
          déjà transmis, la société de gestion de la SCPI reste votre interlocuteur sur sa décision.
        </p>
      </>
    ),
  },
  {
    id: 'contacts-specifiques',
    titre: '2. Contacts spécifiques',
    contenu: (
      <>
        <Tableau
          entetes={['Votre demande', 'Contact', 'Délai de réponse']}
          lignes={[
            [
              'Une réclamation',
              <Email key="r" adresse="reclamations@scpi-investplus.fr" />,
              'Accusé de réception sous 10 jours ouvrables, réponse sous 2 mois maximum',
            ],
            [
              'Vos données personnelles (accès, suppression…)',
              <>
                Julien Garnier, délégué à la protection des données :{' '}
                <Email adresse="dpo@scpi-investplus.fr" />
              </>,
              '1 mois',
            ],
            [
              'Une société de gestion qui souhaite devenir SCPI partenaire',
              <Email key="p" adresse="partenaires@scpi-investplus.fr" />,
              '5 jours ouvrés',
            ],
          ]}
        />
        <p>
          Si notre réponse à une réclamation ne vous satisfait pas, vous pouvez saisir gratuitement
          un médiateur. Les coordonnées figurent dans nos{' '}
          <a href="/cgu#article-12">Conditions générales d’utilisation (article 12)</a>.
        </p>
      </>
    ),
  },
];

export default function Contact() {
  return <PageLegale titre="Contact" sections={SECTIONS} />;
}
