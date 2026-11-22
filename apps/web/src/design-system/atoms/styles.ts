export const focus =
  'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4';
export const target = 'min-h-11 min-w-11';
// W1 ma niewarstwowe style przycisków i select; modyfikator ! zachowuje warianty atomów.
export const control = `${target} ${focus} w-full rounded-sm border border-border-strong bg-surface px-3! py-2! text-text disabled:cursor-not-allowed disabled:opacity-50`;
export type FieldState =
  'default' | 'focus' | 'error' | 'readOnly' | 'externalSystem';
export const fieldState = {
  default: '',
  focus: 'outline-2 outline-primary outline-offset-4',
  error: 'border-danger!',
  readOnly: 'bg-background text-muted',
  externalSystem: 'bg-background text-info border-dashed',
};
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export const tones: Record<Tone, string> = {
  success: 'text-success border-success',
  warning: 'text-warning border-warning',
  danger: 'text-danger border-danger',
  info: 'text-info border-info',
  neutral: 'text-muted border-border-strong',
};
export function cx(...values: (string | undefined | false)[]) {
  return values.filter(Boolean).join(' ');
}
