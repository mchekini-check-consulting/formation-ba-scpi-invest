import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErreurApi } from '../auth.js';
import Catalogue from './Catalogue.jsx';
import { FILTRES_VIDES } from './filtres.js';
import { photoScpi } from './photos.js';
import { TRI_PAR_DEFAUT } from './tri.js';

afterEach(cleanup);
beforeEach(() => sessionStorage.clear());

const OPTIONS = {
  categories: ['Bureaux', 'Santé'],
  pays: ['Espagne', 'France'],
  gerants: ['Gestion A'],
  capitalisations: [
    { code: 'moins-100m', libelle: 'Moins de 100 M€' },
    { code: 'plus-3md', libelle: 'Plus de 3 Md€' },
  ],
  taux: { min: 2.26, max: 8.35 },
  prix: { min: 168, max: 1664 },
  frais: { min: 0, max: 12 },
  minimum: { min: null, max: null },
  anneeTaux: 2025,
};

const scpi = (id, nom, tauxDistribution, autres = {}) => ({
  id,
  nom,
  gerant: `Gérant ${nom}`,
  tauxDistribution,
  capitalisation: 289000000,
  categorie: 'Bureaux',
  zoneGeographique: 'France',
  ...autres,
});

const PAGE_1 = {
  scpis: [scpi(1, 'Pierre Plus', 6.2), scpi(2, 'Rivoli Avenir', 5.1)],
  total: 14,
  page: 1,
  taillePage: 12,
  nombrePages: 2,
  anneeTaux: 2025,
  misAJourLe: '2026-11-05T02:00:00.000Z',
};

const PAGE_2 = {
  ...PAGE_1,
  page: 2,
  scpis: [
    scpi(14, 'Nouvelle', null, {
      gerant: null,
      capitalisation: null,
      categorie: null,
      zoneGeographique: null,
    }),
  ],
};

async function afficher({
  lire = vi.fn().mockResolvedValue({ etapeCourante: 6, reponses: {}, valide: true }),
  lister = vi.fn((page) => Promise.resolve(page === 2 ? PAGE_2 : PAGE_1)),
  lireFiltres = vi.fn().mockResolvedValue(OPTIONS),
  rechercher = vi.fn().mockResolvedValue({ scpis: [], anneeTaux: 2025 }),
  seDeconnecter = vi.fn().mockResolvedValue(undefined),
  allerA = vi.fn(),
  passer = false,
} = {}) {
  const chargerIdentite = vi.fn().mockResolvedValue({ nomComplet: '', email: '', profil: null });
  await act(async () => {
    render(
      <Catalogue
        lire={lire}
        lister={lister}
        lireFiltres={lireFiltres}
        rechercher={rechercher}
        seDeconnecter={seDeconnecter}
        allerA={allerA}
        chargerIdentite={chargerIdentite}
        passer={passer}
      />,
    );
  });
  return { lister, lireFiltres, rechercher, seDeconnecter, allerA };
}

const texte = () => document.body.textContent.replaceAll(' ', ' ');
const cartes = () => screen.getAllByRole('listitem').filter((li) => li.className === 'scpi');

