import { HttpError } from '../logging/http-error.js';
import { loggable } from '../logging/service.js';

// US-11 « Saisir ma demande d'investissement » (SCPI-259) : l'investisseur connecté choisit
// un nombre de parts et un type d'investissement sur une SCPI ; « Valider ma demande » crée
// un dossier au statut « Demande envoyée » (table dossier_investissement, EN-02).
// Les contrôles de l'écran sont refaits ici, sans se fier à lui :
//   - nombre de parts : entier > 0 ;
//   - type : pleine propriété, nue-propriété ou usufruit ;
//   - montant = nombre de parts × prix de part ACTUEL de la SCPI (lu en base, jamais reçu) ;
//   - montant ≥ minimum à investir de la SCPI, sinon refus avec le message de l'écran ;
//   - KYC validé (statut « complété ») : sinon refus 403, même si l'écran a été contourné.
// Un investisseur ne lit que ses propres dossiers (sinon « Cette demande est introuvable. »).
// Données personnelles : jamais dans les logs (loggable ne journalise ni les arguments ni
// le retour ; les messages d'erreur ne reprennent que des données du catalogue).

export const TYPES_INVESTISSEMENT = ['pleine_propriete', 'nue_propriete', 'usufruit'] as const;
export type TypeInvestissement = (typeof TYPES_INVESTISSEMENT)[number];

export const STATUTS_DOSSIER = [
  'demande_envoyee',
  'demande_recue',
  'acceptee_attente_paiement',
  'refusee',
  'investissement_actif',
] as const;
export type StatutDossier = (typeof STATUTS_DOSSIER)[number];

// Conditions de la SCPI lues au moment de la demande (prix de part de l'année la plus
// récente ; null si non renseigné)
export type ConditionsScpi = {
  id: number;
  nom: string;
  prixPart: number | null;
  minimum: number | null;
};

export type NouveauDossier = {
  utilisateurId: string;
  scpiId: number;
  scpiNom: string;
  nombreParts: number;
  prixPart: number;
  montant: number;
  type: TypeInvestissement;
};

// Informations de suivi (US-16), remplies au fil du parcours (US-12 à 15)
export type SuiviDossier = {
  accuseReceptionLe: Date | null;
  motifRefus: string | null;
  ibanPaiement: string | null;
  bicPaiement: string | null;
  referenceVirement: string | null;
  jouissanceLe: string | null;
};

export type LigneDossier = Omit<NouveauDossier, 'utilisateurId'> &
  SuiviDossier & {
    id: number;
    gerant: string | null;
    statut: StatutDossier;
    demandeLe: Date;
  };

// Virement attendu pour un dossier accepté, en attente de paiement (US-16)
export type Paiement = {
  iban: string | null;
  bic: string | null;
  montant: number;
  reference: string | null;
};

// Dossier renvoyé à l'écran : numéro affiché « D-<id> », dates en ISO. US-16 (règle 3) :
// seules les informations utiles au statut sont renvoyées (paiement si accepté, motif si
// refusé, date de jouissance si actif) ; les autres restent à null.
export type Dossier = Omit<LigneDossier, keyof SuiviDossier | 'demandeLe'> & {
  numero: string;
  demandeLe: string;
  accuseReceptionLe: string | null;
  motifRefus: string | null;
  paiement: Paiement | null;
  jouissanceLe: string | null;
};

export type DepotDemandes = {
  // true si le KYC de cet utilisateur est validé (statut « complete »)
  kycComplet(utilisateurId: string): Promise<boolean>;
  // SCPI du catalogue ; null si elle n'existe pas (ou plus)
  conditions(scpiId: number): Promise<ConditionsScpi | null>;
  // Crée le dossier (statut demande_envoyee) et renvoie son identifiant
  creer(dossier: NouveauDossier): Promise<number>;
  // Dossier de cet utilisateur ; null s'il n'existe pas ou appartient à un autre
  lire(utilisateurId: string, id: number): Promise<LigneDossier | null>;
};

export const PARTS_INVALIDES = 'Saisissez un nombre entier de parts supérieur à 0.';
export const TYPE_INVALIDE =
  'Choisissez un type d’investissement : pleine propriété, nue-propriété ou usufruit.';
export const ERREUR_SAISIE = 'Merci de corriger les champs signalés.';
export const SCPI_INTROUVABLE = 'Cette SCPI n’est pas disponible';
export const PRIX_INCONNU =
  'Le prix de part de cette SCPI n’est pas connu : la demande ne peut pas être enregistrée.';
export const DEMANDE_INTROUVABLE = 'Cette demande est introuvable.';
export const KYC_NON_VALIDE = 'Votre KYC doit être validé avant de pouvoir investir.';

// Plus grand nombre de parts accepté (colonne integer de PostgreSQL)
const PARTS_MAX = 2_147_483_647;

// « 1 000 € », « 1 234,50 € » (espaces insécables, comme l'écran)
export function euros(montant: number): string {
  const texte = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: Number.isInteger(montant) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(montant);
  return `${texte} €`;
}

export function messageMinimum(minimum: number, prixPart: number): string {
  return `Le minimum à investir pour cette SCPI est de ${euros(minimum)}, soit ${Math.ceil(minimum / prixPart)} parts.`;
}

