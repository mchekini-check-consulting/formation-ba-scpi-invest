import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { Db } from '../db/index.js';
import { COLONNES } from './convert.js';
import { erreurDeLecture, FichierInvalide, phrase, texteAlerte } from './erreurs.js';
import { importScpis } from './import.js';
import { lignesCsv } from './source.js';

// US-07b, scénario 2 : fichier entier refusé, motif expliqué en blocs. De vrais petits CSV
// passent par la lecture (lignesCsv) puis l'import : le refus arrive avant toute écriture,
// la base n'est jamais appelée.
const ENTETE = COLONNES.join(',');
function ligneValide(nom: string) {
  return `${nom},,1000,"France,100","Bureaux,100",200,1000000,G,10,10,3,Mensuelle,,FR7630001007941234567890185,BNPAFRPPXXX,,Non,,Non,Texte`;
}
const csv = (...lignes: string[]) => `${lignes.join('\n')}\n`;

async function refus(contenu: string | Buffer): Promise<FichierInvalide> {
  const flux =
    typeof contenu === 'string'
      ? Readable.from([contenu])
      : Readable.from([contenu], { objectMode: false });
  const erreur = await importScpis({} as Db, lignesCsv(flux)).catch((e: unknown) => e);
  expect(erreur).toBeInstanceOf(FichierInvalide);
  return erreur as FichierInvalide;
}

const REENREGISTRER =
  'Réenregistrer le fichier en CSV UTF-8 (Excel : « CSV UTF-8 (délimité par des virgules) »), puis le déposer à nouveau';

