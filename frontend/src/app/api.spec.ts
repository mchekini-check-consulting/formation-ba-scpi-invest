import { apiBase } from './api';

describe('apiBase', () => {
  it('pointe la passerelle de l\'environnement du frontend', () => {
    expect(apiBase('frontend.formation-ba-scpi-invest.qualif.check-consulting.net')).toBe(
      'https://api.qualif.check-consulting.net/formation-ba-scpi-invest/backend',
    );
  });

  it('utilise le proxy du serveur de dev en local', () => {
    expect(apiBase('localhost')).toBe('/api');
  });
});
