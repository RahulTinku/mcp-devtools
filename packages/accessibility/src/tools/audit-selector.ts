import { AxeBuilder } from "@axe-core/playwright";
import { withPage } from "../browser.js";
import type { AuditOptions, ImpactLevel, Violation } from "../types.js";

const IMPACT_ICON: Record<ImpactLevel, string> = {
  critical: "🔴",
  serious: "🟠",
  moderate: "🟡",
  minor: "⚪",
};

/**
 * Audit a specific component or region of the page by CSS selector.
 * Useful for testing a single component, modal, or widget in isolation.
 */
export async function auditSelector(
  options: AuditOptions & { selector: string }
): Promise<string> {
  const { url, selector, tags, timeout = 30_000 } = options;

  try {
    const results = await withPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout });

      // Verify selector exists before running audit
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`SELECTOR_NOT_FOUND: "${selector}" not found on ${url}`);
      }

      let builder = new AxeBuilder({ page }).include(selector);
      if (tags?.length) builder = builder.withTags(tags);

      return await builder.analyze();
    }, timeout);

    const violations = results.violations as Violation[];
    const lines: string[] = [];

    lines.push(`## Accessibility Audit — Component`);
    lines.push(`**URL:** ${url}`);
    lines.push(`**Selector:** \`${selector}\``);
    if (tags?.length) lines.push(`**Filters:** ${tags.join(", ")}`);
    lines.push("");

    if (violations.length === 0) {
      lines.push(`✅ No violations found in \`${selector}\`. ${results.passes.length} rules passed.`);
      return lines.join("\n");
    }

    const totalElements = violations.reduce((s, v) => s + v.nodes.length, 0);
    lines.push(`**${violations.length} violations** across **${totalElements} elements** within \`${selector}\``);
    lines.push("");

    violations
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        return (order[a.impact] ?? 4) - (order[b.impact] ?? 4);
      })
      .forEach((v, i) => {
        const icon = IMPACT_ICON[v.impact as ImpactLevel] ?? "⚪";
        lines.push(`### ${i + 1}. ${icon} ${v.help}`);
        lines.push(`**Rule:** \`${v.id}\` | **Impact:** ${v.impact}`);
        lines.push(`${v.description}`);
        lines.push("");
        v.nodes.forEach((node, ni) => {
          lines.push(`**Element ${ni + 1}:** \`${node.target.join(", ")}\``);
          lines.push(`\`\`\`html\n${node.html.trim().slice(0, 150)}\n\`\`\``);
          if (node.failureSummary) {
            lines.push(`*${node.failureSummary.trim().slice(0, 200)}*`);
          }
          lines.push("");
        });
        lines.push(`📖 [How to fix →](${v.helpUrl})`);
        lines.push("");
      });

    return lines.join("\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("SELECTOR_NOT_FOUND:")) {
      return `Error: ${msg.replace("SELECTOR_NOT_FOUND: ", "")}`;
    }
    return `Error running audit: ${msg}`;
  }
}
