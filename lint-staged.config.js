// Hook pre-commit (husky) : formatage des fichiers indexés, puis lint et tests unitaires
// du projet touché. Pas de tests d'intégration ici (Docker requis, lents) : la CI les lance.
export default {
  '*': 'prettier --write --ignore-unknown',
  'backend/**/*.ts': () => ['npm --prefix backend run lint', 'npm --prefix backend test'],
  'frontend/**/*.{js,jsx}': () => ['npm --prefix frontend run lint', 'npm --prefix frontend test'],
};
