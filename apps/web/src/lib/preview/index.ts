import jsonata from 'jsonata';
import type { Field, FormDefinition, Question } from '@/lib/api/schemas';
import { sanitizeHtml } from './sanitize';

export { sanitizeHtml } from './sanitize';

/** Odpowiedzi pojedyncze są tekstem, wielokrotne tablicą nazw opcji. */
export type Answer = string | string[];
export interface AnswerQuestion {
  field: {
    techName: string;
    repeatingSectionGrid: AnswerQuestion[];
    __userAnswer: Answer;
  };
}
/** Kształt danych oczekiwany przez zapytania JSONata z kontraktu COI. */
export interface PreviewState {
  tabs: { title: string; questions: AnswerQuestion[] }[];
}
export interface ConditionError {
  type: 'SHOW' | 'READ_ONLY';
  query: string;
  message: 'błędny warunek';
}
export interface FieldView {
  key: string;
  id: string;
  techName: string;
  type: Field['type'];
  label: string;
  description: string;
  tooltip: string;
  options: { id: string; name: string; techName?: string | null }[];
  dictionaryName: string | null;
  validators: Field['validation'];
  required: boolean;
  readOnly: boolean;
  defaultValue: Answer;
  placeholder: string;
  consents: { description: string; required: boolean }[];
  children: FieldView[];
  layout: { x: number; y: number; rows: number; cols: number };
  visible: boolean;
  conditionErrors: ConditionError[];
}
export interface ViewModel {
  title: string;
  tabs: {
    id: string;
    title: string;
    type: 'MAIN' | 'FINISH';
    questions: FieldView[];
  }[];
}