describe('fichier refusé : motif en blocs', () => {
  it('séparateur point-virgule (Excel en français), valeurs avec virgules décimales', async () => {
    const erreur = await refus(csv('Nom;taux_distribution;prix_part', 'A;8,35;200'));

    expect(erreur.detail).toEqual({
      ligne: 1,
      constat: 'Séparateur incorrect : point-virgule détecté dans l’en-tête, virgule attendue',
      cause:
        'fichier enregistré par Excel en français, qui sépare les colonnes par des points-virgules',
      action: REENREGISTRER,
      technique: 'Invalid Record Length: columns length is 1, got 2 on line 2',
    });
    expect(erreur.message).toBe(
      'Ligne 1 : séparateur incorrect : point-virgule détecté dans l’en-tête, virgule attendue. Cause probable : fichier enregistré par Excel en français, qui sépare les colonnes par des points-virgules',
    );
  });

  it('séparateur point-virgule, valeurs sans virgule : même constat, sans détail technique', async () => {
    const erreur = await refus(csv('Nom;prix_part', 'A;200'));
    expect(erreur.detail).toMatchObject({
      ligne: 1,
      constat: 'Séparateur incorrect : point-virgule détecté dans l’en-tête, virgule attendue',
      technique: null,
    });
  });

  it('séparateur tabulation', async () => {
    const erreur = await refus(csv('Nom\tprix_part', 'A\t200'));
    expect(erreur.detail).toMatchObject({
      ligne: 1,
      constat: 'Séparateur incorrect : tabulation détecté dans l’en-tête, virgule attendue',
      cause: 'fichier enregistré en « texte (séparateur : tabulation) » ou copié depuis un tableur',
      action: REENREGISTRER,
    });
  });

  it('valeur en trop : virgule sans guillemets dans un taux', async () => {
    const enTrop = ligneValide('B').replace('B,,', 'B,8.35,8.16,');
    const erreur = await refus(csv(ENTETE, ligneValide('A'), enTrop));

    expect(erreur.detail).toEqual({
      ligne: 3,
      constat: '21 valeurs au lieu de 20',
      cause:
        'une valeur contient une virgule sans être entourée de guillemets (taux, secteurs, localisation…)',
      action:
        'Corriger cette ligne : elle doit compter 20 valeurs, une par colonne du catalogue ; une valeur qui contient des virgules s’écrit entre guillemets, par exemple "8.35,8.16"',
      technique: 'Invalid Record Length: columns length is 20, got 21 on line 3',
    });
    expect(erreur.message).toBe(
      'Ligne 3 : 21 valeurs au lieu de 20. Cause probable : une valeur contient une virgule sans être entourée de guillemets (taux, secteurs, localisation…)',
    );
  });

  it('valeur manquante', async () => {
    const erreur = await refus(csv(ENTETE, ligneValide('A').replace(',Texte', '')));
    expect(erreur.detail).toMatchObject({
      ligne: 2,
      constat: '19 valeurs au lieu de 20',
      cause: 'valeur manquante, ou ligne coupée en deux par un retour à la ligne dans une valeur',
    });
  });

  it('guillemet ouvert jamais fermé : situé juste après la dernière ligne lue', async () => {
    const nonFerme = ligneValide('C').replace(',Texte', ',"Texte');
    const erreur = await refus(csv(ENTETE, ligneValide('A'), ligneValide('B'), nonFerme, 'D'));

    expect(erreur.detail).toEqual({
      ligne: 4,
      constat: 'Guillemet ouvert jamais fermé',
      cause:
        'il manque le guillemet de fin d’une valeur : toute la suite du fichier est lue comme une seule valeur',
      action:
        'Ajouter le guillemet de fin de la valeur : une valeur entre guillemets en a un au début et un à la fin',
      technique: 'Quote Not Closed: the parsing is finished with an opening quote at line 5',
    });
  });

  it.each([
    ['caractère collé au guillemet', '"France,100"x', 'Invalid Closing Quote: got "x" at line 2'],
    [
      'texte après le guillemet',
      '"France,100" x',
      'Invalid Closing Quote: found non trimable byte after quote at line 2',
    ],
  ])('caractère après un guillemet fermant (%s)', async (_cas, valeur, technique) => {
    const erreur = await refus(csv(ENTETE, ligneValide('A').replace('"France,100"', valeur)));
    expect(erreur.detail).toMatchObject({
      ligne: 2,
      constat: 'Caractère inattendu après un guillemet fermant (colonne localisation)',
      cause: 'guillemet au milieu d’une valeur, ou texte collé après une valeur entre guillemets',
      action:
        'Entourer toute la valeur de guillemets, et doubler les guillemets qui font partie du texte ("")',
    });
    expect(erreur.detail.technique).toContain(technique);
  });

  it('fichier en Latin-1 : encodage invalide, réenregistrer en CSV UTF-8', async () => {
    const erreur = await refus(Buffer.from(csv(ENTETE, ligneValide('Métropoles')), 'latin1'));

    expect(erreur.detail).toEqual({
      ligne: null,
      constat: 'Encodage du fichier invalide : UTF-8 attendu',
      cause:
        'fichier enregistré dans un autre encodage (Latin-1 / Windows-1252), souvent par Excel en « CSV » simple',
      action: REENREGISTRER,
      technique: 'encodage invalide (UTF-8 attendu)',
    });
  });

  it('colonnes absentes : colonnes trouvées dans le détail technique (hors message)', async () => {
    const sansBancaire = COLONNES.filter((c) => c !== 'iban' && c !== 'bic');
    const erreur = await refus(csv(sansBancaire.join(','), sansBancaire.map(() => '1').join(',')));

    expect(erreur.detail).toEqual({
      ligne: 1,
      constat: 'Colonnes absentes de l’en-tête : iban, bic',
      cause:
        'nom de colonne mal orthographié ou modifié, colonne supprimée, ou séparateur autre que la virgule',
      action:
        'Corriger l’en-tête (ligne 1) : il doit contenir les 20 colonnes du catalogue, séparées par des virgules',
      technique: `Colonnes trouvées (18) : ${sansBancaire.join(', ')}`,
    });
    expect(erreur.message).not.toContain('trouvées');
  });

  it('en-tête d’une seule colonne sans séparateur : colonnes absentes', async () => {
    const erreur = await refus(csv('Nom', 'A'));
    expect(erreur.detail).toMatchObject({ ligne: 1, technique: 'Colonnes trouvées (1) : Nom' });
    expect(erreur.detail.constat).toMatch(/^Colonnes absentes de l’en-tête : taux_distribution, /);
  });

  it('une valeur de trop pour un en-tête d’une seule colonne sans séparateur', async () => {
    const erreur = await refus(csv('Nom', 'A,B'));
    expect(erreur.detail).toMatchObject({ ligne: 2, constat: '2 valeurs au lieu de 1' });
  });

  it.each([
    ['totalement vide', ''],
    ['réduit à l’en-tête', csv(ENTETE)],
  ])('fichier %s : aucune SCPI', async (_cas, contenu) => {
    const erreur = await refus(contenu);
    expect(erreur.detail).toEqual({
      ligne: null,
      constat: 'Fichier vide : aucune SCPI, catalogue non modifié',
      cause: 'le fichier ne contient que l’en-tête, ou rien du tout (dépôt incomplet ?)',
      action: 'Déposer à nouveau le fichier complet du catalogue',
      technique: null,
    });
  });

  it.each([
    [1, 'Aucune ligne valide : la seule ligne est rejetée, catalogue non modifié'],
    [2, 'Aucune ligne valide : les 2 lignes sont rejetées, catalogue non modifié'],
  ])('aucune ligne valide (%i ligne) : renvoie aux lignes rejetées', async (n, constat) => {
    const invalides = ['A', 'B']
      .slice(0, n)
      .map((nom) => ligneValide(nom).replace('BNPAFRPPXXX', ''));
    const erreur = await refus(csv(ENTETE, ...invalides));

    expect(erreur.detail).toEqual({
      ligne: null,
      constat,
      cause: null,
      action:
        'Corriger les lignes rejetées (numéro et motif dans la liste des lignes rejetées), puis déposer à nouveau le fichier',
      technique: null,
    });
    expect(erreur.rejets).toHaveLength(n);
    expect(erreur.message).toBe(constat);
  });
});

