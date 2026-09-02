import { NextRequest, NextResponse } from "next/server";
import { upsertQuestions, type BankQuestionInput } from "@/lib/question-store";
import { currentUserId } from "@/lib/api-auth";

const CB_LIST =
  "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions";
const CB_QUESTION =
  "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question";
const SAT_ID = 99;

const DOMAINS: Record<string, string[]> = {
  rw: ["INI", "CAS", "EOI", "SEC"],
  math: ["H", "P", "Q", "S"],
};

// Collegeboard's own test code: 1 = Reading & Writing, 2 = Math.
const TEST_CODE: Record<string, number> = { rw: 1, math: 2 };

type Meta = Record<string, unknown>;

/**
 * Collegeboard serves two kinds of bank entries. Most carry an `external_id`
 * and their content is fetchable. The rest only carry an `ibn` (they live in a
 * printed book) and have no `external_id` — the content endpoint answers those
 * with an S3 "NoSuchKey" body under a 200, so they can never be rendered.
 * They are ~24% of the math bank, so they must be filtered out of the pool
 * rather than silently dropped after selection, which used to leave math
 * modules with as few as 13 of the 22 questions.
 */
function isFetchable(q: Meta): boolean {
  const ext = q.external_id;
  return typeof ext === "string" && ext.length > 0;
}

/** A Collegeboard content payload is only usable if it actually has a stem. */
function isUsableContent(d: unknown): d is Meta {
  if (!d || typeof d !== "object") return false;
  const stem = (d as Meta).stem;
  return typeof stem === "string" && stem.trim().length > 0;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Caches ────────────────────────────────────────────────────────────────
// The domain lists are ~200KB each and change very rarely, and question
// content is immutable. Caching both keeps a class of 30 students starting
// tests at once from hammering Collegeboard (and getting rate-limited).

const LIST_TTL_MS = 60 * 60 * 1000;
const listCache = new Map<string, { at: number; data: Meta[] }>();

const CONTENT_CACHE_MAX = 3000;
const contentCache = new Map<string, Meta>();

function rememberContent(id: string, content: Meta): void {
  if (contentCache.size >= CONTENT_CACHE_MAX) {
    // Map preserves insertion order, so the first key is the oldest.
    const oldest = contentCache.keys().next().value;
    if (oldest !== undefined) contentCache.delete(oldest);
  }
  contentCache.set(id, content);
}

/** Returns the domain's question list, or null if Collegeboard could not be reached. */
async function listDomain(domain: string, test: number): Promise<Meta[] | null> {
  const cached = listCache.get(domain);
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.data;

  try {
    const r = await fetch(CB_LIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ asmtEventId: SAT_ID, test, domain }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const list = Array.isArray(d)
      ? (d as Meta[])
      : d && Array.isArray(d.data)
      ? (d.data as Meta[])
      : null;
    if (!list) return null;
    listCache.set(domain, { at: Date.now(), data: list });
    return list;
  } catch {
    // Serve a stale list rather than a broken test if we have one.
    return cached ? cached.data : null;
  }
}

async function fetchContent(id: string): Promise<Meta | null> {
  const hit = contentCache.get(id);
  if (hit) return hit;

  try {
    const r = await fetch(CB_QUESTION, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ external_id: id }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const content = d?.data ?? d;
    // Collegeboard returns S3 errors ("NoSuchKey") with a 200 status, so the
    // response body has to be validated rather than trusting the status code.
    if (!isUsableContent(content)) return null;
    rememberContent(id, content);
    return content;
  } catch {
    return null;
  }
}


// ── MathML compatibility ──────────────────────────────────────────────────
// Collegeboard still emits <mfenced> for brackets, which every current browser
// dropped when it moved to MathML Core. The children survive but the fences do
// not, so "0.96(15,000)^x" renders as "0.9615,000^x", "f(x)" as "fx" and
// "|x|" as "x". Rewriting it to explicit <mo> fences restores the notation.

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Splits MathML children at depth zero so separators land between them. */
function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  const tag = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let depth = 0;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(inner)) !== null) {
    const isClose = m[1] === "/";
    const isSelf = m[4] === "/";
    const end = m.index + m[0].length;
    if (isSelf) {
      if (depth === 0) { parts.push(inner.slice(start, end)); start = end; }
    } else if (isClose) {
      depth--;
      if (depth === 0) { parts.push(inner.slice(start, end)); start = end; }
    } else {
      depth++;
    }
  }
  const tail = inner.slice(start);
  if (tail.trim()) parts.push(tail);
  return parts.filter((p) => p.trim().length > 0);
}

