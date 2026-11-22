import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace }),
}));
vi.mock('./placeholder', () => ({ Placeholder: () => null }));

import Home from './page';

describe('strona główna', () => {
  it('przekierowuje do panelu głównego /upload', () => {
    render(<Home />);
    expect(replace).toHaveBeenCalledWith('/upload');
  });
});
