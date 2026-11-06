import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import LienOutilsPied from './LienOutilsPied.jsx';

afterEach(cleanup);

describe('lien du pied de page vers l’import du catalogue', () => {
  it('dev : lien vers l’outil, marqué « dev »', () => {
    render(<LienOutilsPied visible />);
    const lien = screen.getByRole('link', { name: /Import du catalogue/ });
    expect(lien.getAttribute('href')).toBe('/outils/import-catalogue');
    expect(lien.textContent).toContain('dev');
  });

  it('qualif, preprod, prod : rien', () => {
    const { container } = render(<LienOutilsPied visible={false} />);
    expect(container.innerHTML).toBe('');
  });
});
