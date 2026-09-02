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
} from "lucide-react";
import { KcainLogo } from "./KcainLogo";
import { useState } from "react";
import clsx from "clsx";
import { ThemeToggle } from "./ThemeToggle";

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
