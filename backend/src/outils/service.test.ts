import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { captureLogs } from '../logging/capture.js';
import { HttpError } from '../logging/http-error.js';
import {
  creerOutilsImportService,
  LIMITE_RAPPORTS,
  MESSAGES,
  stockageCsvR2,
  type OutilsImportDeps,
  type RapportImport,
  type StockageCsv,
} from './service.js';

const RAPPORT = { id: 7, statut: 'reussi', lues: 3 } as RapportImport;
const MAINTENANT = new Date('2026-11-06T13:33:00Z');

function stockage(surcharge: Partial<StockageCsv> = {}): StockageCsv {
  return {
    endpoint: 'https://compte.r2.cloudflarestorage.com',
    bucket: 'scpi',
    cle: 'scpi.csv',
    supprimerSource: false,
    deposer: vi.fn().mockResolvedValue(undefined),
    decrire: vi.fn().mockResolvedValue({
      taille: 10,
      modifieLe: '2026-11-06T13:00:00.000Z',
      etag: '"e"',
      typeContenu: 'text/csv',
    }),
    ...surcharge,
  };
}

function service(surcharge: Partial<OutilsImportDeps> = {}) {
  const { log, lignes } = captureLogs();
  const deps: OutilsImportDeps = {
    depot: {
      rapports: vi.fn().mockResolvedValue([RAPPORT]),
      dernierRapport: vi.fn().mockResolvedValue(RAPPORT),
      catalogue: vi.fn().mockResolvedValue([{ nom: 'Horizon' }]),
    },
    stockage: stockage(),
    lancer: vi.fn(async (executer) => {
      await executer();
      return 'lance' as const;
    }),
    executer: vi.fn().mockResolvedValue(undefined),
    planification: () => ({ horaire: '0 2 * * *', fuseau: 'Europe/Paris', prochain: null }),
    maintenant: () => MAINTENANT,
    demarreLe: new Date('2026-11-06T08:00:00Z'),
    pod: 'backend-abc',
    log,
    ...surcharge,
  };
  return { outils: creerOutilsImportService(deps), deps, lignes };
}

describe('OutilsImportService.etat', () => {
  it('serveur, stockage R2, fichier déposé et planification', async () => {
    const { outils } = service();
    const etat = await outils.etat();
    expect(etat).toMatchObject({
      serveur: {
        heure: MAINTENANT.toISOString(),
        demarreLe: '2026-11-06T08:00:00.000Z',
        pod: 'backend-abc',
      },
      stockage: { configure: true, bucket: 'scpi', cle: 'scpi.csv', supprimerSource: false },
      fichier: { present: true, taille: 10, etag: '"e"' },
      planification: { horaire: '0 2 * * *' },
    });
    expect(etat.serveur.fuseau).toEqual(expect.any(String));
  });

  it('aucun fichier sur R2', async () => {
    const { outils } = service({
      stockage: stockage({ decrire: vi.fn().mockResolvedValue(null) }),
    });
    expect((await outils.etat()).fichier).toEqual({ present: false });
  });

  it('R2 en erreur : message affiché, pas d’échec de l’écran', async () => {
    const decrire = vi.fn().mockRejectedValue(new Error('AccessDenied'));
    const { outils } = service({ stockage: stockage({ decrire }) });
    expect((await outils.etat()).fichier).toEqual({ present: null, erreur: 'AccessDenied' });
  });

  it('R2 en erreur non standard', async () => {
    const decrire = vi.fn().mockRejectedValue('coupure');
    const { outils } = service({ stockage: stockage({ decrire }) });
    expect((await outils.etat()).fichier).toEqual({ present: null, erreur: 'coupure' });
  });

  it('sans variables R2 : la raison, pas de fichier ; valeurs par défaut', async () => {
    const { outils } = service({
      stockage: null,
      stockageAbsent: 'variables manquantes : S3_URL',
      planification: () => null,
      pod: undefined,
      demarreLe: undefined,
      maintenant: undefined,
    });
    const etat = await outils.etat();
    expect(etat.stockage).toEqual({ configure: false, raison: 'variables manquantes : S3_URL' });
    expect(etat.fichier).toBeNull();
    expect(etat.planification).toBeNull();
    expect(etat.serveur.pod).toBeNull();
    expect(Date.parse(etat.serveur.heure)).not.toBeNaN();
  });

  it('sans variables R2 ni raison : message par défaut', async () => {
    const { outils } = service({ stockage: null });
    expect((await outils.etat()).stockage).toEqual({ configure: false, raison: MESSAGES.sansR2 });
  });
});

