"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, Calculator, ExternalLink } from "lucide-react";
import { getQuestionsByTopic } from "@/lib/questions";
import type { PracticeBankQuestion } from "@/lib/questions";
import { mathStr } from "@/components/MathText";

const QUESTIONS_PER_SESSION = 25;

/** Fisher-Yates shuffle for a fair random order. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Get a new random set of questions every time: shuffle pool, take up to N, then order by difficulty. */
function getSessionQuestions(topic: string, difficulty: "easy" | "medium" | "hard" | "very_hard" | undefined): PracticeBankQuestion[] {
  const pool = getQuestionsByTopic(topic);
  const filtered = difficulty ? pool.filter((q) => q.difficulty === difficulty) : pool;
  const diffOrder = { easy: 0, medium: 1, hard: 2, very_hard: 3 };
  const shuffled = shuffle(filtered);
  const chosen = shuffled.slice(0, QUESTIONS_PER_SESSION);
  return chosen.sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty]);
}

const TOPIC_LABELS: Record<string, string> = {
  "math-algebra": "Math – Algebra",
  "math-problem-solving": "Math – Problem Solving",
  "math-quadratics": "Math – Quadratics",
  "math-functions": "Math – Functions",
  "math-data": "Math – Data & Statistics",
  "math-geometry": "Math – Geometry",
  "math-inequalities": "Math – Inequalities",
  "math-exponentials": "Math – Exponentials",
  "math-trigonometry": "Math – Trigonometry",
  "math-word-problems": "Math – Word Problems",
  "math-advanced": "Math – Advanced",
  "reading-evidence": "Reading – Evidence",
  "reading-words": "Reading – Words in Context",
  "reading-main-idea": "Reading – Main Idea",
  "reading-tone": "Reading – Tone",
  "reading-rhetoric": "Reading – Rhetoric",
  "reading-comprehension": "Reading – Comprehension",
  "writing-conventions": "Writing – Conventions",
  "writing-conventions-advanced": "Writing – Conventions Advanced",
  "writing-transitions": "Writing – Transitions",
};

const TOPIC_MAP: Record<string, string> = {
  "math-algebra": "algebra",
  "math-problem-solving": "math",
  "math-quadratics": "quadratics",
  "math-functions": "functions",
  "math-data": "data",
  "math-geometry": "geometry",
  "math-inequalities": "inequalities",
  "math-exponentials": "exponentials",
  "math-trigonometry": "trigonometry",
  "math-word-problems": "word-problems",
  "math-advanced": "advanced-math",
  "reading-evidence": "evidence",
  "reading-words": "words",
  "reading-main-idea": "main-idea",
  "reading-tone": "tone",
  "reading-rhetoric": "rhetoric",
  "reading-comprehension": "reading",
  "writing-conventions": "grammar",
  "writing-conventions-advanced": "conventions-advanced",
  "writing-transitions": "transitions",
};

const MATH_TOPIC_SLUGS = new Set(Object.keys(TOPIC_MAP).filter((k) => k.startsWith("math-")));
const DESMOS_CALCULATOR_URL = "https://www.desmos.com/calculator";
const DESMOS_SCIENTIFIC_URL = "https://www.desmos.com/scientific";