// Entier > 0, reçu en nombre ou en texte de chiffres (« 5 ») ; null sinon
export function entierStrictementPositif(valeur: unknown, max = PARTS_MAX): number | null {
  const nombre =
    typeof valeur === 'string' && /^\d+$/.test(valeur.trim()) ? Number(valeur.trim()) : valeur;
  return typeof nombre === 'number' && Number.isSafeInteger(nombre) && nombre > 0 && nombre <= max
    ? nombre
    : null;
}

type Saisie = { scpiId: number; nombreParts: number; type: TypeInvestissement };
export type Erreurs = Partial<Record<'scpiId' | 'nombreParts' | 'type', string>>;

// Contrôle de la saisie : valeurs nettoyées, ou message par champ en erreur
export function verifier(
  saisie: Record<string, unknown>,
): { saisie: Saisie } | { erreurs: Erreurs } {
  const erreurs: Erreurs = {};
  const scpiId = entierStrictementPositif(saisie.scpiId);
  if (scpiId === null) erreurs.scpiId = SCPI_INTROUVABLE;
  const nombreParts = entierStrictementPositif(saisie.nombreParts);
  if (nombreParts === null) erreurs.nombreParts = PARTS_INVALIDES;
  const type = saisie.type as TypeInvestissement;
  if (!TYPES_INVESTISSEMENT.includes(type)) erreurs.type = TYPE_INVALIDE;
  if (scpiId === null || nombreParts === null || Object.keys(erreurs).length > 0) {
    return { erreurs };
  }
  return { saisie: { scpiId, nombreParts, type } };
}

// Numéro du dossier vu par l'investisseur et envoyé à la SCPI partenaire (US-12 : idDossier)
export function numeroDossier(id: number): string {
  return `D-${id}`;
}

export function versDossier(ligne: LigneDossier): Dossier {
  const {
    accuseReceptionLe,
    motifRefus,
    ibanPaiement,
    bicPaiement,
    referenceVirement,
    jouissanceLe,
    ...dossier
  } = ligne;
  return {
    ...dossier,
    numero: numeroDossier(ligne.id),
    demandeLe: ligne.demandeLe.toISOString(),
    accuseReceptionLe: accuseReceptionLe?.toISOString() ?? null,
    motifRefus: ligne.statut === 'refusee' ? motifRefus : null,
    paiement:
      ligne.statut === 'acceptee_attente_paiement'
        ? {
            iban: ibanPaiement,
            bic: bicPaiement,
            montant: ligne.montant,
            reference: referenceVirement,
          }
        : null,
    jouissanceLe: ligne.statut === 'investissement_actif' ? jouissanceLe : null,
  };
}

// Couche service des demandes d'investissement (US-11)
export function creerDemandesService(depot: DepotDemandes) {
  // 400 { message, erreurs: { <champ>: message } } si la saisie est invalide ou le minimum
  // non atteint ; 403 si le KYC n'est pas validé ; 404 si la SCPI n'existe pas ; 422 si
  // son prix de part est inconnu
  async function creer(utilisateurId: string, brut: Record<string, unknown>): Promise<Dossier> {
    if (!(await depot.kycComplet(utilisateurId))) throw new HttpError(403, KYC_NON_VALIDE);
    const resultat = verifier(brut);
    if ('erreurs' in resultat) {
      throw new HttpError(400, ERREUR_SAISIE, { erreurs: resultat.erreurs });
    }
    const { scpiId, nombreParts, type } = resultat.saisie;
    const scpi = await depot.conditions(scpiId);
    if (!scpi) throw new HttpError(404, SCPI_INTROUVABLE);
    if (scpi.prixPart === null || scpi.prixPart <= 0) throw new HttpError(422, PRIX_INCONNU);

    const montant = Math.round(nombreParts * scpi.prixPart * 100) / 100;
    if (scpi.minimum !== null && montant < scpi.minimum) {
      const message = messageMinimum(scpi.minimum, scpi.prixPart);
      throw new HttpError(400, message, { erreurs: { nombreParts: message } });
    }

    const nouveau: NouveauDossier = {
      utilisateurId,
      scpiId: scpi.id,
      scpiNom: scpi.nom,
      nombreParts,
      prixPart: scpi.prixPart,
      montant,
      type,
    };
    const id = await depot.creer(nouveau);
    const ligne = await depot.lire(utilisateurId, id);
    if (!ligne) throw new Error('Dossier créé introuvable');
    return versDossier(ligne);
  }

  // 404 « Cette demande est introuvable. » : numéro invalide, inexistant ou d'un autre
  // investisseur (on ne dit jamais lequel)
  async function lire(utilisateurId: string, brut: unknown): Promise<Dossier> {
    const id = entierStrictementPositif(brut, Number.MAX_SAFE_INTEGER);
    const ligne = id === null ? null : await depot.lire(utilisateurId, id);
    if (!ligne) throw new HttpError(404, DEMANDE_INTROUVABLE);
    return versDossier(ligne);
  }

  return loggable('DemandesService', { creer, lire });
}

export type DemandesService = ReturnType<typeof creerDemandesService>;
