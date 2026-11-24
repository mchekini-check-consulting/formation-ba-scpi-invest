// Graphiques de la fiche SCPI (US-02), avec Recharts : taux de distribution (tiges et
// pastilles, dernière année mise en avant), prix de part (courbe et aire), secteurs
// (camembert). Les valeurs sont aussi écrites dans une liste lue par les lecteurs d'écran.
import {
  Area,
  AreaChart,
  Bar,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { echelleTaux, formaterPart, texteTaux, textePrix } from './donnees.js';

// Taille avant la première mesure de la page (et dans les tests, sans mise en page)
const TAILLE_INITIALE = { width: 560, height: 210 };

const POLICE = { fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 11, fill: '#45506a' };

// Valeurs du graphique pour les lecteurs d'écran
function ValeursLues({ valeurs, texte }) {
  return (
    <ul className="sr-only">
      {valeurs.map((v) => (
        <li key={v.annee}>
          {v.annee} : {texte(v)}
        </li>
      ))}
    </ul>
  );
}

function PastilleTaux({ cx, cy, index, nombre }) {
  if (cx == null || cy == null) return null;
  const derniere = index === nombre - 1;
  return (
    <g>
      {derniere && <circle cx={cx} cy={cy} r={20} fill="#ec4899" opacity={0.16} />}
      <circle
        cx={cx}
        cy={cy}
        r={derniere ? 13 : 11}
        fill={derniere ? 'url(#fiche-taux-derniere)' : 'url(#fiche-taux-pastille)'}
        stroke="#fff"
        strokeWidth={3}
      />
    </g>
  );
}

function EtiquetteTaux({ x, y, value, index, nombre }) {
  const derniere = index === nombre - 1;
  return (
    <text
      x={x}
      y={y - (derniere ? 24 : 20)}
      textAnchor="middle"
      fontFamily="Figtree, system-ui, sans-serif"
      fontSize={derniere ? 14 : 12.5}
      fontWeight={derniere ? 800 : 700}
      fill={derniere ? '#9d174d' : '#0f766e'}
    >
      {texteTaux({ valeur: value })}
    </text>
  );
}

export function GraphTaux({ valeurs }) {
  const { domaine, graduations } = echelleTaux(valeurs);
  const nombre = valeurs.length;
  return (
    <>
      <div className="fiche__graphique" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" initialDimension={TAILLE_INITIALE}>
          <ComposedChart data={valeurs} margin={{ top: 34, right: 20, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="fiche-taux-tige" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#5eead4" stopOpacity={0.2} />
                <stop offset="1" stopColor="#14b8a6" />
              </linearGradient>
              <linearGradient id="fiche-taux-pastille" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2dd4bf" />
                <stop offset="1" stopColor="#0ea5e9" />
              </linearGradient>
              <linearGradient id="fiche-taux-derniere" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#a855f7" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="annee"
              tickLine={false}
              axisLine={{ stroke: '#c9d8e3' }}
              tick={POLICE}
            />
            <YAxis
              domain={domaine}
              ticks={graduations}
              allowDataOverflow
              width={46}
              tickLine={false}
              axisLine={false}
              tick={POLICE}
              tickFormatter={(t) => `${String(t.toFixed(1)).replace('.', ',')} %`}
            />
            <Bar
              dataKey="valeur"
              barSize={10}
              radius={5}
              fill="url(#fiche-taux-tige)"
              isAnimationActive={false}
            />
            <Line
              dataKey="valeur"
              stroke="#a78bfa"
              strokeWidth={2}
              strokeDasharray="2 6"
              strokeLinecap="round"
              isAnimationActive={false}
              dot={(props) => <PastilleTaux key={props.index} {...props} nombre={nombre} />}
              activeDot={false}
            >
              <LabelList
                dataKey="valeur"
                content={(props) => <EtiquetteTaux {...props} nombre={nombre} />}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ValeursLues valeurs={valeurs} texte={texteTaux} />
    </>
  );
}

export function GraphPrix({ valeurs }) {
  const prix = valeurs.map((v) => v.valeur);
  const ecart = Math.max(Math.max(...prix) - Math.min(...prix), 4);
  const domaine = [Math.min(...prix) - ecart, Math.max(...prix) + ecart * 0.6];
  const nombre = valeurs.length;
  return (
    <>
      <div className="fiche__graphique" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" initialDimension={TAILLE_INITIALE}>
          <AreaChart data={valeurs} margin={{ top: 30, right: 24, bottom: 4, left: 24 }}>
            <defs>
              <linearGradient id="fiche-prix-aire" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3d6ef0" stopOpacity={0.45} />
                <stop offset="1" stopColor="#9b6dff" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="fiche-prix-trait" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#9b6dff" />
                <stop offset="1" stopColor="#3d6ef0" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="annee"
              tickLine={false}
              axisLine={{ stroke: '#e3ddd1' }}
              tick={POLICE}
            />
            <YAxis hide domain={domaine} />
            <Area
              dataKey="valeur"
              type="linear"
              stroke="url(#fiche-prix-trait)"
              strokeWidth={4}
              fill="url(#fiche-prix-aire)"
              isAnimationActive={false}
              activeDot={false}
              dot={({ cx, cy, index }) =>
                index === nombre - 1 ? (
                  <g key={index}>
                    <circle cx={cx} cy={cy} r={10} fill="#3d6ef0" opacity={0.25} />
                    <circle cx={cx} cy={cy} r={6} fill="#3d6ef0" stroke="#fff" strokeWidth={2} />
                  </g>
                ) : (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={4.5}
                    fill="#fff"
                    stroke="#3d6ef0"
                    strokeWidth={2.5}
                  />
                )
              }
            >
              <LabelList
                dataKey="valeur"
                content={({ x, y, value, index }) => (
                  <text
                    x={x}
                    y={y - 13}
                    textAnchor="middle"
                    fontFamily="Figtree, system-ui, sans-serif"
                    fontSize={11.5}
                    fontWeight={index === nombre - 1 ? 800 : 400}
                    fill={index === nombre - 1 ? '#0e1a33' : '#45506a'}
                  >
                    {textePrix({ valeur: value })}
                  </text>
                )}
              />
            </Area>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ValeursLues valeurs={valeurs} texte={textePrix} />
    </>
  );
}

// Étiquette d'une part du camembert, dans la part (plus près du bord pour une petite part)
function EtiquettePart({ cx, cy, midAngle, outerRadius, value }) {
  const rayon = outerRadius * (value < 15 ? 0.72 : 0.5);
  const angle = (-midAngle * Math.PI) / 180;
  return (
    <text
      x={cx + rayon * Math.cos(angle)}
      y={cy + rayon * Math.sin(angle)}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="Figtree, system-ui, sans-serif"
      fontSize={value < 15 ? 14 : 22}
      fontWeight={700}
      fill="#fff"
    >
      {value >= 4 ? formaterPart(value) : ''}
    </text>
  );
}

export function Camembert({ parts }) {
  return (
    <div className="fiche__camembert" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%" initialDimension={TAILLE_INITIALE}>
        <PieChart>
          <Pie
            data={parts}
            dataKey="part"
            nameKey="nom"
            startAngle={90}
            endAngle={-270}
            outerRadius="92%"
            stroke="#fff"
            strokeWidth={3}
            isAnimationActive={false}
            labelLine={false}
            label={EtiquettePart}
          >
            {parts.map((p) => (
              <Cell key={p.nom} fill={p.couleur} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
