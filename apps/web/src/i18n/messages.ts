import plCommon from '../../messages/pl/common.json';
import enCommon from '../../messages/en/common.json';
import plDesignSystem from '../../messages/pl/design-system.json';
import enDesignSystem from '../../messages/en/design-system.json';

export const messages = {
  pl: { common: plCommon, 'design-system': plDesignSystem },
  en: { common: enCommon, 'design-system': enDesignSystem },
};
export type Locale = keyof typeof messages;
