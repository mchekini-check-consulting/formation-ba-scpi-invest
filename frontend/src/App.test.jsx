import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// App dans un cache de requêtes neuf, fetch simulé
function afficher(fetch) {
  vi.stubGlobal('fetch', fetch);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

const reponse = (status, corps) => () => Promise.resolve(new Response(corps, { status }));

describe('App', () => {
  it('affiche le titre et appelle /health', () => {
    const fetch = vi.fn(() => new Promise(() => {}));
    afficher(fetch);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('SCPI Invest+');
    expect(screen.getByRole('status').textContent).toBe('GET /health → …');
    expect(fetch).toHaveBeenCalledWith('/api/health');
  });

  it('bandeau vert si le backend répond 200', async () => {
    afficher(reponse(200, '{"status":"ok"}'));
    const bandeau = await screen.findByText('GET /health → HTTP 200 · {"status":"ok"}');
    expect(bandeau.className).toContain('bg-green-600');
    expect(screen.getByText('backend 200')).toBeTruthy();
  });

  it('bandeau rouge si le backend répond 503', async () => {
    afficher(reponse(503, '{"status":"ko"}'));
    const bandeau = await screen.findByText('GET /health → HTTP 503 · {"status":"ko"}');
    expect(bandeau.className).toContain('bg-red-600');
  });

  it('bandeau rouge si le backend est injoignable', async () => {
    afficher(() => Promise.reject(new TypeError('Failed to fetch')));
    const bandeau = await screen.findByText('GET /health → backend injoignable');
    expect(bandeau.className).toContain('bg-red-600');
  });
});
