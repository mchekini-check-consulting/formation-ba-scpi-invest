// Graphiques de la simulation (US-09, SCPI-258, règle 10), dans le style de la fiche SCPI
// (US-02) : mêmes cartes blanches, même camembert (fiche/Graphiques.jsx), même légende
// en pastilles avec jauge (classes fiche__parts). Revenus par SCPI : une barre « Brut » et
// une barre « Après fiscalité » par SCPI (demande BA, en plus de l'US). Les valeurs sont
// aussi écrites dans des listes lues par les lecteurs d'écran.
import { useState } from 'react';
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis } from 'recharts';
import { formaterPart } from '../fiche/donnees.js';
import { libellesSousBarre } from './repartitions.js';
import CarteSimulation from './CarteSimulation.jsx';
import { Camembert } from '../fiche/Graphiques.jsx';
import '../fiche/fiche.css';
import { formaterEuros, formaterMontantCalcule } from '../utils/format.js';

// Taille avant la première mesure de la page (et dans les tests, sans mise en page)
const TAILLE_INITIALE = { width: 520, height: 240 };

const POLICE = { fontFamily: 'Figtree, system-ui, sans-serif', fontSize: 11, fill: '#45506a' };
// Largeur moyenne d'un caractère à 11 px (un peu large, pour ne jamais déborder) et marge
// entre deux colonnes : nombre de caractères par ligne sous une barre
const LARGEUR_CARACTERE = 6;
const MARGE_COLONNE = 10;
const MARGES_GRAPHIQUE = 16; // gauche + droite du BarChart

export const COULEUR_BRUT = '#3d6ef0';
const ECART = 18; // entre la barre brut et la barre après fiscalité d'une SCPI
export const COULEUR_NET = '#14b8a6';

