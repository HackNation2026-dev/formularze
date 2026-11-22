import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import pl from '../../../../../messages/pl/design-system.json';
import en from '../../../../../messages/en/design-system.json';
import { catalogue } from './index';
import TabCatalogue from './Tab';
afterEach(cleanup);
describe('katalog', () => {
  it.each(catalogue)('$name ma działający wpis PL i EN', ({ Component }) => {
    const { container, rerender } = render(<Component t={pl} />);
    expect(container.childElementCount).toBeGreaterThan(0);
    rerender(<Component t={en} />);
    expect(container.childElementCount).toBeGreaterThan(0);
  });
  it('zakładki obsługują kliknięcia i strzałki', () => {
    render(<TabCatalogue t={pl} />);
    const first = screen.getByRole('tab', { name: pl.step1 });
    const second = screen.getByRole('tab', { name: pl.step2 });
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent(pl.step1);
  });
});
