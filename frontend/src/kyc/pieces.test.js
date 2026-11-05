import { describe, expect, it } from 'vitest';
import {
  MESSAGE_FORMAT,
  MESSAGE_PIECE_MANQUANTE,
  TAILLE_MAX,
  erreurFichier,
  nationaliteUnionEuropeenne,
  piecesAttendues,
  piecesManquantes,
} from './pieces.js';

const BASE = {
  nationalite: 'Française',
  origineFonds: ['Épargne issue de mes revenus'],
  ppe: 'Non',
};
const types = (reponses) => piecesAttendues(reponses).map((p) => p.type);

describe('pièces demandées (US-04c, scénario 1)', () => {
  it('cas de base : identité (verso facultatif), domicile, RIB, avec libellés', () => {
    const pieces = piecesAttendues(BASE);
    expect(pieces.map((p) => [p.type, p.obligatoire])).toEqual([
      ['identite', true],
      ['identite_verso', false],
      ['domicile', true],
      ['rib', true],
    ]);
    expect(pieces[0].libelle).toBe('Pièce d’identité');
  });

  it('adaptée à la nationalité, à l’origine des fonds et au statut PPE', () => {
    expect(types({ ...BASE, nationalite: 'Sénégalaise' })).toContain('titre_sejour');
    expect(types({ ...BASE, origineFonds: ['Donation'] })).toContain('origine_fonds');
    expect(types({ ...BASE, ppe: 'Oui' })).toContain('ppe');
    expect(types({})).toEqual(['identite', 'identite_verso', 'domicile', 'rib']);
  });

  it('pièces obligatoires manquantes, par type', () => {
    expect(piecesManquantes(BASE, [{ type: 'identite' }, { type: 'identite_verso' }])).toEqual({
      domicile: MESSAGE_PIECE_MANQUANTE,
      rib: MESSAGE_PIECE_MANQUANTE,
    });
  });
});

describe('nationalité de l’Union européenne', () => {
  it.each(['Française', 'ESPAGNOL', 'Néerlandaise', 'pays-bas', 'Franco-marocaine'])(
    '%s : oui',
    (n) => expect(nationaliteUnionEuropeenne(n)).toBe(true),
  );
  it.each(['Marocaine', 'Suisse', 'Britannique'])('%s : non', (n) =>
    expect(nationaliteUnionEuropeenne(n)).toBe(false),
  );
});

describe('fichier accepté avant l’envoi (scénario 3)', () => {
  const fichier = (nom, type, taille) => ({ name: nom, type, size: taille });
  it('PDF, JPG, PNG jusqu’à 10 Mo', () => {
    expect(erreurFichier(fichier('a.pdf', 'application/pdf', 1000))).toBeNull();
    expect(erreurFichier(fichier('a.jpg', 'image/jpeg', TAILLE_MAX))).toBeNull();
    expect(erreurFichier(fichier('a.png', '', 10))).toBeNull(); // type inconnu du navigateur
  });
  it('autre format, trop gros ou vide : message de l’US', () => {
    expect(erreurFichier(fichier('a.gif', 'image/gif', 10))).toBe(MESSAGE_FORMAT);
    expect(erreurFichier(fichier('a.pdf', 'application/pdf', TAILLE_MAX + 1))).toBe(MESSAGE_FORMAT);
    expect(erreurFichier(fichier('a.pdf', 'application/pdf', 0))).toBe(MESSAGE_FORMAT);
    expect(erreurFichier(fichier('a.doc', '', 10))).toBe(MESSAGE_FORMAT);
  });
});
