import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Kyc from './Kyc.jsx';

afterEach(cleanup);

const JEAN = { id: 'u1', email: 'jean@exemple.fr' };
const NOUVEAU = { statut: 'en_cours', etape: 1, reponses: {}, valideLe: null };

function afficher(props) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Kyc
        lireUtilisateur={vi.fn().mockResolvedValue(JEAN)}
        lire={vi.fn().mockResolvedValue(NOUVEAU)}
        lirePieces={vi.fn().mockResolvedValue([])}
        allerA={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('Écran /connaissance-client (après la création de compte ou la connexion)', () => {
  it('US-04a scénario 1 : formulaire KYC à l’étape 1, sans sidebar, email du compte', async () => {
    afficher();
    expect(await screen.findByRole('heading', { level: 2, name: 'Identité' })).toBeDefined();
    expect(screen.getByText('Étape 1/5')).toBeDefined();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText('jean@exemple.fr')).toBeDefined();
    expect(document.title).toBe('SCPI Invest+ · Formulaire KYC');
  });

  it('US-04b scénario 1 : reprise à l’étape 3 avec les réponses déjà saisies', async () => {
    const lire = vi
      .fn()
      .mockResolvedValue({ ...NOUVEAU, etape: 3, reponses: { nom: 'Martin', prenom: 'Claire' } });
    afficher({ lire });
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Situation personnelle et professionnelle',
      }),
    ).toBeDefined();
    expect(screen.getByText('Étape 3/5')).toBeDefined();
  });

  it('« Suivant » enregistre l’étape auprès du backend', async () => {
    const enregistrer = vi.fn().mockResolvedValue({});
    afficher({ lire: vi.fn().mockResolvedValue({ ...NOUVEAU, etape: 3 }), enregistrer });
    await screen.findByText('Étape 3/5');
    const changer = (libelle, valeur) =>
      fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
    changer('Situation familiale', 'Célibataire');
    changer('Profession', 'Ingénieure');
    changer('Catégorie socio-professionnelle', 'Employé');
    changer('Secteur d’activité', 'Commerce');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Suivant' })));
    expect(enregistrer).toHaveBeenCalledWith(4, {
      situationFamiliale: 'Célibataire',
      profession: 'Ingénieure',
      categorie: 'Employé',
      secteur: 'Commerce',
    });
  });

  it('US-04b scénario 3 : après « Valider », direction le formulaire investisseur', async () => {
    const allerA = vi.fn();
    const valider = vi.fn().mockResolvedValue({ statut: 'complete' });
    afficher({ lire: vi.fn().mockResolvedValue({ ...NOUVEAU, etape: 6 }), valider, allerA });
    const bouton = await screen.findByRole('button', { name: 'Valider' });
    await act(async () => fireEvent.click(bouton));
    expect(valider).toHaveBeenCalledOnce();
    expect(allerA).toHaveBeenCalledWith('/formulaire-investisseur');
  });

  it('US-04b scénario 4 : KYC déjà complété, le formulaire n’est plus proposé', async () => {
    const allerA = vi.fn();
    afficher({
      lire: vi.fn().mockResolvedValue({ ...NOUVEAU, statut: 'complete', etape: 6 }),
      allerA,
    });
    await vi.waitFor(() => expect(allerA).toHaveBeenCalledWith('/formulaire-investisseur'));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('US-04c : reprise à l’étape des pièces avec les pièces déjà déposées', async () => {
    const lirePieces = vi
      .fn()
      .mockResolvedValue([{ type: 'rib', nomFichier: 'rib.pdf', statut: 'deposee' }]);
    afficher({ lire: vi.fn().mockResolvedValue({ ...NOUVEAU, etape: 5 }), lirePieces });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Pièces justificatives' }),
    ).toBeDefined();
    expect(screen.getByText('rib.pdf')).toBeDefined();
  });

  it('service indisponible (pièces) : message, pas de formulaire', async () => {
    afficher({ lirePieces: vi.fn().mockRejectedValue(new Error('panne')) });
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('sans session : retour à l’accueil', async () => {
    const allerA = vi.fn();
    const lire = vi.fn();
    afficher({ lireUtilisateur: vi.fn().mockResolvedValue(null), lire, allerA });
    await vi.waitFor(() => expect(allerA).toHaveBeenCalledWith('/'));
    expect(lire).not.toHaveBeenCalled();
  });

  it('se déconnecter : session fermée, retour à l’accueil', async () => {
    const seDeconnecter = vi.fn().mockResolvedValue(undefined);
    const allerA = vi.fn();
    afficher({ seDeconnecter, allerA });
    const bouton = await screen.findByRole('button', { name: 'Se déconnecter' });
    await act(async () => fireEvent.click(bouton));
    expect(seDeconnecter).toHaveBeenCalledOnce();
    expect(allerA).toHaveBeenCalledWith('/');
  });

  it('service indisponible (session) : message compréhensible', async () => {
    afficher({ lireUtilisateur: vi.fn().mockRejectedValue(new Error('panne')) });
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(document.body.textContent).toContain('momentanément indisponible');
  });

  it('service indisponible (KYC) : message compréhensible, pas de formulaire', async () => {
    afficher({ lire: vi.fn().mockRejectedValue(new Error('panne')) });
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
