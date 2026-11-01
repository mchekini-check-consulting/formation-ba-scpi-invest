import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

describe('App', () => {
  it('affiche le message de bienvenue', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hello la team');
  });

  it('affiche un chat', () => {
    render(<App />);
    const chat = screen.getByRole('figure');
    expect(chat.textContent).toContain('( o.o )');
    expect(chat.querySelector('figcaption').textContent).toBe('Un chat');
  });

  it('est tout en mauve', () => {
    render(<App />);
    expect(screen.getByRole('main').className).toContain('bg-purple-500');
    expect(screen.getByRole('heading', { level: 1 }).parentElement.className).toContain(
      'text-purple-50',
    );
  });
});
