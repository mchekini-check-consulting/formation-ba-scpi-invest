import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FormulaireInvestisseur from './FormulaireInvestisseur.jsx';

afterEach(cleanup);

describe('Formulaire investisseur (page d’attente après le KYC)', () => {
  it('confirme la validation du KYC et annonce la prochaine étape', () => {
    render(<FormulaireInvestisseur />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Votre KYC est validé');
    expect(document.body.textContent).toContain('questionnaire de profil investisseur');
    expect(document.title).toBe('SCPI Invest+ · Formulaire investisseur');
  });

  it('se déconnecter : retour à l’accueil', async () => {
    const seDeconnecter = vi.fn().mockResolvedValue(undefined);
    const allerA = vi.fn();
    render(<FormulaireInvestisseur seDeconnecter={seDeconnecter} allerA={allerA} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' })));
    expect(seDeconnecter).toHaveBeenCalledOnce();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});
