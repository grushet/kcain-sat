"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { KcainLogo } from "@/components/layout/KcainLogo";

// Email/password sign-up is dormant until an email provider (Resend, SES, etc.)
// is configured — flip this on once EMAIL_FROM / RESEND_API_KEY are set.
const EMAIL_AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH === "true";

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

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");
    const res = await signIn("google", { redirect: false, callbackUrl: "/dashboard" });
    if (res?.error) {
      setError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSuccess(false);
    setDevVerifyUrl(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSuccess(true);
      if (data.verifyUrl) setDevVerifyUrl(data.verifyUrl);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <motion.div
        className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-sat-cream to-white dark:from-sat-gray-900 dark:to-sat-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="card w-full max-w-md p-8 text-center dark:bg-sat-gray-800 dark:border-sat-gray-700">
          <div className="flex justify-center mb-6">
            <KcainLogo size="lg" />
          </div>
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mx-auto mb-6 text-white"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <h1 className="text-2xl font-display font-bold mb-2 dark:text-white">Check your email</h1>
          <p className="text-sat-gray-600 dark:text-sky-200 mb-6">
            We sent a verification link to <strong>{email}</strong>. Click it to activate your account, then log in to go to your dashboard.
          </p>
          {devVerifyUrl && process.env.NODE_ENV === "development" && (
            <div className="mb-6 p-4 bg-sat-primary/5 rounded-xl text-left">
              <p className="text-sm font-medium text-sat-primary mb-2">Dev mode: verification link</p>
              <a href={devVerifyUrl} className="text-sm text-sat-gray-600 break-all hover:underline">
                {devVerifyUrl}
              </a>
            </div>
          )}
          <Link href="/auth/login" className="text-sat-primary font-medium hover:underline">
            Go to login
          </Link>
        </div>
      </motion.div>
    );
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
        <h1 className="text-2xl font-display font-bold text-center mb-2 dark:text-white">Create your account</h1>
        <p className="text-sat-gray-600 dark:text-sky-200 text-center mb-6">Sign up to access lessons, practice, and your dashboard.</p>

        {/* Google Sign Up */}
        <motion.button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-sat-gray-200 dark:border-sat-gray-600 bg-white dark:bg-sat-gray-700 text-sat-gray-800 dark:text-white font-medium text-sm hover:bg-sat-gray-50 dark:hover:bg-sat-gray-600 transition-colors disabled:opacity-60 mb-4"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Sign up with Google"}
        </motion.button>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-sat-crimson/10 text-sat-crimson text-sm mb-4"
          >
            {error}
          </motion.div>
        )}

        {EMAIL_AUTH_ENABLED && (
          <>
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-sat-gray-200 dark:border-sat-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs text-sat-gray-400 dark:text-sat-gray-500">
                <span className="bg-white dark:bg-sat-gray-800 px-3">or sign up with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-sat-gray-700 dark:text-sky-200 mb-1">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-700 dark:text-white focus:ring-2 focus:ring-sat-primary dark:focus:ring-sky-500 outline-none transition"
                  placeholder="Your name"
                />
              </div>
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
                  className="w-full px-4 py-3 rounded-xl border border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-700 dark:text-white focus:ring-2 focus:ring-sat-primary dark:focus:ring-sky-500 outline-none transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-sat-gray-700 dark:text-sky-200 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-sat-gray-200 dark:border-sat-gray-600 dark:bg-sat-gray-700 dark:text-white focus:ring-2 focus:ring-sat-primary dark:focus:ring-sky-500 outline-none transition"
                  placeholder="At least 6 characters"
                />
              </div>
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {loading ? "Creating account..." : "Sign up"}
              </motion.button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-sat-gray-600 dark:text-sky-200">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-sat-primary dark:text-sky-400 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
