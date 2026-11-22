'use client';
import { useId, useState } from 'react';
import { Button } from '../atoms/Button';
import { TextInput } from '../atoms/TextInput';
import { Text } from '../atoms/Text';
export interface DropzoneProps {
  label: string;
  action: string;
  helper?: string;
  accept?: string;
  disabled?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}
export function Dropzone({
  label,
  action,
  helper,
  accept,
  disabled,
  multiple = true,
  onFiles,
}: DropzoneProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
      data-dragging={dragging}
      aria-disabled={disabled}
      className={`grid justify-items-center gap-4 rounded-lg border-2 border-dashed bg-surface p-6 text-center ${dragging ? 'border-primary' : 'border-border-strong'}`}
    >
      <Text>{label}</Text>
      <TextInput
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={action}
        aria-describedby={helper ? `${id}-help` : undefined}
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <Button
        disabled={disabled}
        onClick={() => document.getElementById(id)?.click()}
      >
        {action}
      </Button>
      {helper && (
        <Text id={`${id}-help`} variant="caption" muted>
          {helper}
        </Text>
      )}
    </div>
  );
}
