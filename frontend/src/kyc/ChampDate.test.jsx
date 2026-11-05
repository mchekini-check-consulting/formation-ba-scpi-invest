import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChampDate from './ChampDate.jsx';
import { isoVersTexte, masquer, texteVersIso } from './dates.js';

afterEach(cleanup);

const AUJOURDHUI = new Date(2026, 10, 4); // 4 novembre 2026

// Champ piloté comme dans le formulaire : la valeur suit ce que le champ transmet
function afficher(valeurInitiale = '') {
  const changer = vi.fn();
  function Banc() {
    const [valeur, setValeur] = useState(valeurInitiale);
    return (
      <>
        <label htmlFor="date">Date de naissance</label>
        <ChampDate
          id="date"
          valeur={valeur}
          changer={(v) => {
            changer(v);
            setValeur(v);
          }}
          aujourdhui={AUJOURDHUI}
        />
        <p>Autre chose</p>
      </>
    );
  }
  render(<Banc />);
  return { changer, champ: screen.getByLabelText('Date de naissance') };
}

const cliquer = (nom) => fireEvent.click(screen.getByRole('button', { name: nom }));
const ouvrir = () => cliquer('Ouvrir le calendrier');
const calendrier = () => screen.queryByRole('dialog', { name: 'Choisir une date de naissance' });

describe('conversions de la date', () => {
  it('les « / » s’ajoutent pendant la frappe', () => {
    expect(masquer('1')).toBe('1');
    expect(masquer('15')).toBe('15');
    expect(masquer('150')).toBe('15/0');
    expect(masquer('1501')).toBe('15/01');
    expect(masquer('15011980')).toBe('15/01/1980');
    expect(masquer('15/01/1980')).toBe('15/01/1980');
    expect(masquer('15 01 1980 99')).toBe('15/01/1980');
    expect(masquer('')).toBe('');
  });

  it('JJ/MM/AAAA <-> AAAA-MM-JJ, dates inexistantes refusées', () => {
    expect(texteVersIso('15/01/1980')).toBe('1980-01-15');
    expect(texteVersIso('29/02/2000')).toBe('2000-02-29');
    expect(texteVersIso('29/02/2001')).toBeNull();
    expect(texteVersIso('31/04/1980')).toBeNull();
    expect(texteVersIso('15/01/19')).toBeNull();
    expect(isoVersTexte('1980-01-15')).toBe('15/01/1980');
    expect(isoVersTexte('15/01')).toBe('15/01');
    expect(isoVersTexte(undefined)).toBe('');
  });
});

describe('saisie au clavier', () => {
  it('on tape les chiffres d’affilée : date complète transmise au format AAAA-MM-JJ', () => {
    const { changer, champ } = afficher();
    fireEvent.change(champ, { target: { value: '15011980' } });
    expect(champ.value).toBe('15/01/1980');
    expect(changer).toHaveBeenLastCalledWith('1980-01-15');
  });

  it('saisie incomplète transmise telle quelle (signalée ensuite comme invalide)', () => {
    const { changer, champ } = afficher();
    fireEvent.change(champ, { target: { value: '1501' } });
    expect(champ.value).toBe('15/01');
    expect(changer).toHaveBeenLastCalledWith('15/01');
  });

  it('date déjà connue affichée en JJ/MM/AAAA, clavier numérique sur mobile', () => {
    const { champ } = afficher('1980-01-15');
    expect(champ.value).toBe('15/01/1980');
    expect(champ.getAttribute('inputmode')).toBe('numeric');
    expect(champ.getAttribute('placeholder')).toBe('JJ/MM/AAAA');
  });
});

describe('calendrier', () => {
  it('sans date : s’ouvre sur une grille de 12 années, navigation par 10 ans', () => {
    afficher();
    ouvrir();
    expect(calendrier()).not.toBeNull();
    // 2026 - 35 = 1991 -> grille 1989 – 2000
    expect(screen.getByText('1989 – 2000')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^\d{4}$/ })).toHaveLength(12);
    cliquer('10 années plus tôt');
    cliquer('10 années plus tôt');
    expect(screen.getByText('1969 – 1980')).toBeDefined();
    cliquer('10 années plus tard');
    expect(screen.getByText('1979 – 1990')).toBeDefined();
  });

  it('année, puis mois, puis jour : la date est remplie et le calendrier se ferme', () => {
    const { changer, champ } = afficher();
    ouvrir();
    cliquer('10 années plus tôt');
    cliquer('1980');
    cliquer('janvier');
    expect(screen.getByRole('button', { name: 'janvier, choisir un autre mois' })).toBeDefined();
    cliquer('15 janvier 1980');
    expect(changer).toHaveBeenLastCalledWith('1980-01-15');
    expect(champ.value).toBe('15/01/1980');
    expect(calendrier()).toBeNull();
    expect(document.activeElement).toBe(champ);
  });

  it('date déjà choisie : ouverture sur son mois, jour mis en évidence', () => {
    afficher('1980-01-15');
    ouvrir();
    expect(
      screen.getByRole('button', { name: '15 janvier 1980' }).getAttribute('aria-pressed'),
    ).toBe('true');
    // depuis les jours : l'année ramène à la grille des années, le mois à celle des mois
    cliquer('1980, choisir une autre année');
    expect(screen.getByText('1979 – 1990')).toBeDefined();
    expect(screen.getByRole('button', { name: '1980' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('mois suivant / précédent, y compris en changeant d’année', () => {
    afficher('1980-12-10');
    ouvrir();
    cliquer('Mois suivant');
    expect(screen.getByRole('button', { name: '1 janvier 1981' })).toBeDefined();
    cliquer('Mois précédent');
    cliquer('Mois précédent');
    expect(screen.getByRole('button', { name: '1 novembre 1980' })).toBeDefined();
    cliquer('novembre, choisir un autre mois');
    cliquer('Année suivante');
    cliquer('Année précédente');
    cliquer('mars');
    expect(screen.getByRole('button', { name: '31 mars 1980' })).toBeDefined();
    cliquer('1980, choisir une autre année');
    expect(screen.getByText('1979 – 1990')).toBeDefined();
  });

  it('les dates dans le futur ne sont pas proposées', () => {
    afficher('2026-11-01');
    ouvrir();
    expect(screen.getByRole('button', { name: '4 novembre 2026' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: '5 novembre 2026' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Mois suivant' }).disabled).toBe(true);
    cliquer('2026, choisir une autre année');
    expect(screen.getByRole('button', { name: '2027' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '10 années plus tard' }).disabled).toBe(true);
  });

  it('Échap ou clic en dehors : le calendrier se ferme', () => {
    const { champ } = afficher();
    ouvrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(calendrier()).toBeNull();
    expect(document.activeElement).toBe(champ);
    ouvrir();
    fireEvent.mouseDown(screen.getByText('Autre chose'));
    expect(calendrier()).toBeNull();
    // le bouton du calendrier ouvre et referme
    ouvrir();
    ouvrir();
    expect(calendrier()).toBeNull();
  });
});
