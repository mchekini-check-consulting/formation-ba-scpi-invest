import { DrizzleQueryError } from 'drizzle-orm';
import { pino } from 'pino';

// Une erreur technique peut transporter des données : Drizzle met la requête SQL et
// ses valeurs (emails, identifiants...) dans le message (« Failed query: ...\nparams: ... »).
// Rien de cela ne doit aller dans les logs : on garde le type de l'erreur, un message
// sans valeurs et le code SQLSTATE de PostgreSQL (ex. 23505 : doublon).
export type ErreurDecrite = { error: string; errorMessage: string; errorCode?: string };

const REQUETE_EN_ECHEC = 'requête SQL en échec';

export function decrireErreur(err: unknown): ErreurDecrite {
  if (err instanceof DrizzleQueryError) {
    const code = (err.cause as { code?: unknown } | undefined)?.code;
    return {
      error: 'DrizzleQueryError', // son name est "Error"
      errorMessage: REQUETE_EN_ECHEC,
      ...(typeof code === 'string' && { errorCode: code }),
    };
  }
  if (err instanceof Error) {
    return { error: err.name, errorMessage: err.message };
  }
  return { error: 'Error', errorMessage: String(err) };
}

export function messageSansDonnees(err: unknown): string {
  return decrireErreur(err).errorMessage;
}

// Sérialiseur pino du champ err (trace complète, hors Loki) : sans la requête ni ses
// valeurs, dans le message, la trace, ni la cause.
export function serialiserErreur(err: Error): Record<string, unknown> {
  const serialisee = pino.stdSerializers.err(err) as unknown as Record<string, unknown>;
  if (err instanceof DrizzleQueryError) {
    const { errorCode } = decrireErreur(err);
    const { query: _q, params: _p, cause: _c, ...reste } = serialisee;
    return {
      ...reste,
      message: REQUETE_EN_ECHEC,
      stack: err.stack?.replace(err.message, REQUETE_EN_ECHEC),
      ...(errorCode && { errorCode }),
    };
  }
  return serialisee;
}
