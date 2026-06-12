import fs from "node:fs";
import path from "node:path";
import type { WebpackStats, ModuleRecord, RollupVisualizerNode } from "../types.js";
import { isRollupVisualizerStats } from "../types.js";

const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";

// ─── Shared formatter ────────────────────────────────────────────────────────

function formatLargeModules(
  allModules: ModuleRecord[],
  thresholdKb: number,
  resolvedPath: string,
  isSourceSizes: boolean
): string {
  const lines: string[] = [];
  lines.push(`## Large Modules (> ${thresholdKb} KB)`);
  lines.push(`Found **${allModules.length}** modules above threshold in \`${resolvedPath}\``);
  if (isSourceSizes) {
    lines.push(`> ⚠️ Sizes are pre-minification source sizes from rollup-plugin-visualizer.`);
  }
  lines.push("");

  const nodeModules = allModules.filter((m) => m.name.includes("node_modules"));
  const appModules = allModules.filter((m) => !m.name.includes("node_modules"));

  if (nodeModules.length > 0) {
    lines.push(`### Third-party Dependencies (${nodeModules.length})`);
    nodeModules.forEach((mod, i) => {
      lines.push(`${i + 1}. \`${mod.name}\``);
      lines.push(`   - Size: **${mod.sizeKb}**`);
      if (mod.importedBy.length > 0) {
        lines.push(`   - Imported by: ${mod.importedBy.map((n) => `\`${n}\``).join(", ")}`);
      }
    });
    lines.push("");
  }

  if (appModules.length > 0) {
    lines.push(`### Application Modules (${appModules.length})`);
    appModules.forEach((mod, i) => {
      lines.push(`${i + 1}. \`${mod.name}\` — **${mod.sizeKb}**`);
    });
    lines.push("");
  }

  const totalSize = allModules.reduce((s, m) => s + m.sizeBytes, 0);
  lines.push(`### Impact`);
  lines.push(`Total size of large modules: **${kb(totalSize)}**`);

  if (nodeModules.length > 0) {
    lines.push("");
    lines.push(`### Suggested actions for large dependencies`);
    nodeModules.slice(0, 5).forEach((mod) => {
      const pkgMatch = mod.name.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
      const pkg = pkgMatch?.[1] ?? mod.name;
      lines.push(
        `- **${pkg}** (${mod.sizeKb}): Check if tree-shaking is enabled, consider a lighter alternative, or lazy-load if not needed at startup.`
      );
    });
  }

  return lines.join("\n");
}

// ─── Vite / Rollup (rollup-plugin-visualizer) ────────────────────────────────

function collectVisualizerModules(
  node: RollupVisualizerNode,
  thresholdBytes: number,
  results: ModuleRecord[]
): void {
  if (!node.children || node.children.length === 0) {
    if ((node.originalSize ?? 0) >= thresholdBytes) {
      results.push({
        name: node.name,
        sizeBytes: node.originalSize!,
        sizeKb: kb(node.originalSize!),
        chunks: [],
        importedBy: [],
      });
    }
  } else {
    for (const child of node.children) {
      collectVisualizerModules(child, thresholdBytes, results);
    }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function findLargeModules(statsPath: string, thresholdKb = 50): string {
  const resolved = path.resolve(statsPath);

  if (!fs.existsSync(resolved)) {
    return `Error: stats.json not found at ${resolved}`;
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  const thresholdBytes = thresholdKb * 1024;

  // ── Vite / Rollup ──
  if (isRollupVisualizerStats(parsed)) {
    const allModules: ModuleRecord[] = [];
    for (const chunk of parsed.tree.children ?? []) {
      collectVisualizerModules(chunk, thresholdBytes, allModules);
    }
    allModules.sort((a, b) => b.sizeBytes - a.sizeBytes);

    if (allModules.length === 0) {
      return `No modules found larger than ${thresholdKb} KB.\n> Note: sizes are pre-minification source sizes from rollup-plugin-visualizer.`;
    }

    return formatLargeModules(allModules, thresholdKb, resolved, true);
  }

  // ── Webpack ──
  const stats = parsed as WebpackStats;

  if (!stats.modules?.length) {
    return (
      "No module data found in stats.json. " +
      "Re-run webpack with `--stats=verbose` or set `stats: 'verbose'` in your webpack config."
    );
  }

  const allModules: ModuleRecord[] = [];
  const flattenModules = (mods: WebpackStats["modules"] = []) => {
    for (const m of mods) {
      if (m.modules?.length) {
        flattenModules(m.modules);
      } else if (m.size >= thresholdBytes) {
        allModules.push({
          name: m.name,
          sizeBytes: m.size,
          sizeKb: kb(m.size),
          chunks: m.chunks ?? [],
          importedBy: (m.reasons ?? [])
            .map((r) => r.moduleName)
            .filter(Boolean)
            .slice(0, 3),
        });
      }
    }
  };

  flattenModules(stats.modules);
  allModules.sort((a, b) => b.sizeBytes - a.sizeBytes);

  if (allModules.length === 0) {
    return `No modules found larger than ${thresholdKb} KB. Your bundle looks well-optimized at the module level.`;
  }

  return formatLargeModules(allModules, thresholdKb, resolved, false);
}
