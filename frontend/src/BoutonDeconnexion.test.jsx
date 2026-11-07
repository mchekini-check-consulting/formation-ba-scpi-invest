import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BoutonDeconnexion from './BoutonDeconnexion.jsx';

afterEach(cleanup);

describe('bouton « Se déconnecter » de l’en-tête (KYC, formulaire investisseur)', () => {
  it('demande confirmation : « Non » referme sans déconnecter, « Oui » déconnecte', () => {
    const deconnecter = vi.fn();
    render(<BoutonDeconnexion onClick={deconnecter} />);

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'Voulez-vous vraiment vous déconnecter ?',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Non' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(deconnecter).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
    expect(deconnecter).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
