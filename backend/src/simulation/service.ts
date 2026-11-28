import { detaillerAction } from '../logging/logger.js';
import { loggable } from '../logging/service.js';

// US-08 (SCPI-257) : SCPI proposées dans la simulation, avec ce qu'il faut pour calculer
// le montant et les revenus d'une ligne (le calcul est fait par l'écran). Une donnée non
// renseignée reste null, jamais remplacée par 0.

// Durée de démembrement proposée (en années) et sa décote (en %)
export type Decote = { duree: number; decote: number };

// Part d'un pays ou d'un secteur dans le patrimoine de la SCPI, en %
export type Part = { libelle: string; part: number };

export type ScpiSimulable = {
  id: number;
  nom: string;
  // prix de part de l'année la plus récente, en euros
  prixPart: number | null;
  // dernier taux de distribution connu, en %
  tauxDistribution: number | null;
  // investissement minimum, en euros
  minimum: number | null;
  // en mois
  delaiJouissance: number | null;
  // démembrement autorisé (nue-propriété et usufruit proposés)
  demembrement: boolean | null;
  // durées de démembrement du référentiel, de la plus courte à la plus longue
  decotes: Decote[];
  // US-09 : répartitions géographique et sectorielle, de la plus forte à la plus faible
  // (vides sans répartition dans le référentiel)
  pays: Part[];
  secteurs: Part[];
};

// Ligne lue en base : la colonne « decote » du référentiel (CSV decote_demembrement) contient
// en réalité la part de la nue-propriété en % du prix (87 sur 3 ans, 52 sur 20 ans : elle
// baisse quand la durée s'allonge). Décision BA (SCPI-257) : décote = 100 − cette part.
export type LigneSimulable = Omit<ScpiSimulable, 'decotes'> & {
  decotes: { duree: number; partNuePropriete: number }[];
};

export type DepotSimulation = {
  // toutes les SCPI du catalogue, triées par nom
  lister(): Promise<LigneSimulable[]>;
};

// Couche service de la simulation (US-08)
export function creerSimulationService(depot: DepotSimulation) {
  async function lister(): Promise<ScpiSimulable[]> {
    const scpis = await depot.lister();
    detaillerAction({ resultats: scpis.length });
    return scpis.map((scpi) => ({
      ...scpi,
      decotes: [...scpi.decotes]
        .sort((a, b) => a.duree - b.duree)
        .map(({ duree, partNuePropriete }) => ({ duree, decote: 100 - partNuePropriete })),
    }));
  }

  return loggable('SimulationService', { lister });
}

export type SimulationService = ReturnType<typeof creerSimulationService>;
