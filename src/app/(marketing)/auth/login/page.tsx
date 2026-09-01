"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { KcainLogo } from "@/components/layout/KcainLogo";

// Email/password sign-in is dormant until an email provider (Resend, SES, etc.)
// is configured — flip this on once EMAIL_FROM / RESEND_API_KEY are set.
const EMAIL_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH === "true";

// When OAuth fails, NextAuth redirects back here with ?error=<code> rather than
// returning anything to the caller. Without this the page would render as if
// nothing had happened, which makes a broken login impossible to diagnose.
const AUTH_ERRORS: Record<string, string> = {
  OAuthSignin: "Could not reach Google. Please try again.",
  OAuthCallback: "Google rejected the sign-in. This usually means the redirect URI or NEXTAUTH_URL is misconfigured.",
  OAuthCreateAccount: "Could not create your account. Please try again.",
  OAuthAccountNotLinked: "That email is already registered with a different sign-in method.",
  Callback: "Sign-in could not be completed. Please try again.",
  AccessDenied: "Sign-in was denied. If this persists, the server may be unable to reach the database.",
  Configuration: "Server auth configuration error. Check that NEXTAUTH_SECRET and the Google credentials are set.",
  Verification: "That sign-in link has expired. Please try again.",
};

function describeAuthError(code: string | null): string {
  if (!code) return "";
  return AUTH_ERRORS[code] ?? `Sign-in failed (${code}).`;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Errors raised during the OAuth round trip arrive as a query param, not as a
  // return value, so surface those alongside any locally-set error.
  const displayedError = error || describeAuthError(searchParams.get("error"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password. New user? Verify your email first.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");
    // OAuth always performs a full-page redirect to the provider: this call does
    // not return, and `redirect: false` is ignored for non-credentials providers.
    // Failures come back as ?error= on this page, handled by displayedError.
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <motion.div
      className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-sat-cream to-white dark:from-sat-gray-900 dark:to-sat-gray-800"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="card w-full max-w-md p-8 shadow-xl dark:bg-sat-gray-800 dark:border-sat-gray-700">
        <div className="flex justify-center mb-8">
          <KcainLogo size="lg" />
        </div>
        <h1 className="text-2xl font-display font-bold text-center mb-2 dark:text-white">Welcome back</h1>
        <p className="text-sat-gray-600 dark:text-sky-200 text-center mb-6">Log in to access your dashboard, lessons, and practice.</p>

        {/* Google Sign In */}
        <motion.button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-sat-gray-200 dark:border-sat-gray-600 bg-white dark:bg-sat-gray-700 text-sat-gray-800 dark:text-white font-medium text-sm hover:bg-sat-gray-50 dark:hover:bg-sat-gray-600 transition-colors disabled:opacity-60 mb-4"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </motion.button>

        {displayedError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-sat-crimson/10 text-sat-crimson text-sm mb-4"
          >
            {displayedError}
          </motion.div>
        )}

        {EMAIL_AUTH_ENABLED && (
          <>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-sat-gray-200 dark:border-sat-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs text-sat-gray-400 dark:text-sat-gray-500">
                <span className="bg-white dark:bg-sat-gray-800 px-3">or continue with email</span>
              </div>
            </div>

            <p className="text-xs text-sat-gray-500 dark:text-sky-300 text-center mb-4">New? Check your email for a verification link before logging in.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-sat-gray-700 dark:text-sky-200 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-700 dark:text-white focus:ring-2 focus:ring-sat-primary dark:focus:ring-sky-500 focus:border-sat-primary outline-none transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-sat-gray-700 dark:text-sky-200">
                    Password
                  </label>
                  <Link href="/auth/forgot-password" className="text-xs text-sat-primary font-medium hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-700 dark:text-white focus:ring-2 focus:ring-sat-primary dark:focus:ring-sky-500 outline-none transition"
                />
              </div>
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? "Signing in..." : "Log in"}
              </motion.button>
            </form>

            <p className="mt-6 text-center text-sm text-sat-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-sat-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-sat-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
