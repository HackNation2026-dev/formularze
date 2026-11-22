import plCommon from '../../messages/pl/common.json';
import enCommon from '../../messages/en/common.json';

export const messages = { pl: { common: plCommon }, en: { common: enCommon } };
export type Locale = keyof typeof messages;
