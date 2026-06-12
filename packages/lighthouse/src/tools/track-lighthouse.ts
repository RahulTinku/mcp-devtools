/**
 * track_lighthouse — run a Lighthouse audit and store the result for trend tracking.
 * Shows the current result + trend vs previous audits for this URL.
 */

import lighthouse from "lighthouse";
import { launchChrome } from "../chrome.js";
import { saveRecord, getHistory, getAllTrackedUrls } from "./trend-store.js";
import type { AuditRecord } from "./trend-store.js";
import type { RunOptions } from "../types.js";

const SCORE_ICON = (score: number | null) => {
  if (score === null) return "—";
  if (score >= 90) return `✅ ${score}`;
  if (score >= 50) return `⚠️ ${score}`;
  return `❌ ${score}`;
};

const TREND_ICON = (current: number | null, prev: number | null): string => {
  if (current === null || prev === null) return "";
  const delta = current - prev;
  if (Math.abs(delta) < 2) return " (→)";
  return delta > 0 ? ` (↑${delta})` : ` (↓${Math.abs(delta)})`;
};

function extractScores(lhr: Record<string, unknown>): AuditRecord["scores"] {
  const cats = lhr.categories as Record<string, { score: number | null }>;
  return {
    performance: cats.performance?.score !== undefined ? Math.round((cats.performance.score ?? 0) * 100) : null,
    accessibility: cats.accessibility?.score !== undefined ? Math.round((cats.accessibility.score ?? 0) * 100) : null,
    bestPractices: cats["best-practices"]?.score !== undefined ? Math.round((cats["best-practices"].score ?? 0) * 100) : null,
    seo: cats.seo?.score !== undefined ? Math.round((cats.seo.score ?? 0) * 100) : null,
  };
}

function extractCwv(lhr: Record<string, unknown>): AuditRecord["cwv"] {
  const audits = lhr.audits as Record<string, { displayValue?: string }>;
  return {
    lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
    fcp: audits["first-contentful-paint"]?.displayValue ?? null,
    cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
    tbt: audits["total-blocking-time"]?.displayValue ?? null,
    speedIndex: audits["speed-index"]?.displayValue ?? null,
    tti: audits["interactive"]?.displayValue ?? null,
  };
}

export async function trackLighthouse(
  options: Pick<RunOptions, "url" | "mobile">
): Promise<string> {
  const { url, mobile = false } = options;

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
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      ...(mobile
        ? {}
        : {
            screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
            formFactor: "desktop",
            throttling: { cpuSlowdownMultiplier: 1 },
          }),
    });
    if (!result?.lhr) return `Error: Lighthouse returned no results for ${url}`;
    lhr = result.lhr as unknown as Record<string, unknown>;
  } catch (err) {
    return `Error running Lighthouse: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    await chrome.kill();
  }

  const now = Date.now();
  const record: AuditRecord = {
    timestamp: now,
    date: new Date(now).toISOString(),
    url,
    mobile,
    scores: extractScores(lhr),
    cwv: extractCwv(lhr),
  };

  saveRecord(record);
  const history = getHistory(url, mobile, 10);

  return formatTrackingResult(record, history);
}

export async function getLighthouseTrend(url: string, mobile = false, limit = 10): Promise<string> {
  const history = getHistory(url, mobile, limit);

  if (history.length === 0) {
    const all = getAllTrackedUrls();
    const lines = [`## Lighthouse Trend: No data for ${url} (${mobile ? "mobile" : "desktop"})`];
    if (all.length > 0) {
      lines.push("", "**Tracked URLs:**");
      all.forEach((entry) => {
        lines.push(`- ${entry.url} (${entry.mobile ? "mobile" : "desktop"}) — ${entry.count} audits`);
      });
    } else {
      lines.push("", "No audits tracked yet. Run `track_lighthouse` to start recording.");
    }
    return lines.join("\n");
  }

  return formatTrendTable(url, mobile, history);
}

