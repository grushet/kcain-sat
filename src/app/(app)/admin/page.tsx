import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin-auth";
import { AdminDashboard } from "./AdminDashboard";

export const dynamic = "force-dynamic";

/**
 * Server-gated: a non-admin gets the real 404 page, not a "not authorized"
 * message, so the route's existence isn't disclosed. isCurrentUserAdmin runs
 * on the server before any of this segment's client code ships.
 */
export default async function AdminPage() {
  if (!(await isCurrentUserAdmin())) notFound();

  return <AdminDashboard />;
}
