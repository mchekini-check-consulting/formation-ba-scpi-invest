import { describe, expect, it } from 'vitest';
import { apiBase } from './api.js';

describe('apiBase', () => {
  it('en local : /api (relayé vers le backend)', () => {
    expect(apiBase('localhost')).toBe('/api');
    expect(apiBase('127.0.0.1')).toBe('/api');
  });

  it('sur le cluster : passerelle du projet, même environnement', () => {
    expect(apiBase('frontend.formation-ba-scpi-invest.dev.check-consulting.net')).toBe(
      'https://gateway.formation-ba-scpi-invest.dev.check-consulting.net/backend',
    );
    expect(apiBase('frontend.formation-ba-scpi-invest.qualif.check-consulting.net')).toBe(
      'https://gateway.formation-ba-scpi-invest.qualif.check-consulting.net/backend',
    );
  });

  it('par défaut : host de la page (localhost en test)', () => {
    expect(apiBase()).toBe('/api');
  });
});
