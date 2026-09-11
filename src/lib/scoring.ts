export type Section = "math" | "reading_writing";

export interface ScoreRange {
  lower: number;
  upper: number;
}

// College Board's published conversion table for the paper form of Digital
// SAT Practice Test 4. Index = raw score (number correct); each entry is
// [lower, upper] of the scaled-score band that raw score maps to.
const RW_TABLE: ScoreRange[] = [
  [200, 200], [200, 200], [200, 200], [200, 200], [200, 200], [200, 200], [200, 200], [200, 210], [200, 220],
  [210, 230], [230, 250], [240, 260], [250, 270], [260, 280], [280, 300], [290, 310], [320, 340], [340, 360],
  [350, 370], [360, 380], [370, 390], [370, 390], [380, 400], [390, 410], [400, 420], [410, 430], [420, 440],
  [420, 440], [430, 450], [440, 460], [450, 470], [460, 480], [460, 480], [470, 490], [480, 500], [490, 510],
  [490, 510], [500, 520], [510, 530], [520, 540], [530, 550], [540, 560], [540, 560], [550, 570], [560, 580],
  [570, 590], [580, 600], [590, 610], [590, 610], [600, 620], [610, 630], [620, 640], [630, 650], [630, 650],
  [640, 660], [650, 670], [660, 680], [670, 690], [680, 700], [690, 710], [700, 720], [710, 730], [720, 740],
  [730, 750], [750, 770], [770, 790], [790, 800],
].map(([lower, upper]) => ({ lower, upper }));

const MATH_TABLE: ScoreRange[] = [
  [200, 200], [200, 200], [200, 200], [200, 200], [200, 200], [200, 200], [200, 200], [200, 220], [200, 230],
  [220, 250], [250, 280], [280, 310], [290, 320], [300, 330], [310, 340], [320, 350], [330, 360], [330, 360],
  [340, 370], [350, 380], [360, 390], [370, 400], [370, 400], [380, 410], [390, 420], [400, 430], [420, 450],
  [430, 460], [440, 470], [460, 490], [470, 500], [480, 510], [500, 530], [510, 540], [520, 550], [530, 560],
  [550, 580], [560, 590], [570, 600], [580, 610], [590, 620], [600, 630], [620, 650], [630, 660], [650, 680],
  [670, 700], [690, 720], [710, 740], [730, 760], [740, 770], [750, 780], [760, 790], [770, 800], [780, 800],
  [790, 800],
].map(([lower, upper]) => ({ lower, upper }));

function tableFor(section: Section): ScoreRange[] {
  return section === "math" ? MATH_TABLE : RW_TABLE;
}

function roundToNearest10(n: number): number {
  return Math.round(n / 10) * 10;
}

function clampScore(n: number): number {
  return Math.max(200, Math.min(800, n));
}

/**
 * Interpolates into College Board's published conversion table (Digital SAT
 * Practice Test 4, paper form) by percentage of raw score achieved.
 */
export function estimateSectionRange(rawCorrect: number, maxRaw: number, section: Section): ScoreRange {
  if (maxRaw <= 0 || Number.isNaN(rawCorrect) || Number.isNaN(maxRaw)) return { lower: 200, upper: 200 };

  const table = tableFor(section);
  const clamped = Math.max(0, Math.min(rawCorrect, maxRaw));
  const p = Math.max(0, Math.min(clamped / maxRaw, 1));
  const r = p * (table.length - 1);
  const lo = Math.floor(r);
  const hi = Math.ceil(r);
  const frac = r - lo;

  const lowEntry = table[lo]!;
  const highEntry = table[hi]!;
  const lower = lowEntry.lower + (highEntry.lower - lowEntry.lower) * frac;
  const upper = lowEntry.upper + (highEntry.upper - lowEntry.upper) * frac;

  return {
    lower: clampScore(roundToNearest10(lower)),
    upper: clampScore(roundToNearest10(upper)),
  };
}

// Digital SAT style: each section 200–800, total 400–1600.
/** Midpoint of the estimated range, rounded to the nearest 10. Kept for callers and stored columns that expect a single number. */
export function estimateSectionScore(rawCorrect: number, maxRaw: number, section: Section): number {
  const { lower, upper } = estimateSectionRange(rawCorrect, maxRaw, section);
  return clampScore(roundToNearest10((lower + upper) / 2));
}



/** Parses a grid-in answer such as "43/5", ".2857" or "-3" into a number. */
export function answerValue(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "").replace(/^\+/, "");
  if (!s) return null;
  const frac = /^(-?\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const denom = Number(frac[2]);
    return denom === 0 ? null : Number(frac[1]) / denom;
  }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  return null;
}

/**
 * Collegeboard lists every accepted form of a grid-in answer, e.g.
 * [".2857", "2/7"] or ["0.5", "1/2"]. A student who types "0.2857" or "1/2"
 * is right either way, so answers are compared by value as well as literally.
 * Multiple choice keys ("B") are not numeric and fall back to the exact match.
 */
export function answersMatch(expected: string, actual: string): boolean {
  if (expected.trim().toLowerCase() === actual.trim().toLowerCase()) return true;
  const e = answerValue(expected);
  const a = answerValue(actual);
  if (e === null || a === null) return false;
  // Collegeboard truncates repeating decimals (".2857" for 2/7), so allow the
  // small gap that truncation to four digits produces.
  return Math.abs(e - a) <= 1e-4 * Math.max(1, Math.abs(e));
}
