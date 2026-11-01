import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Simulateur from './Simulateur';

afterEach(cleanup);

// Les montants formatés en français utilisent des espaces insécables : on les normalise
const texte = (element) => element.textContent.replace(/\s/g, ' ');
const resultats = () => screen.getAllByRole('status').map(texte);

describe('Simulateur', () => {
  it('calcule les revenus avec les hypothèses de départ', () => {
    render(<Simulateur />);
    // 20 000 € à 4,5 % : 900 €/an, 75 €/mois, 9 000 € sur 10 ans ; 10 % de frais -> 18 000 € investis
    expect(resultats()).toEqual(['18 000 €', '75 €', '9 000 €']);
  });

  it('recalcule quand on déplace un curseur', () => {
    render(<Simulateur />);
    fireEvent.change(screen.getByLabelText('Montant investi'), { target: { value: '40000' } });
    fireEvent.change(screen.getByLabelText('Durée de détention'), { target: { value: '1' } });
    expect(resultats()).toEqual(['36 000 €', '150 €', '1 800 €']);
    expect(screen.getByText('Revenus cumulés sur 1 an')).toBeTruthy();
  });

  it('affiche la valeur choisie à côté de chaque curseur', () => {
    render(<Simulateur />);
    fireEvent.change(screen.getByLabelText('Taux de distribution (hypothèse)'), {
      target: { value: '5.2' },
    });
    fireEvent.change(screen.getByLabelText('Frais de souscription'), { target: { value: '0' } });
    const valeurs = screen.getAllByText(/%$/).map(texte);
    expect(valeurs).toEqual(['5,2 %', '0,0 %']);
  });
});
