import { describe, expect, it, vi } from 'vitest';
import { creerAdressesService } from './service.js';

const reponse = (corps: unknown, status = 200) =>
  ({ ok: status < 400, status, json: () => Promise.resolve(corps) }) as Response;

const LILAS = {
  label: '12 Rue des Lilas 69008 Lyon',
  name: '12 Rue des Lilas',
  postcode: '69008',
  city: 'Lyon',
};

describe('suggestions d’adresses', () => {
  it('interroge le service national et renvoie adresse, code postal et ville', async () => {
    const chercher = vi.fn().mockResolvedValue(reponse({ features: [{ properties: LILAS }] }));
    const service = creerAdressesService(chercher, 'https://geo.test');
    expect(await service.suggestions('  12 rue des lilas ')).toEqual([
      {
        libelle: '12 Rue des Lilas 69008 Lyon',
        adresse: '12 Rue des Lilas',
        codePostal: '69008',
        ville: 'Lyon',
      },
    ]);
    const url = new URL(chercher.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://geo.test/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: '12 rue des lilas',
      index: 'address',
      autocomplete: '1',
      limit: '5',
    });
  });

  it('moins de 3 caractères ou valeur absente : pas d’appel, liste vide', async () => {
    const chercher = vi.fn();
    const service = creerAdressesService(chercher);
    expect(await service.suggestions('12')).toEqual([]);
    expect(await service.suggestions(undefined)).toEqual([]);
    expect(await service.suggestions(['12 rue'])).toEqual([]);
    expect(chercher).not.toHaveBeenCalled();
  });

  it('suggestions incomplètes ou réponse inattendue : ignorées', async () => {
    const sansVille = { ...LILAS, city: '' };
    const chercher = vi
      .fn()
      .mockResolvedValueOnce(
        reponse({ features: [{ properties: sansVille }, {}, null, { properties: LILAS }] }),
      )
      .mockResolvedValueOnce(reponse({ inattendu: true }))
      .mockResolvedValueOnce(reponse(null));
    const service = creerAdressesService(chercher);
    expect((await service.suggestions('12 rue des lilas')).map((a) => a.ville)).toEqual(['Lyon']);
    expect(await service.suggestions('12 rue des lilas')).toEqual([]);
    expect(await service.suggestions('12 rue des lilas')).toEqual([]);
  });

  it('service en panne ou en erreur : liste vide pour l’écran, erreur pour le log', async () => {
    const chercher = vi
      .fn()
      .mockResolvedValueOnce(reponse({}, 503))
      .mockRejectedValueOnce(new Error('délai dépassé'))
      .mockResolvedValueOnce(reponse({}, 500));
    const service = creerAdressesService(chercher);
    expect(await service.suggestions('12 rue des lilas')).toEqual([]);
    expect(await service.suggestions('12 rue des lilas')).toEqual([]);
    await expect(service.rechercher('12 rue des lilas')).rejects.toThrow('réponse 500');
  });
});

describe('communes d’un code postal', () => {
  it('interroge le découpage administratif, noms sans doublon triés', async () => {
    const chercher = vi
      .fn()
      .mockResolvedValue(
        reponse([{ nom: 'Soulgé-sur-Ouette' }, { nom: 'Argentré' }, { nom: 'Argentré' }, {}]),
      );
    const service = creerAdressesService(chercher, 'https://geo.test', 'https://communes.test');
    expect(await service.communes(' 53210 ')).toEqual(['Argentré', 'Soulgé-sur-Ouette']);
    const url = new URL(chercher.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://communes.test/communes');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      codePostal: '53210',
      fields: 'nom',
      format: 'json',
    });
  });

  it('code postal pas à 5 chiffres : pas d’appel, liste vide', async () => {
    const chercher = vi.fn();
    const service = creerAdressesService(chercher);
    for (const code of ['6900', '690033', 'abcde', undefined]) {
      expect(await service.communes(code)).toEqual([]);
    }
    expect(chercher).not.toHaveBeenCalled();
  });

  it('service en erreur ou réponse illisible : liste vide', async () => {
    const enPanne = creerAdressesService(vi.fn().mockResolvedValue(reponse({}, 500)));
    expect(await enPanne.communes('69003')).toEqual([]);
    await expect(enPanne.rechercherCommunes('69003')).rejects.toThrow('réponse 500');
    const illisible = creerAdressesService(vi.fn().mockResolvedValue(reponse({ pas: 'liste' })));
    expect(await illisible.communes('69003')).toEqual([]);
  });
});
