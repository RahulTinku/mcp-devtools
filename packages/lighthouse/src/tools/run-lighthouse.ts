import lighthouse from "lighthouse";
import { launchChrome } from "../chrome.js";
import type {
  RunOptions,
  LighthouseReport,
  CategoryScore,
  CwvMetric,
  Opportunity,
  FailingAudit,
  ScoreRating,
} from "../types.js";

// Thresholds and metadata for Core Web Vitals
const CWV_META: Record<string, { title: string; threshold: string; goodMs: number; poorMs: number }> = {
  "largest-contentful-paint": { title: "LCP", threshold: "Good <2.5s · Poor >4s", goodMs: 2500, poorMs: 4000 },
  "first-contentful-paint": { title: "FCP", threshold: "Good <1.8s · Poor >3s", goodMs: 1800, poorMs: 3000 },
  "total-blocking-time": { title: "TBT", threshold: "Good <200ms · Poor >600ms", goodMs: 200, poorMs: 600 },
  "cumulative-layout-shift": { title: "CLS", threshold: "Good <0.1 · Poor >0.25", goodMs: 100, poorMs: 250 },
  "speed-index": { title: "Speed Index", threshold: "Good <3.4s · Poor >5.8s", goodMs: 3400, poorMs: 5800 },
  "interactive": { title: "TTI", threshold: "Good <3.8s · Poor >7.3s", goodMs: 3800, poorMs: 7300 },
};

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

/** Map of audit id → category title (built from lhr.categories) */
function buildAuditCategoryMap(lhr: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  const cats = lhr.categories as Record<string, { title: string; auditRefs: Array<{ id: string }> }>;
  for (const [, cat] of Object.entries(cats)) {
    for (const ref of cat.auditRefs ?? []) {
      map.set(ref.id, cat.title);
    }
  }
  return map;
}

export async function runLighthouse(options: RunOptions): Promise<string> {
  const {
    url,
    categories = ["performance", "accessibility", "best-practices", "seo"],
    mobile = false,
    timeout = 60_000,
  } = options;

  let chrome;
  try {
    chrome = await launchChrome(mobile);
  } catch (err) {
    return `Error launching Chrome: ${err instanceof Error ? err.message : String(err)}`;
  }

  let lhr: Record<string, unknown>;
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "silent",
      onlyCategories: categories,
      ...(mobile
        ? {}
        : {
            // Desktop config
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1,
              disabled: false,
            },
            formFactor: "desktop",
            throttling: { cpuSlowdownMultiplier: 1 },
          }),
    });

    if (!result?.lhr) {
      return `Error: Lighthouse returned no results for ${url}`;
    }

    lhr = result.lhr as unknown as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("net::ERR") || msg.includes("ECONNREFUSED")) {
      return `Error: Could not reach "${url}". Is the server running?`;
    }
    if (msg.includes("Timeout") || msg.includes("timeout")) {
      return `Error: Lighthouse timed out after ${timeout}ms on "${url}".`;
    }
    return `Error running Lighthouse: ${msg}`;
  } finally {
    // Unconditional — always kill the Chrome process
    await chrome.kill();
  }

  return formatReport(lhr, url, mobile);
}