export default function PracticeTopicPage() {
  const params = useParams();
  const router = useRouter();
  const topicSlug = params.topic as string;
  const topic = TOPIC_MAP[topicSlug] || "algebra";
  const label = TOPIC_LABELS[topicSlug] || topicSlug;

  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard" | "very_hard">("all");
  const [questions, setQuestions] = useState<PracticeBankQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [desmosOpen, setDesmosOpen] = useState(true);

  const isMathTopic = topicSlug && MATH_TOPIC_SLUGS.has(topicSlug);

  useEffect(() => {
    const diff = difficulty === "all" ? undefined : difficulty as "easy" | "medium" | "hard" | "very_hard";
    setCurrent(0);
    setSelected(null);
    setShowResult(false);
    setScore(0);
    setQuestionsLoading(true);
    setQuestions(getSessionQuestions(topic, diff));
    setQuestionsLoading(false);
  }, [topic, difficulty]);

  const q = questions[current];
  const isCorrect = selected === q?.correctKey;

  const handleCheck = () => {
    if (!selected) return;
    setShowResult(true);
    if (selected === q.correctKey) setScore((s) => s + 1);
  };

  const handleNext = () => {
    setSelected(null);
    setShowResult(false);
    if (current < questions.length - 1) setCurrent((c) => c + 1);
  };

  const handleFinish = () => router.push("/practice");

  // An unrecognised slug used to silently fall back to algebra questions under
  // the raw slug as a heading, which looked like a real but mislabelled topic.
  if (!Object.prototype.hasOwnProperty.call(TOPIC_MAP, topicSlug)) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link href="/practice" className="inline-flex items-center gap-2 text-sat-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Practice
        </Link>
        <div className="card p-8 text-center text-sat-gray-600 dark:text-sat-gray-400">
          That practice topic does not exist. Pick one from the practice page.
        </div>
      </div>
    );
  }

  if (questionsLoading || questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link href="/practice" className="inline-flex items-center gap-2 text-sat-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Practice
        </Link>
        <div className="card p-8 text-center text-sat-gray-600 dark:text-sat-gray-400">
          {questionsLoading ? "Loading questions…" : "No questions found for this topic."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/practice" className="inline-flex items-center gap-2 text-sat-primary hover:underline mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Practice
      </Link>

      <p className="text-sm text-sat-gray-500 dark:text-sat-gray-400 mb-4">
        This session: {questions.length} random questions, different every time you open this category.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "easy", "medium", "hard", "very_hard"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDifficulty(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              difficulty === d
                ? "bg-sat-primary text-white"
                : "bg-sat-gray-200 dark:bg-sat-gray-700 text-sat-gray-700 dark:text-sat-gray-300 hover:bg-sat-gray-300 dark:hover:bg-sat-gray-600"
            }`}
          >
            {d === "all" ? "All" : d.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-sat-gray-600 dark:text-sat-gray-400 mb-1">
          <span>Question {current + 1} of {questions.length}</span>
          <span>Score: {score}</span>
        </div>
        <div className="h-2 rounded-full bg-sat-gray-200 dark:bg-sat-gray-700 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-sat-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((current + 1) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {isMathTopic && (
        <div className="mb-6 card overflow-hidden">
          <button
            type="button"
            onClick={() => setDesmosOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-sat-gray-50 dark:hover:bg-sat-gray-700/50 transition-colors"
          >
            <span className="flex items-center gap-2 font-display font-bold text-sat-gray-900 dark:text-white">
              <Calculator className="w-5 h-5 text-sat-primary" />
              Desmos Calculator
            </span>
            <span className="text-sm text-sat-gray-500 dark:text-sat-gray-400">
              {desmosOpen ? "Hide" : "Show"} calculator
            </span>
          </button>
          {desmosOpen && (
            <div className="border-t border-sat-gray-100 dark:border-sat-gray-700">
              <div className="flex flex-wrap gap-2 p-3 bg-sat-gray-50 dark:bg-sat-gray-800/50">
                <a
                  href={DESMOS_CALCULATOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-sat-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open graphing calculator in new tab
                </a>
                <span className="text-sat-gray-400 dark:text-sat-gray-500">|</span>
                <a
                  href={DESMOS_SCIENTIFIC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-sat-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open scientific calculator
                </a>
              </div>
              <div className="aspect-video w-full min-h-[280px] bg-sat-gray-100 dark:bg-sat-gray-800">
                <iframe
                  title="Desmos Graphing Calculator"
                  src={DESMOS_CALCULATOR_URL}
                  className="w-full h-full min-h-[280px] border-0"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="card p-6 md:p-8"
        >
          <h2 className="font-display font-bold text-lg mb-4 dark:text-white">{label}</h2>
          <p className="text-sat-gray-800 dark:text-sat-gray-200 whitespace-pre-line mb-6">{mathStr(q.question)}</p>
          <div className="space-y-3">
            {q.options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                disabled={showResult}
                onClick={() => !showResult && setSelected(opt.key)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                  selected !== opt.key && !showResult
                    ? "border-sat-gray-200 dark:border-sat-gray-600 hover:border-sat-primary/50 dark:hover:border-sat-primary/50"
                    : selected === opt.key && !showResult
                    ? "border-sat-primary bg-sat-primary/10"
                    : showResult && opt.key === q.correctKey
                    ? "border-green-500 bg-green-500/10"
                    : showResult && selected === opt.key
                    ? "border-red-500 bg-red-500/10"
                    : "border-sat-gray-200 dark:border-sat-gray-600"
                }`}
              >
                {showResult && (opt.key === q.correctKey ? <Check className="w-5 h-5 text-green-600 shrink-0" /> : selected === opt.key ? <X className="w-5 h-5 text-red-600 shrink-0" /> : null)}
                <span className="font-medium dark:text-white">{opt.key}. {mathStr(opt.text)}</span>
              </button>
            ))}
          </div>
          {showResult && q.explanation && (
            <div className="mt-6 p-4 rounded-lg bg-sat-gray-100 dark:bg-sat-gray-800 text-sat-gray-800 dark:text-sat-gray-200 text-sm">
              <strong>Explanation:</strong> {mathStr(q.explanation)}
            </div>
          )}
          <div className="mt-6 flex gap-3">
            {!showResult ? (
              <button type="button" onClick={handleCheck} disabled={!selected} className="btn-primary">
                Check
              </button>
            ) : current < questions.length - 1 ? (
              <button type="button" onClick={handleNext} className="btn-primary">
                Next
              </button>
            ) : (
              <button type="button" onClick={handleFinish} className="btn-primary">
                Finish
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
