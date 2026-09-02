"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shuffle, Calculator, BookOpen, PenLine } from "lucide-react";

const MATH_TOPICS = [
  { topic: "Math - Algebra", count: "80+", href: "/practice/math-algebra" },
  { topic: "Math - Quadratics", count: "30+", href: "/practice/math-quadratics" },
  { topic: "Math - Functions", count: "20+", href: "/practice/math-functions" },
  { topic: "Math - Data & Stats", count: "45+", href: "/practice/math-data" },
  { topic: "Math - Geometry", count: "30+", href: "/practice/math-geometry" },
  { topic: "Math - Inequalities", count: "15", href: "/practice/math-inequalities" },
  { topic: "Math - Exponentials", count: "15+", href: "/practice/math-exponentials" },
  { topic: "Math - Trigonometry", count: "12+", href: "/practice/math-trigonometry" },
  { topic: "Math - Word Problems", count: "35+", href: "/practice/math-word-problems" },
  { topic: "Math - Advanced", count: "12", href: "/practice/math-advanced" },
  { topic: "Math - Mixed", count: "300+", href: "/practice/math-problem-solving" },
];

const READING_TOPICS = [
  { topic: "Reading - Evidence", count: "30+", href: "/practice/reading-evidence" },
  { topic: "Reading - Words", count: "30+", href: "/practice/reading-words" },
  { topic: "Reading - Main Idea", count: "30", href: "/practice/reading-main-idea" },
  { topic: "Reading - Tone", count: "15+", href: "/practice/reading-tone" },
  { topic: "Reading - Rhetoric", count: "20+", href: "/practice/reading-rhetoric" },
  { topic: "Reading - Comprehension", count: "200+", href: "/practice/reading-comprehension" },
];

const WRITING_TOPICS = [
  { topic: "Writing - Conventions", count: "25+", href: "/practice/writing-conventions" },
  { topic: "Writing - Conventions Advanced", count: "15", href: "/practice/writing-conventions-advanced" },
  { topic: "Writing - Transitions", count: "20+", href: "/practice/writing-transitions" },
];

const sectionConfig = [
  { title: "Math", icon: Calculator, topics: MATH_TOPICS, accent: "border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20 dark:border-l-amber-400" },
  { title: "Reading", icon: BookOpen, topics: READING_TOPICS, accent: "border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-l-emerald-400" },
  { title: "Writing", icon: PenLine, topics: WRITING_TOPICS, accent: "border-l-4 border-l-violet-500 bg-violet-50/50 dark:bg-violet-950/20 dark:border-l-violet-400" },
];

function TopicGrid({ topics, accent }: { topics: typeof MATH_TOPICS; accent: string }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {topics.map(({ topic, count, href }) => (
        <Link key={topic} href={href}>
          <motion.div
            className={`card p-5 rounded-xl ${accent} group cursor-pointer transition-shadow`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, boxShadow: "0 12px 28px -10px rgba(0,0,0,0.15)" }}
            whileTap={{ scale: 0.99 }}
          >
            <h3 className="font-display font-bold text-base mb-1 group-hover:text-sat-primary transition-colors dark:text-white">
              {topic}
            </h3>
            <p className="text-sat-gray-600 text-sm dark:text-sat-gray-400">{count} questions · random each time</p>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}

export default function PracticePage() {
  return (
    <motion.div
      className="max-w-5xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-sat-primary/10 text-sat-primary">
            <Shuffle className="w-6 h-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-sat-gray-900 dark:text-white">
            Practice
          </h1>
        </div>
        <p className="text-sat-gray-600 dark:text-sky-200 text-lg max-w-2xl">
          Pick a category. Every time you open it you get a <strong>new random set</strong> of questions, no two sessions the same.
        </p>
      </motion.div>

      <div className="space-y-10 mb-12">
        {sectionConfig.map(({ title, icon: Icon, topics, accent }, i) => (
          <motion.section
            key={title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
          >
            <h2 className="flex items-center gap-2 font-display font-bold text-xl mb-4 text-sat-gray-800 dark:text-white">
              <Icon className="w-5 h-5 text-sat-primary" />
              {title}
            </h2>
            <TopicGrid topics={topics} accent={accent} />
          </motion.section>
        ))}
      </div>

      <motion.div
        className="card p-6 bg-sat-gray-50 dark:bg-sat-gray-800/50 border border-sat-gray-200 dark:border-sat-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h3 className="font-display font-bold text-lg mb-2 dark:text-white">Full Practice Test</h3>
        <p className="text-sat-gray-600 dark:text-sky-200 mb-4">
          Simulate a real SAT with a timed full-length practice test. Use the <strong>Full Test</strong> tab in the sidebar for the full experience.
        </p>
        <Link href="/full-test">
          <motion.span className="btn-secondary text-sm py-2 px-5 inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            Go to Full Test
          </motion.span>
        </Link>
      </motion.div>
    </motion.div>
  );
}