function expandMfenced(html: string): string {
  if (!html || !html.includes("<mfenced")) return html;
  const innermost = /<mfenced([^>]*)>((?:(?!<mfenced)[\s\S])*?)<\/mfenced>/;
  let out = html;
  for (let guard = 0; guard < 100 && innermost.test(out); guard++) {
    out = out.replace(innermost, (_all, attrs: string, body: string) => {
      const open = /open\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? "(";
      const close = /close\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? ")";
      const seps = /separators\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? ",";
      const kids = splitTopLevel(body);
      let joined = kids.length > 0 ? kids[0] : body;
      for (let i = 1; i < kids.length; i++) {
        const sep = seps[i - 1] ?? seps[seps.length - 1] ?? ",";
        joined += (sep ? `<mo>${escapeXml(sep)}</mo>` : "") + kids[i];
      }
      const openTag = open ? `<mo>${escapeXml(open)}</mo>` : "";
      const closeTag = close ? `<mo>${escapeXml(close)}</mo>` : "";
      return `<mrow>${openTag}${joined}${closeTag}</mrow>`;
    });
  }
  return out;
}


/**
 * Collegeboard HTML is injected with dangerouslySetInnerHTML, so it is scrubbed
 * before it ever reaches the page. Today the bank contains none of these
 * constructs, which is exactly why removing them costs nothing and keeps a
 * change upstream from turning into script execution here.
 *
 * <style> is stripped too: the SVG figures ship rules like
 * `*{stroke-linecap:butt}`, and a universal selector inserted via innerHTML is
 * not scoped to the figure, so it restyles the app's own icons.
 */
function sanitiseHtml(html: string): string {
  if (!html) return html;
  return html
    // Paired tags together with their contents, e.g. <style>...</style>.
    .replace(
      /<\s*(script|iframe|object|embed|form|link|meta|base|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ""
    )
    // Any stragglers left unpaired or self-closing.
    .replace(
      /<\s*\/?\s*(script|iframe|object|embed|form|link|meta|base|style)\b[^>]*>/gi,
      ""
    )
    // Inline event handlers, in all three quoting styles.
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    // javascript: URLs in links, images and SVG <use>.
    .replace(
      /(href|xlink:href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
      '$1="#"'
    );
}

/** Everything Collegeboard sends goes through the same clean-up. */
function prepareHtml(html: string): string {
  return sanitiseHtml(expandMfenced(html));
}

// ── Normalisation ─────────────────────────────────────────────────────────

interface NormalisedOption {
  key: string;
  text: string;
}

interface NormalisedQuestion {
  id: string;
  externalId: string;
  difficulty: string;
  skill_desc: string;
  domain: string;
  type: string;
  stem: string;
  stimulus?: string;
  answerOptions?: NormalisedOption[];
  correctAnswer: string[];
  rationale?: string;
}

function optionText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Meta;
    const t = obj.content ?? obj.text ?? obj.value;
    if (typeof t === "string") return t;
  }
  return "";
}

/**
 * Collegeboard returns `answerOptions` as an array of `{ id, content }` in
 * display order, so position determines the letter the student sees. It is
 * typed loosely here because a handful of older items come back as an object
 * keyed by letter instead.
 */
function normaliseOptions(raw: unknown): { options: NormalisedOption[]; idToKey: Map<string, string> } {
  const idToKey = new Map<string, string>();
  if (!raw || typeof raw !== "object") return { options: [], idToKey };

  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((v, i) => [String(i), v])
    : Object.entries(raw as Meta).sort(([a], [b]) => {
        const an = parseInt(a, 10);
        const bn = parseInt(b, 10);
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
        return a.localeCompare(b);
      });

  const options = entries.map(([key, value], index) => {
    const letter = /^[A-Z]$/i.test(key)
      ? key.toUpperCase()
      : String.fromCharCode(65 + index);
    idToKey.set(key, letter);
    idToKey.set(key.toUpperCase(), letter);
    if (value && typeof value === "object") {
      const id = (value as Meta).id;
      if (typeof id === "string") idToKey.set(id, letter);
    }
    return { key: letter, text: prepareHtml(optionText(value)) };
  });

  return { options, idToKey };
}

