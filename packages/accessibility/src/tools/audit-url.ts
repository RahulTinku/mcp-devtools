import { AxeBuilder } from "@axe-core/playwright";
import { withPage } from "../browser.js";
import type { AuditOptions, ImpactLevel, Violation, AxeResults } from "../types.js";

const IMPACT_ORDER: ImpactLevel[] = ["critical", "serious", "moderate", "minor"];

const IMPACT_ICON: Record<ImpactLevel, string> = {
  critical: "🔴",
  serious: "🟠",
  moderate: "🟡",
  minor: "⚪",
};

/** Parse WCAG criterion tags (e.g. "wcag111") into readable form */
function parseWcagTags(tags: string[]): string {
  const levels: string[] = [];
  const criteria: string[] = [];

  for (const tag of tags) {
    if (tag === "wcag2a") levels.push("WCAG 2.0 A");
    else if (tag === "wcag2aa") levels.push("WCAG 2.0 AA");
    else if (tag === "wcag21aa") levels.push("WCAG 2.1 AA");
    else if (tag === "wcag22aa") levels.push("WCAG 2.2 AA");
    else if (tag === "best-practice") levels.push("Best Practice");
    else if (/^wcag\d{3,}$/.test(tag)) {
      // wcag111 → 1.1.1, wcag412 → 4.1.2
      const digits = tag.replace("wcag", "");
      const formatted = digits.length === 3
        ? `${digits[0]}.${digits[1]}.${digits[2]}`
        : digits;
      criteria.push(formatted);
    }
  }

  const parts: string[] = [];
  if (levels.length) parts.push(levels.join(" · "));
  if (criteria.length) parts.push(`Criterion ${criteria.join(", ")}`);
  return parts.join(" | ") || tags.join(", ");
}

function formatViolation(violation: Violation, index: number): string {
  const lines: string[] = [];
  const icon = IMPACT_ICON[violation.impact];
  const nodeCount = violation.nodes.length;

  lines.push(
    `#### ${index}. ${violation.id} — ${violation.help}`
  );
  lines.push(`**Impact:** ${icon} ${violation.impact.toUpperCase()}`);
  lines.push(`**WCAG:** ${parseWcagTags(violation.tags)}`);
  lines.push(`**Description:** ${violation.description}`);
  lines.push(`**Affected elements:** ${nodeCount}`);
  lines.push("");

  violation.nodes.forEach((node, i) => {
    lines.push(`**Element ${i + 1}:**`);
    lines.push(`\`\`\`html`);
    lines.push(node.html.trim().slice(0, 200));
    lines.push(`\`\`\``);
    lines.push(`Selector: \`${node.target.join(", ")}\``);
    if (node.failureSummary) {
      const summary = node.failureSummary
        .replace(/^Fix any of the following:\n/, "")
        .replace(/^Fix all of the following:\n/, "")
        .trim();
      lines.push(`Fix hint: ${summary}`);
    }
    lines.push("");
  });

  lines.push(`📖 [How to fix →](${violation.helpUrl})`);

  return lines.join("\n");
}

export async function auditUrl(options: AuditOptions): Promise<string> {
  const { url, tags, include, exclude, waitForSelector, timeout = 30_000 } = options;

  let results: AxeResults;

  try {
    results = await withPage(async (page) => {
      // Navigate to the target URL
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout,
      });

      // For SPAs: wait for a specific element if requested
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout });
      }

      // Build axe runner
      let builder = new AxeBuilder({ page });

      if (tags?.length) builder = builder.withTags(tags);
      if (include?.length) {
        for (const sel of include) builder = builder.include(sel);
      }
      if (exclude?.length) {
        for (const sel of exclude) builder = builder.exclude(sel);
      }

      return (await builder.analyze()) as AxeResults;
    }, timeout);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("net::ERR") || msg.includes("ECONNREFUSED")) {
      return `Error: Could not reach "${url}". Is the server running?`;
    }
    if (msg.includes("Timeout")) {
      return `Error: Page timed out after ${timeout}ms loading "${url}". Try increasing timeout or using wait_for_selector.`;
    }
    return `Error running audit: ${msg}`;
  }

  return formatResults(results, options);
}

function formatResults(results: AxeResults, options: AuditOptions): string {
  const violations = results.violations as Violation[];
  const lines: string[] = [];

  // — Header —
  lines.push(`## Accessibility Audit`);
  lines.push(`**URL:** ${options.url}`);
  if (options.tags?.length) lines.push(`**Filters:** ${options.tags.join(", ")}`);
  lines.push("");

  // — Summary —
  const byImpact = IMPACT_ORDER.reduce((acc, level) => {
    const vs = violations.filter((v) => v.impact === level);
    const elementCount = vs.reduce((s, v) => s + v.nodes.length, 0);
    acc[level] = { count: vs.length, elements: elementCount };
    return acc;
  }, {} as Record<ImpactLevel, { count: number; elements: number }>);

  const totalViolations = violations.length;
  const totalElements = violations.reduce((s, v) => s + v.nodes.length, 0);

  lines.push(`### Summary`);
  if (totalViolations === 0) {
    lines.push(`✅ **No violations found!** ${results.passes.length} rules passed.`);
    if (results.incomplete.length > 0) {
      lines.push(`\n⚠️ ${results.incomplete.length} rules need manual review (automated check incomplete).`);
    }
    return lines.join("\n");
  }

  lines.push(`| Impact | Violations | Elements Affected |`);
  lines.push(`|--------|-----------|-------------------|`);
  IMPACT_ORDER.forEach((level) => {
    const { count, elements } = byImpact[level];
    if (count > 0) {
      lines.push(`| ${IMPACT_ICON[level]} ${level} | ${count} | ${elements} |`);
    }
  });
  lines.push(`| **Total** | **${totalViolations}** | **${totalElements}** |`);
  lines.push(`| ✅ Passing | ${results.passes.length} | — |`);
  if (results.incomplete.length > 0) {
    lines.push(`| ⚠️ Incomplete | ${results.incomplete.length} | needs manual review |`);
  }
  lines.push("");

  // — Violations grouped by impact —
  IMPACT_ORDER.forEach((level) => {
    const levelViolations = violations.filter((v) => v.impact === level);
    if (levelViolations.length === 0) return;

    lines.push(`---`);
    lines.push(`### ${IMPACT_ICON[level]} ${level.toUpperCase()} (${levelViolations.length})`);
    lines.push("");
    levelViolations.forEach((v, i) => {
      lines.push(formatViolation(v, i + 1));
      lines.push("");
    });
  });

  // — Incomplete (needs manual review) —
  if (results.incomplete.length > 0) {
    lines.push(`---`);
    lines.push(`### ⚠️ Needs Manual Review (${results.incomplete.length})`);
    lines.push(
      `These rules couldn't be fully automated. A human should verify them.`
    );
    results.incomplete.slice(0, 5).forEach((r) => {
      lines.push(`- **${r.id}** — ${r.description}`);
    });
  }

  return lines.join("\n");
}
