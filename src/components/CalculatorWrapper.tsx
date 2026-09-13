"use client";

import { usePathname } from "next/navigation";
import { Calculator } from "./Calculator";
import { ReferenceSheet } from "./ReferenceSheet";

const MATH_LESSON_IDS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "19", "20", "21"]);

function isMathPage(pathname: string): boolean {
  if (pathname.startsWith("/practice/math-")) return true;
  const learnMatch = pathname.match(/^\/learn\/(\d+)$/);
  if (learnMatch && MATH_LESSON_IDS.has(learnMatch[1]!)) return true;
  return false;
}

export function CalculatorWrapper() {
  const pathname = usePathname();
  if (!pathname || !isMathPage(pathname)) return null;
  return (
    <>
      <Calculator />
      <ReferenceSheet />
    </>
  );
}
