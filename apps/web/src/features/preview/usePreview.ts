'use client';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import type { FormDefinition } from '@/lib/api/schemas';
import { buildViewModel, createState, evaluateStates } from '@/lib/preview';
import type { Answer, AnswerQuestion } from '@/lib/preview';
export function usePreview(definition: FormDefinition) {
  const initial = useMemo(() => createState(definition), [definition]);
  const defaults = useMemo(() => {
    const values: Record<string, Answer> = {};
    function visit(questions: AnswerQuestion[]) {
      questions.forEach(({ field }) => {
        values[field.techName] = field.__userAnswer;
        visit(field.repeatingSectionGrid);
      });
    }
    initial.tabs.forEach((tab) => visit(tab.questions));
    return values;
  }, [initial]);
  const form = useForm({ defaultValues: defaults });
  const [evaluation, setEvaluation] = useState<{
    view: ReturnType<typeof buildViewModel>;
    ready: boolean;
  }>(() => ({ view: buildViewModel(definition), ready: false }));
  const [answers, setAnswers] = useState(initial);
  useEffect(() => {
    let active = true;
    void evaluateStates(definition, answers).then((view) => {
      if (active) setEvaluation({ view, ready: true });
    });
    return () => {
      active = false;
    };
  }, [definition, answers]);
  return { form, answers, setAnswers, ...evaluation };
}
