import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { corsJson, plannerPreflight } from "@/lib/planner-cors";

export const dynamic = "force-dynamic";

export const OPTIONS = plannerPreflight;

/**
 * Who the planner is talking to. NextAuth's own /api/auth/session is not
 * reachable cross-origin -- it does not carry the planner's CORS headers -- so
 * the planner asks here instead.
 *
 * Always 200, with a null user when signed out, so the client can tell "not
 * signed in" apart from "the API is down".
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; image?: string | null }
    | undefined;

  if (!user?.id) return corsJson(req, { user: null });

  return corsJson(req, {
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
    },
  });
}
