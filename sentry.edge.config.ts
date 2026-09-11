import * as Sentry from "@sentry/nextjs";

// Unset (both locally and until the owner sets it in Vercel) leaves the SDK a
// harmless no-op rather than failing the build or throwing at runtime.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
});
