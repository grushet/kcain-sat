"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Lock, Check, Play, Star, Gift } from "lucide-react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { SAT_SECTIONS } from "@/lib/db";
import { LESSONS } from "@/lib/lessons";
import { MATH_LESSON_IDS, READING_LESSON_IDS } from "@/lib/lessons";

export type SkillNodeStatus = "locked" | "available" | "completed" | "current";

export interface SkillNode {
  id: string;
  title: string;
  topic: string;
  xpReward: number;
  status: SkillNodeStatus;
  section: "math" | "reading";
  order: number;
}

function buildNodes(ids: string[], section: "math" | "reading", completedIds: Set<string>): SkillNode[] {
  let foundCurrent = false;
  return ids.map((id, i) => {
    const prevCompleted = i === 0 || completedIds.has(ids[i - 1]!);
    const completed = completedIds.has(id);
    let status: SkillNodeStatus = "locked";
    if (completed) status = "completed";
    else if (prevCompleted) {
      status = !foundCurrent ? "current" : "available";
      foundCurrent = true;
    }
    return {
      id,
      title: LESSONS[id]!.title,
      topic: section === "math" ? "Math" : "Reading",
      xpReward: LESSONS[id]!.xpReward,
      status,
      section,
      order: i + 1,
    };
  });
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function PathSection({ nodes, label }: { nodes: SkillNode[]; label: string }) {
  return (
    <div className="path-section">
      <h2 className="text-lg font-semibold text-sat-gray-700 dark:text-sat-gray-300 mb-6 pl-1">
        {label}
      </h2>
      <div className="relative flex flex-col max-w-md mx-auto w-full" style={{ minHeight: nodes.length * 88 }}>
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 100 ${nodes.length * 88}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={[
              "M 50 0",
              ...nodes.map((_, i) => {
                const x = i % 2 === 0 ? 25 : 75;
                const y = 44 + i * 88;
                return `L ${x} ${y}`;
              }),
            ].join(" ")}
            fill="none"
            className="path-snake"
            strokeWidth="0.4"
          />
        </svg>
        {nodes.map((node, i) => {
          const isLeft = i % 2 === 0;
          const showReward = (i + 1) % 5 === 0 && i > 0;
          return (
            <div
              key={node.id}
              className="relative grid w-full items-center gap-0 px-1"
              style={{ gridTemplateColumns: "1fr 2fr 1fr", minHeight: showReward ? 100 : 88 }}
            >
              {showReward && (
                <div
                  className={clsx(
                    "absolute left-1/2 -translate-x-1/2 -top-2 z-10 flex items-center justify-center w-10 h-10 rounded-full path-reward",
                    "bg-amber-100 dark:bg-amber-900/50 border-2 border-amber-400 dark:border-amber-600"
                  )}
                >
                  <Gift className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              )}
              <div className="flex items-center justify-end h-full pr-1">
                {isLeft ? <PathNode node={node} /> : null}
              </div>
              <div className={clsx("flex items-center h-full px-2", isLeft ? "justify-start" : "justify-end")}>
                {(node.status === "available" || node.status === "current") && (
                  <p className={clsx("text-sm font-medium text-sat-gray-700 dark:text-sat-gray-300 line-clamp-2", isLeft ? "text-left" : "text-right")}>
                    {node.title}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-start h-full pl-1">
                {!isLeft ? <PathNode node={node} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SkillTree() {
  const { data: session } = useSession();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<"math" | "reading">("math");

  useEffect(() => {
    if (!session) {
      setCompletedIds(new Set());
      return;
    }
    fetch("/api/progress")
      .then((r) => r.json())
      .then((d) => setCompletedIds(new Set(d.completedLessonIds || [])))
      .catch(() => setCompletedIds(new Set()));
  }, [session]);

  const mathNodes = buildNodes(MATH_LESSON_IDS, "math", completedIds);
  const readingNodes = buildNodes(READING_LESSON_IDS, "reading", completedIds);

  const sections = [
    { section: "math" as const, nodes: mathNodes, label: SAT_SECTIONS[0].name },
    { section: "reading" as const, nodes: readingNodes, label: SAT_SECTIONS[1].name },
  ];

  return (
    <motion.div className="space-y-10" initial="hidden" animate="show" variants={container}>
      <motion.div variants={item} className="flex justify-center mb-2">
        <div className="inline-flex rounded-full bg-sat-gray-100 dark:bg-sat-gray-800 p-1">
          {(["math", "reading"] as const).map((sec) => (
            <motion.button
              key={sec}
              type="button"
              onClick={() => setActiveSection(sec)}
              className={clsx(
                "px-4 py-1.5 text-sm font-semibold rounded-full transition-colors",
                activeSection === sec
                  ? "bg-sat-primary text-white dark:bg-sky-500"
                  : "text-sat-gray-700 dark:text-sat-gray-300 hover:bg-sat-gray-200 dark:hover:bg-sat-gray-700"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {sec === "math" ? SAT_SECTIONS[0].name : SAT_SECTIONS[1].name}
            </motion.button>
          ))}
        </div>
      </motion.div>

      <PathSection
        key={activeSection}
        nodes={activeSection === "math" ? mathNodes : readingNodes}
        label={activeSection === "math" ? SAT_SECTIONS[0].name : SAT_SECTIONS[1].name}
      />
    </motion.div>
  );
}

function PathNode({ node }: { node: SkillNode }) {
  const isClickable = node.status === "available" || node.status === "current";

  const circleContent = (
    <motion.span
      className={clsx(
        "path-node path-node--circle",
        node.status === "locked" && "path-node--locked",
        node.status === "available" && "path-node--available",
        node.status === "completed" && "path-node--completed",
        node.status === "current" && "path-node--current"
      )}
      whileHover={isClickable ? { scale: 1.1 } : {}}
      whileTap={isClickable ? { scale: 0.95 } : {}}
      transition={{ type: "spring", stiffness: 400 }}
    >
      {node.status === "locked" && <Lock className="w-5 h-5" />}
      {node.status === "completed" && (
        <>
          <Check className="w-6 h-6 text-white" strokeWidth={3} />
          <span className="path-node-stars">
            <Star className="w-3 h-3 fill-white text-white" />
            <Star className="w-3 h-3 fill-white text-white" />
            <Star className="w-3 h-3 fill-white text-white" />
          </span>
        </>
      )}
      {(node.status === "available" || node.status === "current") && (
        <span className="path-node-play">
          <Play className="w-5 h-5" fill="currentColor" />
        </span>
      )}
    </motion.span>
  );

  if (isClickable) {
    return (
      <Link href={`/learn/${node.id}`} className="inline-flex flex-col items-center gap-1.5 group">
        {circleContent}
        <span className="text-xs font-semibold text-sat-primary dark:text-sky-400 group-hover:underline">
          {node.status === "current" ? "PLAY" : "Start"}
        </span>
      </Link>
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-1.5 cursor-not-allowed">
      {circleContent}
      {node.status === "completed" && (
        <span className="text-xs font-medium text-sat-gray-500 dark:text-sat-gray-400">Done</span>
      )}
    </div>
  );
}
