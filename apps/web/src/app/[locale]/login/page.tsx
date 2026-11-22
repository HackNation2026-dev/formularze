'use client';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useRouter } from '@/i18n/navigation';
import { safeReturnTo } from '@/features/auth/hooks';
import { tokenStore } from '@/lib/api';
import { ApplicationShell } from '@/design-system/templates/AppShell/Connected';
import { AuthLayout } from '@/design-system/templates/AuthLayout';
import { LoginForm } from '@/design-system/organisms/LoginForm';
import { Text } from '@/design-system/atoms/Text';
import { Callout } from '@/design-system/molecules/Callout';
function Login() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const finish = (token: string | null) => {
    tokenStore.set(token);
    router.replace(safeReturnTo(params.get('returnTo')));
  };
  return (
    <AuthLayout>
      <Text as="h2" variant="heading">
        {t('title')}
      </Text>
      <Text muted>{t('description')}</Text>
      {params.get('reason') === '401' && (
        <Callout role="alert" tone="danger">
          {t('unauthorized')}
        </Callout>
      )}
      <LoginForm
        tokenLabel={t('token')}
        submitLabel={t('login')}
        skipLabel={t('skip')}
        requiredMessage={t('required')}
        onLogin={finish}
        onSkip={() => finish(null)}
      />
    </AuthLayout>
  );
}
export default function Page() {
  return (
    <ApplicationShell>
      <Suspense>
        <Login />
      </Suspense>
    </ApplicationShell>
  );
}
