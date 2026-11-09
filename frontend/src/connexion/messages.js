// Messages de l'écran de connexion propres à l'US-03b (sécurité de la session)

export const MESSAGE_SESSION_EXPIREE = 'Votre session a expiré. Reconnectez-vous pour continuer.';

// Compte bloqué (429) : message du backend suivi de l'heure de déblocage, à l'heure du
// poste (« Réessayez à 14 h 32. ») ; autre erreur : message tel quel.
// Espaces insécables dans l'heure : « 14 h 32 » n'est jamais coupé en fin de ligne.
const INSECABLE = ' ';

const MINUTE_MS = 60_000;

export function messageErreur(err) {
  const fin = err.status === 429 && err.debloqueA ? new Date(err.debloqueA) : null;
  if (!fin || Number.isNaN(fin.getTime())) {
    return err.message;
  }
  // Arrondie à la minute supérieure (déblocage à 14:31:40 -> « 14 h 32 ») : un essai à
  // l'heure affichée n'est jamais encore refusé
  const heure = new Date(Math.ceil(fin.getTime() / MINUTE_MS) * MINUTE_MS)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', `${INSECABLE}h${INSECABLE}`);
  return `${err.message} Réessayez à ${heure}.`;
}
