import { useState } from 'react';
import { formatDuree, formatEuros, formatPourcent, simuler } from './simulation';

// Curseurs du simulateur : valeur de départ, bornes et affichage de chaque hypothèse
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
    <div className="flex flex-col gap-7 bg-white p-6 md:p-8 border border-bord rounded-3xl min-w-0 basis-[560px] grow">
      <div className="flex flex-col gap-5">
        {CURSEURS.map(({ cle, libelle, min, max, pas, format }) => (
          <div key={cle} className="flex flex-col gap-2">
            <div className="flex justify-between gap-3 font-semibold">
              <label htmlFor={`sim-${cle}`}>{libelle}</label>
              <span className="font-titre">{format(hypotheses[cle])}</span>
            </div>
            <input
              id={`sim-${cle}`}
              type="range"
              min={min}
              max={max}
              step={pas}
              value={hypotheses[cle]}
              onChange={regler(cle)}
              className="m-0 w-full h-7 accent-vert"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3.5" aria-live="polite">
        <Resultat libelle="Capital réellement investi" valeur={formatEuros(net)} />
        <Resultat libelle="Revenus bruts / mois" valeur={formatEuros(mensuel)} />
        <Resultat
          libelle={`Revenus cumulés sur ${formatDuree(hypotheses.duree)}`}
          valeur={formatEuros(cumul)}
          sombre
        />
      </div>
    </div>
  );
}

function Resultat({ libelle, valeur, sombre = false }) {
  return (
    <div
      className={`flex flex-col gap-1 p-4.5 rounded-2xl min-w-0 text-sm basis-[150px] grow ${
        sombre ? 'bg-encre text-slate-300' : 'bg-fond text-texte'
      }`}
    >
      <span>{libelle}</span>
      <output className={`font-titre font-semibold text-2xl ${sombre ? 'text-menthe' : 'text-encre'}`}>
        {valeur}
      </output>
    </div>
  );
}

export default Simulateur;
