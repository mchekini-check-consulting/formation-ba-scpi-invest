// Écran pas encore développé (EN-03) : son adresse définitive répond déjà, avec le titre
// de l'écran et la mention « Bientôt disponible ». L'US de l'écran remplace cette page.
import { deconnecter } from '../auth.js';
import PageApplication from './PageApplication.jsx';

export default function PageBientot({ titre, actif }) {
  async function quitter() {
    await deconnecter();
    window.location.assign('/');
  }

  return (
    <PageApplication titre={titre} actif={actif} seDeconnecter={quitter}>
      <p>Bientôt disponible</p>
    </PageApplication>
  );
}
