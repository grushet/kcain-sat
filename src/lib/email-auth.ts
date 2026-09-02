/**
 * Email/password auth is fully built but switched off: no email provider is
 * configured, so verification and reset mail cannot actually be delivered.
 *
 * While it is off, the server routes must be closed too, not merely hidden in
 * the UI. `NEXT_PUBLIC_ENABLE_EMAIL_AUTH` only ever gated the client, so
 * /api/auth/signup stayed publicly callable: it created a real account and,
 * because sending always failed, returned the verification token in its own
 * response. That was enough to self-register a verified account and sign in
 * with credentials, bypassing Google entirely.
 */
export function isEmailAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH === "true";
}
