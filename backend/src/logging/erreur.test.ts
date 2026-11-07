import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { captureLogs } from './capture.js';
import { decrireErreur, messageSansDonnees, serialiserErreur } from './erreur.js';
import { HttpError } from './http-error.js';

// Erreur levée par Drizzle quand PostgreSQL refuse une requête : requête et valeurs
// dans le message (ici un email et un mot de passe haché)
function erreurSql(cause: unknown = Object.assign(new Error('duplicate key'), { code: '23505' })) {
  return new DrizzleQueryError(
    'insert into "user" ("email", "password") values ($1, $2)',
    ['jean.dupont@mail.fr', 'hash-secret'],
    cause as Error,
  );
}

const DONNEES = /jean\.dupont|hash-secret|insert into/;

describe('decrireErreur', () => {
  it('erreur SQL (Drizzle) : ni la requête ni ses valeurs, code SQLSTATE gardé', () => {
    const decrite = decrireErreur(erreurSql());
    expect(decrite).toEqual({
      error: 'DrizzleQueryError',
      errorMessage: 'requête SQL en échec',
      errorCode: '23505',
    });
    expect(JSON.stringify(decrite)).not.toMatch(DONNEES);
  });

  it('erreur SQL sans code PostgreSQL (connexion coupée) : pas de errorCode', () => {
    expect(decrireErreur(erreurSql(new Error('Connection terminated')))).toEqual({
      error: 'DrizzleQueryError',
      errorMessage: 'requête SQL en échec',
    });
  });

  it('erreur métier ou autre Error : type et message', () => {
    expect(decrireErreur(new HttpError(404, 'client introuvable'))).toEqual({
      error: 'HttpError',
      errorMessage: 'client introuvable',
    });
  });

  it('valeur levée qui n’est pas une Error : en texte', () => {
    expect(decrireErreur('coupure')).toEqual({ error: 'Error', errorMessage: 'coupure' });
    expect(messageSansDonnees(erreurSql())).toBe('requête SQL en échec');
  });
});

describe('serialiserErreur (champ err, trace hors Loki)', () => {
  it('erreur SQL : trace gardée, sans requête, valeurs ni cause', () => {
    const serialisee = serialiserErreur(erreurSql());
    expect(serialisee).toMatchObject({
      type: 'DrizzleQueryError',
      message: 'requête SQL en échec',
      errorCode: '23505',
    });
    expect(serialisee.stack).toMatch(/^Error: requête SQL en échec\n\s+at /);
    expect(JSON.stringify(serialisee)).not.toMatch(DONNEES);
  });

  it('branché sur le logger : log.error({ err }) ne laisse rien passer', () => {
    const { log, lignes } = captureLogs();
    log.error({ err: erreurSql() }, 'erreur non gérée');
    expect(JSON.stringify(lignes)).not.toMatch(DONNEES);
    expect(lignes[0].err).toMatchObject({ message: 'requête SQL en échec' });
  });

  it('autre erreur : sérialisation pino habituelle', () => {
    expect(serialiserErreur(new Error('base indisponible'))).toMatchObject({
      type: 'Error',
      message: 'base indisponible',
      stack: expect.stringContaining('base indisponible'),
    });
  });
});
