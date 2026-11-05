import { describe, expect, it } from 'vitest';
import { JPG, KYC_COMPLET, PDF, PNG } from './exemple.js';
import {
  clePiece,
  formatDuFichier,
  nationaliteUnionEuropeenne,
  nomFichierAffiche,
  piecesAttendues,
  piecesManquantes,
  typePiece,
} from './pieces.js';

const types = (reponses: Record<string, string | string[]>) =>
  piecesAttendues(reponses).map((piece) => piece.type);

describe('pièces demandées selon les réponses du KYC', () => {
  it('cas de base (Française, épargne, non PPE) : identité, domicile, RIB', () => {
    expect(piecesAttendues(KYC_COMPLET)).toEqual([
      { type: 'identite', obligatoire: true },
      { type: 'identite_verso', obligatoire: false },
      { type: 'domicile', obligatoire: true },
      { type: 'rib', obligatoire: true },
    ]);
  });

  it('nationalité hors Union européenne : titre de séjour', () => {
    expect(types({ ...KYC_COMPLET, nationalite: 'Marocaine' })).toContain('titre_sejour');
    expect(types({ ...KYC_COMPLET, nationalite: '' })).not.toContain('titre_sejour');
  });

  it('autre origine des fonds que l’épargne : justificatif d’origine des fonds', () => {
    const origineFonds = ['Épargne issue de mes revenus', 'Héritage ou succession'];
    expect(types({ ...KYC_COMPLET, origineFonds })).toContain('origine_fonds');
    expect(types({ ...KYC_COMPLET, origineFonds: [] })).not.toContain('origine_fonds');
  });

  it('personne politiquement exposée : pièce complémentaire', () => {
    expect(types({ ...KYC_COMPLET, ppe: 'Oui' })).toContain('ppe');
  });

  it('pièces manquantes : seulement les obligatoires non déposées', () => {
    expect(piecesManquantes(KYC_COMPLET, ['identite', 'rib'])).toEqual(['domicile']);
    expect(piecesManquantes(KYC_COMPLET, ['identite', 'domicile', 'rib'])).toEqual([]);
  });
});

describe('nationalité de l’Union européenne', () => {
  it.each(['Française', 'francais', 'ITALIENNE', 'Néerlandaise', 'Pays-Bas', 'franco-algérienne'])(
    '%s : oui',
    (nationalite) => expect(nationaliteUnionEuropeenne(nationalite)).toBe(true),
  );
  it.each(['Marocaine', 'Suisse', 'Américaine', 'Britannique'])('%s : non', (nationalite) =>
    expect(nationaliteUnionEuropeenne(nationalite)).toBe(false),
  );
});

describe('fichiers acceptés', () => {
  it('format reconnu au contenu : PDF, JPG, PNG', () => {
    expect(formatDuFichier(PDF)).toBe('application/pdf');
    expect(formatDuFichier(JPG)).toBe('image/jpeg');
    expect(formatDuFichier(PNG)).toBe('image/png');
    expect(formatDuFichier(Buffer.from('GIF89a'))).toBeNull();
    expect(formatDuFichier(Buffer.alloc(0))).toBeNull();
  });

  it('nom affiché sans chemin ni caractère de contrôle, sinon nom par défaut', () => {
    expect(nomFichierAffiche('C:\\docs\\rib.pdf', 'rib', 'application/pdf')).toBe('rib.pdf');
    expect(nomFichierAffiche('../a\u0000b.png', 'rib', 'image/png')).toBe('ab.png');
    expect(nomFichierAffiche(undefined, 'domicile', 'image/jpeg')).toBe('domicile.jpg');
    expect(nomFichierAffiche('x'.repeat(300), 'rib', 'image/png')).toHaveLength(200);
  });

  it('type de pièce connu, clé R2 par utilisateur et par pièce', () => {
    expect(typePiece('rib')).toBe('rib');
    expect(typePiece('photo')).toBeNull();
    expect(clePiece('u1', 'rib')).toBe('kyc/u1/rib');
  });
});
