import { describe, expect, it } from 'vitest';
import { PHOTOS, photoScpi, photosPage } from './photos.js';

describe('photo d’illustration de chaque SCPI', () => {
  it('52 photos, toutes différentes', () => {
    expect(PHOTOS).toHaveLength(52);
    expect(new Set(PHOTOS).size).toBe(52);
  });

  it('une photo différente pour chacune des 52 premières SCPI, toujours la même', () => {
    const photos = Array.from({ length: 52 }, (_, i) => photoScpi(i + 1));
    expect(new Set(photos).size).toBe(52);
    expect(photoScpi(7)).toBe(photoScpi(7));
    expect(photoScpi(1)).toBe(PHOTOS[0]);
  });

  it('au-delà de 52 SCPI, les photos sont réutilisées dans le même ordre', () => {
    expect(photoScpi(53)).toBe(PHOTOS[0]);
    expect(photoScpi(104)).toBe(PHOTOS[51]);
  });

  it('sur une page, jamais deux fois la même photo', () => {
    // 1 et 53 tombent sur la même photo : la seconde prend la suivante
    const page = photosPage([{ id: 1 }, { id: 53 }, { id: 2 }]);
    expect(page.get(1)).toBe(PHOTOS[0]);
    expect(page.get(53)).toBe(PHOTOS[1]);
    expect(page.get(2)).toBe(PHOTOS[2]);
    const douze = photosPage(Array.from({ length: 12 }, (_, i) => ({ id: 43 + i * 52 })));
    expect(new Set(douze.values()).size).toBe(12);
  });

  it('identifiant absent ou invalide : une photo quand même', () => {
    for (const id of [undefined, null, 0, -3, 'x']) {
      expect(PHOTOS).toContain(photoScpi(id));
    }
  });
});
