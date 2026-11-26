import { describe, expect, it } from 'vitest';
import { environnementDe, outilsDisponibles } from './environnement.js';

describe('environnement lu dans l’adresse appelée', () => {
  it.each([
    ['localhost', 'local'],
    ['127.0.0.1', 'local'],
    ['::1', 'local'],
    ['gateway.formation-ba-scpi-invest.dev.check-consulting.net', 'dev'],
    ['gateway.formation-ba-scpi-invest.prod.check-consulting.net', 'prod'],
    ['societe-gestion', null],
  ])('%s -> %s', (hostname, env) => {
    expect(environnementDe(hostname)).toBe(env);
  });

  it('outils ouverts en dev et en local seulement', () => {
    expect(outilsDisponibles('localhost')).toBe(true);
    expect(outilsDisponibles('gateway.formation-ba-scpi-invest.dev.check-consulting.net')).toBe(
      true,
    );
    expect(outilsDisponibles('gateway.formation-ba-scpi-invest.qualif.check-consulting.net')).toBe(
      false,
    );
    expect(outilsDisponibles('societe-gestion')).toBe(false);
  });
});
