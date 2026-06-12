import fs from "node:fs";
import path from "node:path";
import type { WebpackStats, WebpackModule } from "../types.js";
import { isRollupVisualizerStats } from "../types.js";

const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CjsModule {
  name: string;
  sizeBytes: number;
  packageName: string;
}

interface BailoutModule {
  name: string;
  sizeBytes: number;
  bailouts: string[];
}

interface PartiallyUsedModule {
  name: string;
  sizeBytes: number;
  providedCount: number;
  usedCount: number;
  unusedCount: number;
  unusedExports: string[];
}

interface TreeShakingReport {
  cjsModules: CjsModule[];
  bailoutModules: BailoutModule[];
  partiallyUsed: PartiallyUsedModule[];
  hasUsedExportsData: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPackageName(moduleName: string): string {
  const match = moduleName.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  return match?.[1] ?? moduleName;
}

function isNodeModule(name: string): boolean {
  return name.includes("node_modules");
}

function flattenWebpackModules(
  mods: WebpackStats["modules"] = []
): WebpackModule[] {
  const result: WebpackModule[] = [];
  const flatten = (list: WebpackStats["modules"] = []) => {
    for (const m of list) {
      if (m.modules?.length) {
        flatten(m.modules);
      } else {
        result.push(m);
      }
    }
  };
  flatten(mods);
  return result;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

const MIN_SIZE_BYTES = 10 * 1024; // only report modules ≥ 10KB — noise filter

function analyzeWebpackModules(modules: WebpackModule[]): TreeShakingReport {
  const cjsModules: CjsModule[] = [];
  const bailoutModules: BailoutModule[] = [];
  const partiallyUsed: PartiallyUsedModule[] = [];

  // Check if this stats.json has usedExports data at all
  const hasUsedExportsData = modules.some(
    (m) => m.usedExports !== undefined && m.usedExports !== null
  );

  const seenPackages = new Set<string>(); // dedupe CJS by package name

  for (const mod of modules) {
    if (mod.size < MIN_SIZE_BYTES) continue;

    // ── CJS detection ──
    // providedExports === null means webpack couldn't determine exports = CommonJS
    if (
      mod.providedExports === null &&
      isNodeModule(mod.name) &&
      !mod.name.endsWith(".css") &&
      !mod.name.endsWith(".json")
    ) {
      const pkg = extractPackageName(mod.name);
      if (!seenPackages.has(pkg)) {
        seenPackages.add(pkg);
        cjsModules.push({
          name: mod.name,
          sizeBytes: mod.size,
          packageName: pkg,
        });
      }
    }

    // ── Optimization bailouts ──
    if (mod.optimizationBailouts && mod.optimizationBailouts.length > 0) {
      bailoutModules.push({
        name: mod.name,
        sizeBytes: mod.size,
        bailouts: mod.optimizationBailouts.slice(0, 3), // top 3 reasons
      });
    }

    // ── Partial usage ──
    // Only meaningful when we have both providedExports (array) and usedExports (array)
    if (
      Array.isArray(mod.providedExports) &&
      mod.providedExports.length > 2 &&
      Array.isArray(mod.usedExports)
    ) {
      const usedSet = new Set(mod.usedExports);
      const unusedExports = mod.providedExports.filter((e) => !usedSet.has(e));

      // Only flag when >30% of exports are unused and module is sizeable
      const unusedRatio = unusedExports.length / mod.providedExports.length;
      if (unusedRatio > 0.3 && unusedExports.length >= 2) {
        partiallyUsed.push({
          name: mod.name,
          sizeBytes: mod.size,
          providedCount: mod.providedExports.length,
          usedCount: mod.usedExports.length,
          unusedCount: unusedExports.length,
          unusedExports: unusedExports.slice(0, 5), // show up to 5 unused
        });
      }
    }
  }

  // Sort each list by size descending
  cjsModules.sort((a, b) => b.sizeBytes - a.sizeBytes);
  bailoutModules.sort((a, b) => b.sizeBytes - a.sizeBytes);
  partiallyUsed.sort((a, b) => b.unusedCount - a.unusedCount);

  return { cjsModules, bailoutModules, partiallyUsed, hasUsedExportsData };
}

// ─── Formatter ────────────────────────────────────────────────────────────────

function formatReport(report: TreeShakingReport, resolvedPath: string): string {
  const lines: string[] = [];
  lines.push(`## Tree-Shaking Opportunity Analysis`);
  lines.push(`**Source:** \`${resolvedPath}\``);
  lines.push("");

  const hasFindings =
    report.cjsModules.length > 0 ||
    report.bailoutModules.length > 0 ||
    report.partiallyUsed.length > 0;

  if (!hasFindings) {
    lines.push("✅ No obvious tree-shaking opportunities detected.");
    if (!report.hasUsedExportsData) {
      lines.push("");
      lines.push(
        "> For richer analysis (unused export detection), re-run webpack with `optimization.usedExports: true` and `--stats=verbose`."
      );
    }
    return lines.join("\n");
  }

  // ── Summary ──
  const issueCount =
    report.cjsModules.length + report.bailoutModules.length + report.partiallyUsed.length;
  lines.push(`Found **${issueCount}** potential tree-shaking issue${issueCount !== 1 ? "s" : ""}.`);
  if (!report.hasUsedExportsData) {
    lines.push(
      `> ℹ️ Used-export data not found — add \`optimization.usedExports: true\` to webpack config for deeper analysis.`
    );
  }
  lines.push("");

  // ── CJS modules ──
  if (report.cjsModules.length > 0) {
    const totalCjsBytes = report.cjsModules.reduce((s, m) => s + m.sizeBytes, 0);
    lines.push(`### CommonJS Modules (cannot be tree-shaken)`);
    lines.push(
      `${report.cjsModules.length} package${report.cjsModules.length !== 1 ? "s" : ""} use CommonJS exports — webpack cannot eliminate unused code from them. **Total: ${kb(totalCjsBytes)}**`
    );
    lines.push("");
    report.cjsModules.slice(0, 10).forEach((mod, i) => {
      lines.push(`${i + 1}. \`${mod.packageName}\` — ${kb(mod.sizeBytes)}`);
    });
    if (report.cjsModules.length > 10) {
      lines.push(`... and ${report.cjsModules.length - 10} more`);
    }
    lines.push("");
    lines.push(`**Fix:** Look for ESM-compatible alternatives or named imports:`);
    lines.push(`- Check if the package has an \`"exports"\` field or \`"module"\` entry pointing to an ES module build`);
    lines.push(`- For \`lodash\`: use \`lodash-es\` or named imports (\`import { debounce } from 'lodash'\`)`);
    lines.push(`- For \`moment\`: consider \`date-fns\` (ESM, tree-shakeable)`);
    lines.push(`- For others: search npm for \`<package>-es\` or \`<package>/esm\``);
    lines.push("");
  }

  // ── Bailout modules ──
  if (report.bailoutModules.length > 0) {
    lines.push(`### Optimization Bailouts`);
    lines.push(
      `${report.bailoutModules.length} module${report.bailoutModules.length !== 1 ? "s" : ""} have webpack optimization bailouts — webpack tried but couldn't fully optimize these.`
    );
    lines.push("");
    report.bailoutModules.slice(0, 8).forEach((mod, i) => {
      lines.push(`${i + 1}. \`${mod.name}\` — ${kb(mod.sizeBytes)}`);
      mod.bailouts.forEach((b) => lines.push(`   - ${b}`));
    });
    if (report.bailoutModules.length > 8) {
      lines.push(`... and ${report.bailoutModules.length - 8} more`);
    }
    lines.push("");
    lines.push(`**Common causes:** dynamic \`require()\` calls, eval usage, or missing \`"sideEffects": false\` in package.json.`);
    lines.push("");
  }

  // ── Partially used ──
  if (report.partiallyUsed.length > 0) {
    lines.push(`### Partially Used Modules (barrel file suspects)`);
    lines.push(
      `${report.partiallyUsed.length} module${report.partiallyUsed.length !== 1 ? "s" : ""} have unused exports still included in the bundle — likely barrel files or missing \`sideEffects: false\`.`
    );
    lines.push("");
    report.partiallyUsed.slice(0, 8).forEach((mod, i) => {
      const pct = Math.round((mod.unusedCount / mod.providedCount) * 100);
      lines.push(
        `${i + 1}. \`${mod.name}\` — ${kb(mod.sizeBytes)}, ${mod.usedCount}/${mod.providedCount} exports used (${pct}% unused)`
      );
      if (mod.unusedExports.length > 0) {
        lines.push(`   Unused: ${mod.unusedExports.map((e) => `\`${e}\``).join(", ")}${mod.unusedCount > 5 ? ` +${mod.unusedCount - 5} more` : ""}`);
      }
    });
    lines.push("");
    lines.push(`**Fix options:**`);
    lines.push(`- Add \`"sideEffects": false\` to the package's package.json (or your own modules) to let webpack drop unused exports`);
    lines.push(`- Avoid barrel files (\`index.js\` that re-exports everything) — import directly from the source file instead`);
    lines.push(`- Use \`webpack-bundle-analyzer\` visually to confirm which chunks contain these modules`);
    lines.push("");
  }

  // ── Quick wins summary ──
  lines.push(`### Quick wins`);
  lines.push(`1. Run \`npm ls\` to find which dependencies use CJS — prioritize the largest ones`);
  lines.push(`2. Add \`optimization: { usedExports: true, sideEffects: true }\` to webpack config if not already set`);
  lines.push(`3. Check each CJS package's GitHub for an \`esm\` branch or \`/es\` dist directory`);

  return lines.join("\n");
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeTreeShaking(statsPath: string): string {
  const resolved = path.resolve(statsPath);

  if (!fs.existsSync(resolved)) {
    return `Error: File not found: ${resolved}`;
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(resolved, "utf-8"));

  // Vite/Rollup — rollup does tree-shaking natively; visualizer JSON doesn't
  // expose used/unused export data so we can only give a generic note
  if (isRollupVisualizerStats(parsed)) {
    return [
      `## Tree-Shaking Opportunity Analysis`,
      `**Source:** \`${resolved}\``,
      ``,
      `ℹ️ Rollup/Vite performs tree-shaking automatically at build time.`,
      `rollup-plugin-visualizer JSON does not include used/unused export data,`,
      `so module-level analysis is not available from this file.`,
      ``,
      `**What you can do:**`,
      `- Check for CJS dependencies: modules without \`.mjs\` extension in node_modules`,
      `  may not be fully tree-shakeable — look for \`@rollup/plugin-commonjs\` warnings`,
      `- Run \`npx vite build --debug\` and look for "treeshake" warnings in the output`,
      `- Use the \`analyze_bundle\` tool on your \`dist/\` directory to see actual output sizes`,
    ].join("\n");
  }

  // Webpack
  const stats = parsed as WebpackStats;

  if (!stats.modules?.length) {
    return (
      "No module data found. Re-run webpack with `--stats=verbose` to enable tree-shaking analysis.\n" +
      "Also add `optimization: { usedExports: true }` to your webpack config for used-export tracking."
    );
  }

  const allModules = flattenWebpackModules(stats.modules);
  const report = analyzeWebpackModules(allModules);
  return formatReport(report, resolved);
}