describe('Catalogue : liste des SCPI (US-08)', () => {
  it('scénario 1 : profil validé -> première page, dans l’ordre du backend', async () => {
    const { lister, allerA } = await afficher();
    expect(lister).toHaveBeenCalledWith(1, FILTRES_VIDES, TRI_PAR_DEFAUT);
    expect(allerA).not.toHaveBeenCalled();
    expect(cartes().map((c) => c.querySelector('h2').textContent)).toEqual([
      'Pierre Plus',
      'Rivoli Avenir',
    ]);
    expect(texte()).toContain('Page 1 sur 2');
  });

  it('scénario 2 : nom, société de gestion, taux N-1, capitalisation, catégorie, zone', async () => {
    await afficher();
    const carte = cartes()[0].textContent.replaceAll(' ', ' ');
    expect(carte).toContain('Pierre Plus');
    expect(carte).toContain('Gérant Pierre Plus');
    expect(carte).toContain('Taux de distribution 2025');
    expect(carte).toContain('6,20 %');
    expect(carte).toContain('289 M€');
    expect(carte).toContain('Bureaux');
    expect(carte).toContain('France');
  });

  it('jauge segmentée : 10 segments de 1 %, remplis selon le taux, sans numéro de rang', async () => {
    await afficher();
    const [premiere, seconde] = cartes();
    expect(premiere.querySelectorAll('.scpi__segment')).toHaveLength(10);
    expect(premiere.querySelectorAll('.scpi__segment--plein')).toHaveLength(6); // 6,20 %
    expect(seconde.querySelectorAll('.scpi__segment--plein')).toHaveLength(5); // 5,10 %
    expect(premiere.querySelector('.scpi__echelle').textContent).toBe('0 %5 %10 %');
    expect(premiere.querySelector('.scpi__jauge').getAttribute('aria-hidden')).toBe('true');
    expect(premiere.textContent).not.toMatch(/#\d/);
  });

  it('encadré du taux, puis zone, catégorie et capitalisation en lignes libellé / valeur', async () => {
    await afficher();
    const carte = cartes()[0];
    expect(carte.querySelector('.scpi__taux-titre').textContent).toBe('Taux de distribution 2025');
    expect(
      carte
        .querySelector('.scpi__taux-valeur')
        .textContent.replaceAll(String.fromCharCode(160), ' '),
    ).toBe('6,20 %');
    const lignes = [...carte.querySelectorAll('.scpi__info')].map((l) => [
      l.querySelector('dt').textContent,
      l.querySelector('dd').textContent.replaceAll(String.fromCharCode(160), ' '),
    ]);
    expect(lignes).toEqual([
      ['📍Principal pays', 'France'],
      ['🏢Secteur principal', 'Bureaux'],
      ['💳Capitalisation', '289 M€'],
    ]);
    expect([...carte.querySelectorAll('.scpi__emoji')].map((e) => e.textContent)).toEqual([
      '📍',
      '🏢',
      '💳',
    ]);
    // Icônes décoratives : ignorées par les lecteurs d'écran
    for (const icone of carte.querySelectorAll('svg, .scpi__emoji')) {
      expect(icone.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('photo en haut de chaque carte, différente d’une SCPI à l’autre', async () => {
    await afficher();
    const [premiere, seconde] = cartes();
    const photo = premiere.querySelector('.scpi__photo img');
    expect(photo.getAttribute('alt')).toBe(''); // décorative
    expect(photo.getAttribute('src')).toBe(photoScpi(1));
    expect(seconde.querySelector('.scpi__photo img').getAttribute('src')).toBe(photoScpi(2));
    expect(photoScpi(1)).not.toBe(photoScpi(2));
  });

  it('titre « Catalogue SCPI » et sous-titre', async () => {
    await afficher();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Catalogue SCPI');
    expect(texte()).toContain('Découvrez notre sélection de SCPI partenaires');
  });

  it('en-tête figé : titre, sous-titre, nombre de SCPI et date, hors de la liste', async () => {
    await afficher();
    const entete = document.querySelector('.application__entete');
    expect(entete.querySelector('h1').textContent).toBe('Catalogue SCPI');
    const contenu = entete.textContent.replaceAll(String.fromCharCode(160), ' ');
    expect(contenu).toContain('Découvrez notre sélection de SCPI partenaires');
    expect(contenu).toContain('14 SCPI disponibles');
    expect(contenu).toContain('Données mises à jour le 05/11/2026');
    expect(entete.querySelector('.scpi')).toBeNull();
  });

  it('boutons « En savoir plus » et « Investir » : pas encore actifs, bulle « Bientôt disponible »', async () => {
    const { allerA } = await afficher();
    const carte = cartes()[0];
    const boutons = [...carte.querySelectorAll('button')];
    expect(boutons.map((b) => b.textContent)).toEqual(['En savoir plus', 'Investir']);
    for (const bouton of boutons) {
      expect(bouton.getAttribute('aria-disabled')).toBe('true');
      // Bulle « Bientôt disponible » liée au bouton (lue aussi par les lecteurs d'écran)
      const bulle = document.getElementById(bouton.getAttribute('aria-describedby'));
      expect(bulle.getAttribute('role')).toBe('tooltip');
      expect(bulle.textContent).toBe('Bientôt disponible');
    }
    // Un clic ne fait rien (pas de navigation)
    fireEvent.click(boutons[1]);
    expect(allerA).not.toHaveBeenCalled();
  });

  it('scénario 3 : nombre total de SCPI et date de mise à jour des données', async () => {
    await afficher();
    expect(texte()).toContain('14 SCPI disponibles');
    expect(texte()).toContain('Données mises à jour le 05/11/2026');
  });

  it('scénario 4 : page suivante, SCPI sans taux N-1 affichée « N/C »', async () => {
    const { lister } = await afficher();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    });
    expect(lister).toHaveBeenLastCalledWith(2, FILTRES_VIDES, TRI_PAR_DEFAUT);
    expect(texte()).toContain('Page 2 sur 2');
    const carte = cartes()[0];
    expect(carte.textContent).toContain('Nouvelle');
    const valeurs = ['.scpi__gerant', '.scpi__taux-valeur'].map(
      (selecteur) => carte.querySelector(selecteur).textContent,
    );
    expect(valeurs).toEqual(['N/C', 'N/C']);
    const infos = [...carte.querySelectorAll('.scpi__info dd')];
    expect(infos.map((dd) => dd.textContent)).toEqual(['N/C', 'N/C', 'N/C']);
    expect(infos.every((dd) => dd.className === 'scpi__nc')).toBe(true);
    // Jauge vide, jamais remplie comme un taux de 0 % affiché
    expect(carte.querySelectorAll('.scpi__segment--plein')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Suivant' }).disabled).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    });
    expect(lister).toHaveBeenLastCalledWith(1, FILTRES_VIDES, TRI_PAR_DEFAUT);
    expect(screen.getByRole('button', { name: 'Précédent' }).disabled).toBe(true);
  });

  it('une seule page : pas de pagination ; catalogue vide : message', async () => {
    await afficher({
      lister: vi.fn().mockResolvedValue({
        ...PAGE_1,
        scpis: [],
        total: 0,
        nombrePages: 1,
        misAJourLe: null,
      }),
    });
    expect(screen.queryByRole('navigation', { name: 'Pagination du catalogue' })).toBeNull();
    expect(texte()).toContain('0 SCPI');
    expect(texte()).toContain('Données mises à jour le N/C');
    expect(texte()).toContain('Aucune SCPI n’est disponible pour le moment.');
  });

  it('liste indisponible : message d’erreur', async () => {
    await afficher({ lister: vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible.')) });
    expect(screen.getByRole('alert').textContent).toBe('Indisponible.');
  });

  it('session expirée pendant le chargement de la liste : connexion', async () => {
    const { allerA } = await afficher({
      lister: vi.fn().mockRejectedValue(new ErreurApi(401, 'connexion requise')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });
});

describe('Catalogue : tri (US-11)', () => {
  const menu = () => screen.getByRole('button', { name: /^Trier par/ });
  // Choix à la souris dans le menu sur mesure (MenuTri.jsx), par le libellé complet
  const choisir = async (libelle) => {
    fireEvent.click(menu());
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: libelle }));
    });
  };

  it('scénario 1 : sans tri choisi, taux N-1 décroissant affiché dans le menu', async () => {
    const { lister } = await afficher();
    expect(lister).toHaveBeenCalledWith(1, FILTRES_VIDES, 'taux-desc');
    expect(menu().getAttribute('aria-label')).toBe(
      'Trier par : Taux de distribution — décroissant',
    );
    fireEvent.click(menu());
    expect(screen.getAllByRole('option')).toHaveLength(12);
  });

  it('scénarios 2 et 3 : changer de tri puis inverser le sens, retour en page 1', async () => {
    const { lister } = await afficher();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    });
    await choisir('Capitalisation — croissant');
    expect(lister).toHaveBeenLastCalledWith(1, FILTRES_VIDES, 'capitalisation-asc');
    expect(menu().textContent).toContain('Capitalisation — croissant');
    await choisir('Capitalisation — décroissant');
    expect(lister).toHaveBeenLastCalledWith(1, FILTRES_VIDES, 'capitalisation-desc');
  });

  it('scénario 4 : « Nom A → Z » ; la liste suit l’ordre renvoyé par le backend', async () => {
    const parNom = { ...PAGE_1, scpis: [...PAGE_1.scpis].reverse() };
    const lister = vi.fn((page, filtres, tri) =>
      Promise.resolve(tri === 'nom-desc' ? parNom : PAGE_1),
    );
    await afficher({ lister });
    await choisir('Nom A → Z');
    expect(lister).toHaveBeenLastCalledWith(1, FILTRES_VIDES, 'nom-asc');
    await choisir('Nom Z → A');
    expect(cartes().map((c) => c.querySelector('h2').textContent)).toEqual([
      'Rivoli Avenir',
      'Pierre Plus',
    ]);
  });

  it('scénario 6 : changer de tri conserve les filtres actifs', async () => {
    sessionStorage.setItem(
      'scpi-invest.catalogue.filtres',
      JSON.stringify({ ...FILTRES_VIDES, pays: ['France'] }),
    );
    const { lister } = await afficher();
    await choisir('Société de gestion A → Z');
    expect(lister).toHaveBeenLastCalledWith(
      1,
      { ...FILTRES_VIDES, pays: ['France'] },
      'gerant-asc',
    );
    expect(screen.getByRole('list', { name: 'Filtres actifs' }).textContent).toContain('France');
  });
});

describe('Catalogue (accès après validation du profil, US-05b)', () => {
  it('US-06 scénario 1 : sidebar affichée, entrée Catalogue sélectionnée', async () => {
    await afficher();
    const menu = screen.getByRole('navigation', { name: 'Menu de l’application' });
    expect(menu.textContent).toContain('Comparaison');
    expect(screen.getByRole('link', { name: 'Catalogue' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('profil non validé (certification non cochée) : formulaire investisseur', async () => {
    const { allerA, lister } = await afficher({
      lire: vi.fn().mockResolvedValue({ etapeCourante: 6, reponses: {}, valide: false }),
    });
    expect(allerA).toHaveBeenCalledWith('/formulaire-investisseur');
    expect(lister).not.toHaveBeenCalled();
  });

  it('sans session : connexion', async () => {
    const { allerA } = await afficher({
      lire: vi.fn().mockRejectedValue(new ErreurApi(401, 'connexion requise')),
    });
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });

  it('service indisponible : message d’erreur', async () => {
    await afficher({ lire: vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible.')) });
    expect(screen.getByRole('alert').textContent).toBe('Indisponible.');
  });

  it('pendant la vérification : message d’attente', () => {
    render(
      <Catalogue
        lire={() => new Promise(() => {})}
        allerA={vi.fn()}
        chargerIdentite={() => new Promise(() => {})}
      />,
    );
    expect(texte()).toContain('Chargement…');
  });

  it('déconnexion depuis la sidebar', async () => {
    const { seDeconnecter, allerA } = await afficher();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    });
    expect(seDeconnecter).not.toHaveBeenCalled(); // confirmation demandée d'abord
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
    });
    expect(seDeconnecter).toHaveBeenCalled();
    expect(allerA).toHaveBeenCalledWith('/');
  });
});

describe('Raccourci de test du poste : formulaires passés', () => {
  it('profil investisseur non exigé : liste affichée sans lire le formulaire', async () => {
    const lire = vi.fn().mockResolvedValue({ valide: false });
    const { lister, allerA } = await afficher({ lire, passer: true });
    expect(lire).not.toHaveBeenCalled();
    expect(lister).toHaveBeenCalled();
    expect(allerA).not.toHaveBeenCalledWith('/formulaire-investisseur');
  });
});

describe('Catalogue : filtres (US-10a, US-10b, US-10c)', () => {
  const panneau = () => screen.getByRole('dialog', { name: 'Filtres' });
  const memoriser = (filtres) =>
    sessionStorage.setItem(
      'scpi-invest.catalogue.filtres',
      JSON.stringify({ ...FILTRES_VIDES, ...filtres }),
    );

  async function ouvrir(options) {
    const rendu = await afficher(options);
    fireEvent.click(screen.getByRole('button', { name: /^Filtres/ }));
    return rendu;
  }

  it('US-10a scénario 1 : le panneau affiche tous les filtres avec leur type de sélection', async () => {
    await ouvrir();
    const legendes = [...panneau().querySelectorAll('legend')].map((l) => l.textContent);
    expect(legendes).toEqual([
      'Catégorie',
      'Pays',
      'Capitalisation',
      'Société de gestion',
      'Taux de distribution 2025 (%)',
      'Prix de la part (€)',
      'Frais de souscription (%)',
    ]);
    // Investissement minimum : aucune donnée, pas de curseur
    expect(within(panneau()).getByRole('checkbox', { name: 'Plus de 3 Md€' })).toBeDefined();
    expect(within(panneau()).getAllByRole('slider')).toHaveLength(6);
    expect(document.activeElement.getAttribute('aria-label')).toBe('Fermer les filtres');
  });

  it('US-10a scénarios 2 à 4 : filtres appliqués, page 1, nombre de résultats actualisé', async () => {
    const lister = vi.fn((page, filtres) =>
      Promise.resolve(filtres.categories.length ? { ...PAGE_1, total: 2, nombrePages: 1 } : PAGE_1),
    );
    await ouvrir({ lister });
    for (const nom of ['Santé', 'Bureaux', 'France']) {
      await act(async () => {
        fireEvent.click(within(panneau()).getByRole('checkbox', { name: nom }));
      });
    }
    expect(lister).toHaveBeenLastCalledWith(
      1,
      {
        ...FILTRES_VIDES,
        categories: ['Santé', 'Bureaux'],
        pays: ['France'],
      },
      TRI_PAR_DEFAUT,
    );
    expect(texte()).toContain('2 SCPI correspondant à vos critères');
    expect(within(panneau()).getByRole('button', { name: 'Voir les 2 SCPI' })).toBeDefined();
    // Gardés le temps de la session du navigateur
    const gardes = JSON.parse(sessionStorage.getItem('scpi-invest.catalogue.filtres'));
    expect(gardes.pays).toEqual(['France']);
  });

  it('US-10b : curseur appliqué au relâchement, bornes issues des données', async () => {
    const { lister } = await ouvrir();
    const nom = 'Taux de distribution 2025 : minimum';
    const minimum = within(panneau()).getByRole('slider', { name: nom });
    expect([minimum.min, minimum.max, minimum.value]).toEqual(['2.26', '8.35', '2.26']);
    fireEvent.change(minimum, { target: { value: '4' } });
    expect(lister).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.pointerUp(minimum);
    });
    expect(lister).toHaveBeenLastCalledWith(
      1,
      { ...FILTRES_VIDES, taux: { min: 4, max: null } },
      TRI_PAR_DEFAUT,
    );
    // Le maximum ne passe jamais sous le minimum
    const maximum = within(panneau()).getByRole('slider', {
      name: 'Taux de distribution 2025 : maximum',
    });
    fireEvent.change(maximum, { target: { value: '3' } });
    expect(maximum.value).toBe('4');
  });

  it('fermeture : Échap, « Voir les SCPI », clic à côté ; focus rendu au bouton', async () => {
    await ouvrir();
    // Page du Catalogue figée tant que le panneau est ouvert
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(panneau(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    const bouton = screen.getByRole('button', { name: 'Filtres' });
    expect(document.activeElement).toBe(bouton);

    fireEvent.click(bouton);
    fireEvent.click(within(panneau()).getByRole('button', { name: 'Voir les 14 SCPI' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(bouton);
    fireEvent.mouseDown(panneau());
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.mouseDown(panneau().parentElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Tab et Maj+Tab restent dans le panneau', async () => {
    await ouvrir();
    const fermer = document.activeElement;
    fireEvent.keyDown(panneau(), { key: 'Tab', shiftKey: true });
    expect(document.activeElement.textContent).toBe('Voir les 14 SCPI');
    fireEvent.keyDown(panneau(), { key: 'Tab' });
    expect(document.activeElement).toBe(fermer);
    fireEvent.keyDown(panneau(), { key: 'a' });
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('US-10c : pastilles des filtres actifs, retrait individuel, réinitialisation', async () => {
    memoriser({ categories: ['Santé'], pays: ['France'] });
    const { lister } = await afficher();
    // Filtres de la session repris à l’arrivée
    expect(lister).toHaveBeenCalledWith(
      1,
      {
        ...FILTRES_VIDES,
        categories: ['Santé'],
        pays: ['France'],
      },
      TRI_PAR_DEFAUT,
    );
    const actifs = screen.getByRole('list', { name: 'Filtres actifs' });
    const libelles = within(actifs)
      .getAllByRole('listitem')
      .map((li) => li.firstChild.textContent);
    expect(libelles).toEqual(['Santé', 'France']);
    const boutonFiltres = screen.getByRole('button', { name: 'Filtres, 2 actifs' });
    // « Réinitialiser les filtres » juste après « Filtres », avant les pastilles
    expect(boutonFiltres.nextElementSibling.textContent).toBe('Réinitialiser les filtres');
    expect(boutonFiltres.nextElementSibling.nextElementSibling).toBe(actifs);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre Santé' }));
    });
    expect(lister).toHaveBeenLastCalledWith(
      1,
      { ...FILTRES_VIDES, pays: ['France'] },
      TRI_PAR_DEFAUT,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    });
    expect(lister).toHaveBeenLastCalledWith(1, FILTRES_VIDES, TRI_PAR_DEFAUT);
    expect(screen.queryByRole('list', { name: 'Filtres actifs' })).toBeNull();
  });

  it('US-10c scénario 4 : aucun résultat -> message et « Réinitialiser les filtres »', async () => {
    memoriser({ categories: ['Santé'] });
    const vide = { ...PAGE_1, scpis: [], total: 0, nombrePages: 1 };
    const lister = vi.fn((page, filtres) =>
      Promise.resolve(filtres.categories.length ? vide : PAGE_1),
    );
    await afficher({ lister });
    expect(texte()).toContain('Aucune SCPI ne correspond à vos critères.');
    const boutons = screen.getAllByRole('button', { name: 'Réinitialiser les filtres' });
    expect(boutons).toHaveLength(2);
    await act(async () => {
      fireEvent.click(boutons[1]);
    });
    expect(lister).toHaveBeenLastCalledWith(1, FILTRES_VIDES, TRI_PAR_DEFAUT);
    expect(texte()).toContain('14 SCPI disponibles');
  });

  it('réinitialisation depuis le panneau : curseur remis à son extrémité', async () => {
    memoriser({ prix: { min: 500, max: null } });
    const { lister } = await ouvrir();
    const prix = within(panneau()).getByRole('slider', { name: 'Prix de la part : minimum' });
    expect(prix.value).toBe('500');
    await act(async () => {
      fireEvent.click(within(panneau()).getByRole('button', { name: 'Réinitialiser' }));
    });
    expect(lister).toHaveBeenLastCalledWith(1, FILTRES_VIDES, TRI_PAR_DEFAUT);
    expect(prix.value).toBe('168');
    const reinitialiser = within(panneau()).getByRole('button', { name: 'Réinitialiser' });
    expect(reinitialiser.disabled).toBe(true);
  });

  it('valeurs des filtres indisponibles : message dans le panneau, liste affichée', async () => {
    await ouvrir({ lireFiltres: vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible')) });
    expect(panneau().textContent).toContain('Les filtres ne sont pas disponibles pour le moment.');
    expect(cartes()).toHaveLength(2);
  });
});

describe('Catalogue : recherche par nom', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const champ = () => screen.getByRole('searchbox', { name: 'Rechercher une SCPI par son nom' });
  const taper = (valeur) => fireEvent.change(champ(), { target: { value: valeur } });
  const attendre = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
  const noms = () => cartes().map((li) => within(li).getByRole('heading').textContent);
  const trouvees = (...scpis) => ({ scpis, anneeTaux: 2025 });
  const PIERRE = scpi(1, 'Pierre Plus', 6.2);
  const RIVOLI = scpi(7, 'Rivoli Pierre', null, { gerant: null });
  const TROUVEES = trouvees(PIERRE, RIVOLI);

  it('1 caractère : aide affichée, aucune recherche, liste du Catalogue gardée', async () => {
    const { rechercher } = await afficher();
    taper('p');
    await attendre(1000);
    expect(texte()).toContain('Saisissez au moins 2 caractères');
    expect(rechercher).not.toHaveBeenCalled();
    expect(cartes()).toHaveLength(2);
  });

  it('lancée 300 ms après la dernière frappe, une seule fois, texte sans espaces autour', async () => {
    const { rechercher } = await afficher({ rechercher: vi.fn().mockResolvedValue(TROUVEES) });
    taper('pi');
    await attendre(200);
    taper('pie');
    await attendre(200);
    taper(' pier ');
    await attendre(299);
    expect(rechercher).not.toHaveBeenCalled();
    expect(texte()).toContain('Recherche en cours…');
    await attendre(1);
    expect(rechercher).toHaveBeenCalledTimes(1);
    expect(rechercher).toHaveBeenCalledWith('pier', FILTRES_VIDES, TRI_PAR_DEFAUT);
  });

  it('résultats à la place de la liste, avec les mêmes cartes que le Catalogue', async () => {
    const lister = vi.fn().mockResolvedValue({
      ...PAGE_1,
      scpis: [scpi(2, 'Rivoli Avenir', 5.1), scpi(3, 'Autre', 4)],
    });
    await afficher({ lister, rechercher: vi.fn().mockResolvedValue(TROUVEES) });
    taper('pierre');
    await attendre(300);
    expect(texte()).toContain('2 SCPI trouvées pour « pierre »');
    expect(noms()).toEqual(['Pierre Plus', 'Rivoli Pierre']);
    expect(screen.queryByRole('navigation', { name: 'Pagination du catalogue' })).toBeNull();
    const [carte, sansTaux] = cartes();
    const contenu = carte.textContent.replace(/\s/g, ' ');
    expect(contenu).toContain('Gérant Pierre Plus');
    expect(contenu).toContain('Taux de distribution 2025');
    expect(contenu).toContain('6,20 %');
    expect(carte.querySelector('img').getAttribute('src')).toBe(photoScpi(1));
    expect(sansTaux.querySelector('.scpi__gerant').textContent).toBe('N/C');
  });

  it('une seule SCPI trouvée : libellé au singulier', async () => {
    await afficher({ rechercher: vi.fn().mockResolvedValue(trouvees(PIERRE)) });
    taper('plus');
    await attendre(300);
    expect(texte()).toContain('1 SCPI trouvée pour « plus »');
  });

  it('20 SCPI trouvées : invite à préciser la recherche', async () => {
    const vingt = Array.from({ length: 20 }, (_, i) => scpi(i + 1, `SCPI ${i + 1}`, 5));
    await afficher({ rechercher: vi.fn().mockResolvedValue(trouvees(...vingt)) });
    taper('scpi');
    await attendre(300);
    expect(cartes()).toHaveLength(20);
    expect(texte()).toContain('seules les 20 premières sont affichées, précisez votre recherche');
  });

  it('aucun résultat : message, « Effacer la recherche » ramène la liste du Catalogue', async () => {
    await afficher();
    taper('zzz');
    await attendre(300);
    expect(texte()).toContain('Aucune SCPI ne correspond à « zzz ».');
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(champ().value).toBe('');
    expect(cartes()).toHaveLength(2);
  });

  it('croix « Effacer la saisie » : visible dès qu’il y a du texte, vide le champ, liste revenue', async () => {
    await afficher({ rechercher: vi.fn().mockResolvedValue(TROUVEES) });
    const croix = () => screen.queryByRole('button', { name: 'Effacer la saisie' });
    expect(croix()).toBeNull();
    taper('pierre');
    await attendre(300);
    expect(noms()).toEqual(['Pierre Plus', 'Rivoli Pierre']);
    fireEvent.click(croix());
    expect(champ().value).toBe('');
    expect(document.activeElement).toBe(champ());
    expect(croix()).toBeNull();
    expect(noms()).toEqual(['Pierre Plus', 'Rivoli Avenir']);
  });

  it('seule la réponse au dernier texte est affichée', async () => {
    const reponses = [];
    const rechercher = vi.fn(
      () =>
        new Promise((resolve) => {
          reponses.push(resolve);
        }),
    );
    await afficher({ rechercher });
    taper('pi');
    await attendre(300);
    taper('rivoli');
    await attendre(300);
    await act(async () => {
      reponses[1](trouvees(RIVOLI));
      reponses[0](trouvees(PIERRE));
    });
    expect(noms()).toEqual(['Rivoli Pierre']);
  });

  it('recherche indisponible : message d’erreur', async () => {
    await afficher({ rechercher: vi.fn().mockRejectedValue(new ErreurApi(503, 'Indisponible')) });
    taper('pierre');
    await attendre(300);
    expect(screen.getByRole('alert').textContent).toBe('Indisponible');
  });

  it('session expirée pendant la recherche : connexion', async () => {
    const { allerA } = await afficher({
      rechercher: vi.fn().mockRejectedValue(new ErreurApi(401, 'Session expirée')),
    });
    taper('pierre');
    await attendre(300);
    expect(allerA).toHaveBeenCalledWith('/connexion');
  });
});

describe('Catalogue : recherche, filtres et tri combinés (US-12)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const champ = () => screen.getByRole('searchbox', { name: 'Rechercher une SCPI par son nom' });
  const attendre = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
  const FRANCE = { ...FILTRES_VIDES, pays: ['France'] };
  const trouvees = (...scpis) => ({ scpis, anneeTaux: 2025 });
  const memoriser = (filtres) =>
    sessionStorage.setItem('scpi-invest.catalogue.filtres', JSON.stringify(filtres));
  const choisirTri = async (libelle) => {
    fireEvent.click(screen.getByRole('button', { name: /^Trier par/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: libelle }));
    });
  };

  it('scénario 1 : filtres et tri actifs, puis recherche -> les trois envoyés', async () => {
    memoriser(FRANCE);
    const rechercher = vi.fn().mockResolvedValue(trouvees(scpi(1, 'Pierre Plus', 6.2)));
    await afficher({ rechercher });
    await choisirTri('Nom A → Z');
    fireEvent.change(champ(), { target: { value: 'pierre' } });
    await attendre(300);
    expect(rechercher).toHaveBeenCalledWith('pierre', FRANCE, 'nom-asc');
    expect(texte()).toContain('1 SCPI trouvée pour « pierre » avec les filtres actifs');
  });

  it('scénario 2 : filtre appliqué pendant une recherche -> relancée, texte gardé', async () => {
    memoriser(FRANCE);
    const rechercher = vi.fn().mockResolvedValue(trouvees());
    await afficher({ rechercher });
    fireEvent.change(champ(), { target: { value: 'pierre' } });
    await attendre(300);
    expect(texte()).toContain('Aucune SCPI ne correspond à « pierre » avec les filtres actifs.');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre France' }));
    });
    await attendre(300);
    expect(rechercher).toHaveBeenLastCalledWith('pierre', FILTRES_VIDES, TRI_PAR_DEFAUT);
    expect(champ().value).toBe('pierre');
    expect(texte()).toContain('Aucune SCPI ne correspond à « pierre ».');
  });

  it('scénarios 3 et 4 : tri changé pendant une recherche filtrée -> recherche et filtres gardés', async () => {
    memoriser(FRANCE);
    const PIERRE = scpi(1, 'Pierre Plus', 6.2);
    const RIVOLI = scpi(7, 'Rivoli Pierre', 4);
    const rechercher = vi.fn((texteCherche, filtres, tri) =>
      Promise.resolve(tri === 'nom-desc' ? trouvees(RIVOLI, PIERRE) : trouvees(PIERRE, RIVOLI)),
    );
    await afficher({ rechercher });
    fireEvent.change(champ(), { target: { value: 'pierre' } });
    await attendre(300);
    await choisirTri('Nom Z → A');
    expect(texte()).toContain('Recherche en cours…');
    await attendre(300);
    expect(rechercher).toHaveBeenLastCalledWith('pierre', FRANCE, 'nom-desc');
    expect(cartes().map((li) => within(li).getByRole('heading').textContent)).toEqual([
      'Rivoli Pierre',
      'Pierre Plus',
    ]);
    expect(champ().value).toBe('pierre');
    expect(screen.getByRole('list', { name: 'Filtres actifs' }).textContent).toContain('France');
  });
});
