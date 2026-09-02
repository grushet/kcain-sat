export type Section = "math" | "reading_writing";

// Digital SAT style: each section 200–800, total 400–1600.
// This is an approximation that maps raw score percentage to the scaled band.
export function estimateSectionScore(rawCorrect: number, maxRaw: number, section: Section): number {
  if (maxRaw <= 0 || Number.isNaN(rawCorrect)) return 200;
  const clamped = Math.max(0, Math.min(rawCorrect, maxRaw));
  const p = clamped / maxRaw;

  // Base linear scale from 200 to 800
  let scaled = 200 + Math.round(600 * p);

  // Slight curve at the top end to better match official score bands:
  // make very high raw scores a bit more rewarding.
  if (p > 0.9) {
    const extra = Math.round(20 * (p - 0.9) * 10); // up to ~20 extra points near perfect
    scaled += extra;
  }

  // Clamp to 200–800
  if (scaled < 200) scaled = 200;
  if (scaled > 800) scaled = 800;

  return scaled;
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
