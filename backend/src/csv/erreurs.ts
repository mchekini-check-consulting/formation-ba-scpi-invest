import type { DetailErreurImport, RejetImport } from '../db/schema.js';
import { COLONNES } from './convert.js';

// Refus du fichier entier (US-07b, scénario 2), expliqué en blocs (« variante C ») :
// où / constat / cause probable / à faire / détail technique. Le detail va dans le rapport
// d'import (erreur_detail) ; le message, une phrase lisible (où + constat + cause), va
// dans la colonne erreur, les logs et l'alerte. Le détail technique (message d'origine,
// colonnes trouvées) n'est jamais dans le message : il peut contenir un bout du fichier.
export type DetailErreur = DetailErreurImport;

export class FichierInvalide extends Error {
  constructor(
    readonly detail: DetailErreur,
    // lignes rejetées, quand le fichier est refusé parce qu'aucune n'est valide
    readonly rejets: RejetImport[] = [],
  ) {
    super(phrase(detail));
    this.name = 'FichierInvalide';
  }
}

// « Ligne 3 : 21 valeurs au lieu de 20. Cause probable : … »
export function phrase({ ligne, constat, cause }: DetailErreur): string {
  const ou = ligne === null ? constat : `Ligne ${ligne} : ${minuscule(constat)}`;
  return cause ? `${ou}. Cause probable : ${cause}` : ou;
}

