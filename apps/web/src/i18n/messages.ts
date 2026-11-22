import plResults from '../../messages/pl/results.json';
import enResults from '../../messages/en/results.json';
import plPreview from '../../messages/pl/preview.json';
import enPreview from '../../messages/en/preview.json';
import plCommon from '../../messages/pl/common.json';
import enCommon from '../../messages/en/common.json';
import plDesignSystem from '../../messages/pl/design-system.json';
import enDesignSystem from '../../messages/en/design-system.json';
import plShell from '../../messages/pl/shell.json';
import enShell from '../../messages/en/shell.json';
import plAuth from '../../messages/pl/auth.json';
import enAuth from '../../messages/en/auth.json';
import plUpload from '../../messages/pl/upload.json';
import enUpload from '../../messages/en/upload.json';
import plSettings from '../../messages/pl/settings.json';
import enSettings from '../../messages/en/settings.json';
import plOpen from '../../messages/pl/open.json';
import enOpen from '../../messages/en/open.json';

export const messages = {
  pl: {
    results: plResults,
    preview: plPreview,
    common: plCommon,
    'design-system': plDesignSystem,
    shell: plShell,
    auth: plAuth,
    upload: plUpload,
    settings: plSettings,
    open: plOpen,
  },
  en: {
    results: enResults,
    preview: enPreview,
    common: enCommon,
    'design-system': enDesignSystem,
    shell: enShell,
    auth: enAuth,
    upload: enUpload,
    settings: enSettings,
    open: enOpen,
  },
};
export type Locale = keyof typeof messages;
