/** A pulsing placeholder block, sized like the real content it stands in for. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-sat-gray-200 dark:bg-sat-gray-700 ${className}`}
      aria-hidden
    />
  );
}
