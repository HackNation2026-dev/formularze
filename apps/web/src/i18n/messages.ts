import plResults from '../../messages/pl/results.json';
import enResults from '../../messages/en/results.json';
import plPreview from '../../messages/pl/preview.json';
import enPreview from '../../messages/en/preview.json';
import plCommon from '../../messages/pl/common.json';
import enCommon from '../../messages/en/common.json';
import plDesignSystem from '../../messages/pl/design-system.json';
import enDesignSystem from '../../messages/en/design-system.json';

export const messages = {
  pl: {
    results: plResults,
    preview: plPreview,
    common: plCommon,
    'design-system': plDesignSystem,
  },
  en: {
    results: enResults,
    preview: enPreview,
    common: enCommon,
    'design-system': enDesignSystem,
  },
};
export type Locale = keyof typeof messages;
