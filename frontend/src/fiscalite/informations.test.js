import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAMP_OBLIGATOIRE,
  ENTIER_INVALIDE,
  VIDE,
  effacerInformationsFiscales,
  enregistrerInformationsFiscales,
  formaterRevenu,
  lireInformationsFiscales,
  nombreParts,
  verifier,
  versFormulaire,
} from './informations.js';

const SAISIE = { revenuNetImposable: '40000', situationFamiliale: 'seul', nombreEnfants: '0' };

describe('règles de saisie (US-06, SCPI-255)', () => {
  it('saisie complète : nombres convertis, espaces de milliers acceptés', () => {
    expect(verifier({ ...SAISIE, revenuNetImposable: ' 40 000 ' })).toEqual({
      informations: { revenuNetImposable: 40000, situationFamiliale: 'seul', nombreEnfants: 0 },
    });
  });

  it('pas de plafond sur le revenu', () => {
    expect(verifier({ ...SAISIE, revenuNetImposable: '12000000000' }).informations).toMatchObject({
      revenuNetImposable: 12000000000,
    });
  });

  it('formulaire vide : revenu et situation obligatoires, enfants à 0 par défaut', () => {
    expect(VIDE.nombreEnfants).toBe('0');
    expect(verifier(VIDE)).toEqual({
      erreurs: {
        revenuNetImposable: CHAMP_OBLIGATOIRE,
        situationFamiliale: CHAMP_OBLIGATOIRE,
      },
    });
    expect(verifier({ ...SAISIE, nombreEnfants: ' ' })).toEqual({
      erreurs: { nombreEnfants: CHAMP_OBLIGATOIRE },
    });
  });

  it.each(['-1', '12,5', '1.5', 'abc', '1e3'])('« %s » refusé : entier positif ou nul', (texte) => {
    expect(verifier({ ...SAISIE, revenuNetImposable: texte, nombreEnfants: texte })).toEqual({
      erreurs: { revenuNetImposable: ENTIER_INVALIDE, nombreEnfants: ENTIER_INVALIDE },
    });
  });

  it('situation familiale inconnue : à choisir', () => {
    expect(verifier({ ...SAISIE, situationFamiliale: 'Marié(e)' })).toEqual({
      erreurs: { situationFamiliale: CHAMP_OBLIGATOIRE },
    });
  });

  it('versFormulaire : valeurs du backend en texte, null -> formulaire vide', () => {
    expect(
      versFormulaire({ revenuNetImposable: 40000, situationFamiliale: 'couple', nombreEnfants: 2 }),
    ).toMatchObject({ situationFamiliale: 'couple', nombreEnfants: '2' });
    expect(
      versFormulaire({
        revenuNetImposable: 40000,
        situationFamiliale: 'seul',
        nombreEnfants: 0,
      }).revenuNetImposable.replace(/\s/g, ' '),
    ).toBe('40 000');
    expect(versFormulaire(null)).toEqual(VIDE);
  });
});

describe('affichage', () => {
  it('formaterRevenu : espaces de milliers, texte invalide laissé tel quel', () => {
    expect(formaterRevenu('40000').replace(/\s/g, ' ')).toBe('40 000');
    expect(formaterRevenu(' 1 234 567 ').replace(/\s/g, ' ')).toBe('1 234 567');
    expect(formaterRevenu('12,5')).toBe('12,5');
    expect(formaterRevenu('')).toBe('');
  });

  it.each([
    ['seul', 0, 1],
    ['couple', 0, 2],
    ['seul', 1, 1.5],
    ['couple', 2, 3],
    ['couple', 3, 4],
    ['seul', 5, 5],
  ])('nombreParts : %s, %i enfant(s) -> %d part(s)', (situation, enfants, parts) => {
    expect(nombreParts(situation, enfants)).toBe(parts);
  });

  it('nombreParts : sans situation familiale -> null', () => {
    expect(nombreParts('', 2)).toBeNull();
  });
});

describe('API des informations fiscales', () => {
  let fetchMock;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('scpi-invest.session', 'jeton-1');
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(null),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lire : GET avec la session', async () => {
    expect(await lireInformationsFiscales('/api')).toBeNull();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/informations-fiscales');
    expect(options.method).toBe('GET');
    expect(options.headers).toEqual({ Authorization: 'Bearer jeton-1' });
  });

  it('enregistrer : PUT des trois valeurs', async () => {
    const informations = { revenuNetImposable: 1, situationFamiliale: 'seul', nombreEnfants: 0 };
    await enregistrerInformationsFiscales(informations, '/api');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/informations-fiscales');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual(informations);
  });

  it('effacer : DELETE, réponse 204 sans corps', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    expect(await effacerInformationsFiscales('/api')).toBeNull();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/informations-fiscales');
    expect(options.method).toBe('DELETE');
  });
});
