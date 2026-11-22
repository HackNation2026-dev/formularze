'use client';
import { useState } from 'react';
import { AppBar } from '@/design-system/organisms/AppBar';
import {
  BottomNav,
  type NavigationProps,
} from '@/design-system/organisms/BottomNav';
import { SideRail } from '@/design-system/organisms/SideRail';
import { Dropzone } from '@/design-system/organisms/Dropzone';
import { FileQueue } from '@/design-system/organisms/FileQueue';
import { BottomSheet } from '@/design-system/organisms/BottomSheet';
import { SidePanel } from '@/design-system/organisms/SidePanel';
import { SettingsPanel } from '@/design-system/organisms/SettingsPanel';
import { LoginForm } from '@/design-system/organisms/LoginForm';
import { AppShell } from '@/design-system/templates/AppShell';
import { AuthLayout } from '@/design-system/templates/AuthLayout';
import { MasterDetail } from '@/design-system/templates/MasterDetail';
import { Button } from '@/design-system/atoms/Button';
import { Text } from '@/design-system/atoms/Text';
import { Example, type ExampleProps } from './shared';
function nav(t: ExampleProps['t']): NavigationProps {
  return {
    label: t.navigation,
    items: [
      { href: '#AppBar', label: t.step1, active: true },
      { href: '#Dropzone', label: t.step2 },
    ],
  };
}
export function AppBarExample({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <AppBar
        title={t.sample}
        status={<Text>{t.success}</Text>}
        controls={<Button>{t.action}</Button>}
      />
    </Example>
  );
}
export function BottomNavExample({ t }: ExampleProps) {
  return (
    <Example label={t.navigation}>
      <div className="relative min-h-20 [&>nav]:static [&>nav]:flex">
        <BottomNav {...nav(t)} />
      </div>
    </Example>
  );
}
export function SideRailExample({ t }: ExampleProps) {
  return (
    <Example label={t.navigation}>
      <div className="[&>nav]:flex">
        <SideRail {...nav(t)} />
      </div>
    </Example>
  );
}
export function DropzoneExample({ t }: ExampleProps) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <>
      <Example label={t.default}>
        <Dropzone
          label={t.helper}
          action={t.action}
          helper={files.map((file) => file.name).join(', ')}
          onFiles={setFiles}
        />
      </Example>
      <Example label={t.disabled}>
        <Dropzone
          label={t.helper}
          action={t.action}
          disabled
          onFiles={setFiles}
        />
      </Example>
    </>
  );
}
export function FileQueueExample({ t }: ExampleProps) {
  return (
    <Example label={t.progress}>
      <FileQueue
        label={t.navigation}
        rows={(['queued', 'processing', 'done', 'error'] as const).map(
          (state) => ({
            id: state,
            filename: t.file,
            state,
            statusLabel: t[state],
            error:
              state === 'error'
                ? {
                    code: 'UNSUPPORTED_MEDIA_TYPE',
                    status: 415,
                    message: t.fileError,
                  }
                : undefined,
          }),
        )}
      />
    </Example>
  );
}
export function BottomSheetExample({ t }: ExampleProps) {
  const [open, setOpen] = useState(false);
  return (
    <Example label={t.default}>
      <Button onClick={() => setOpen(true)}>{t.action}</Button>
      <BottomSheet
        open={open}
        title={t.sample}
        closeLabel={t.close}
        onClose={() => setOpen(false)}
      >
        <Text>{t.helper}</Text>
      </BottomSheet>
    </Example>
  );
}
export function SidePanelExample({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <div className="[&>aside]:grid">
        <SidePanel title={t.sample} closeLabel={t.close} onClose={() => {}}>
          <Text>{t.helper}</Text>
        </SidePanel>
      </div>
    </Example>
  );
}
export function SettingsPanelExample({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <SettingsPanel
        sections={[{ title: t.sample, content: <Text>{t.helper}</Text> }]}
      />
    </Example>
  );
}
export function LoginFormExample({ t }: ExampleProps) {
  const [done, setDone] = useState(false);
  return (
    <Example label={t.default}>
      <LoginForm
        tokenLabel={t.label}
        submitLabel={t.action}
        skipLabel={t.close}
        requiredMessage={t.error}
        onLogin={() => setDone(true)}
        onSkip={() => setDone(true)}
      />
      {done && <Text role="status">{t.done}</Text>}
    </Example>
  );
}
export function AppShellExample({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <div className="[&_nav]:static [&>div]:min-h-0">
        <AppShell title={t.sample} navigation={nav(t)}>
          <Text>{t.helper}</Text>
        </AppShell>
      </div>
    </Example>
  );
}
export function AuthLayoutExample({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <AuthLayout>
        <Text>{t.sample}</Text>
        <Button>{t.action}</Button>
      </AuthLayout>
    </Example>
  );
}
export function MasterDetailExample({ t }: ExampleProps) {
  return (
    <Example label={t.default}>
      <MasterDetail
        master={<Text>{t.sample}</Text>}
        detail={<Text>{t.helper}</Text>}
      />
    </Example>
  );
}