describe('OutilsImportService.deposer', () => {
  it('envoie le contenu sur R2 et renvoie la clé, la taille et l’heure', async () => {
    const { outils, deps } = service();
    const contenu = Buffer.from('Nom\nHorizon\n');
    expect(await outils.deposer(contenu)).toEqual({
      bucket: 'scpi',
      cle: 'scpi.csv',
      taille: contenu.length,
      deposeLe: MAINTENANT.toISOString(),
    });
    expect(deps.stockage!.deposer).toHaveBeenCalledWith(contenu);
  });

  it.each([[Buffer.alloc(0)], [{}], [undefined]])('fichier vide ou absent : 400', async (corps) => {
    const { outils, deps } = service();
    await expect(outils.deposer(corps)).rejects.toMatchObject({
      status: 400,
      message: MESSAGES.vide,
    });
    expect(deps.stockage!.deposer).not.toHaveBeenCalled();
  });

  it('sans R2 : 503', async () => {
    const { outils } = service({ stockage: null });
    await expect(outils.deposer(Buffer.from('x'))).rejects.toMatchObject({ status: 503 });
  });
});

describe('OutilsImportService.importer', () => {
  it('lance l’import à la main et renvoie le dernier rapport', async () => {
    const { outils, deps } = service();
    expect(await outils.importer()).toEqual({
      issue: 'lance',
      erreur: null,
      dureeMs: 0,
      rapport: RAPPORT,
    });
    expect(deps.executer).toHaveBeenCalledOnce();
  });

  it('import en échec : le motif est renvoyé avec le rapport, pas d’erreur HTTP', async () => {
    const { outils } = service({
      executer: vi.fn().mockRejectedValue(new Error('encodage invalide (UTF-8 attendu)')),
    });
    expect(await outils.importer()).toMatchObject({
      issue: 'lance',
      erreur: 'encodage invalide (UTF-8 attendu)',
      rapport: RAPPORT,
    });
  });

  it('erreur non standard', async () => {
    const { outils } = service({ executer: vi.fn().mockRejectedValue('coupure') });
    expect((await outils.importer()).erreur).toBe('coupure');
  });

  it('import déjà en cours : 409', async () => {
    const { outils, deps } = service({ lancer: vi.fn().mockResolvedValue('deja_en_cours') });
    const err = await outils.importer().catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 409, message: MESSAGES.enCours });
    expect(deps.depot.dernierRapport).not.toHaveBeenCalled();
  });

  it('sans R2 : 503', async () => {
    const { outils } = service({ lancer: null });
    await expect(outils.importer()).rejects.toMatchObject({
      status: 503,
      message: MESSAGES.sansR2,
    });
  });
});

describe('OutilsImportService.rapports et catalogue', () => {
  it.each([
    [undefined, LIMITE_RAPPORTS.defaut],
    ['abc', LIMITE_RAPPORTS.defaut],
    ['0', LIMITE_RAPPORTS.defaut],
    ['-3', LIMITE_RAPPORTS.defaut],
    ['2.5', LIMITE_RAPPORTS.defaut],
    ['10', 10],
    ['5000', LIMITE_RAPPORTS.max],
  ])('limite %s -> %s rapports au plus', async (limite, attendu) => {
    const { outils, deps } = service();
    expect(await outils.rapports(limite)).toEqual([RAPPORT]);
    expect(deps.depot.rapports).toHaveBeenCalledWith(attendu);
  });

  it('catalogue : celui du dépôt', async () => {
    const { outils } = service();
    expect(await outils.catalogue()).toEqual([{ nom: 'Horizon' }]);
  });

  it('chaque appel est journalisé dans la couche service, sans les arguments', async () => {
    const { outils, lignes } = service();
    await outils.deposer(Buffer.from('contenu-secret'));
    expect(lignes.at(-1)).toMatchObject({
      layer: 'service',
      class: 'OutilsImportService',
      method: 'deposer',
    });
    expect(JSON.stringify(lignes)).not.toContain('contenu-secret');
  });
});

describe('stockageCsvR2', () => {
  it('dépose et décrit le fichier de S3_URL', async () => {
    const send = vi.fn().mockResolvedValue({});
    const config = {
      endpoint: 'https://compte.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'scpi',
      key: 'scpi.csv',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
      supprimerSource: true,
    };
    const s = stockageCsvR2({ send }, config);
    expect(s).toMatchObject({
      endpoint: config.endpoint,
      bucket: 'scpi',
      cle: 'scpi.csv',
      supprimerSource: true,
    });
    await s.deposer(Buffer.from('x'));
    await s.decrire();
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(HeadObjectCommand);
    expect(JSON.stringify(s)).not.toContain('secret');
  });
});
