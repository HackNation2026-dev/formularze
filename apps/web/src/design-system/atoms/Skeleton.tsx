export function Skeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="h-6 w-full animate-pulse rounded-sm bg-border motion-reduce:animate-none"
    />
  );
}
