import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

describe('App', () => {
  it('affiche le message de bienvenue', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hello la team');
  });

  it('est tout en rose', () => {
    render(<App />);
    expect(screen.getByRole('main').className).toContain('bg-pink-500');
    expect(screen.getByRole('heading', { level: 1 }).parentElement.className).toContain(
      'text-pink-50',
    );
  });
});