describe('erreurDeLecture : cas sans fichier réel', () => {
  it('code inconnu : « Fichier illisible », message d’origine en détail technique', () => {
    const erreur = erreurDeLecture(Object.assign(new Error('Max Record Size'), { lines: 7 }));
    expect(erreur.detail).toEqual({
      ligne: 7,
      constat: 'Fichier illisible',
      cause: null,
      action:
        'Vérifier que le fichier est bien un CSV séparé par des virgules et enregistré en UTF-8 ; sinon, transmettre le détail technique à l’équipe technique',
      technique: 'Max Record Size',
    });
  });

  it('erreur qui n’est pas un objet Error : gardée en texte', () => {
    expect(erreurDeLecture('flux coupé').detail).toMatchObject({
      ligne: null,
      constat: 'Fichier illisible',
      technique: 'flux coupé',
    });
  });

  it('nombre de valeurs inconnu : rappelle les colonnes attendues', () => {
    const erreur = erreurDeLecture({ code: 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH', lines: 4 });
    expect(erreur.detail).toMatchObject({
      ligne: 4,
      constat: 'Nombre de valeurs différent de l’en-tête (20 colonnes)',
    });
  });

  it('guillemet jamais fermé sans dernière ligne lue : ligne inconnue', () => {
    expect(erreurDeLecture({ code: 'CSV_QUOTE_NOT_CLOSED' }).detail.ligne).toBeNull();
  });
});

describe('phrase et texte de l’alerte', () => {
  const detail = {
    ligne: 3,
    constat: '21 valeurs au lieu de 20',
    cause: 'une virgule sans guillemets',
    action: 'Corriger la ligne',
    technique: 'Invalid Record Length',
  };

  it('phrase : où, constat et cause, jamais le détail technique', () => {
    expect(phrase(detail)).toBe(
      'Ligne 3 : 21 valeurs au lieu de 20. Cause probable : une virgule sans guillemets',
    );
    expect(phrase({ ...detail, ligne: null, cause: null })).toBe('21 valeurs au lieu de 20');
  });

  it('alerte : un bloc par ligne, sans le détail technique', () => {
    expect(texteAlerte('scpi.csv', detail)).toBe(
      [
        'Où : scpi.csv, ligne 3',
        'Constat : 21 valeurs au lieu de 20',
        'Cause probable : une virgule sans guillemets',
        'À faire : Corriger la ligne',
      ].join('\n'),
    );
    expect(texteAlerte('scpi.csv', { ...detail, ligne: null, cause: null, action: null })).toBe(
      'Où : scpi.csv, fichier entier\nConstat : 21 valeurs au lieu de 20',
    );
  });
});
