"use client";

export function ThrowButton() {
  return (
    <button
      onClick={() => {
        throw new Error("Sentry client verification — safe to ignore");
      }}
      className="px-6 py-3 rounded-xl font-display font-bold bg-sat-primary text-white hover:bg-sat-primary-dark dark:bg-sky-500 dark:hover:bg-sky-600 transition-colors"
    >
      Throw test error
    </button>
  );
}
