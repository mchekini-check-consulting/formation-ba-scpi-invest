import { describe, expect, it } from 'vitest';
import { environnementDe, outilsDeTestVisibles } from './environnement.js';

const page = (env) => `frontend.formation-ba-scpi-invest.${env}.check-consulting.net`;

describe('environnement des outils de test', () => {
  it.each([
    [page('dev'), 'dev'],
    [page('qualif'), 'qualif'],
    [page('prod'), 'prod'],
    ['localhost', 'local'],
    ['127.0.0.1', 'local'],
    ['[::1]', 'local'],
    ['frontend', null],
  ])('%s -> %s', (hostname, env) => {
    expect(environnementDe(hostname)).toBe(env);
  });

  it('visibles en dev et sur le poste seulement', () => {
    expect(outilsDeTestVisibles(page('dev'))).toBe(true);
    expect(outilsDeTestVisibles('localhost')).toBe(true);
    expect(outilsDeTestVisibles(page('qualif'))).toBe(false);
    expect(outilsDeTestVisibles(page('preprod'))).toBe(false);
    expect(outilsDeTestVisibles(page('prod'))).toBe(false);
    expect(outilsDeTestVisibles('frontend')).toBe(false);
  });

  it('par défaut : l’adresse de la page (localhost dans les tests)', () => {
    expect(environnementDe()).toBe('local');
    expect(outilsDeTestVisibles()).toBe(true);
  });
});