// Texte de l'alerte à l'administrateur : un bloc par ligne (sans le détail technique)
export function texteAlerte(fichier: string, detail: DetailErreur): string {
  const ou = detail.ligne === null ? 'fichier entier' : `ligne ${detail.ligne}`;
  return [
    `Où : ${fichier}, ${ou}`,
    `Constat : ${detail.constat}`,
    detail.cause && `Cause probable : ${detail.cause}`,
    detail.action && `À faire : ${detail.action}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const minuscule = (texte: string) => texte.charAt(0).toLowerCase() + texte.slice(1);

// ---- Refus constatés après la lecture

export function fichierVide(): FichierInvalide {
  return new FichierInvalide({
    ligne: null,
    constat: 'Fichier vide : aucune SCPI, catalogue non modifié',
    cause: 'le fichier ne contient que l’en-tête, ou rien du tout (dépôt incomplet ?)',
    action: 'Déposer à nouveau le fichier complet du catalogue',
    technique: null,
  });
}

export function aucuneLigneValide(rejets: RejetImport[]): FichierInvalide {
  return new FichierInvalide(
    {
      ligne: null,
      constat: `Aucune ligne valide : ${rejets.length > 1 ? `les ${rejets.length} lignes sont rejetées` : 'la seule ligne est rejetée'}, catalogue non modifié`,
      cause: null,
      action:
        'Corriger les lignes rejetées (numéro et motif dans la liste des lignes rejetées), puis déposer à nouveau le fichier',
      technique: null,
    },
    rejets,
  );
}

// En-tête (noms des colonnes lues) sans toutes les colonnes du catalogue
export function colonnesAbsentes(trouvees: string[]): FichierInvalide | null {
  const absentes = COLONNES.filter((c) => !trouvees.includes(c));
  if (absentes.length === 0) return null;
  return (
    mauvaisSeparateur(trouvees, null) ??
    new FichierInvalide({
      ligne: 1,
      constat: `Colonnes absentes de l’en-tête : ${absentes.join(', ')}`,
      cause:
        'nom de colonne mal orthographié ou modifié, colonne supprimée, ou séparateur autre que la virgule',
      action: `Corriger l’en-tête (ligne 1) : il doit contenir les ${COLONNES.length} colonnes du catalogue, séparées par des virgules`,
      // noms trouvés : hors du message (logs), au cas où la ligne 1 serait une ligne de données
      technique: `Colonnes trouvées (${trouvees.length}) : ${trouvees.join(', ')}`,
    })
  );
}

// En-tête lu comme une seule colonne qui contient « ; » ou une tabulation
function mauvaisSeparateur(colonnes: string[], technique: string | null): FichierInvalide | null {
  if (colonnes.length !== 1) return null;
  const separateur = colonnes[0].includes(';')
    ? 'point-virgule'
    : colonnes[0].includes('\t')
      ? 'tabulation'
      : null;
  if (!separateur) return null;
  return new FichierInvalide({
    ligne: 1,
    constat: `Séparateur incorrect : ${separateur} détecté dans l’en-tête, virgule attendue`,
    cause:
      separateur === 'point-virgule'
        ? 'fichier enregistré par Excel en français, qui sépare les colonnes par des points-virgules'
        : 'fichier enregistré en « texte (séparateur : tabulation) » ou copié depuis un tableur',
    action:
      'Réenregistrer le fichier en CSV UTF-8 (Excel : « CSV UTF-8 (délimité par des virgules) »), puis le déposer à nouveau',
    technique,
  });
}

// ---- Erreurs levées pendant la lecture (csv-parse, décodage : source.ts), traduites
// d'après leur code, jamais d'après le texte anglais

// Code de l'erreur de décodage levée par decoderUtf8 (source.ts)
export const ENCODAGE_INVALIDE = 'ENCODAGE_INVALIDE';

// Champs utiles des erreurs de csv-parse (CsvError) ; derniere_ligne_lue : posé par lignesCsv
type ErreurLecture = {
  code?: unknown;
  message?: unknown;
  lines?: unknown;
  column?: unknown;
  columns?: unknown;
  record?: unknown;
  derniere_ligne_lue?: unknown;
};

const nombre = (v: unknown) => (typeof v === 'number' ? v : null);

export function erreurDeLecture(err: unknown): FichierInvalide {
  const e: ErreurLecture = typeof err === 'object' && err !== null ? err : {};
  const technique = err instanceof Error ? err.message : String(err);
  const ligne = nombre(e.lines);

  switch (e.code) {
    case 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH':
    case 'CSV_RECORD_INCONSISTENT_COLUMNS': {
      const entete = Array.isArray(e.columns)
        ? e.columns.map((c: { name?: unknown }) => String(c?.name ?? ''))
        : [];
      const separateur = mauvaisSeparateur(entete, technique);
      if (separateur) return separateur;
      const recues = Array.isArray(e.record) ? e.record.length : null;
      const attendues = entete.length || COLONNES.length;
      const enTrop = recues !== null && recues > attendues;
      return new FichierInvalide({
        ligne,
        constat:
          recues === null
            ? `Nombre de valeurs différent de l’en-tête (${attendues} colonnes)`
            : `${recues} valeurs au lieu de ${attendues}`,
        cause: enTrop
          ? 'une valeur contient une virgule sans être entourée de guillemets (taux, secteurs, localisation…)'
          : 'valeur manquante, ou ligne coupée en deux par un retour à la ligne dans une valeur',
        action: `Corriger cette ligne : elle doit compter ${COLONNES.length} valeurs, une par colonne du catalogue ; une valeur qui contient des virgules s’écrit entre guillemets, par exemple "8.35,8.16"`,
        technique,
      });
    }

    case 'CSV_QUOTE_NOT_CLOSED': {
      // csv-parse signale la fin du fichier : le guillemet s'ouvre juste après la
      // dernière ligne lue sans erreur
      const derniere = nombre(e.derniere_ligne_lue);
      return new FichierInvalide({
        ligne: derniere === null ? null : derniere + 1,
        constat: 'Guillemet ouvert jamais fermé',
        cause:
          'il manque le guillemet de fin d’une valeur : toute la suite du fichier est lue comme une seule valeur',
        action:
          'Ajouter le guillemet de fin de la valeur : une valeur entre guillemets en a un au début et un à la fin',
        technique,
      });
    }

    case 'CSV_INVALID_CLOSING_QUOTE':
    case 'CSV_NON_TRIMABLE_CHAR_AFTER_CLOSING_QUOTE':
      return new FichierInvalide({
        ligne,
        constat: `Caractère inattendu après un guillemet fermant${typeof e.column === 'string' ? ` (colonne ${e.column})` : ''}`,
        cause: 'guillemet au milieu d’une valeur, ou texte collé après une valeur entre guillemets',
        action:
          'Entourer toute la valeur de guillemets, et doubler les guillemets qui font partie du texte ("")',
        technique,
      });

    case ENCODAGE_INVALIDE:
      return new FichierInvalide({
        ligne: null,
        constat: 'Encodage du fichier invalide : UTF-8 attendu',
        cause:
          'fichier enregistré dans un autre encodage (Latin-1 / Windows-1252), souvent par Excel en « CSV » simple',
        action:
          'Réenregistrer le fichier en CSV UTF-8 (Excel : « CSV UTF-8 (délimité par des virgules) »), puis le déposer à nouveau',
        technique,
      });

    default:
      return new FichierInvalide({
        ligne,
        constat: 'Fichier illisible',
        cause: null,
        action:
          'Vérifier que le fichier est bien un CSV séparé par des virgules et enregistré en UTF-8 ; sinon, transmettre le détail technique à l’équipe technique',
        technique,
      });
  }
}
