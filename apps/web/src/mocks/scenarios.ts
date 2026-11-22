import { errorStatuses, type KnownErrorCode } from '@/lib/api/errors';

export const scenarios = [
  'auto',
  'success',
  'degraded',
  ...Object.keys(errorStatuses),
  'detail',
  'plain-500',
] as const;
export type MockScenario =
  'auto' | 'success' | 'degraded' | KnownErrorCode | 'detail' | 'plain-500';
const KEY = 'formgen.mockScenario';
let selected: MockScenario = 'auto';
export function getMockScenario(): MockScenario {
  if (typeof window === 'undefined') return selected;
  try {
    const saved = localStorage.getItem(KEY);
    return scenarios.includes(saved ?? '') ? (saved as MockScenario) : selected;
  } catch {
    return selected;
  }
}
export function setMockScenario(scenario: MockScenario) {
  selected = scenario;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(KEY, scenario);
    } catch {
      /* Preferencja pozostaje w pamięci. */
    }
  }
}
export function scenarioForFilename(
  filename: string,
): Exclude<MockScenario, 'auto'> {
  const forced = getMockScenario();
  if (forced !== 'auto') return forced;
  if (filename.length > 250 || /[;:<>/\\|'*%$]/.test(filename))
    return 'INVALID_FILENAME';
  const name = filename.toLowerCase();
  const aliases: [string, Exclude<MockScenario, 'auto'>][] = [
    ['413', 'FILE_TOO_LARGE'],
    ['415', 'UNSUPPORTED_MEDIA_TYPE'],
    ['mime', 'MIME_MISMATCH'],
    ['401', 'UNAUTHORIZED'],
    ['timeout', 'PROCESSING_TIMEOUT'],
    ['503', 'MODEL_UNAVAILABLE'],
    ['invalid-output', 'INVALID_OUTPUT'],
    ['degraded', 'degraded'],
    ['auth-misconfigured', 'AUTH_MISCONFIGURED'],
    ['missing-file', 'MISSING_FILE'],
    ['too-many-files', 'TOO_MANY_FILES'],
    ['invalid-form-definition', 'INVALID_FORM_DEFINITION'],
    ['invalid-sample-values', 'INVALID_SAMPLE_VALUES'],
    ['detail', 'detail'],
    ['plain-500', 'plain-500'],
  ];
  return aliases.find(([pattern]) => name.includes(pattern))?.[1] ?? 'success';
}
