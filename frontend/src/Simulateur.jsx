import { useState } from 'react';
import './Simulateur.css';
import { formatDuree, formatEuros, formatPourcent, simuler } from './simulation';

// Curseurs du simulateur : bornes et affichage de chaque hypothèse
const CURSEURS = [
  { cle: 'montant', libelle: 'Montant investi', min: 1000, max: 200000, pas: 1000, format: formatEuros },
  { cle: 'taux', libelle: 'Taux de distribution (hypothèse)', min: 2, max: 8, pas: 0.1, format: formatPourcent },
  { cle: 'frais', libelle: 'Frais de souscription', min: 0, max: 12, pas: 0.5, format: formatPourcent },
  { cle: 'duree', libelle: 'Durée de détention', min: 1, max: 25, pas: 1, format: formatDuree },
];

const DEPART = { montant: 20000, taux: 4.5, frais: 10, duree: 10 };

function Simulateur() {
  const [hypotheses, setHypotheses] = useState(DEPART);
  const { net, mensuel, cumul } = simuler(hypotheses);

  const regler = (cle) => (event) =>
    setHypotheses((avant) => ({ ...avant, [cle]: Number(event.target.value) }));

  return (
    <div className="simulateur">
      <div className="simulateur__curseurs">
        {CURSEURS.map(({ cle, libelle, min, max, pas, format }) => (
          <div key={cle} className="simulateur__curseur">
            <div className="simulateur__entete">
              <label htmlFor={`sim-${cle}`}>{libelle}</label>
              <span>{format(hypotheses[cle])}</span>
            </div>
            <input
              id={`sim-${cle}`}
              type="range"
              min={min}
              max={max}
              step={pas}
              value={hypotheses[cle]}
              onChange={regler(cle)}
            />
          </div>
        ))}
      </div>
      <div className="simulateur__resultats" aria-live="polite">
        <Resultat libelle="Capital réellement investi" valeur={formatEuros(net)} />
        <Resultat libelle="Revenus bruts / mois" valeur={formatEuros(mensuel)} />
        <Resultat
          libelle={`Revenus cumulés sur ${formatDuree(hypotheses.duree)}`}
          valeur={formatEuros(cumul)}
          fonce
        />
      </div>
    </div>
  );
}

function Resultat({ libelle, valeur, fonce = false }) {
  return (
    <div className={`simulateur__resultat${fonce ? ' simulateur__resultat--fonce' : ''}`}>
      <span>{libelle}</span>
      <output>{valeur}</output>
    </div>
  );
}

export default Simulateur;
