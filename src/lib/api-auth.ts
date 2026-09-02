import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/** The signed-in user's id, or null. Every route that touches student data uses it. */
export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}
