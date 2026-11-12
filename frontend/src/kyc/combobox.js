// Attributs communs des champs avec liste de suggestions (adresse, ville) : modèle
// « combobox » des lecteurs d'écran (ChampAdresse.jsx, ChampVille.jsx, ListeSuggestions.jsx)

export const idOption = (idListe, i) => `${idListe}-${i}`;

export function attributsCombobox({ idListe, ouvert, position, invalide, decritPar }) {
  return {
    type: 'text',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': ouvert,
    'aria-controls': idListe,
    'aria-activedescendant': ouvert ? idOption(idListe, position) : undefined,
    'aria-invalid': invalide ? true : undefined,
    'aria-describedby': decritPar,
  };
}
