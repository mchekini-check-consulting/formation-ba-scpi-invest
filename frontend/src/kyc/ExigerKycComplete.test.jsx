import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExigerKycComplete from './ExigerKycComplete.jsx';

afterEach(cleanup);

const JEAN = { id: 'u1', email: 'jean@exemple.fr' };

function afficher({ utilisateur = JEAN, kyc, lire, passer = false } = {}) {
  const allerA = vi.fn();
  const lireKyc = lire ?? vi.fn().mockResolvedValue(kyc);
  const lireUtilisateur =
    utilisateur instanceof Error
      ? vi.fn().mockRejectedValue(utilisateur)
      : vi.fn().mockResolvedValue(utilisateur);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExigerKycComplete
        lireUtilisateur={lireUtilisateur}
        lire={lireKyc}
        allerA={allerA}
        passer={passer}
      >
        <p>Écran protégé</p>
      </ExigerKycComplete>
    </QueryClientProvider>,
  );
  return { allerA, lireKyc };
}

describe('Accès bloqué tant que le KYC n’est pas validé (US-04b, scénario 2)', () => {
  it('KYC non validé : redirection vers le formulaire KYC, écran non affiché', async () => {
    const { allerA } = afficher({ kyc: { statut: 'en_cours', etape: 2 } });
    await vi.waitFor(() => expect(allerA).toHaveBeenCalledWith('/connaissance-client'));
    expect(screen.queryByText('Écran protégé')).toBeNull();
  });

  it('KYC validé : l’écran demandé s’affiche', async () => {
    const { allerA } = afficher({ kyc: { statut: 'complete', etape: 5 } });
    expect(await screen.findByText('Écran protégé')).toBeDefined();
    expect(allerA).not.toHaveBeenCalled();
  });

  it('sans session : page de connexion', async () => {
    const { allerA, lireKyc } = afficher({ utilisateur: null });
    await vi.waitFor(() => expect(allerA).toHaveBeenCalledWith('/connexion'));
    expect(lireKyc).not.toHaveBeenCalled();
  });

  it('service indisponible : message, écran non affiché', async () => {
    afficher({ lire: vi.fn().mockRejectedValue(new Error('panne')) });
    expect((await screen.findByRole('alert')).textContent).toContain('momentanément indisponible');
    expect(screen.queryByText('Écran protégé')).toBeNull();
  });

  it('session illisible : message', async () => {
    afficher({ utilisateur: new Error('panne') });
    expect(await screen.findByRole('alert')).toBeDefined();
  });
});

describe('Raccourci de test du poste : formulaires passés', () => {
  it('KYC non exigé : l’écran s’affiche sans lire le KYC', async () => {
    const { allerA, lireKyc } = afficher({ passer: true });
    expect(await screen.findByText('Écran protégé')).toBeDefined();
    expect(lireKyc).not.toHaveBeenCalled();
    expect(allerA).not.toHaveBeenCalled();
  });

  it('connexion toujours exigée', async () => {
    const { allerA } = afficher({ passer: true, utilisateur: null });
    await vi.waitFor(() => expect(allerA).toHaveBeenCalledWith('/connexion'));
    expect(screen.queryByText('Écran protégé')).toBeNull();
  });
});
