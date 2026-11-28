// Cadre « Ma fiscalité » de l'écran Simuler (maquette de l'écran d'accueil), entre « Mes
// SCPI » et « Résultat » :
//   - sans informations fiscales : message, liste « Taux d'imposition estimé » (taux du
//     barème, 30 % par défaut, US-09 règle 8) et bouton vers « Mes informations fiscales » ;
//   - avec : rappel que l'impôt est calculé avec la TMI et le taux moyen du foyer (détaillés
//     dans le résultat), et lien pour les modifier.
// Rien tant que la première estimation n'est pas reçue (on ne sait pas encore si le foyer a
// renseigné ses informations).
import { formaterPart } from '../fiche/donnees.js';
import { LienInterne } from '../MiseEnPage.jsx';

export const MESSAGE_SANS_INFORMATIONS =
  'Informations fiscales non renseignées : l’impôt est estimé avec le taux que vous ' +
  'choisissez. Renseignez-les pour un calcul personnalisé (TMI, taux moyen).';

export const MESSAGE_AVEC_INFORMATIONS =
  'Informations fiscales renseignées : l’impôt est calculé avec votre TMI et votre taux ' +
  'moyen, détaillés dans le résultat.';

function IconeDocument() {
  return (
    <span className="simulation__icone-fiscalite" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v4h4" />
        <path d="M10 16.5l4-5M10.5 12h.01M13.5 16h.01" />
      </svg>
    </span>
  );
}

export default function MaFiscalite({ estimation, taux, choisirTaux }) {
  if (!estimation) return null;
  const avec = estimation.avecInformations;
  return (
    <section className="simulation__ma-fiscalite" aria-labelledby="simulation-ma-fiscalite">
      <IconeDocument />
      <div className="simulation__ma-fiscalite-texte">
        <h2 id="simulation-ma-fiscalite" className="simulation__titre">
          Ma fiscalité
        </h2>
        <p>{avec ? MESSAGE_AVEC_INFORMATIONS : MESSAGE_SANS_INFORMATIONS}</p>
      </div>
      <div className="simulation__ma-fiscalite-actions">
        {!avec && (
          <div className="simulation__champ">
            <label htmlFor="simulation-taux">Taux d’imposition estimé</label>
            <select
              id="simulation-taux"
              value={taux ?? estimation.tauxParDefaut}
              onChange={(e) => choisirTaux(Number(e.target.value))}
            >
              {estimation.tauxProposes.map((t) => (
                <option key={t} value={t}>
                  {formaterPart(t)}
                </option>
              ))}
            </select>
          </div>
        )}
        <LienInterne
          to="/fiscalite"
          className={`simulation__bouton${avec ? ' simulation__bouton--secondaire' : ''}`}
        >
          {avec ? 'Modifier mes informations fiscales' : 'Renseigner mes informations fiscales'}
        </LienInterne>
      </div>
    </section>
  );
}
