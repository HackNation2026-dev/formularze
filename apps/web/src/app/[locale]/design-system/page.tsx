import { getMessages } from 'next-intl/server';
import { Catalogue } from './catalogue/Catalogue';
import { tokenThemes } from './catalogue/token-data';
import type { Copy } from './catalogue/shared';
export default async function DesignSystemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = (await getMessages({ locale }))['design-system'] as Copy;
  return <Catalogue t={copy} themes={tokenThemes()} />;
}
