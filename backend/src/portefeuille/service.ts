import { detaillerAction } from '../logging/logger.js';
import { loggable } from '../logging/service.js';
import {
  numeroDossier,
  type StatutDossier,
  type TypeInvestissement,
} from '../demandes/service.js';

// US-20 « Consulter la liste de mes investissements » (SCPI-267), bloc « Mes
// investissements » du portefeuille : les dossiers de l'investisseur connecté, regroupés par
// SCPI.
//   Règle 1 : une ligne par SCPI (nom, société de gestion, nombre de dossiers, montant
//     investi, nombre de parts, revenus mensuels) ; les trois derniers ne comptent que les
//     investissements actifs.
//   Règle 2 : SCPI triées par montant investi décroissant.
//   Règle 3 : dossiers de chaque SCPI, tous statuts confondus, du plus récent au plus ancien,
//     avec selon le statut la date de jouissance, la référence de virement ou le motif de refus.
// Revenu mensuel estimé d'un dossier (C6, choix du BA) = montant × dernier taux de
// distribution de la SCPI ÷ 12, s'il produit un revenu ce mois-ci (règle commune de l'epic
// SCPI-247) : actif, pas en nue-propriété, jouissance au plus tard le 1er du mois en cours.
// Un investisseur ne voit que ses propres dossiers (EN-02 règle 3, assuré par le dépôt).
// Données personnelles : jamais dans les logs (loggable ne journalise ni arguments ni retour).

export type LigneInvestissement = {
  id: number;
  scpiId: number;
  scpiNom: string;
  gerant: string | null; // null : SCPI retirée du catalogue depuis la demande
  nombreParts: number;
  montant: number;
  type: TypeInvestissement;
  mode: 'ponctuel' | 'programme';
  statut: StatutDossier;
  demandeLe: Date;
  jouissanceLe: string | null; // AAAA-MM-JJ
  referenceVirement: string | null;
  motifRefus: string | null;
  // dernier taux de distribution connu de la SCPI, en % ; null si inconnu
  tauxDistribution: number | null;
};

export type DossierPortefeuille = {
  id: number;
  numero: string;
  demandeLe: string;
  mode: 'ponctuel' | 'programme';
  type: TypeInvestissement;
  nombreParts: number;
  montant: number;
  statut: StatutDossier;
  jouissanceLe: string | null;
  referenceVirement: string | null;
  motifRefus: string | null;
};

export type ScpiPortefeuille = {
  scpiId: number;
  scpiNom: string;
  gerant: string | null;
  nombreDossiers: number;
  montantInvesti: number;
  nombreParts: number;
  revenusMensuels: number;
  dossiers: DossierPortefeuille[];
};

export type Portefeuille = { scpis: ScpiPortefeuille[] };

export type DepotPortefeuille = {
  // Tous les dossiers de cet investisseur (et seulement les siens)
  investissements(utilisateurId: string): Promise<LigneInvestissement[]>;
};

const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;

// « 2026-11-01 » : premier jour du mois de la date donnée (heure de Paris)
export function premierDuMois(aujourdHui: Date): string {
  const [annee, mois] = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
    .format(aujourdHui)
    .split('-');
  return `${annee}-${mois}-01`;
}

// Revenu mensuel estimé d'un dossier ce mois-ci (0 s'il n'en produit pas)
export function revenuMensuel(ligne: LigneInvestissement, aujourdHui: Date): number {
  const produit =
    ligne.statut === 'investissement_actif' &&
    ligne.type !== 'nue_propriete' &&
    ligne.jouissanceLe !== null &&
    ligne.jouissanceLe <= premierDuMois(aujourdHui) &&
    ligne.tauxDistribution !== null;
  return produit ? (ligne.montant * (ligne.tauxDistribution as number)) / 100 / 12 : 0;
}

// Informations affichées selon le statut (comme le suivi, US-16 règle 3)
function versDossier(ligne: LigneInvestissement): DossierPortefeuille {
  return {
    id: ligne.id,
    numero: numeroDossier(ligne.id),
    demandeLe: ligne.demandeLe.toISOString(),
    mode: ligne.mode,
    type: ligne.type,
    nombreParts: ligne.nombreParts,
    montant: ligne.montant,
    statut: ligne.statut,
    jouissanceLe: ligne.statut === 'investissement_actif' ? ligne.jouissanceLe : null,
    referenceVirement:
      ligne.statut === 'acceptee_attente_paiement' ? ligne.referenceVirement : null,
    motifRefus: ligne.statut === 'refusee' ? ligne.motifRefus : null,
  };
}

const plusRecentDAbord = (a: LigneInvestissement, b: LigneInvestissement) =>
  b.demandeLe.getTime() - a.demandeLe.getTime() || b.id - a.id;

export function regrouper(lignes: LigneInvestissement[], aujourdHui: Date): Portefeuille {
  const parScpi = new Map<number, LigneInvestissement[]>();
  for (const ligne of [...lignes].sort(plusRecentDAbord)) {
    const groupe = parScpi.get(ligne.scpiId) ?? [];
    groupe.push(ligne);
    parScpi.set(ligne.scpiId, groupe);
  }

  const scpis = [...parScpi.values()].map((groupe): ScpiPortefeuille => {
    const actifs = groupe.filter((l) => l.statut === 'investissement_actif');
    // Nom et société de gestion : ceux du dossier le plus récent
    const [recent] = groupe;
    return {
      scpiId: recent.scpiId,
      scpiNom: recent.scpiNom,
      gerant: recent.gerant,
      nombreDossiers: groupe.length,
      montantInvesti: arrondi(actifs.reduce((total, l) => total + l.montant, 0)),
      nombreParts: actifs.reduce((total, l) => total + l.nombreParts, 0),
      revenusMensuels: arrondi(actifs.reduce((total, l) => total + revenuMensuel(l, aujourdHui), 0)),
      dossiers: groupe.map(versDossier),
    };
  });

  scpis.sort(
    (a, b) => b.montantInvesti - a.montantInvesti || a.scpiNom.localeCompare(b.scpiNom, 'fr'),
  );
  return { scpis };
}

// Couche service du portefeuille (US-20)
export function creerPortefeuilleService(
  depot: DepotPortefeuille,
  maintenant: () => Date = () => new Date(),
) {
  async function lister(utilisateurId: string): Promise<Portefeuille> {
    const lignes = await depot.investissements(utilisateurId);
    const portefeuille = regrouper(lignes, maintenant());
    // Logs métier (choix du BA) : comptages seulement, écrits sur la ligne de la requête
    // (layer controller) ; jamais les montants ni les noms (données financières personnelles)
    detaillerAction({
      nombreScpis: portefeuille.scpis.length,
      nombreDossiers: lignes.length,
      nombreActifs: lignes.filter((l) => l.statut === 'investissement_actif').length,
    });
    return portefeuille;
  }

  return loggable('PortefeuilleService', { lister });
}

export type PortefeuilleService = ReturnType<typeof creerPortefeuilleService>;