function formatReport(lhr: Record<string, unknown>, url: string, mobile: boolean): string {
  const audits = lhr.audits as Record<string, {
    id: string; title: string; description: string;
    score: number | null; displayValue?: string;
    numericValue?: number;
    details?: { type: string; overallSavingsMs?: number; overallSavingsBytes?: number };
  }>;
  const cats = lhr.categories as Record<string, { title: string; score: number | null }>;
  const auditCatMap = buildAuditCategoryMap(lhr);
  const fetchTime = (lhr.fetchTime as string ?? "").split("T")[0];

  const lines: string[] = [];

  // — Header —
  lines.push(`## Lighthouse Audit`);
  lines.push(`**URL:** ${url}`);
  lines.push(`**Mode:** ${mobile ? "Mobile (throttled)" : "Desktop"} | **Date:** ${fetchTime}`);
  lines.push("");

  // — Category Scores —
  const CATEGORY_ICON: Record<string, string> = {
    performance: "🚀",
    accessibility: "♿",
    "best-practices": "💡",
    seo: "🔍",
  };

  lines.push(`### Scores`);
  lines.push(`| Category | Score | Rating |`);
  lines.push(`|----------|-------|--------|`);

  const categoryScores: CategoryScore[] = Object.entries(cats).map(([id, cat]) => {
    const score = cat.score !== null ? Math.round(cat.score * 100) : null;
    const rating = scoreRating(cat.score);
    return { id, title: cat.title, score, rating };
  });

  categoryScores.forEach(({ id, title, score, rating }) => {
    const icon = CATEGORY_ICON[id] ?? "•";
    const scoreStr = score !== null ? `${score}/100` : "n/a";
    lines.push(`| ${icon} ${title} | ${scoreStr} | ${RATING_ICON[rating]} ${rating} |`);
  });
  lines.push("");

  // — Core Web Vitals —
  lines.push(`### Core Web Vitals`);
  lines.push(`| Metric | Value | Rating | Threshold |`);
  lines.push(`|--------|-------|--------|-----------|`);

  let hasCwv = false;
  for (const [id, meta] of Object.entries(CWV_META)) {
    const audit = audits[id];
    if (!audit) continue;
    hasCwv = true;
    const rating = scoreRating(audit.score);
    lines.push(
      `| **${meta.title}** | ${audit.displayValue ?? "—"} | ${RATING_ICON[rating]} ${rating} | ${meta.threshold} |`
    );
  }
  if (!hasCwv) {
    lines.push(`| — | Performance category not included in this audit | | |`);
  }
  lines.push("");

  // — Opportunities (estimated savings) —
  const opportunities = Object.values(audits).filter(
    (a) => a.details?.type === "opportunity" && a.score !== null && a.score < 1
  );

  if (opportunities.length > 0) {
    lines.push(`### ⚡ Performance Opportunities`);
    lines.push(`_Fixing these would improve load time:_`);
    lines.push("");
    opportunities
      .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
      .forEach((opp) => {
        const savingsMs = opp.details?.overallSavingsMs;
        const savingsBytes = opp.details?.overallSavingsBytes;
        const saving = savingsMs
          ? `~${(savingsMs / 1000).toFixed(1)}s saved`
          : savingsBytes
          ? `~${(savingsBytes / 1024).toFixed(0)} KB saved`
          : opp.displayValue ?? "";
        lines.push(`#### ${opp.title}`);
        lines.push(opp.description);
        if (saving) lines.push(`**Estimated saving:** ${saving}`);
        lines.push("");
      });
  } else if (categoryScores.find((c) => c.id === "performance")) {
    lines.push(`### ⚡ Performance Opportunities`);
    lines.push(`✅ No opportunities found — performance looks good.`);
    lines.push("");
  }

  // — Failing audits (non-opportunity failures) —
  const failingAudits = Object.values(audits).filter(
    (a) =>
      a.score !== null &&
      a.score < 1 &&
      a.details?.type !== "opportunity" &&
      !Object.keys(CWV_META).includes(a.id)
  );

  if (failingAudits.length > 0) {
    // Group by category
    const byCategory = new Map<string, typeof failingAudits>();
    failingAudits.forEach((a) => {
      const cat = auditCatMap.get(a.id) ?? "Other";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(a);
    });

    lines.push(`### ❌ Failing Audits (${failingAudits.length})`);
    byCategory.forEach((auditsInCat, catTitle) => {
      lines.push(`**${catTitle}**`);
      auditsInCat.forEach((a) => {
        const scoreStr = a.score !== null ? ` (score: ${(a.score * 100).toFixed(0)})` : "";
        lines.push(`- **${a.title}**${scoreStr}`);
        if (a.displayValue) lines.push(`  *${a.displayValue}*`);
        lines.push(`  ${a.description.split(". ")[0]}.`);
      });
      lines.push("");
    });
  }

  // — Passing count —
  const passingCount = Object.values(audits).filter(
    (a) => a.score !== null && a.score >= 0.9
  ).length;
  lines.push(`---`);
  lines.push(`✅ **${passingCount} audits passing**`);

  return lines.join("\n");
}