/**
 * Resolves one raw answer into the letter shown to the student. Collegeboard
 * gives a letter for multiple choice, but grid-in (`spr`) answers are literal
 * values like ".2857" or "43/5" and must be passed through untouched.
 */
function resolveAnswer(raw: unknown, idToKey: Map<string, string>, optionCount: number): string {
  const s = String(raw).trim();
  if (optionCount === 0) return s;

  const upper = s.toUpperCase();
  if (/^[A-Z]$/.test(upper) && upper.charCodeAt(0) - 65 < optionCount) return upper;

  const mapped = idToKey.get(s) ?? idToKey.get(upper);
  if (mapped) return mapped;

  const asIndex = Number(s);
  if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < optionCount) {
    return String.fromCharCode(65 + asIndex);
  }
  return s;
}

function normaliseQuestion(meta: Meta, content: Meta, section: string): NormalisedQuestion | null {
  const extId = String(meta.external_id ?? "");
  if (!extId) return null;

  const type = typeof content.type === "string" ? content.type.toLowerCase() : "mcq";
  const { options, idToKey } = normaliseOptions(content.answerOptions);

  const rawAns = content.correct_answer ?? content.keys;
  const list = Array.isArray(rawAns) ? rawAns : rawAns != null ? [rawAns] : [];
  const correctAnswer = list
    .map((a) => resolveAnswer(a, idToKey, options.length))
    .filter((a) => a.length > 0);

  // A question we cannot grade is worse than one we never showed.
  if (correctAnswer.length === 0) return null;
  if (type !== "spr" && options.length === 0) return null;

  return {
    id: String(meta.questionId ?? extId),
    externalId: extId,
    difficulty: String(meta.difficulty ?? "M"),
    skill_desc: String(meta.skill_desc ?? ""),
    domain: section,
    type,
    stem: prepareHtml(content.stem as string),
    stimulus:
      typeof content.stimulus === "string" ? prepareHtml(content.stimulus) : undefined,
    answerOptions: options.length > 0 ? options : undefined,
    correctAnswer,
    rationale:
      typeof content.rationale === "string" ? prepareHtml(content.rationale) : undefined,
  };
}

// ── Question bank ─────────────────────────────────────────────────────────

/**
 * Collegeboard items are immutable, so a row already written never needs to be
 * written again. This map keeps the ids of items banked since the server started
 * so a warm module start costs no database round trip at all.
 */
const BANKED_MAX = 5000;
const bankedIds = new Map<string, string>();

function rememberBanked(externalId: string, rowId: string): void {
  if (bankedIds.size >= BANKED_MAX) {
    const oldest = bankedIds.keys().next().value;
    if (oldest !== undefined) bankedIds.delete(oldest);
  }
  bankedIds.set(externalId, rowId);
}

function toBankInput(q: NormalisedQuestion): BankQuestionInput {
  return {
    externalId: q.externalId,
    source: "collegeboard",
    section: q.domain,
    topic: q.skill_desc || (q.domain === "math" ? "Math" : "Reading & Writing"),
    difficulty: q.difficulty,
    skillDesc: q.skill_desc || null,
    stimulus: q.stimulus ?? null,
    questionText: q.stem,
    questionType: q.type === "spr" ? "grid_in" : "multiple_choice",
    correctAnswers: q.correctAnswer,
    explanation: q.rationale ?? null,
    options: q.answerOptions ?? [],
  };
}

/**
 * Rewrites each question's `id` to its row in the shared bank and reports
 * whether every one made it. A database that is down must not take the test
 * down with it, so a failure here only means this attempt cannot be saved.
 */
