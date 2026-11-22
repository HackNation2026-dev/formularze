import type { JsonViewerLabels } from '@/design-system/organisms/JsonViewer';
import type { PreviewLabels } from '@/design-system/organisms/FormRenderer';
type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;
export function jsonLabels(t: Translate): JsonViewerLabels {
  return {
    empty: t('emptyJson'),
    copy: t('copy'),
    copied: t('copied'),
    copyError: t('copyError'),
    download: t('download'),
    more: t('more'),
    expand: t('expand'),
    collapse: t('collapse'),
  };
}
export function previewLabels(t: Translate): PreviewLabels {
  return {
    empty: t('empty'),
    steps: t('steps'),
    back: t('back'),
    next: t('next'),
    cancel: t('cancel'),
    cancelled: t('cancelled'),
    restart: t('restart'),
    dictionary: (name) => t('dictionary', { name }),
    example: t('example'),
    choose: t('choose'),
    file: t('file'),
    fileHelp: t('fileHelp'),
    add: t('add'),
    conditionError: t('conditionError'),
    evaluating: t('evaluating'),
    finished: t('finished'),
    required: t('required'),
  };
}
