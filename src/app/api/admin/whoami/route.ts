import { NextResponse } from "next/server";
import { isCurrentUserAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Lets the sidebar decide whether to show the Admin link, without exposing ADMIN_EMAIL to the client. */
export async function GET() {
  return NextResponse.json({ isAdmin: await isCurrentUserAdmin() });
}
