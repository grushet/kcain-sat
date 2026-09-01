"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Target,
  Trophy,
  Zap,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { TryItSection } from "@/components/landing/TryItSection";

const stagger = { animate: { transition: { staggerChildren: 0.1 } } };
const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } };

const FEATURES = [
  {
    icon: BookOpen,
    title: "Structured Path",
    subtitle: "Navigate to 1600",
    description:
      "A visual skill tree maps every lesson. Math and Reading tracks unlock sequentially, so you always know your next step.",
    stat: "24+",
    statLabel: "lessons",
  },
  {
    icon: Zap,
    title: "5–10 Min Lessons",
    subtitle: "Built for busy schedules",
    description:
      "Each lesson fits inside a coffee break. Concept and practice back-to-back, so retention actually sticks.",
    stat: "10",
    statLabel: "min avg",
  },
  {
    icon: Trophy,
    title: "XP & Streaks",
    subtitle: "Progress you can feel",
    description:
      "Earn XP with every correct answer. Build daily streaks. Your dashboard tracks strengths and weaknesses in real time.",
    stat: "∞",
    statLabel: "motivation",
  },
  {
    icon: Target,
    title: "700+ Questions",
    subtitle: "Real exam feel, every session",
    description:
      "Hard SAT-style questions across Math and Reading, all with detailed explanations that teach not just what's correct, but why.",
    stat: "700+",
    statLabel: "questions",
  },
];

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Horizontal scroll journey refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  // Track slides left as user scrolls through the pinned section
  // Track is 4× container width; −75% of that = −300% = 3 full slides
  const trackX = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", `-${((FEATURES.length - 1) / FEATURES.length) * 100}%`]
  );
  // Book icon travels from 0% to 94% of the track container
  const bookLeft = useTransform(scrollYProgress, [0, 1], ["0%", "94%"]);
  // Book floats up/down as it travels
  const bookY = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [0, -18, 10, -14, 4]
  );
  // Book tilts slightly
  const bookRotate = useTransform(scrollYProgress, [0, 0.5, 1], [-6, 4, -3]);
  // Progress bar width
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  if (session) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-sat-night text-black dark:text-sat-frost">

      {/* ═══════════════════════════════════════════
          HERO — pure black with grid glow
      ═══════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center bg-black overflow-hidden">
        {/* Subtle white grid */}
        <div className="absolute inset-0 bg-grid" />

        {/* Radial glow on the left-centre */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 18% 50%, rgba(255,255,255,0.05) 0%, transparent 70%)",
          }}
        />

        {/* Bottom vignette */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />

        <div className="container mx-auto px-6 lg:px-10 py-24 relative z-10">
          <div className="max-w-5xl">
            {/* Headline */}
            <motion.h1
              className="text-5xl sm:text-7xl md:text-[5.5rem] lg:text-[7rem] font-display font-bold text-white leading-[0.92] tracking-tight mb-8"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              Math meets
              <br />
              <span className="shimmer-text">Reading.</span>
              <br />
              <span
                className="block mt-2 font-normal text-white/35"
                style={{ fontSize: "clamp(1.75rem, 4vw, 4rem)" }}
              >
                Meet&nbsp;cain.
              </span>
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              className="text-white/55 text-lg md:text-xl max-w-lg mb-12 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
            >
              Structured SAT prep: bite-sized lessons, real questions, daily
              streaks. Level up your score one session at a time.
            </motion.p>

            {/* CTA row */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
            >
              <Link href="/auth/signup">
                <motion.span
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-black font-display font-bold text-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  whileHover={{
                    scale: 1.02,
                    boxShadow: "0 0 50px rgba(255,255,255,0.18)",
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </Link>
              <Link href="/auth/login">
                <motion.span
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl border border-white/22 text-white/80 font-display font-bold text-lg hover:bg-white/8 hover:border-white/40 transition-all cursor-pointer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Log in
                </motion.span>
              </Link>
            </motion.div>

            {/* Quick stats */}
            <motion.div
              className="flex flex-wrap gap-8 mt-16 pt-12 border-t border-white/8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
            >
              {[
                { val: "700+", lbl: "SAT questions" },
                { val: "24+", lbl: "structured lessons" },
                { val: "Free", lbl: "to get started" },
              ].map(({ val, lbl }) => (
                <div key={lbl} className="flex flex-col gap-0.5">
                  <span className="text-2xl font-display font-bold text-white">
                    {val}
                  </span>
                  <span className="text-xs text-white/35 uppercase tracking-wider">
                    {lbl}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll nudge */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/28 text-[10px] tracking-[0.2em] uppercase select-none"
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          scroll
          <div className="w-px h-10 bg-gradient-to-b from-white/30 to-transparent" />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════
          TRY IT
      ═══════════════════════════════════════════ */}
      <TryItSection />

      {/* ═══════════════════════════════════════════
          BOOK SCROLL JOURNEY — desktop only
          A glowing book icon travels left → right
          while 4 feature slides scroll past.
      ═══════════════════════════════════════════ */}
      <div
        ref={scrollRef}
        className="relative hidden md:block"
        style={{ height: `${FEATURES.length * 62}vh` }}
      >
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col bg-black">
          {/* Grid overlay — same as hero */}
          <div className="absolute inset-0 bg-grid pointer-events-none" />
          {/* Subtle radial glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)",
            }}
          />

          {/* ── Section header ── */}
          <div className="relative z-10 flex-shrink-0 pt-10 pb-6 px-8 lg:px-16">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/35 mb-2">
                  What you get
                </p>
                <h2 className="text-3xl lg:text-4xl font-display font-bold text-white">
                  Why cain works
                </h2>
              </div>
              <p className="text-xs text-white/25 font-mono pb-1">
                scroll to explore →
              </p>
            </div>
          </div>

          {/* ── Traveling book + progress track ── */}
          <div className="relative flex-shrink-0 h-20 mx-8 lg:mx-16 z-10">
            {/* Track base */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px bg-white/10" />

            {/* Progress fill */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px overflow-hidden">
              <motion.div
                className="h-full bg-white"
                style={{ width: progressWidth }}
              />
            </div>

            {/* Four stop dots */}
            {FEATURES.map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white/20 bg-black"
                style={{
                  left: `${(i / (FEATURES.length - 1)) * 100}%`,
                  marginLeft: i === 0 ? 0 : i === FEATURES.length - 1 ? -10 : -5,
                }}
              />
            ))}

            {/* THE BOOK */}
            <motion.div
              className="absolute top-1/2"
              style={{
                left: bookLeft,
                y: bookY,
                rotate: bookRotate,
                translateY: "-50%",
              }}
            >
              <motion.div
                className="w-10 h-12 rounded-lg bg-white flex items-center justify-center relative overflow-hidden"
                animate={{
                  boxShadow: [
                    "0 0 18px rgba(255,255,255,0.15), 0 6px 18px rgba(255,255,255,0.08)",
                    "0 0 38px rgba(255,255,255,0.30), 0 6px 28px rgba(255,255,255,0.15)",
                    "0 0 18px rgba(255,255,255,0.15), 0 6px 18px rgba(255,255,255,0.08)",
                  ],
                }}
                transition={{ duration: 2.4, repeat: Infinity }}
              >
                <BookOpen className="w-4 h-4 text-black relative z-10" />
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/10 to-transparent rounded-t-lg" />
              </motion.div>
              <div className="absolute -inset-3 rounded-full blur-lg bg-white/10 -z-10" />
            </motion.div>
          </div>

          {/* ── Sliding feature track ── */}
          <div className="flex-1 overflow-hidden px-8 lg:px-16 pb-10 relative z-10">
            <motion.div
              className="flex h-full"
              style={{
                x: trackX,
                width: `${FEATURES.length * 100}%`,
              }}
            >
              {FEATURES.map(({ icon: Icon, title, subtitle, description }, i) => (
                <div
                  key={title}
                  className="h-full flex items-center pr-20"
                  style={{ width: `${100 / FEATURES.length}%` }}
                >
                  <div className="max-w-2xl">
                    {/* Huge faded number */}
                    <div
                      className="font-display font-bold leading-none text-white/[0.04] select-none -ml-2 mb-4"
                      style={{ fontSize: "clamp(6rem, 14vw, 11rem)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    <div className="flex items-start gap-5">
                      {/* Icon chip */}
                      <div
                        className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10"
                        style={{
                          background: "rgba(255,255,255,0.08)",
                          boxShadow: "0 0 22px rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.3)",
                        }}
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </div>

                      <div className="flex-1">
                        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/35 mb-2">
                          {subtitle}
                        </p>
                        <h3 className="text-3xl lg:text-5xl font-display font-bold text-white mb-5 leading-tight">
                          {title}
                        </h3>
                        <p className="text-white/52 text-base lg:text-lg leading-relaxed max-w-md">
                          {description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ─── Mobile fallback for scroll journey ─── */}
      <section className="md:hidden py-20 px-6 bg-white dark:bg-sat-night">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-black/38 dark:text-sat-mist mb-2">
          What you get
        </p>
        <h2 className="text-3xl font-display font-bold text-black dark:text-sat-frost mb-10">
          Why cain works
        </h2>
        <div className="space-y-6">
          {FEATURES.map(({ icon: Icon, title, subtitle, description, stat, statLabel }, i) => (
            <motion.div
              key={title}
              className="card card-glow p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-black dark:bg-blue-600 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-black/38 dark:text-sat-mist mb-1">
                    {subtitle}
                  </p>
                  <h3 className="text-xl font-display font-bold text-black dark:text-sat-frost mb-2">
                    {title}
                  </h3>
                  <p className="text-black/52 dark:text-sat-mist text-sm leading-relaxed">
                    {description}
                  </p>
                  <div className="mt-3 inline-flex items-baseline gap-2 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/7 dark:border-white/8">
                    <span className="font-bold text-black dark:text-sat-frost">{stat}</span>
                    <span className="text-[10px] text-black/40 dark:text-sat-mist uppercase tracking-wider">
                      {statLabel}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════ */}
      <section className="py-24 md:py-32 bg-white dark:bg-sat-night">
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold text-black dark:text-sat-frost mb-4">
              How it works
            </h2>
            <p className="text-black/52 dark:text-sat-mist max-w-sm mx-auto">
              Try the examples above, then sign up to unlock the full path.
            </p>
          </motion.div>

          <div className="max-w-xl mx-auto space-y-5">
            {[
              {
                step: "01",
                title: "Sign up in seconds",
                desc: "Create a free account. No credit card required.",
              },
              {
                step: "02",
                title: "Go to your dashboard",
                desc: "Your private learning hub, separate from this page.",
              },
              {
                step: "03",
                title: "Start learning",
                desc: "Lessons, Full Test, Calendar, and Practice, all in the sidebar.",
              },
              {
                step: "04",
                title: "Track & improve",
                desc: "Build streaks, earn XP, and keep climbing toward your target score.",
              },
            ].map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                className="flex gap-5 items-start group"
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.4 }}
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-black dark:bg-sat-dusk border border-black/8 dark:border-sat-horizon flex items-center justify-center mt-0.5 group-hover:shadow-glow transition-shadow">
                  <span className="font-mono text-xs font-bold text-white dark:text-sat-frost">
                    {step}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-black dark:text-sat-frost mb-0.5">
                    {title}
                  </h3>
                  <p className="text-black/52 dark:text-sat-mist text-sm leading-relaxed">
                    {desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA — black section with grid
      ═══════════════════════════════════════════ */}
      <section className="py-24 md:py-36 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 65% at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 70%)",
          }}
        />
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.h2
            className="text-3xl md:text-6xl font-display font-bold text-white mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Ready to start?
          </motion.h2>
          <p className="text-white/48 text-lg mb-12 max-w-sm mx-auto leading-relaxed">
            Sign up to access your dashboard, lessons, full tests, and calendar.
          </p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <Link href="/auth/signup">
              <motion.span
                className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl bg-white text-black font-display font-bold text-lg hover:bg-gray-100 transition-colors cursor-pointer"
                whileHover={{
                  scale: 1.03,
                  boxShadow: "0 0 50px rgba(255,255,255,0.15)",
                }}
                whileTap={{ scale: 0.97 }}
              >
                Sign Up Free
                <CheckCircle className="w-5 h-5" />
              </motion.span>
            </Link>
            <Link href="/auth/login">
              <motion.span
                className="inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl border border-white/20 text-white font-display font-bold text-lg hover:bg-white/8 hover:border-white/35 transition-all cursor-pointer"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Log In
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════ */}
      <footer className="py-10 bg-sat-gray-900 dark:bg-black text-white/25 text-center text-sm border-t border-white/5">
        © {new Date().getFullYear()} cain
      </footer>
    </div>
  );
}