function initialAnswer(field: Field): Answer {
  const value = field.defaultValue;
  if (field.type === 'CHECKBOX' || field.type === 'CONSENT_SECTION') {
    return Array.isArray(value) ? [...value] : value ? [value] : [];
  }
  // Fixtures zapisują defaultValue SELECT jako tablicę, choć odpowiedź jest pojedyncza.
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function mapQuestions(questions: Question[], parent: string): FieldView[] {
  return questions.map((question, index) => {
    const field = question.field;
    const key = `${parent}.${index}`;
    const dictionaryName = field.dictionaryName ?? null;
    const dictionaryOptions = dictionaryName
      ?.toLocaleLowerCase('pl')
      .includes('kraj')
      ? ['Polska', 'Niemcy', 'Czechy'].map((name) => ({ id: name, name }))
      : [];
    return {
      key,
      id: field.id,
      techName: field.techName,
      type: field.type,
      label: field.title,
      description: sanitizeHtml(field.description),
      tooltip: field.tooltipMessage,
      options: field.options.length
        ? field.options.map((option) => ({ ...option }))
        : dictionaryOptions,
      dictionaryName,
      validators: [...field.validation],
      required:
        field.validation.includes('REQUIRED') ||
        field.consentSectionConfig?.required === true,
      readOnly: field.readOnly,
      defaultValue: initialAnswer(field),
      placeholder:
        field.defaultValueType === 'EXTERNAL_SYSTEM'
          ? String(initialAnswer(field))
          : '',
      consents: (field.consentSectionConfig?.consents ?? []).map((consent) => ({
        description: sanitizeHtml(consent.description),
        required:
          consent.required ?? field.consentSectionConfig?.required ?? false,
      })),
      children: mapQuestions(field.repeatingSectionGrid, key),
      layout: {
        x: question.x,
        y: question.y,
        rows: question.rows,
        cols: question.cols,
      },
      visible: true,
      conditionErrors: [],
    };
  });
}

/** Buduje niezależny od Reacta opis wszystkich pól; klucz to indeksy tab.q.q. */
export function buildViewModel(form: FormDefinition): ViewModel {
  return {
    title: form.title,
    tabs: form.tabs.map((tab, index) => ({
      id: tab.id,
      title: tab.title,
      type: tab.type,
      questions: mapQuestions(tab.questions, String(index)),
    })),
  };
}

/** Inicjalizuje odpowiedzi z defaultValue, nie zmieniając definicji formularza. */
export function createState(form: FormDefinition): PreviewState {
  const map = (questions: Question[]): AnswerQuestion[] =>
    questions.map(({ field }) => ({
      field: {
        techName: field.techName,
        repeatingSectionGrid: map(field.repeatingSectionGrid),
        __userAnswer: initialAnswer(field),
      },
    }));
  return {
    tabs: form.tabs.map((tab) => ({
      title: tab.title,
      questions: map(tab.questions),
    })),
  };
}

/** Zwraca nowy stan; aktualizuje dokładne techName na dowolnej głębokości. */
export function applyAnswer(
  state: PreviewState,
  techName: string,
  value: Answer,
): PreviewState {
  const map = (questions: AnswerQuestion[]): AnswerQuestion[] =>
    questions.map(({ field }) => ({
      field: {
        ...field,
        __userAnswer:
          field.techName === techName
            ? Array.isArray(value)
              ? [...value]
              : value
            : Array.isArray(field.__userAnswer)
              ? [...field.__userAnswer]
              : field.__userAnswer,
        repeatingSectionGrid: map(field.repeatingSectionGrid),
      },
    }));
  return {
    tabs: state.tabs.map((tab) => ({ ...tab, questions: map(tab.questions) })),
  };
}

// Ograniczony cache obejmuje także niepoprawne składniowo zapytania.
const expressions = new Map<string, jsonata.Expression | null>();
function compile(query: string): jsonata.Expression | null {
  if (expressions.has(query)) return expressions.get(query) ?? null;
  let expression: jsonata.Expression | null = null;
  try {
    expression = jsonata(`$boolean((${query}))`, {
      timeout: 100,
      stack: 200,
      sequence: 10000,
    });
  } catch {
    /* Błąd kompilacji zostanie przypisany do pola. */
  }
  if (expressions.size >= 256)
    expressions.delete(expressions.keys().next().value!);
  expressions.set(query, expression);
  return expression;
}

/**
 * Asynchronicznie ocenia warunki, zwraca nowy model widoku z widocznością i błędami.
 * SHOW łączy się przez AND, READ_ONLY przez OR z readOnly definicji/rodzica.
 * Ukrycie rodzica ukrywa potomków. Błąd SHOW ukrywa, błąd READ_ONLY blokuje pole.
 */
export async function evaluateStates(
  form: FormDefinition,
  state: PreviewState,
): Promise<ViewModel> {
  const view = buildViewModel(form);
  const evaluate = async (
    questions: Question[],
    fields: FieldView[],
    visible: boolean,
    readOnly: boolean,
  ): Promise<void> => {
    for (const [index, { field }] of questions.entries()) {
      const target = fields[index];
      target.visible = visible;
      target.readOnly ||= readOnly;
      for (const condition of field.states) {
        try {
          const expression = compile(condition.query);
          if (!expression) throw new Error('Invalid condition');
          const result: unknown = await expression.evaluate(state);
          if (condition.type === 'SHOW') target.visible &&= result === true;
          else target.readOnly ||= result === true;
        } catch {
          target.conditionErrors.push({
            ...condition,
            message: 'błędny warunek',
          });
          if (condition.type === 'SHOW') target.visible = false;
          else target.readOnly = true;
        }
      }
      await evaluate(
        field.repeatingSectionGrid,
        target.children,
        target.visible,
        target.readOnly,
      );
    }
  };
  for (const [index, tab] of form.tabs.entries()) {
    await evaluate(tab.questions, view.tabs[index].questions, true, false);
  }
  return view;
}

export interface StepNavigation {
  current: string | null;
  previous: string | null;
  next: string | null;
  finished: boolean;
}

/**
 * Nawigacja według ID w flow.links (pierwsze poprawne połączenie), nigdy kolejności tabów.
 * Przyjmuje ID lub indeks taba. FINISH kończy przepływ; brak połączenia daje next=null.
 * Stan jest argumentem dla zgodności interfejsu; kontrakt Link nie zawiera warunków.
 */
export function nextStep(
  form: FormDefinition,
  tab: string | number,
  _state: PreviewState,
): StepNavigation {
  void _state;
  const current =
    typeof tab === 'number'
      ? form.tabs[tab]
      : form.tabs.find((item) => item.id === tab);
  if (!current)
    return { current: null, previous: null, next: null, finished: false };
  const exists = (id: string) => form.tabs.some((item) => item.id === id);
  return {
    current: current.id,
    previous:
      form.flow.links.find(
        (link) => link.target === current.id && exists(link.source),
      )?.source ?? null,
    next:
      current.type === 'FINISH'
        ? null
        : (form.flow.links.find(
            (link) => link.source === current.id && exists(link.target),
          )?.target ?? null),
    finished: current.type === 'FINISH',
  };
}
