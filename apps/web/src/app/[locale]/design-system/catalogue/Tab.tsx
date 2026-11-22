'use client';
import { useState } from 'react';
import { Tab } from '@/design-system/molecules/Tab';
import { Example, type ExampleProps } from './shared';

export default function TabCatalogue({ t }: ExampleProps) {
  const [active, setActive] = useState(0);
  return (
    <Example label={t.active + ' / ' + t.inactive}>
      <div
        role="tablist"
        aria-label={t.tabs}
        className="flex flex-wrap"
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next =
              event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - active;
            setActive(next);
            event.currentTarget
              .querySelectorAll<HTMLButtonElement>('[role=tab]')
              [next].focus();
          }
        }}
      >
        {[t.step1, t.step2].map((label, i) => (
          <Tab
            key={label}
            id={'catalogue-tab-' + i}
            active={active === i}
            panelId={'catalogue-panel-' + i}
            onClick={() => setActive(i)}
          >
            {label}
          </Tab>
        ))}
      </div>
      {[t.step1, t.step2].map((label, i) => (
        <div
          key={label}
          id={'catalogue-panel-' + i}
          role="tabpanel"
          aria-labelledby={'catalogue-tab-' + i}
          hidden={active !== i}
        >
          {label}
        </div>
      ))}
    </Example>
  );
}
