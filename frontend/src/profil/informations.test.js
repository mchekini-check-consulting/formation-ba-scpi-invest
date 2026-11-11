import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth.js', () => ({
  appelConnecte: vi.fn().mockResolvedValue({ ok: true }),
  envoyerFichierConnecte: vi.fn().mockResolvedValue({ id: 1 }),
}));

const auth = await import('../auth.js');
const {
  dateHeure,
  demandeBloc,
  deposerJustificatif,
  erreurJustificatif,
  erreursBloc,
  libelleHistorique,
  lireInformations,
  modifierInformations,
  valeursBloc,
} = await import('./informations.js');

afterEach(() => vi.clearAllMocks());

describe('informations personnelles (US-06)', () => {
  it('valeursBloc : champs du bloc, e-mail du compte, pays pour les contrôles', () => {
    const reponses = { telephone: '0612', indicatif: 'France', pays: 'France', ville: 'Lyon' };
    expect(valeursBloc('coordonnees', reponses, 'm@x.fr')).toEqual({
      telephone: '0612',
      email: 'm@x.fr',
      indicatif: 'France',
      pays: 'France',
    });
    expect(valeursBloc('adresse', {})).toEqual({
      pays: '',
      adresse: '',
      codePostal: '',
      ville: '',
    });
    expect(valeursBloc('coordonnees')).toMatchObject({ telephone: '', email: '', pays: '' });
  });

  it('erreursBloc : champs obligatoires et e-mail', () => {
    expect(erreursBloc('adresse', { pays: 'France' })).toMatchObject({
      adresse: 'Ce champ est obligatoire.',
      ville: 'Ce champ est obligatoire.',
    });
    const coordonnees = { telephone: '0612345678', indicatif: 'France', pays: 'France' };
    expect(erreursBloc('coordonnees', { ...coordonnees, email: 'x' }).email).toBe(
      'Merci de saisir une adresse e-mail valide.',
    );
    expect(erreursBloc('coordonnees', { ...coordonnees, email: 'a@b.fr' })).toEqual({});
  });

  it('erreurJustificatif : PDF, JPG, PNG de 10 Mo maximum', () => {
    const fichier = (nom, type, taille) => ({ name: nom, type, size: taille });
    expect(erreurJustificatif(fichier('a.pdf', 'application/pdf', 10))).toBeNull();
    expect(erreurJustificatif(fichier('a.png', '', 10))).toBeNull();
    for (const refuse of [
      fichier('a.gif', 'image/gif', 10),
      fichier('a.pdf', 'application/pdf', 0),
      fichier('a.pdf', 'application/pdf', 10 * 1024 * 1024 + 1),
    ]) {
      expect(erreurJustificatif(refuse)).toBe(
        'Format non accepté ou fichier trop volumineux (PDF, JPG ou PNG, 10 Mo maximum)',
      );
    }
  });

  it('demandeBloc : valeurs nettoyées, justificatif, mot de passe et indicatif', () => {
    expect(
      demandeBloc(
        'adresse',
        { pays: 'France', adresse: ' 8 rue ', codePostal: '75019', ville: 'Paris' },
        { justificatif: 4 },
      ),
    ).toEqual({
      pays: 'France',
      adresse: '8 rue',
      codePostal: '75019',
      ville: 'Paris',
      justificatif: 4,
    });
    expect(
      demandeBloc('coordonnees', { telephone: '0612', email: 'a@b.fr' }, { motDePasse: 'mdp' }),
    ).toEqual({ telephone: '0612', email: 'a@b.fr', motDePasse: 'mdp' });
  });

  it('libellés et dates de l’historique', () => {
    expect(libelleHistorique('ville')).toBe('Ville');
    expect(libelleHistorique('email')).toBe('Adresse e-mail');
    expect(libelleHistorique('identite_verso')).toBe('Pièce d’identité (verso)');
    expect(libelleHistorique('inconnu')).toBe('inconnu');
    expect(dateHeure('2026-11-11T09:42:00.000Z')).toBe('11/11/2026 10:42');
    expect(dateHeure('pas une date')).toBe('');
  });

  it('appels au backend : lecture, justificatif (POST), modification (PUT)', async () => {
    await lireInformations();
    expect(auth.appelConnecte).toHaveBeenCalledWith('/informations-personnelles');
    const fichier = { name: 'quittance été.pdf' };
    await deposerJustificatif(fichier);
    expect(auth.envoyerFichierConnecte).toHaveBeenCalledWith(
      '/informations-personnelles/justificatifs?nom=quittance%20%C3%A9t%C3%A9.pdf',
      fichier,
      { methode: 'POST' },
    );
    await modifierInformations('adresse', { ville: 'Paris' });
    expect(auth.appelConnecte).toHaveBeenLastCalledWith('/informations-personnelles/adresse', {
      methode: 'PUT',
      corps: { ville: 'Paris' },
    });
  });
});
