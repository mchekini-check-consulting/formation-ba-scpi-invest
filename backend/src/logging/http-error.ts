// Erreur métier avec son code HTTP (équivalent de ResponseStatusException) :
// 4xx = règle métier (log warn), 5xx = erreur (log error).
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
