import type { DossierATransmettre } from './message.js';

// Dossier à transmettre (données fictives), partagé par les tests : D-1041, 5 parts à
// 200 € en pleine propriété sur la SCPI TREU (scénario « publication » de l'US-12)
export function dossierExemple(surcharge: Partial<DossierATransmettre> = {}): DossierATransmettre {
  return {
    id: 1041,
    idMessage: '6f1c2b1e-0000-4000-8000-000000001041',
    codeScpi: 'TREU',
    nombreParts: 5,
    prixPart: 200,
    montant: 1000,
    type: 'pleine_propriete',
    demandeLe: new Date('2026-11-26T10:00:00Z'),
    email: 'investisseur@exemple.test',
    reponsesKyc: {
      civilite: 'Madame',
      nom: 'Martin',
      prenom: 'Claire',
      dateNaissance: '1980-04-02',
      lieuNaissance: 'Lyon',
      nationalite: 'Française',
      adresse: '1 rue de la Paix',
      codePostal: '75002',
      ville: 'Paris',
      pays: 'France',
      telephone: '0601020304',
      situationFamiliale: 'Mariée',
      profession: 'Ingénieure',
      categorie: 'Cadre',
      secteur: 'Industrie',
      origineFonds: ['Épargne', 'Héritage'],
      ppe: 'Non',
      residenceFiscale: 'France',
      usPerson: 'Non',
    },
    profil: {
      profil: 'Équilibré',
      score: 42,
      versionQuestionnaire: 'v1',
      valideLe: new Date('2026-11-20T09:00:00Z'),
    },
    pieces: [
      { type: 'identite', nomFichier: 'cni.pdf' },
      { type: 'domicile', nomFichier: 'facture.pdf' },
    ],
    ...surcharge,
  };
}
