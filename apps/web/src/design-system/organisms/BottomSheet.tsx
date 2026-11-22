'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '../atoms/Button';
import { Text } from '../atoms/Text';
export interface BottomSheetProps {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}
export function BottomSheet({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: BottomSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    const trigger = document.activeElement;
    if (matchMedia('(max-width: 767px)').matches) node.showModal();
    const media = matchMedia('(max-width: 767px)');
    const adapt = () => {
      if (open && media.matches && !node.open) node.showModal();
      else if (!media.matches && node.open) node.close();
    };
    media.addEventListener('change', adapt);
    return () => {
      media.removeEventListener('change', adapt);
      if (node.open) node.close();
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-dvh w-full overflow-y-auto rounded-t-lg border border-border bg-surface p-4 text-text backdrop:bg-background/80 md:hidden"
    >
      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <Text id={id} as="h2" variant="heading">
            {title}
          </Text>
          <Button variant="ghost" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
