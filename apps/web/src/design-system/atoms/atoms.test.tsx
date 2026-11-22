import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  IconButton,
  Icon,
  iconNames,
  Text,
  Link,
  Divider,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Badge,
  Spinner,
  ProgressBar,
  Skeleton,
  Kbd,
  VisuallyHidden,
} from './index';

afterEach(cleanup);
describe('atomy', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'Button: %s, nazwa, kliknięcie i loading',
    (variant) => {
      const click = vi.fn();
      const { rerender } = render(
        <Button variant={variant} onClick={click}>
          Dalej
        </Button>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
      expect(click).toHaveBeenCalledOnce();
      rerender(
        <Button variant={variant} loading onClick={click}>
          Dalej
        </Button>,
      );
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
      fireEvent.click(screen.getByRole('button'));
      expect(click).toHaveBeenCalledOnce();
    },
  );
  it.each(['default', 'hover', 'focus'] as const)(
    'Button: %s i disabled',
    (state) => {
      render(
        <Button state={state} disabled>
          Dalej
        </Button>,
      );
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button')).toHaveAttribute('data-state', state);
    },
  );
  it('IconButton ma nazwę, dekoracyjna ikona jest ukryta', () => {
    render(<IconButton icon="menu" label="Menu" />);
    expect(screen.getByRole('button', { name: 'Menu' })).toBeVisible();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
  it.each(iconNames)('Icon: %s ma dostępną nazwę', (name) => {
    render(<Icon name={name} label={name} />);
    expect(screen.getByRole('img', { name })).toBeInTheDocument();
  });
  it('Text zachowuje semantykę i styl kodu', () => {
    render(
      <Text as="h2" variant="code">
        Nagłówek
      </Text>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveClass('font-mono');
  });
  it('Link ma adres i nazwę', () => {
    render(<Link href="/pl/upload">Wczytaj</Link>);
    expect(screen.getByRole('link', { name: 'Wczytaj' })).toHaveAttribute(
      'href',
      '/pl/upload',
    );
  });
  it('Divider jest separatorem', () => {
    render(<Divider />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });
  describe.each([
    ['TextInput', TextInput],
    ['Textarea', Textarea],
  ] as const)('%s', (_name, Component) => {
    it.each([
      'default',
      'focus',
      'error',
      'readOnly',
      'externalSystem',
    ] as const)('stan %s', (state) => {
      render(<Component aria-label="Pole" state={state} />);
      const input = screen.getByRole('textbox', { name: 'Pole' });
      expect(input).toHaveAttribute('data-state', state);
      if (state === 'error')
        expect(input).toHaveAttribute('aria-invalid', 'true');
      if (state === 'readOnly' || state === 'externalSystem')
        expect(input).toHaveAttribute('readonly');
    });
    it('pozwala wpisywać i blokuje disabled', () => {
      const { rerender } = render(<Component aria-label="Pole" />);
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'dane' },
      });
      expect(screen.getByRole('textbox')).toHaveValue('dane');
      rerender(<Component aria-label="Pole" disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });
  it.each(['default', 'focus', 'error', 'readOnly', 'externalSystem'] as const)(
    'Select: %s',
    (state) => {
      render(
        <Select state={state} aria-label="Wybór">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>,
      );
      const select = screen.getByRole('combobox', { name: 'Wybór' });
      if (state === 'readOnly' || state === 'externalSystem')
        expect(select).toBeDisabled();
      else {
        fireEvent.change(select, { target: { value: 'b' } });
        expect(select).toHaveValue('b');
      }
      if (state === 'error')
        expect(select).toHaveAttribute('aria-invalid', 'true');
    },
  );
  it('Checkbox jest powiązany z etykietą i zmienia stan', () => {
    render(<Checkbox label="Zgoda" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Zgoda' });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
  it('Radio grupuje wybory natywnie', () => {
    render(
      <>
        <Radio label="A" name="g" defaultChecked />
        <Radio label="B" name="g" />
      </>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A' })).not.toBeChecked();
  });
  it.each(['success', 'warning', 'danger', 'info', 'neutral'] as const)(
    'Badge: %s',
    (tone) => {
      render(<Badge tone={tone}>{tone}</Badge>);
      expect(screen.getByText(tone)).toHaveClass('border');
    },
  );
  it('Spinner przekazuje nazwę statusu', () => {
    render(<Spinner label="Ładowanie" />);
    expect(
      screen.getByRole('status', { name: 'Ładowanie' }),
    ).toBeInTheDocument();
  });
  it.each([
    [-5, 0],
    [50, 50],
    [120, 100],
  ])('ProgressBar ogranicza %s do %s', (value, bounded) => {
    render(<ProgressBar label="Analiza" value={value} />);
    expect(
      screen.getByRole('progressbar', { name: 'Analiza' }),
    ).toHaveAttribute('aria-valuenow', String(bounded));
  });
  it('ProgressBar nie udaje znanej wartości', () => {
    render(<ProgressBar label="Analiza" />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute(
      'aria-valuenow',
    );
  });
  it('Skeleton opisuje ładowanie', () => {
    render(<Skeleton label="Ładowanie listy" />);
    expect(
      screen.getByRole('status', { name: 'Ładowanie listy' }),
    ).toBeInTheDocument();
  });
  it('Kbd renderuje skrót klawiaturowy', () => {
    render(<Kbd>Enter</Kbd>);
    expect(screen.getByText('Enter').tagName).toBe('KBD');
  });
  it('VisuallyHidden pozostawia tekst dla technologii asystujących', () => {
    render(<VisuallyHidden>Opis</VisuallyHidden>);
    expect(screen.getByText('Opis')).toHaveClass('sr-only');
  });
});
