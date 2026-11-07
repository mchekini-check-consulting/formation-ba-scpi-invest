import { describe, expect, it } from 'vitest';
import { environnementDe, outilsDisponibles } from './environnement.js';

describe('environnement des outils de test', () => {
  it.each([
    ['gateway.formation-ba-scpi-invest.dev.check-consulting.net', 'dev'],
    ['gateway.formation-ba-scpi-invest.qualif.check-consulting.net', 'qualif'],
    ['gateway.formation-ba-scpi-invest.prod.check-consulting.net', 'prod'],
    ['localhost', 'local'],
    ['127.0.0.1', 'local'],
    ['[::1]', 'local'],
    ['backend', null],
    ['backend.formation-ba-scpi-invest', null],
  ])('%s -> %s', (hostname, env) => {
    expect(environnementDe(hostname)).toBe(env);
  });

  it('ouverts en dev et en local seulement', () => {
    expect(outilsDisponibles('gateway.formation-ba-scpi-invest.dev.check-consulting.net')).toBe(
      true,
    );
    expect(outilsDisponibles('localhost')).toBe(true);
    expect(outilsDisponibles('gateway.formation-ba-scpi-invest.qualif.check-consulting.net')).toBe(
      false,
    );
    expect(outilsDisponibles('gateway.formation-ba-scpi-invest.preprod.check-consulting.net')).toBe(
      false,
    );
    expect(outilsDisponibles('gateway.formation-ba-scpi-invest.prod.check-consulting.net')).toBe(
      false,
    );
    expect(outilsDisponibles('backend')).toBe(false);
  });
});
