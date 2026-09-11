import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { isEmailAuthEnabled } from "@/lib/email-auth";
import { SESSION_COOKIE_DOMAIN, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

/**
 * Only registered while email auth is switched on. With no mail provider
 * configured, Google is the only intended way in, so the password path is
 * left out of the provider list entirely rather than merely hidden.
 */
const credentialsProvider = CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      const user = await prisma.user.findUnique({
        where: { email: credentials.email.trim().toLowerCase() },
      });

      if (!user || !user.password) return null;

      if (!user.emailVerified) return null;

      const valid = await verifyPassword(credentials.password, user.password);
      if (!valid) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  });

/**
 * tasks.cainsat.org runs the planner as static files with no backend of its own,
 * so it reads the session from here. Both hosts sit under cainsat.org, which
 * makes them same-site: a SameSite=Lax cookie is still sent on the planner's
 * fetches once the cookie is scoped to the parent domain.
 *
 * The name and domain live in `session-cookie` because the middleware needs the
 * same name and cannot import this module (it would drag Prisma onto the edge
 * runtime). They must not drift apart -- see the comment there.
 */
const PLANNER_ORIGIN = "https://tasks.cainsat.org";

export const authOptions: NextAuthOptions = {
  ...(SESSION_COOKIE_DOMAIN && SESSION_COOKIE_NAME
    ? {
        cookies: {
          sessionToken: {
            name: SESSION_COOKIE_NAME,
            options: {
              httpOnly: true,
              sameSite: "lax" as const,
              path: "/",
              secure: true,
              domain: SESSION_COOKIE_DOMAIN,
            },
          },
        },
      }
    : {}),
  providers: [
    ...(isEmailAuthEnabled() ? [credentialsProvider] : []),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only handle OAuth providers (Google, etc.)
      if (account?.provider === "google") {
        if (!user.email) return false;

        try {
          // Find or create the user record
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            include: { accounts: true },
          });

          if (existingUser) {
            // User exists — link Google account if not already linked
            const alreadyLinked = existingUser.accounts.some(
              (a) => a.provider === "google" && a.providerAccountId === account.providerAccountId
            );
            if (!alreadyLinked) {
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              });
            }
            // Ensure emailVerified is set for Google users
            if (!existingUser.emailVerified) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                  emailVerified: new Date(),
                  image: user.image ?? existingUser.image,
                  name: user.name ?? existingUser.name,
                },
              });
            }
            // Pass the DB id back through so jwt callback gets the right id
            user.id = existingUser.id;
          } else {
            // New user — create them
            const newUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name,
                image: user.image,
                emailVerified: new Date(),
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                  },
                },
              },
            });
            user.id = newUser.id;
          }
          return true;
        } catch (err) {
          console.error("[Google signIn] DB error:", err);
          return false;
        }
      }
      // Credentials provider — already validated in authorize()
      return true;
    },

    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      let origin: string;
      try {
        origin = new URL(url).origin;
      } catch {
        return `${baseUrl}/dashboard`;
      }
      if (origin === baseUrl) return url;
      // The planner sends students here to sign in and expects them back. It is
      // named explicitly rather than matched by suffix, so a lookalike host
      // cannot collect the redirect.
      if (origin === PLANNER_ORIGIN) return url;
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
