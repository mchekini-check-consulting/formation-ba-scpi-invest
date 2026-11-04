// Écran /formulaire-investisseur : destination après la validation du KYC (US-04b).
// Page d'attente : le questionnaire lui-même est porté par l'US-05a (SCPI-22), qui
// remplacera ce contenu. Accessible seulement avec un KYC validé (ExigerKycComplete).
import { useEffect } from 'react';
import { deconnecter } from '../auth.js';
import PageCompte from '../PageCompte.jsx';

function naviguer(url) {
  window.location.assign(url);
}

export default function FormulaireInvestisseur({ seDeconnecter = deconnecter, allerA = naviguer }) {
  useEffect(() => {
    document.title = 'SCPI Invest+ · Formulaire investisseur';
  }, []);

  async function quitter() {
    await seDeconnecter();
    allerA('/');
  }

  return (
    <PageCompte titre="Votre KYC est validé">
      <p className="compte__texte">Merci, votre dossier de connaissance client est complet.</p>
      <p className="compte__texte">
        Prochaine étape : le questionnaire de profil investisseur, bientôt disponible.
      </p>
      <button type="button" className="compte__bouton compte__bouton--secondaire" onClick={quitter}>
        Se déconnecter
      </button>
    </PageCompte>
  );
}
