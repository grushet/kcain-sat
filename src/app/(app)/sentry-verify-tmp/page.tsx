import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin-auth";
import { ThrowButton } from "./ThrowButton";

export const dynamic = "force-dynamic";

/**
 * Temporary: verifies client-side Sentry capture reaches production.
 * Same admin-only gate as /admin -- delete this route once verified.
 */
export default async function SentryVerifyPage() {
  if (!(await isCurrentUserAdmin())) notFound();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <ThrowButton />
    </div>
  );
}
