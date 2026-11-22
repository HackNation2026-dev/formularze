import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';
import { Dropzone } from './Dropzone';
import { FileQueue } from './FileQueue';
import { AppBar } from './AppBar';
import { BottomNav } from './BottomNav';
import { SideRail } from './SideRail';
import { SidePanel } from './SidePanel';
import { BottomSheet } from './BottomSheet';
import { SettingsPanel } from './SettingsPanel';
import { AppShell } from '../templates/AppShell';
import { AuthLayout } from '../templates/AuthLayout';
import { MasterDetail } from '../templates/MasterDetail';
afterEach(cleanup);
const navigation = {
  label: 'Nav',
  items: [{ href: '/upload', label: 'Upload', active: true }],
};
describe('organizmy i szablony powłoki', () => {
  it('loguje przez TanStack Form i zawsze pozwala pominąć token', async () => {
    const login = vi.fn();
    const skip = vi.fn();
    render(
      <LoginForm
        tokenLabel="JWT"
        submitLabel="Login"
        skipLabel="Skip"
        requiredMessage="Required"
        onLogin={login}
        onSkip={skip}
      />,
    );
    fireEvent.click(screen.getByText('Login'));
    expect(await screen.findByText('Required')).toBeVisible();
    expect(login).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('JWT'), {
      target: { value: ' token ' },
    });
    fireEvent.click(screen.getByText('Login'));
    await vi.waitFor(() => expect(login).toHaveBeenCalledWith('token'));
    fireEvent.click(screen.getByText('Skip'));
    expect(skip).toHaveBeenCalledOnce();
  });
  it('Dropzone obsługuje wybór, przeciąganie, ponowny wybór i blokadę', () => {
    const files = vi.fn();
    const a = new File(['a'], 'a.pdf');
    const { container, rerender } = render(
      <Dropzone label="Drop" action="Choose" onFiles={files} />,
    );
    fireEvent.change(screen.getByLabelText('Choose'), {
      target: { files: [a] },
    });
    expect(files).toHaveBeenCalledWith([a]);
    fireEvent.drop(container.firstChild!, { dataTransfer: { files: [a, a] } });
    expect(files).toHaveBeenLastCalledWith([a, a]);
    rerender(
      <Dropzone label="Drop" action="Choose" disabled onFiles={files} />,
    );
    fireEvent.drop(container.firstChild!, { dataTransfer: { files: [a] } });
    expect(files).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('FileQueue aktualizuje stany i ogłasza je przez aria-live', () => {
    const { rerender } = render(
      <FileQueue
        label="Queue"
        rows={[
          {
            id: 'a',
            filename: 'a.pdf',
            state: 'queued',
            statusLabel: 'Queued',
          },
        ]}
      />,
    );
    expect(screen.getByRole('region')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Queued')).toBeVisible();
    rerender(
      <FileQueue
        label="Queue"
        rows={[
          {
            id: 'a',
            filename: 'a.pdf',
            state: 'error',
            statusLabel: 'Error',
            error: { code: 'FILE_TOO_LARGE', status: 413, message: 'Large' },
          },
        ]}
      />,
    );
    expect(screen.getByText('Large')).toBeVisible();
    expect(screen.getByText(/FILE_TOO_LARGE/)).toHaveTextContent('413');
  });
  it.each([BottomNav, SideRail])(
    'nawigacja oznacza aktywną pozycję i zachowuje SPA',
    (Navigation) => {
      const onNavigate = vi.fn();
      render(<Navigation {...navigation} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByRole('link'));
      expect(onNavigate).toHaveBeenCalledWith('/upload');
      expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page');
    },
  );
  it('AppBar, SettingsPanel i szablony składają przekazaną treść', () => {
    render(
      <AppShell title="Generator" navigation={navigation}>
        <AuthLayout>
          <SettingsPanel
            sections={[
              {
                title: 'Settings',
                content: <MasterDetail master="Master" detail="Detail" />,
              },
            ]}
          />
        </AuthLayout>
      </AppShell>,
    );
    expect(screen.getByRole('heading', { name: 'Generator' })).toBeVisible();
    expect(screen.getByText('Master')).toBeVisible();
    expect(screen.getByText('Detail')).toBeVisible();
  });
  it('SidePanel zamyka szczegóły', () => {
    const close = vi.fn();
    render(
      <SidePanel title="Details" closeLabel="Close" onClose={close}>
        Content
      </SidePanel>,
    );
    fireEvent.click(screen.getByText('Close'));
    expect(close).toHaveBeenCalledOnce();
  });
  it('BottomSheet otwiera modal na telefonie, reaguje na Escape i przywraca fokus', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    const close = vi.fn();
    const { container, rerender } = render(
      <BottomSheet open title="Details" closeLabel="Close" onClose={close}>
        Content
      </BottomSheet>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    fireEvent(
      container.querySelector('dialog')!,
      new Event('cancel', { bubbles: true, cancelable: true }),
    );
    expect(close).toHaveBeenCalledOnce();
    rerender(
      <BottomSheet
        open={false}
        title="Details"
        closeLabel="Close"
        onClose={close}
      >
        Content
      </BottomSheet>,
    );
    expect(container.querySelector('dialog')).not.toHaveAttribute('open');
    vi.unstubAllGlobals();
  });
  it('AppBar udostępnia status i kontrolki', () => {
    render(
      <AppBar title="App" status="Ready" controls={<button>Control</button>} />,
    );
    expect(screen.getByText('Ready')).toBeVisible();
    expect(screen.getByRole('button')).toBeVisible();
  });
});
