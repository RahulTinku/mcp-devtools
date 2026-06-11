import fs from "node:fs";
import path from "node:path";
import type { WebpackStats, ModuleRecord } from "../types.js";

const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";

export function findLargeModules(statsPath: string, thresholdKb = 50): string {
  const resolved = path.resolve(statsPath);

  if (!fs.existsSync(resolved)) {
    return `Error: stats.json not found at ${resolved}`;
  }

  const stats: WebpackStats = JSON.parse(fs.readFileSync(resolved, "utf-8"));

  if (!stats.modules?.length) {
    return "No module data found in stats.json. Re-run webpack with `--stats=verbose` or set `stats: 'verbose'` in your webpack config.";
  }

  const thresholdBytes = thresholdKb * 1024;
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

  const lines: string[] = [];
  lines.push(`## Large Modules (> ${thresholdKb} KB)`);
  lines.push(`Found **${allModules.length}** modules above threshold in \`${resolved}\``);
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

  const totalWaste = allModules.reduce((s, m) => s + m.sizeBytes, 0);
  lines.push(`### Impact`);
  lines.push(`Total size of large modules: **${kb(totalWaste)}**`);

  if (nodeModules.length > 0) {
    lines.push("");
    lines.push(`### Suggested actions for large dependencies`);
    nodeModules.slice(0, 5).forEach((mod) => {
      const pkgMatch = mod.name.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
      const pkg = pkgMatch?.[1] ?? mod.name;
      lines.push(`- **${pkg}** (${mod.sizeKb}): Check if tree-shaking is enabled, consider a lighter alternative, or lazy-load if not needed at startup.`);
    });
  }

  return lines.join("\n");
}
