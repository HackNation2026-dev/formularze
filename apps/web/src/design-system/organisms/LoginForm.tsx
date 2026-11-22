'use client';
import { useForm } from '@tanstack/react-form';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/TextInput';
import { FormField } from '../molecules/FormField';
export interface LoginFormProps {
  tokenLabel: string;
  submitLabel: string;
  skipLabel: string;
  requiredMessage: string;
  onLogin: (token: string) => void;
  onSkip: () => void;
}
export function LoginForm({
  tokenLabel,
  submitLabel,
  skipLabel,
  requiredMessage,
  onLogin,
  onSkip,
}: LoginFormProps) {
  const form = useForm({
    defaultValues: { token: '' },
    onSubmit: ({ value }) => onLogin(value.token.trim()),
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="token"
        validators={{
          onSubmit: ({ value }) => (value.trim() ? undefined : requiredMessage),
        }}
      >
        {(field) => (
          <FormField
            id="jwt-token"
            label={tokenLabel}
            error={field.state.meta.errors.join(' ')}
          >
            <TextInput
              id="jwt-token"
              name={field.name}
              type="password"
              autoComplete="off"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              state={field.state.meta.errors.length ? 'error' : 'default'}
            />
          </FormField>
        )}
      </form.Field>
      <Button type="submit">{submitLabel}</Button>
      <Button variant="secondary" onClick={onSkip}>
        {skipLabel}
      </Button>
    </form>
  );
}