// Légende d'une répartition (comme ListeParts de la fiche) : pastille (point de couleur pour
// les secteurs), nom, part, jauge
export function Legende({ parts, etiquette }) {
  return (
    <ul className="fiche__parts" aria-label={etiquette}>
      {parts.map((p) => (
        <li key={p.nom}>
          <span className="fiche__part-texte">
            <span>
              {p.point && (
                <span
                  className="fiche__point"
                  style={{ background: p.couleur }}
                  aria-hidden="true"
                />
              )}
              {p.nom}
            </span>
            <strong>{formaterPart(p.part)}</strong>
          </span>
          <span className="fiche__jauge" aria-hidden="true">
            <span style={{ width: `${Math.min(p.part, 100)}%`, background: p.couleur }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

// Camembert de la fiche, même taille que sur la fiche
export function Disque({ parts }) {
  return (
    <div className="fiche__zone-carte">
      <Camembert parts={parts} />
    </div>
  );
}

// Carte des pays (dessin de la fiche US-02, sans étiquettes sur les pays, bulle au survol),
// sur toute la largeur du bloc
export function Carte({ parts, charger }) {
  return (
    <div className="fiche__zone-carte fiche__zone-carte--pays">
      <CarteSimulation pays={parts} charger={charger} />
    </div>
  );
}

export const PAS_DE_REVENU = 'Pas de revenu';

// Sous les barres : nom de la SCPI, et pour un démembrement ses années de revenus. Sans revenu pendant la durée de placement : « Pas de revenu » écrit juste
// au-dessus de l'axe, à la place des barres (vides).
function NomScpi({ x, y, payload, parCle, libelles }) {
  const barre = parCle.get(payload.value);
  if (!barre) return null;
  const { nom: lignes, mentions } = libelles.get(payload.value);
  return (
    <g>
      {barre.brut === 0 && (
        <text
          x={x}
          y={y - 14}
          textAnchor="middle"
          {...POLICE}
          fontSize={12}
          fontStyle="italic"
          fill="#8a93a6"
        >
          {PAS_DE_REVENU}
        </text>
      )}
      {lignes.map((texte, i) => (
        <text key={texte} x={x} y={y + 12 + i * 14} textAnchor="middle" {...POLICE}>
          {texte}
        </text>
      ))}
      {mentions.map((texte, i) => (
        <text
          key={texte}
          x={x}
          y={y + 12 + (lignes.length + i) * 14}
          textAnchor="middle"
          {...POLICE}
          fontStyle="italic"
          fill="#8a93a6"
        >
          {texte}
        </text>
      ))}
    </g>
  );
}

// Montant au-dessus d'une barre : en euros entiers (le détail est dans le tableau), sur
// une seule ligne, centré sur sa barre
function Etiquette({ x, y, width, value, couleur }) {
  if (value === null || value === undefined || value === 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fontFamily="Figtree, system-ui, sans-serif"
      fontSize={12}
      fontWeight={700}
      fill={couleur}
    >
      {formaterEuros(Math.round(value))}
    </text>
  );
}

// Barres verticales arrondies : brut et après fiscalité côte à côte pour chaque SCPI
// (après fiscalité absent tant que l'impôt n'est pas connu)
export function Barres({ barres }) {
  const avecNet = barres.every((b) => b.net !== null);
  const parCle = new Map(barres.map((b) => [b.cle, b]));
  // Largeur du graphique (mesurée), d'où celle de la colonne de chaque SCPI et le nombre de
  // caractères par ligne de ses libellés : ils ne débordent pas sur la colonne voisine
  const [largeur, setLargeur] = useState(TAILLE_INITIALE.width);
  const colonne = (largeur - MARGES_GRAPHIQUE) / barres.length;
  const caracteres = Math.max(8, Math.floor((colonne - MARGE_COLONNE) / LARGEUR_CARACTERE));
  const libelles = new Map(barres.map((b) => [b.cle, libellesSousBarre(b, caracteres)]));
  // Place sous l'axe : nom et mentions du démembrement, sur autant de lignes que nécessaire
  const dessous = Math.max(...[...libelles.values()].map((l) => l.nom.length + l.mentions.length));
  // Que des SCPI sans revenu : graphique bas (rien à dessiner au-dessus de l'axe)
  const hauteur = barres.every((b) => b.brut === 0) ? 80 + dessous * 14 : undefined;
  return (
    <>
      <div className="simulation__legende-barres" aria-hidden="true">
        <span>
          <span className="fiche__point" style={{ background: COULEUR_BRUT }} />
          Brut
        </span>
        {avecNet && (
          <span>
            <span className="fiche__point" style={{ background: COULEUR_NET }} />
            Après fiscalité
          </span>
        )}
      </div>
      <div
        className="simulation__graphique"
        style={hauteur ? { height: `${hauteur}px` } : undefined}
        aria-hidden="true"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={TAILLE_INITIALE}
          onResize={(w) => w > 0 && setLargeur(w)}
        >
          <BarChart
            data={barres}
            margin={{ top: 28, right: 8, bottom: dessous * 14 - 6, left: 8 }}
            barGap={ECART}
            barCategoryGap="22%"
          >
            <defs>
              <linearGradient id="simulation-brut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3d6ef0" />
                <stop offset="1" stopColor="#9b6dff" stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="simulation-net" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#14b8a6" />
                <stop offset="1" stopColor="#5eead4" stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="cle"
              interval={0}
              tickLine={false}
              axisLine={{ stroke: '#e3ddd1' }}
              tick={(props) => <NomScpi {...props} parCle={parCle} libelles={libelles} />}
            />
            <Bar
              dataKey="brut"
              fill="url(#simulation-brut)"
              radius={[8, 8, 0, 0]}
              maxBarSize={64}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="brut"
                content={(props) => <Etiquette {...props} couleur="#0e1a33" />}
              />
            </Bar>
            {avecNet && (
              <Bar
                dataKey="net"
                fill="url(#simulation-net)"
                radius={[8, 8, 0, 0]}
                maxBarSize={64}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="net"
                  content={(props) => <Etiquette {...props} couleur="#0f766e" />}
                />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only" aria-label="Revenus annuels par SCPI">
        {barres.map((b) => {
          const nom = b.mentions.length ? `${b.nom} — ${b.mentions.join(' ')}` : b.nom;
          if (b.brut === 0) {
            return <li key={b.cle}>{`${nom} : pas de revenu pendant la durée de placement`}</li>;
          }
          const net = b.net === null ? '' : `, ${formaterMontantCalcule(b.net)} après fiscalité`;
          return <li key={b.cle}>{`${nom} : ${formaterMontantCalcule(b.brut)} brut${net}`}</li>;
        })}
      </ul>
    </>
  );
}
