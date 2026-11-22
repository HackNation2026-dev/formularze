'use client';
import type { ReactNode } from 'react';
import { Tab } from '../molecules/Tab';
export interface ResultTab {
  id: string;
  label: string;
  href: string;
}
export interface ResultLayoutProps {
  as?: 'main' | 'section';
  title: string;
  tabs: readonly ResultTab[];
  active: string;
  navigationLabel: string;
  children: ReactNode;
}
export function ResultLayout({
  as: Container = 'main',
  title,
  tabs,
  active,
  navigationLabel,
  children,
}: ResultLayoutProps) {
  return (
    <Container className="mx-auto grid w-full max-w-5xl min-w-0 gap-6 p-4 md:p-6">
      <h1 className="break-words text-2xl font-semibold">{title}</h1>
      <nav
        aria-label={navigationLabel}
        className="flex flex-wrap gap-4 border-b border-border"
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} href={tab.href} active={active === tab.id}>
            {tab.label}
          </Tab>
        ))}
      </nav>
      <div className="grid min-w-0 gap-4">{children}</div>
    </Container>
  );
}