async function bankQuestions(questions: NormalisedQuestion[]): Promise<boolean> {
  if (questions.length === 0) return true;
  try {
    const cold = questions.filter((q) => !bankedIds.has(q.externalId));
    if (cold.length > 0) {
      const written = await upsertQuestions(cold.map(toBankInput));
      written.forEach((rowId, externalId) => rememberBanked(externalId, rowId));
    }
    let complete = true;
    for (const q of questions) {
      const rowId = bankedIds.get(q.externalId);
      if (rowId) q.id = rowId;
      else complete = false;
    }
    return complete;
  } catch (err) {
    console.error("Could not bank full-test questions:", err);
    return false;
  }
}

// ── Route ─────────────────────────────────────────────────────────────────

/** Reads `excludeIds` without letting a malformed query string 500 the route. */
function parseExcludeIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    return new Set();
  }
}

export async function GET(req: NextRequest) {
  // This route writes fetched items into the shared question bank, so it is not
  // an anonymous endpoint. Only a signed-in student can take a test anyway.
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Please sign in to take a test.", questions: [], count: 0 },
      { status: 401 }
    );
  }

  const sp = new URL(req.url).searchParams;
  const section = sp.get("section") === "math" ? "math" : "rw";
  const isM2 = sp.get("module") === "2";
  const harder = sp.get("harder") === "true";
  const excludeIds = parseExcludeIds(sp.get("excludeIds"));

  const domains = DOMAINS[section];
  const target = section === "math" ? 22 : 27;

  // Difficulty ratios per module type
  let eR: number, hR: number;
  if (!isM2) {
    eR = 0.33;
    hR = 0.22;
  } else if (harder) {
    eR = 0.10;
    hR = 0.60;
  } else {
    eR = 0.40;
    hR = 0.20;
  }
  const eN = Math.round(target * eR);
  const hN = Math.round(target * hR);
  const mN = target - eN - hN;

  const lists = await Promise.all(domains.map((d) => listDomain(d, TEST_CODE[section])));
  if (lists.every((l) => l === null)) {
    return NextResponse.json(
      {
        success: false,
        error: "Collegeboard is not responding right now. Please try again in a minute.",
        questions: [],
        count: 0,
      },
      { status: 503 }
    );
  }

  const pool = lists
    .flatMap((l) => l ?? [])
    .filter(isFetchable)
    .filter((q) => !excludeIds.has(String(q.external_id)));

  const byDiff = {
    E: shuffle(pool.filter((q) => q.difficulty === "E")),
    M: shuffle(pool.filter((q) => q.difficulty === "M")),
    H: shuffle(pool.filter((q) => q.difficulty === "H")),
  };

  // Candidates the difficulty plan actually asks for come first; everything
  // else follows as backup so a failed content fetch still yields a full module.
  const planned = shuffle([
    ...byDiff.E.slice(0, eN),
    ...byDiff.M.slice(0, mN),
    ...byDiff.H.slice(0, hN),
  ]);
  const backup = shuffle([
    ...byDiff.E.slice(eN),
    ...byDiff.M.slice(mN),
    ...byDiff.H.slice(hN),
  ]);
  const queue = [...planned, ...backup];

  const picked: NormalisedQuestion[] = [];
  const seen = new Set<string>();
  let cursor = 0;
  const MAX_WAVES = 5;

  for (let wave = 0; wave < MAX_WAVES && picked.length < target && cursor < queue.length; wave++) {
    const need = target - picked.length;
    const batch = queue.slice(cursor, cursor + Math.ceil(need * 1.35) + 4);
    cursor += batch.length;

    const settled = await Promise.all(
      batch.map(async (meta) => {
        const content = await fetchContent(String(meta.external_id));
        return content ? normaliseQuestion(meta, content, section) : null;
      })
    );

    for (const q of settled) {
      if (!q || seen.has(q.externalId)) continue;
      seen.add(q.externalId);
      picked.push(q);
      if (picked.length >= target) break;
    }
  }

  const questions = shuffle(picked).slice(0, target);

  // Put the items in the shared bank and hand back their row ids, so the page
  // can save an attempt by id instead of shipping ~500KB of HTML back up.
  const banked = await bankQuestions(questions);

  if (questions.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Could not load questions from Collegeboard. Please try again.",
        questions: [],
        count: 0,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    questions,
    count: questions.length,
    requested: target,
    partial: questions.length < target,
    banked,
  });
}
