import { describe, expect, it } from 'vitest';
import { CHAMPS_KYC } from '../kyc/champs.js';
import { dossierExemple } from './exemple.js';
import { BLOCS_KYC, construireMessage } from './message.js';

describe('message du dossier (C3, scpi.souscription.dossier.v1)', () => {
  // US-12, scénario « publication »
  it('dossier D-1041 de 5 parts à 200 € en pleine propriété sur TREU', () => {
    expect(construireMessage(dossierExemple())).toMatchObject({
      idMessage: '6f1c2b1e-0000-4000-8000-000000001041',
      idDossier: 'D-1041',
      codeSCPI: 'TREU',
      nombreParts: 5,
      prixPart: 200,
      montant: 1000,
      typeInvestissement: 'PLEINE_PROPRIETE',
      modeInvestissement: 'PONCTUELLE',
      dateDemande: '2026-11-26T10:00:00.000Z',
    });
  });

  it('contient les données du KYC, le profil validé et la liste des justificatifs', () => {
    const { investisseur, justificatifs } = construireMessage(dossierExemple());
    expect(investisseur).toEqual({
      email: 'investisseur@exemple.test',
      identite: {
        civilite: 'Madame',
        nom: 'Martin',
        prenom: 'Claire',
        nomNaissance: null,
        dateNaissance: '1980-04-02',
        lieuNaissance: 'Lyon',
        nationalite: 'Française',
      },
      coordonnees: {
        adresse: '1 rue de la Paix',
        codePostal: '75002',
        ville: 'Paris',
        pays: 'France',
        telephone: '0601020304',
        indicatif: null,
      },
      situation: {
        situationFamiliale: 'Mariée',
        profession: 'Ingénieure',
        categorie: 'Cadre',
        secteur: 'Industrie',
      },
      declarations: {
        origineFonds: ['Épargne', 'Héritage'],
        ppe: 'Non',
        residenceFiscale: 'France',
        usPerson: 'Non',
      },
      profil: {
        profil: 'Équilibré',
        score: 42,
        versionQuestionnaire: 'v1',
        valideLe: '2026-11-20T09:00:00.000Z',
      },
    });
    expect(justificatifs).toEqual([
      { type: 'identite', nomFichier: 'cni.pdf' },
      { type: 'domicile', nomFichier: 'facture.pdf' },
    ]);
  });

  it.each([
    ['nue_propriete', 'NUE_PROPRIETE'],
    ['usufruit', 'USUFRUIT'],
  ] as const)('type %s -> %s', (type, attendu) => {
    expect(construireMessage(dossierExemple({ type })).typeInvestissement).toBe(attendu);
  });

  it('sans profil validé ni pièce : profil null, liste vide', () => {
    const message = construireMessage(dossierExemple({ profil: null, pieces: [] }));
    expect(message.investisseur.profil).toBeNull();
    expect(message.justificatifs).toEqual([]);
  });

  it('chaque champ du KYC est dans un et un seul bloc', () => {
    const ranges = Object.values(BLOCS_KYC).flat();
    expect([...ranges].sort()).toEqual(CHAMPS_KYC.map((c) => c.nom).sort());
  });
});
