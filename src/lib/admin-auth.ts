import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

function adminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL;
  return email && email.trim().length > 0 ? email.trim().toLowerCase() : null;
}

/**
 * True only when ADMIN_EMAIL is set and matches the signed-in user's email.
 * Server-side only -- this is the actual gate for /api/admin/*; the /admin
 * page's own checks are just UX, not security.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const admin = adminEmail();
  if (!admin) return false;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return typeof email === "string" && email.trim().toLowerCase() === admin;
}
