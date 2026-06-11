import lighthouse from "lighthouse";
import { launchChrome } from "../chrome.js";
import type { ScoreRating } from "../types.js";

interface QuickScore {
  performance: number | null;
  accessibility: number | null;
  "best-practices": number | null;
  seo: number | null;
  lcp: string;
  tbt: string;
  cls: string;
  fcp: string;
}

function scoreRating(score: number | null): ScoreRating {
  if (score === null) return "n/a";
  if (score >= 0.9) return "good";
  if (score >= 0.5) return "needs-improvement";
  return "poor";
}

const RATING_ICON: Record<ScoreRating, string> = {
  good: "✅",
  "needs-improvement": "⚠️",
  poor: "❌",
  "n/a": "ℹ️",
};

async function quickAudit(url: string, mobile: boolean): Promise<QuickScore> {
  const chrome = await launchChrome(mobile);
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "silent",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      ...(mobile
        ? {}
        : {
            screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
            formFactor: "desktop",
            throttling: { cpuSlowdownMultiplier: 1 },
          }),
    });

    const lhr = result?.lhr;
    if (!lhr) throw new Error(`No results for ${url}`);

    const cats = lhr.categories as Record<string, { score: number | null }>;
    const audits = lhr.audits as Record<string, { displayValue?: string }>;

    return {
      performance: cats.performance?.score ?? null,
      accessibility: cats.accessibility?.score ?? null,
      "best-practices": cats["best-practices"]?.score ?? null,
      seo: cats.seo?.score ?? null,
      lcp: audits["largest-contentful-paint"]?.displayValue ?? "—",
      tbt: audits["total-blocking-time"]?.displayValue ?? "—",
      cls: audits["cumulative-layout-shift"]?.displayValue ?? "—",
      fcp: audits["first-contentful-paint"]?.displayValue ?? "—",
    };
  } finally {
    await chrome.kill();
  }
}

/** Format a numeric score change with a trend arrow */
function scoreDiff(before: number | null, after: number | null): string {
  if (before === null || after === null) return "—";
  const diff = Math.round((after - before) * 100);
  if (diff === 0) return "→ no change";
  return diff > 0 ? `↑ +${diff}` : `↓ ${diff}`;
}

export async function compareUrls(
  beforeUrl: string,
  afterUrl: string,
  mobile = false
): Promise<string> {
  let before: QuickScore;
  let after: QuickScore;

  try {
    // Run sequentially — two Chrome instances at once risks port collision
    before = await quickAudit(beforeUrl, mobile);
    after = await quickAudit(afterUrl, mobile);
  } catch (err) {
    return `Error running comparison: ${err instanceof Error ? err.message : String(err)}`;
  }

  const lines: string[] = [];
  lines.push(`## Lighthouse Comparison`);
  lines.push(`**Before:** ${beforeUrl}`);
  lines.push(`**After:** ${afterUrl}`);
  lines.push(`**Mode:** ${mobile ? "Mobile" : "Desktop"}`);
  lines.push("");

  lines.push(`### Category Scores`);
  lines.push(`| Category | Before | After | Change |`);
  lines.push(`|----------|--------|-------|--------|`);

  const categories: Array<[string, keyof QuickScore, string]> = [
    ["🚀 Performance", "performance", ""],
    ["♿ Accessibility", "accessibility", ""],
    ["💡 Best Practices", "best-practices", ""],
    ["🔍 SEO", "seo", ""],
  ];

  categories.forEach(([label, key]) => {
    const b = before[key] as number | null;
    const a = after[key] as number | null;
    const bScore = b !== null ? `${Math.round(b * 100)}` : "—";
    const aScore = a !== null ? `${Math.round(a * 100)}` : "—";
    const diff = scoreDiff(b, a);
    const afterRating = scoreRating(a);
    lines.push(`| ${label} | ${bScore} | ${aScore} ${RATING_ICON[afterRating]} | ${diff} |`);
  });

  lines.push("");
  lines.push(`### Core Web Vitals`);
  lines.push(`| Metric | Before | After |`);
  lines.push(`|--------|--------|-------|`);
  lines.push(`| LCP (Largest Contentful Paint) | ${before.lcp} | ${after.lcp} |`);
  lines.push(`| FCP (First Contentful Paint) | ${before.fcp} | ${after.fcp} |`);
  lines.push(`| TBT (Total Blocking Time) | ${before.tbt} | ${after.tbt} |`);
  lines.push(`| CLS (Cumulative Layout Shift) | ${before.cls} | ${after.cls} |`);
  lines.push("");

  // Summary verdict
  const perfBefore = before.performance !== null ? Math.round(before.performance * 100) : null;
  const perfAfter = after.performance !== null ? Math.round(after.performance * 100) : null;
  if (perfBefore !== null && perfAfter !== null) {
    const diff = perfAfter - perfBefore;
    if (diff > 0) {
      lines.push(`✅ **Performance improved by ${diff} points** (${perfBefore} → ${perfAfter})`);
    } else if (diff < 0) {
      lines.push(`⚠️ **Performance regressed by ${Math.abs(diff)} points** (${perfBefore} → ${perfAfter})`);
    } else {
      lines.push(`→ **Performance unchanged** (${perfBefore})`);
    }
  }

  return lines.join("\n");
}
