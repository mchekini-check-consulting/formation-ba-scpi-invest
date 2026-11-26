import type { ReponsesKyc } from '../db/schema.js';
import { numeroDossier, type TypeInvestissement } from '../demandes/service.js';

// US-12 (SCPI-260) : message publié sur scpi.souscription.dossier.v1 (contrat C3). Seuls les
// dossiers ponctuels passent par ce topic (le versement programmé a le sien).
// Contient des données personnelles : jamais dans les logs (RG5).

// Dossier à transmettre, avec ce qu'il faut lire en base pour le message (depotTransmission)
export type DossierATransmettre = {
  id: number;
  idMessage: string; // fixé à la création du dossier : identique à chaque tentative
  codeScpi: string;
  nombreParts: number;
  prixPart: number;
  montant: number;
  type: TypeInvestissement;
  demandeLe: Date;
  email: string;
  reponsesKyc: ReponsesKyc;
  // Profil investisseur validé le plus récent (formulaire investisseur) ; null si aucun
  profil: { profil: string; score: number; versionQuestionnaire: string; valideLe: Date } | null;
  // Pièces du KYC ; lien de téléchargement ajouté plus tard
  pieces: { type: string; nomFichier: string }[];
};

// Blocs du KYC dans le message, dans l'ordre des étapes du formulaire (src/kyc/champs.ts).
// Chaque champ du KYC doit être dans un bloc (vérifié par message.test.ts).
export const BLOCS_KYC = {
  identite: [
    'civilite',
    'nom',
    'prenom',
    'nomNaissance',
    'dateNaissance',
    'lieuNaissance',
    'nationalite',
  ],
  coordonnees: ['adresse', 'codePostal', 'ville', 'pays', 'telephone', 'indicatif'],
  situation: ['situationFamiliale', 'profession', 'categorie', 'secteur'],
  declarations: ['origineFonds', 'ppe', 'residenceFiscale', 'usPerson'],
} as const;

type Bloc = Record<string, string | string[] | null>;

const TYPES_C3: Record<TypeInvestissement, string> = {
  pleine_propriete: 'PLEINE_PROPRIETE',
  nue_propriete: 'NUE_PROPRIETE',
  usufruit: 'USUFRUIT',
};

// Champ absent (facultatif non rempli) : null, pour que la SCPI reçoive toujours les mêmes clés
function bloc(reponses: ReponsesKyc, champs: readonly string[]): Bloc {
  return Object.fromEntries(champs.map((champ) => [champ, reponses[champ] ?? null]));
}

export function construireMessage(dossier: DossierATransmettre) {
  const { reponsesKyc: kyc, profil } = dossier;
  return {
    idMessage: dossier.idMessage,
    idDossier: numeroDossier(dossier.id),
    codeSCPI: dossier.codeScpi,
    nombreParts: dossier.nombreParts,
    prixPart: dossier.prixPart,
    montant: dossier.montant,
    typeInvestissement: TYPES_C3[dossier.type],
    modeInvestissement: 'PONCTUELLE',
    dateDemande: dossier.demandeLe.toISOString(),
    investisseur: {
      email: dossier.email,
      identite: bloc(kyc, BLOCS_KYC.identite),
      coordonnees: bloc(kyc, BLOCS_KYC.coordonnees),
      situation: bloc(kyc, BLOCS_KYC.situation),
      declarations: bloc(kyc, BLOCS_KYC.declarations),
      profil: profil && {
        profil: profil.profil,
        score: profil.score,
        versionQuestionnaire: profil.versionQuestionnaire,
        valideLe: profil.valideLe.toISOString(),
      },
    },
    justificatifs: dossier.pieces.map((piece) => ({
      type: piece.type,
      nomFichier: piece.nomFichier,
    })),
  };
}

export type MessageDossier = ReturnType<typeof construireMessage>;
