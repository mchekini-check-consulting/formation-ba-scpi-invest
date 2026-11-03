// Mise en page commune des pages légales du pied de page (US-01b) : mentions légales,
// CGU, politique de confidentialité, contact. Texte repris tel quel des documents
// joints au ticket Jira SCPI-29.
import { useEffect } from 'react';
import PageCompte from '../PageCompte.jsx';
import './legal.css';

export default function PageLegale({ titre, sections, miseAJour }) {
  useEffect(() => {
    document.title = `SCPI Invest+ · ${titre}`;
  }, [titre]);

  return (
    <PageCompte titre={titre} large>
      <div className="legal">
        {sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titre`}>
            <h2 id={`${s.id}-titre`}>{s.titre}</h2>
            {s.contenu}
          </section>
        ))}
        {miseAJour && (
          <p className="legal__maj">
            <em>Dernière mise à jour : {miseAJour}</em>
          </p>
        )}
        <p className="legal__retour">
          <a href="/">Retour à l’accueil</a>
        </p>
      </div>
    </PageCompte>
  );
}

// Lien vers un site extérieur, ouvert dans un nouvel onglet
export function Externe({ site }) {
  return (
    <a href={`https://${site}`} target="_blank" rel="noopener noreferrer">
      {site}
    </a>
  );
}

// Adresse e-mail cliquable
export function Email({ adresse }) {
  return <a href={`mailto:${adresse}`}>{adresse}</a>;
}

export function Tableau({ entetes, lignes }) {
  return (
    <div className="legal__tableau">
      <table>
        <thead>
          <tr>
            {entetes.map((e) => (
              <th key={e} scope="col">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, i) => (
            <tr key={i}>
              {ligne.map((cellule, j) => (
                <td key={j}>{cellule}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
