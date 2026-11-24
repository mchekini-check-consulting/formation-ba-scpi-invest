// Fenêtre de confirmation avant la déconnexion (Confirmation.jsx) : « Oui » déconnecte,
// « Non » la referme sans rien faire.
import Confirmation from './Confirmation.jsx';

export default function ConfirmationDeconnexion(proprietes) {
  return (
    <Confirmation
      titre="Se déconnecter ?"
      message="Voulez-vous vraiment vous déconnecter ?"
      {...proprietes}
    />
  );
}
