import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Kyc from './Kyc.jsx';

afterEach(cleanup);

const JEAN = { id: 'u1', email: 'jean@exemple.fr' };

function afficher(props) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Kyc {...props} />
    </QueryClientProvider>,
  );
}

describe('Écran /kyc (après la création de compte ou la connexion)', () => {
  it('US-04a scénario 1 : formulaire KYC à l’étape 1, sans sidebar, email du compte', async () => {
    afficher({ lireUtilisateur: vi.fn().mockResolvedValue(JEAN), allerA: vi.fn() });
    expect(await screen.findByRole('heading', { level: 2, name: 'Identité' })).toBeDefined();
    expect(screen.getByText('Étape 1/4')).toBeDefined();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText('jean@exemple.fr')).toBeDefined();
    expect(document.title).toBe('SCPI Invest+ · Formulaire KYC');
  });

  it('sans session : retour à l’accueil', async () => {
    const allerA = vi.fn();
    afficher({ lireUtilisateur: vi.fn().mockResolvedValue(null), allerA });
    await vi.waitFor(() => expect(allerA).toHaveBeenCalledWith('/'));
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('se déconnecter : session fermée, retour à l’accueil', async () => {
    const seDeconnecter = vi.fn().mockResolvedValue(undefined);
    const allerA = vi.fn();
    afficher({ lireUtilisateur: vi.fn().mockResolvedValue(JEAN), seDeconnecter, allerA });
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
