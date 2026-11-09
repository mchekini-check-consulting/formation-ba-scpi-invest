// Erreur métier avec son code HTTP (équivalent de ResponseStatusException) :
// 4xx = règle métier (log warn), 5xx = erreur (log error).
// details : champs ajoutés au corps de la réponse 4xx, à côté de message
// (ex. { debloqueA } pour un compte bloqué) ; jamais de donnée personnelle.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
