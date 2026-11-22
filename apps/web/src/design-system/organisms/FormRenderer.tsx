'use client';
import { useRef, useState } from 'react';
import type { FormDefinition } from '@/lib/api/schemas';
import {
  applyAnswer,
  createState,
  nextStep,
  sanitizeHtml,
  type Answer,
  type FieldView,
} from '@/lib/preview';
import { usePreview } from '@/features/preview/usePreview';
import {
  Button,
  TextInput,
  Textarea,
  Select,
  Radio,
  Checkbox,
  Badge,
} from '../atoms';
import {
  Callout,
  ChoiceGroup,
  EmptyState,
  FormField,
  StepIndicator,
} from '../molecules';
export interface PreviewLabels {
  empty: string;
  steps: string;
  back: string;
  next: string;
  cancel: string;
  cancelled: string;
  restart: string;
  dictionary: (name: string) => string;
  example: string;
  choose: string;
  file: string;
  fileHelp: string;
  add: string;
  conditionError: string;
  evaluating: string;
  finished: string;
  required: string;
}
export function FormRenderer({
  form,
  labels,
}: {
  form: FormDefinition;
  labels: PreviewLabels;
}) {
  return (
    <Renderer
      key={form.tabs.map((tab) => tab.id).join('|')}
      definition={form}
      labels={labels}
    />
  );
}
function Html({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}
function Renderer({
  definition,
  labels,
}: {
  definition: FormDefinition;
  labels: PreviewLabels;
}) {
  const { form, answers, setAnswers, view, ready } = usePreview(definition);
  const [step, setStep] = useState(definition.tabs[0]?.id ?? '');
  const [cancelled, setCancelled] = useState(false);
  const [repeats, setRepeats] = useState<Record<string, number>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  if (!view.tabs.length) return <EmptyState title={labels.empty} />;
  if (cancelled)
    return (
      <EmptyState
        title={labels.cancelled}
        action={
          <Button
            onClick={() => {
              form.reset();
              setStep(definition.tabs[0].id);
              setCancelled(false);
              setRepeats({});
              setAnswers(createState(definition));
            }}
          >
            {labels.restart}
          </Button>
        }
      />
    );
  const current = view.tabs.find((tab) => tab.id === step) ?? view.tabs[0];
  const navigation = nextStep(definition, current.id, answers);
  function move(id: string) {
    setStep(id);
    requestAnimationFrame(() => heading.current?.focus());
  }
  function renderField(field: FieldView, instance = ''): React.ReactNode {
    const key = field.techName + instance;
    const errors = field.conditionErrors.length > 0 && (
      <Badge tone="danger">{labels.conditionError}</Badge>
    );
    if (!field.visible)
      return errors ? (
        <div key={field.key + instance} className="flex gap-2">
          <span>{field.label}</span>
          {errors}
        </div>
      ) : null;
    const label = (
      <>
        {field.label}
        {field.required && (
          <span className="text-danger" aria-label={labels.required}>
            {' '}
            *
          </span>
        )}
      </>
    );
    if (field.type === 'SECTION' || field.type === 'REPEATING_SECTION')
      return (
        <section
          key={field.key + instance}
          className="grid gap-4 rounded-md border border-border bg-surface p-4"
        >
          <h3 className="text-xl font-semibold">{label}</h3>
          {errors}
          <Html html={field.description} />
          {Array.from(
            {
              length:
                field.type === 'REPEATING_SECTION' ? (repeats[key] ?? 1) : 1,
            },
            (_, index) => (
              <div key={index} className="grid gap-4">
                {field.children.map((child) =>
                  renderField(
                    child,
                    instance +
                      (field.type === 'REPEATING_SECTION' ? `.${index}` : ''),
                  ),
                )}
              </div>
            ),
          )}
          {field.type === 'REPEATING_SECTION' && (
            <Button
              variant="secondary"
              disabled={field.readOnly}
              onClick={() =>
                setRepeats({ ...repeats, [key]: (repeats[key] ?? 1) + 1 })
              }
            >
              {labels.add}
            </Button>
          )}
        </section>
      );
    if (field.type === 'TEXT_BLOCK' || field.type === 'INFO_SECTION')
      return (
        <section
          key={field.key + instance}
          className="grid gap-3 rounded-md border border-border bg-surface p-4"
        >
          {field.label && <h3 className="font-semibold">{label}</h3>}
          {errors}
          <Html html={field.description} />
        </section>
      );
    return (
      <div
        key={field.key + instance}
        className="grid min-w-0 gap-2"
        data-field={field.techName}
      >
        {errors}
        {field.description && <Html html={field.description} />}
        <form.Field name={key} defaultValue={field.defaultValue}>
          {(control) => {
            const answer = control.state.value ?? field.defaultValue;
            const change = (value: Answer) => {
              control.handleChange(value);
              setAnswers((state) => applyAnswer(state, field.techName, value));
            };
            const multi = Array.isArray(answer) ? answer : [];
            const toggle = (value: string, checked: boolean) =>
              change(
                checked
                  ? [...multi, value]
                  : multi.filter((item) => item !== value),
              );
            const disabled = field.readOnly || !ready;
            const helper = (
              <>
                {field.tooltip}
                {field.validators
                  .filter((value) => value !== 'REQUIRED')
                  .map((value) => (
                    <Badge key={value}>{value}</Badge>
                  ))}
              </>
            );
            if (field.type === 'RADIO' || field.type === 'CHECKBOX')
              return (
                <ChoiceGroup label={label} helper={helper}>
                  {field.options.map((option) =>
                    field.type === 'RADIO' ? (
                      <Radio
                        key={option.id}
                        name={key}
                        label={option.name}
                        checked={answer === option.name}
                        disabled={disabled}
                        onBlur={control.handleBlur}
                        onChange={() => change(option.name)}
                      />
                    ) : (
                      <Checkbox
                        key={option.id}
                        label={option.name}
                        checked={multi.includes(option.name)}
                        disabled={disabled}
                        onChange={(event) =>
                          toggle(option.name, event.target.checked)
                        }
                      />
                    ),
                  )}
                </ChoiceGroup>
              );
            if (field.type === 'CONSENT_SECTION')
              return (
                <ChoiceGroup label={label}>
                  {field.consents.map((consent, index) => (
                    <Checkbox
                      key={index}
                      label={
                        <>
                          <Html html={consent.description} />
                          {consent.required && (
                            <span className="text-danger"> *</span>
                          )}
                        </>
                      }
                      required={consent.required}
                      checked={multi.includes(String(index))}
                      disabled={disabled}
                      onChange={(event) =>
                        toggle(String(index), event.target.checked)
                      }
                    />
                  ))}
                </ChoiceGroup>
              );
            if (field.type === 'FILE_UPLOADER')
              return (
                <div className="grid gap-2 rounded-md border border-dashed border-border-strong p-4">
                  <p>{labels.file}</p>
                  <FormField
                    label={field.label}
                    required={field.required}
                    helper={labels.fileHelp}
                  >
                    <TextInput
                      aria-label={`${field.label}: ${labels.file}`}
                      type="file"
                      disabled={disabled}
                      onChange={(event) =>
                        change(event.target.files?.[0]?.name ?? '')
                      }
                    />
                  </FormField>
                </div>
              );
            if (field.type === 'SELECT')
              return (
                <FormField
                  label={field.label}
                  required={field.required}
                  helper={
                    <>
                      {field.dictionaryName &&
                        labels.dictionary(field.dictionaryName)}
                      {helper}
                    </>
                  }
                >
                  <Select
                    value={String(answer)}
                    disabled={disabled}
                    onBlur={control.handleBlur}
                    onChange={(event) => change(event.target.value)}
                  >
                    <option value="">{labels.choose}</option>
                    {String(answer) &&
                      !field.options.some(
                        (option) => option.name === answer,
                      ) && (
                        <option value={String(answer)}>{String(answer)}</option>
                      )}
                    {(field.options.length
                      ? field.options
                      : [{ id: 'example', name: labels.example }]
                    ).map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              );
            const common = {
              value: String(answer),
              disabled,
              placeholder: field.placeholder,
              onBlur: control.handleBlur,
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => change(event.target.value),
            };
            return (
              <FormField
                label={field.label}
                required={field.required}
                helper={helper}
                state={field.readOnly ? 'readOnly' : 'default'}
              >
                {field.type === 'TEXTAREA' ? (
                  <Textarea {...common} />
                ) : (
                  <TextInput
                    {...common}
                    type={
                      field.type === 'NUMBER'
                        ? 'number'
                        : field.type === 'DATEPICKER'
                          ? 'date'
                          : 'text'
                    }
                  />
                )}
              </FormField>
            );
          }}
        </form.Field>
      </div>
    );
  }
  return (
    <div className="grid min-w-0 gap-6" aria-busy={!ready}>
      <StepIndicator
        label={labels.steps}
        steps={view.tabs.map((tab) => tab.title)}
        current={view.tabs.indexOf(current)}
      />
      {!ready && <Callout role="status">{labels.evaluating}</Callout>}
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-primary"
      >
        {current.title}
      </h2>
      {current.questions.map((field) => renderField(field))}
      {navigation.finished && (
        <Callout tone="success">{labels.finished}</Callout>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={!navigation.previous}
          onClick={() => navigation.previous && move(navigation.previous)}
        >
          {labels.back}
        </Button>
        <Button
          disabled={!navigation.next || !ready}
          onClick={() => navigation.next && move(navigation.next)}
        >
          {labels.next}
        </Button>
        <Button variant="ghost" onClick={() => setCancelled(true)}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
