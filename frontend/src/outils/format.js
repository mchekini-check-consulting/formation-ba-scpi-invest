// Mise en forme des valeurs de l'outil de test : dates complètes à la seconde (heure de
// Paris), durées, tailles de fichier. Valeur absente : « — ».
export const VIDE = '—';

const DATE_HEURE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function dateHeure(iso) {
  if (!iso) return VIDE;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? VIDE : DATE_HEURE.format(date);
}

// « il y a 3 min », « dans 2 h » ; maintenant injecté pour les tests
export function relatif(iso, maintenant = new Date()) {
  if (!iso) return '';
  const ecart = Math.round((new Date(iso).getTime() - maintenant.getTime()) / 1000);
  if (Number.isNaN(ecart)) return '';
  const absolu = Math.abs(ecart);
  const [valeur, unite] =
    absolu < 60
      ? [absolu, 's']
      : absolu < 3600
        ? [Math.round(absolu / 60), 'min']
        : absolu < 86400
          ? [Math.round(absolu / 3600), 'h']
          : [Math.round(absolu / 86400), 'j'];
  return ecart < 0 ? `il y a ${valeur} ${unite}` : `dans ${valeur} ${unite}`;
}

export function duree(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return VIDE;
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

// Durée d'un rapport : de debut à fin ; pas de fin = encore en cours (ou interrompu)
export function dureeEntre(debut, fin) {
  if (!debut || !fin) return VIDE;
  return duree(new Date(fin).getTime() - new Date(debut).getTime());
}

export function taille(octets) {
  if (octets === null || octets === undefined) return VIDE;
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024)
    return `${(octets / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`;
  return `${(octets / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

export function nombre(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return VIDE;
  const n = Number(valeur);
  return Number.isNaN(n) ? String(valeur) : n.toLocaleString('fr-FR');
}

export function ouiNon(valeur) {
  if (valeur === null || valeur === undefined) return VIDE;
  return valeur ? 'Oui' : 'Non';
}
