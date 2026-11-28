import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chargerMonde } from '../fiche/carte.js';
import CarteSimulation from './CarteSimulation.jsx';

afterEach(cleanup);

const monde = await chargerMonde();

const PAYS = [
  { iso: 250, nom: 'France', part: 70.92, couleur: '#5b3fd9' },
  { iso: 276, nom: 'Allemagne', part: 11.02, couleur: '#4a7ae0' },
];

async function afficher(charger = () => Promise.resolve(monde)) {
  await act(async () => {
    render(<CarteSimulation pays={PAYS} charger={charger} />);
  });
}

const pays = (iso) => document.querySelector(`.simulation__pays[data-iso="${iso}"]`);
const bulle = () => document.querySelector('.simulation__bulle-carte');
const texte = (element) => element.textContent.replace(/\s/g, ' ');

describe('Carte des pays de la simulation', () => {
  it('pays en couleur, sans étiquette posée sur la carte', async () => {
    await afficher();
    expect(pays(250).getAttribute('fill')).toBe('#5b3fd9');
    expect(pays(276).getAttribute('fill')).toBe('#4a7ae0');
    expect(document.querySelectorAll('svg text')).toHaveLength(0);
    expect(bulle()).toBeNull();
    // Décorative : les parts sont dans la légende sous la carte
    expect(document.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('survol : bulle avec le nom et la part, pays souligné ; quitter la carte : plus de bulle', async () => {
    await afficher();
    fireEvent.pointerOver(pays(250));
    expect(texte(bulle())).toBe('France · 70,92 %');
    expect(pays(250).getAttribute('stroke')).toBe('#0f1f45');
    expect(pays(276).getAttribute('stroke')).toBe('#ffffff');
    fireEvent.pointerOver(pays(276));
    expect(texte(bulle())).toBe('Allemagne · 11,02 %');
    fireEvent.pointerOut(document.querySelector('svg'), { relatedTarget: document.body });
    expect(bulle()).toBeNull();
  });

  it('toucher (mobile) : bulle du pays touché ; toucher la mer : plus de bulle', async () => {
    await afficher();
    fireEvent.click(pays(276));
    expect(texte(bulle())).toBe('Allemagne · 11,02 %');
    fireEvent.click(document.querySelector('svg > rect'));
    expect(bulle()).toBeNull();
  });

  it('contours indisponibles : pas de carte', async () => {
    await afficher(vi.fn().mockRejectedValue(new Error('réseau')));
    expect(document.querySelector('svg')).toBeNull();
  });
});
