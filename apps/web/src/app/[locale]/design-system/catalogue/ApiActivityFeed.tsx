'use client';
import { recordActivity } from '@/lib/api/activity';
import { ApiActivityFeed as Feed } from '@/design-system/organisms/ApiActivityFeed';
import { messages } from '@/i18n/messages';
import type { ExampleProps } from './shared';
function locale(t: ExampleProps['t']): 'pl' | 'en' {
  return t.title === messages.pl['design-system'].title ? 'pl' : 'en';
}
export function ApiActivityFeed({ t }: ExampleProps) {
  const shell = messages[locale(t)].shell;
  recordActivity({ path: '/health', method: 'GET', status: 200, ms: 42 });
  recordActivity({
    path: '/api/v1/forms/analyze',
    method: 'POST',
    status: 200,
    ms: 5123,
  });
  return (
    <Feed
      labels={{ title: shell.activityTitle, empty: shell.activityEmpty }}
    />
  );
}
