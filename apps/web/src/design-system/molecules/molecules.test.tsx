import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextInput, Checkbox } from '../atoms';
import {
  FormField,
  ChoiceGroup,
  Tab,
  NavItem,
  KeyValue,
  Toast,
  StatusChip,
  Chip,
  SegmentedControl,
  StepIndicator,
  EmptyState,
  FileRow,
  ValidationItem,
  Callout,
} from './index';
afterEach(cleanup);
describe('molekuły', () => {
  it('FormField łączy etykietę, pomoc, błąd i required', () => {
    render(
      <FormField label="Imię" required helper="Pomoc" error="Błąd">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: 'Imię' });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Pomoc Błąd');
  });
  it.each(['default', 'focus', 'error', 'readOnly', 'externalSystem'] as const)(
    'FormField przenosi stan %s',
    (state) => {
      render(
        <FormField label="Imię" state={state}>
          <TextInput />
        </FormField>,
      );
      expect(screen.getByRole('textbox')).toHaveAttribute('data-state', state);
    },
  );
  it('FormField zachowuje istniejący opis', () => {
    render(
      <>
        <span id="extra">Opis</span>
        <FormField label="Imię" helper="Pomoc">
          <TextInput aria-describedby="extra" />
        </FormField>
      </>,
    );
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'Opis Pomoc',
    );
  });
  it('ChoiceGroup ma nazwę grupy i błąd', () => {
    render(
      <ChoiceGroup label="Zgody" error="Wybierz">
        <Checkbox label="Zgoda" />
      </ChoiceGroup>,
    );
    expect(screen.getByRole('group', { name: 'Zgody' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Wybierz');
  });
  it.each([true, false])('Tab aktywny=%s', (active) => {
    render(
      <Tab active={active} panelId="panel">
        JSON
      </Tab>,
    );
    const tab = screen.getByRole('tab', { name: 'JSON' });
    expect(tab).toHaveAttribute('aria-selected', String(active));
    expect(tab).toHaveAttribute('aria-controls', 'panel');
    expect(tab).toHaveAttribute('tabindex', active ? '0' : '-1');
  });
  it.each([true, false])('NavItem aktywny=%s', (active) => {
    render(
      <NavItem href="/pl" active={active}>
        Start
      </NavItem>,
    );
    const link = screen.getByRole('link', { name: 'Start' });
    if (active) expect(link).toHaveAttribute('aria-current', 'page');
    else expect(link).not.toHaveAttribute('aria-current');
  });
  it('KeyValue używa dt i dd', () => {
    render(<KeyValue label="Czas" value="2 s" />);
    expect(screen.getByText('Czas').tagName).toBe('DT');
    expect(screen.getByText('2 s').tagName).toBe('DD');
  });
  it.each(['success', 'error', 'info'] as const)(
    'Toast %s ma odpowiednią rolę',
    (tone) => {
      const close = vi.fn();
      render(
        <Toast tone={tone} onDismiss={close} dismissLabel="Zamknij">
          Komunikat
        </Toast>,
      );
      expect(
        screen.getByRole(tone === 'error' ? 'alert' : 'status'),
      ).toHaveTextContent('Komunikat');
      fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
      expect(close).toHaveBeenCalledOnce();
    },
  );
  it.each(['success', 'warning', 'danger', 'info', 'neutral'] as const)(
    'StatusChip %s zachowuje treść',
    (tone) => {
      render(<StatusChip tone={tone}>Status</StatusChip>);
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    },
  );
  it('Chip usuwa po akcji opisanej etykietą', () => {
    const remove = vi.fn();
    render(
      <Chip removeLabel="Usuń filtr" onRemove={remove}>
        Filtr
      </Chip>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Usuń filtr' }));
    expect(remove).toHaveBeenCalledOnce();
  });
  it('SegmentedControl ma natywne wybory i disabled', () => {
    const change = vi.fn();
    render(
      <SegmentedControl
        name="test"
        label="Tryb"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C', disabled: true },
        ]}
        onChange={change}
      />,
    );
    expect(screen.getByRole('group', { name: 'Tryb' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'A' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(change).toHaveBeenCalledWith('b');
    expect(screen.getByRole('radio', { name: 'C' })).toBeDisabled();
  });
  it('StepIndicator oznacza tylko bieżący krok', () => {
    render(
      <StepIndicator
        label="Etapy"
        steps={['Wczytaj', 'Sprawdź', 'Pobierz']}
        current={1}
      />,
    );
    expect(
      screen.getByRole('navigation', { name: 'Etapy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sprawdź').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Wczytaj').closest('li')).not.toHaveAttribute(
      'aria-current',
    );
  });
  it('EmptyState ma opis i akcję', () => {
    render(
      <EmptyState
        title="Pusto"
        description="Dodaj plik"
        action={<button>Dodaj</button>}
      />,
    );
    expect(screen.getByText('Dodaj plik')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Dodaj' })).toBeVisible();
  });
  it.each(['queued', 'processing', 'done', 'error'] as const)(
    'FileRow %s i pełna długa nazwa',
    (state) => {
      const filename = 'bardzo-długa-nazwa-'.repeat(15) + '.pdf';
      render(
        <FileRow
          filename={filename}
          state={state}
          statusLabel={state}
          progress={45}
          progressLabel="Analiza"
          error={{
            code: 'MIME_MISMATCH',
            status: 415,
            message: 'Nieprawidłowy format',
          }}
        />,
      );
      expect(screen.getByTitle(filename)).toHaveClass('truncate');
      if (state === 'processing')
        expect(
          screen.getByRole('progressbar', { name: 'Analiza' }),
        ).toHaveAttribute('aria-valuenow', '45');
      else expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      if (state === 'error') {
        expect(screen.getByText(/MIME_MISMATCH/)).toHaveTextContent('415');
        expect(screen.getByText('Nieprawidłowy format')).toBeVisible();
      }
    },
  );
  it.each(['error', 'warning'] as const)('ValidationItem %s', (severity) => {
    render(
      <ValidationItem
        severity={severity}
        message="Uwaga"
        path="tabs[0]"
        code="REQUIRED"
      />,
    );
    expect(screen.getByText('Uwaga')).toBeVisible();
    expect(screen.getByText('tabs[0]')).toBeVisible();
    expect(screen.getByText('REQUIRED')).toBeVisible();
  });
  it.each(['success', 'warning', 'danger', 'info', 'neutral'] as const)(
    'Callout %s',
    (tone) => {
      render(
        <Callout tone={tone} title="Tytuł">
          Opis
        </Callout>,
      );
      expect(screen.getByText('Tytuł')).toBeVisible();
      expect(screen.getByText('Opis')).toBeVisible();
    },
  );
});
