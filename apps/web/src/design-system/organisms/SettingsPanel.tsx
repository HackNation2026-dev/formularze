import type { ReactNode } from 'react';
import { Text } from '../atoms/Text';
export interface SettingsPanelProps {
  sections: { title: string; content: ReactNode }[];
}
export function SettingsPanel({ sections }: SettingsPanelProps) {
  return (
    <div className="grid gap-6">
      {sections.map(({ title, content }) => (
        <section
          key={title}
          className="grid min-w-0 gap-4 rounded-lg border border-border bg-surface p-4"
        >
          <Text as="h2" variant="heading">
            {title}
          </Text>
          {content}
        </section>
      ))}
    </div>
  );
}
