import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

describe('App', () => {
  it('affiche le titre', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Get started');
  });

  it('incrémente le compteur au clic', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: /count is/i });
    expect(button.textContent).toBe('Count is 0');
    fireEvent.click(button);
    expect(button.textContent).toBe('Count is 1');
  });
});
