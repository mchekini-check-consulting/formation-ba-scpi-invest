import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Kyc from './Kyc.jsx';

afterEach(cleanup);

function afficher(props) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Kyc {...props} />
    </QueryClientProvider>,
  );
}

describe('Kyc (après la création de compte)', () => {
  it('confirme la connexion avec l’email du compte', async () => {
    const lireUtilisateur = vi.fn().mockResolvedValue({ id: 'u1', email: 'jean@exemple.fr' });
    afficher({ lireUtilisateur, allerA: vi.fn() });
    expect(await screen.findByText('jean@exemple.fr')).toBeDefined();
    expect(document.body.textContent).toContain('formulaire KYC');
  });

  it('sans session : retour à l’accueil', async () => {
    const allerA = vi.fn();
    afficher({ lireUtilisateur: vi.fn().mockResolvedValue(null), allerA });
    await vi.waitFor(() => expect(allerA).toHaveBeenCalledWith('/'));
  });

  it('se déconnecter : session fermée, retour à l’accueil', async () => {
    const seDeconnecter = vi.fn().mockResolvedValue(undefined);
    const allerA = vi.fn();
    afficher({
      lireUtilisateur: vi.fn().mockResolvedValue({ id: 'u1', email: 'jean@exemple.fr' }),
      seDeconnecter,
      allerA,
    });
    const bouton = await screen.findByRole('button', { name: 'Se déconnecter' });
    await act(async () => fireEvent.click(bouton));
    expect(seDeconnecter).toHaveBeenCalledOnce();
    expect(allerA).toHaveBeenCalledWith('/');
  });

  it('service indisponible : message compréhensible', async () => {
    afficher({ lireUtilisateur: vi.fn().mockRejectedValue(new Error('panne')), allerA: vi.fn() });
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(document.body.textContent).toContain('momentanément indisponible');
  });
});
