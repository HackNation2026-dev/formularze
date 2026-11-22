'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { tokenStore, useFormats } from '@/lib/api';
import { useToken, useUnauthorized } from '@/features/auth/hooks';
import { useSystemStatus } from '@/features/system/hooks';
import {
  getMockScenario,
  setMockScenario,
  scenarios,
  type MockScenario,
} from '@/mocks/scenarios';
import { mockEnabled } from '@/lib/mock-runtime';
import {
  ApplicationShell,
  PreferenceControls,
  SystemStatus,
} from '@/design-system/templates/AppShell/Connected';
import { SettingsPanel } from '@/design-system/organisms/SettingsPanel';
import { Text } from '@/design-system/atoms/Text';
import { Button } from '@/design-system/atoms/Button';
import { TextInput } from '@/design-system/atoms/TextInput';
import { Select } from '@/design-system/atoms/Select';
import { Skeleton } from '@/design-system/atoms/Skeleton';
import { FormField } from '@/design-system/molecules/FormField';
import { KeyValue } from '@/design-system/molecules/KeyValue';
import { Callout } from '@/design-system/molecules/Callout';
export default function Page() {
  const t = useTranslations('settings');
  const shell = useTranslations('shell');
  const upload = useTranslations('upload');
  const token = useToken();
  const formats = useFormats();
  useUnauthorized(formats.error, 'settings');
  const system = useSystemStatus();
  const router = useRouter();
  const [scenario, selectScenario] = useState(getMockScenario);
  return (
    <ApplicationShell>
      <div className="grid gap-4">
        <Text as="h2" variant="heading">
          {t('title')}
        </Text>
        <SettingsPanel
          sections={[
            {
              title: t('preferences'),
              content: (
                <div className="flex flex-wrap gap-4">
                  <PreferenceControls />
                </div>
              ),
            },
            {
              title: t('access'),
              content: (
                <>
                  {token ? (
                    <>
                      <FormField label={t('token')}>
                        <TextInput
                          type="password"
                          readOnly
                          value={token}
                          autoComplete="off"
                        />
                      </FormField>
                      <Button
                        variant="danger"
                        onClick={() => tokenStore.set(null)}
                      >
                        {t('removeToken')}
                      </Button>
                    </>
                  ) : (
                    <Text>{t('noToken')}</Text>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => router.push('/login?returnTo=settings')}
                  >
                    {t('login')}
                  </Button>
                </>
              ),
            },
            {
              title: t('formats'),
              content: formats.data ? (
                <>
                  <KeyValue
                    label={t('extensions')}
                    value={formats.data.extensions.join(', ')}
                  />
                  <KeyValue
                    label={t('limit')}
                    value={formats.data.max_upload_size_mb}
                  />
                </>
              ) : formats.isError ? (
                <Callout tone="danger">
                  {upload('formatsError')}
                  <Button
                    variant="ghost"
                    onClick={() => void formats.refetch()}
                  >
                    {shell('retry')}
                  </Button>
                </Callout>
              ) : (
                <Skeleton label={shell('loading')} />
              ),
            },
            {
              title: t('system'),
              content: (
                <>
                  <SystemStatus />
                  <KeyValue
                    label={t('health')}
                    value={system.health.data?.status ?? shell('unknown')}
                  />
                  <KeyValue
                    label={t('ready')}
                    value={
                      system.ready.data
                        ? shell(system.ready.data.status)
                        : shell('unknown')
                    }
                  />
                  {(['extractor', 'llm', 'ocr'] as const).map((key) => (
                    <KeyValue
                      key={key}
                      label={t(key)}
                      value={system.ready.data?.[key] ?? shell('unknown')}
                    />
                  ))}
                </>
              ),
            },
            ...(mockEnabled
              ? [
                  {
                    title: t('mock'),
                    content: (
                      <FormField label={t('scenario')}>
                        <Select
                          value={scenario}
                          onChange={(event) => {
                            const value = event.target.value as MockScenario;
                            setMockScenario(value);
                            selectScenario(value);
                          }}
                        >
                          {scenarios.map((value) => (
                            <option value={value} key={value}>
                              {value === 'plain-500'
                                ? t('plain500')
                                : [
                                      'auto',
                                      'success',
                                      'degraded',
                                      'detail',
                                    ].includes(value)
                                  ? t(value)
                                  : value}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>
    </ApplicationShell>
  );
}
