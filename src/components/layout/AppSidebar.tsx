"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  BookOpen,
  FileQuestion,
  Calendar,
  Target,
  History,
  LogOut,
  User,
  Menu,
  X,
  CheckSquare,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { KcainLogo } from "./KcainLogo";
import { useState } from "react";
import clsx from "clsx";
import { ThemeToggle } from "./ThemeToggle";

/** The planner, which signs in with this same account. */
const PLANNER_URL = "https://tasks.cainsat.org";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lessons",   label: "Lessons",   icon: BookOpen },
  { href: "/full-test", label: "Full Test",  icon: FileQuestion },
  { href: "/calendar",  label: "Calendar",   icon: Calendar },
  { href: "/practice",  label: "Practice",   icon: Target },
  { href: "/history",   label: "Results",    icon: History },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await fetch("/api/me", { method: "DELETE" });
    } finally {
      await signOut({ callbackUrl: "/" });
    }
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/lessons")   return pathname === "/lessons";
    return pathname.startsWith(href);
  };

  const sidebar = (
    <aside className="flex flex-col w-64 h-screen bg-white dark:bg-sat-dusk border-r border-black/8 dark:border-sat-horizon shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-black/6 dark:border-sat-horizon/60">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          onClick={() => setMobileOpen(false)}
        >
          <KcainLogo size="md" />
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {mainLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              isActive(href)
                ? [
                    "bg-black text-white",
                    "dark:bg-blue-600/25 dark:text-blue-300 dark:border dark:border-blue-500/30",
                    "shadow-[0_1px_6px_rgba(0,0,0,0.15)]",
                    "dark:shadow-[0_1px_8px_rgba(37,99,235,0.18)]",
                  ]
                : [
                    "text-black/62 hover:text-black hover:bg-black/5",
                    "dark:text-sat-mist dark:hover:text-sat-frost dark:hover:bg-white/5",
                  ]
            )}
          >
            <Icon
              className={clsx(
                "w-4.5 h-4.5 shrink-0",
                isActive(href) ? "opacity-100" : "opacity-65"
              )}
            />
            {label}
          </Link>
        ))}

        {/*
          The planner is a separate app on its own subdomain, but it shares this
          account, so it belongs in this list. Nothing linked to it before, which
          left it unreachable for anyone who did not already know the URL.
        */}
        <a
          href={PLANNER_URL}
          onClick={() => setMobileOpen(false)}
          className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
            "text-black/62 hover:text-black hover:bg-black/5",
            "dark:text-sat-mist dark:hover:text-sat-frost dark:hover:bg-white/5"
          )}
        >
          <CheckSquare className="w-4.5 h-4.5 shrink-0 opacity-65" />
          <span className="flex-1">Tasks</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-40" aria-hidden />
        </a>
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-black/6 dark:border-sat-horizon/60 space-y-1">
        {/* Theme toggle */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-black/50 dark:text-sat-mist">
          <ThemeToggle />
          <span className="text-xs">Theme</span>
        </div>

        {/* User row */}
        {session && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 rounded-lg object-cover shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-black/8 dark:bg-sat-horizon flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-black/45 dark:text-sat-mist" />
              </div>
            )}
            <span className="text-xs font-medium text-black/72 dark:text-sat-frost truncate flex-1">
              {session.user?.name || session.user?.email || "Account"}
            </span>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-black/50 dark:text-sat-mist hover:bg-black/5 hover:text-black dark:hover:bg-white/5 dark:hover:text-red-400 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>

        {/* Delete account */}
        {!deleteOpen ? (
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-black/40 dark:text-sat-mist/70 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all duration-150"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            Delete my account
          </button>
        ) : (
          <div className="px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 space-y-2">
            <p className="text-xs text-red-700 dark:text-red-300">
              This permanently deletes your account and everything in it. Type DELETE to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-sat-dusk text-black dark:text-sat-frost outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
              >
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-black/60 dark:text-sat-mist hover:bg-black/5 dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Legal */}
        <div className="flex items-center gap-3 px-3 pt-1 text-[11px] text-black/35 dark:text-sat-mist/50">
          <Link href="/privacy" className="hover:underline" onClick={() => setMobileOpen(false)}>
            Privacy
          </Link>
          <Link href="/terms" className="hover:underline" onClick={() => setMobileOpen(false)}>
            Terms
          </Link>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="p-2 rounded-xl bg-white dark:bg-sat-dusk border border-black/10 dark:border-sat-horizon shadow-sm"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <X className="w-5 h-5 text-black dark:text-sat-frost" />
          ) : (
            <Menu className="w-5 h-5 text-black dark:text-sat-frost" />
          )}
        </button>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:block">{sidebar}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile sidebar slide-in */}
      <div
        className={clsx(
          "lg:hidden fixed inset-y-0 left-0 z-40 transform transition-transform duration-250 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </div>
    </>
  );
}