function formatTrackingResult(current: AuditRecord, history: AuditRecord[]): string {
  const prev = history[1] ?? null; // index 0 is current (just saved)
  const lines: string[] = [];

  lines.push(`## Lighthouse Tracked Audit`);
  lines.push(`**URL:** ${current.url}`);
  lines.push(`**Mode:** ${current.mobile ? "Mobile" : "Desktop"} | **Time:** ${current.date}`);
  lines.push(`**Stored:** ${history.length} audit${history.length !== 1 ? "s" : ""} on record`);
  lines.push("");

  lines.push(`### Scores`);
  lines.push(`| Category | Score | Trend |`);
  lines.push(`|----------|-------|-------|`);
  const prevScores = prev?.scores;
  lines.push(`| 🚀 Performance   | ${SCORE_ICON(current.scores.performance)}   | ${TREND_ICON(current.scores.performance, prevScores?.performance ?? null)} |`);
  lines.push(`| ♿ Accessibility  | ${SCORE_ICON(current.scores.accessibility)}  | ${TREND_ICON(current.scores.accessibility, prevScores?.accessibility ?? null)} |`);
  lines.push(`| 💡 Best Practices | ${SCORE_ICON(current.scores.bestPractices)} | ${TREND_ICON(current.scores.bestPractices, prevScores?.bestPractices ?? null)} |`);
  lines.push(`| 🔍 SEO            | ${SCORE_ICON(current.scores.seo)}           | ${TREND_ICON(current.scores.seo, prevScores?.seo ?? null)} |`);
  lines.push("");

  lines.push(`### Core Web Vitals`);
  if (current.cwv.lcp) lines.push(`- **LCP:** ${current.cwv.lcp}`);
  if (current.cwv.fcp) lines.push(`- **FCP:** ${current.cwv.fcp}`);
  if (current.cwv.cls) lines.push(`- **CLS:** ${current.cwv.cls}`);
  if (current.cwv.tbt) lines.push(`- **TBT:** ${current.cwv.tbt}`);
  lines.push("");

  if (history.length > 1) {
    lines.push(`_Run \`get_lighthouse_trend\` on this URL to see the full history._`);
  }

  return lines.join("\n");
}

function formatTrendTable(url: string, mobile: boolean, history: AuditRecord[]): string {
  const lines: string[] = [];
  lines.push(`## Lighthouse Trend: ${url}`);
  lines.push(`**Mode:** ${mobile ? "Mobile" : "Desktop"} | **${history.length} audits**`);
  lines.push("");

  lines.push(`| Date | Perf | A11y | BP | SEO | LCP | CLS |`);
  lines.push(`|------|------|------|----|-----|-----|-----|`);

  history.forEach((r) => {
    const d = r.date.split("T")[0];
    const t = r.date.split("T")[1]?.slice(0, 5) ?? "";
    const p = r.scores.performance !== null ? String(r.scores.performance) : "—";
    const a = r.scores.accessibility !== null ? String(r.scores.accessibility) : "—";
    const bp = r.scores.bestPractices !== null ? String(r.scores.bestPractices) : "—";
    const s = r.scores.seo !== null ? String(r.scores.seo) : "—";
    lines.push(`| ${d} ${t} | ${p} | ${a} | ${bp} | ${s} | ${r.cwv.lcp ?? "—"} | ${r.cwv.cls ?? "—"} |`);
  });
  lines.push("");

  // Simple trend summary — compare first and last
  const latest = history[0];
  const oldest = history[history.length - 1];
  if (history.length > 1 && latest.scores.performance !== null && oldest.scores.performance !== null) {
    const delta = latest.scores.performance - oldest.scores.performance;
    const direction = delta > 0 ? `↑ improved by ${delta} pts` : delta < 0 ? `↓ degraded by ${Math.abs(delta)} pts` : "→ unchanged";
    lines.push(`**Performance trend (${history.length} audits):** ${direction}`);
    lines.push(`_Oldest: ${oldest.scores.performance} | Latest: ${latest.scores.performance}_`);
  }

  return lines.join("\n");
}
