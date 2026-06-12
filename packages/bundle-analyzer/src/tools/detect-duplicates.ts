import fs from "node:fs";
import path from "node:path";
import type { WebpackStats, RollupVisualizerNode } from "../types.js";
import { isRollupVisualizerStats } from "../types.js";

const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleEntry {
  name: string;
  sizeBytes: number;
}

interface PackageInstance {
  /** The node_modules prefix path leading to this instance, e.g. "node_modules/some-lib/" */
  prefix: string;
  totalBytes: number;
  moduleCount: number;
}

interface DuplicatePackage {
  name: string;
  instances: PackageInstance[];
  wastedBytes: number; // total size of all instances except the largest
}

// ─── Package extraction ───────────────────────────────────────────────────────

/**
 * Extract the last node_modules/PACKAGE occurrence from a module name.
 * Returns { pkg, prefix } where prefix is everything up to and including
 * the parent node_modules path segment.
 *
 * Examples:
 *   "./node_modules/react/index.js"                        → { pkg: "react", prefix: "" }
 *   "./node_modules/foo/node_modules/react/index.js"       → { pkg: "react", prefix: "node_modules/foo/" }
 *   "./node_modules/@babel/core/lib/index.js"              → { pkg: "@babel/core", prefix: "" }
 */
function extractPackageInfo(moduleName: string): { pkg: string; prefix: string } | null {
  const regex = /node_modules\/(@[^/]+\/[^/]+|[^/@][^/]*)/g;
  let match: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;

  while ((match = regex.exec(moduleName)) !== null) {
    last = match;
  }

  if (!last) return null;

  const pkg = last[1];
  // Everything before the last "node_modules/PKG" segment
  const prefix = moduleName.substring(0, last.index).replace(/^\.\//, "");
  return { pkg, prefix };
}

// ─── Collector (works for both webpack modules and rollup nodes) ──────────────

function collectModulesFromWebpack(
  mods: WebpackStats["modules"] = []
): ModuleEntry[] {
  const entries: ModuleEntry[] = [];
  const flatten = (list: WebpackStats["modules"] = []) => {
    for (const m of list) {
      if (m.modules?.length) {
        flatten(m.modules);
      } else {
        entries.push({ name: m.name, sizeBytes: m.size });
      }
    }
  };
  flatten(mods);
  return entries;
}

function collectModulesFromVisualizerNode(
  node: RollupVisualizerNode,
  entries: ModuleEntry[]
): void {
  if (!node.children || node.children.length === 0) {
    if (node.originalSize !== undefined) {
      entries.push({ name: node.name, sizeBytes: node.originalSize });
    }
  } else {
    for (const child of node.children) {
      collectModulesFromVisualizerNode(child, entries);
    }
  }
}

// ─── Detection logic ──────────────────────────────────────────────────────────

function detectDuplicates(modules: ModuleEntry[]): DuplicatePackage[] {
  // Map: pkg name → Map(prefix → { totalBytes, moduleCount })
  const pkgMap = new Map<string, Map<string, { totalBytes: number; moduleCount: number }>>();

  for (const mod of modules) {
    const info = extractPackageInfo(mod.name);
    if (!info) continue;

    if (!pkgMap.has(info.pkg)) {
      pkgMap.set(info.pkg, new Map());
    }
    const instances = pkgMap.get(info.pkg)!;

    const existing = instances.get(info.prefix) ?? { totalBytes: 0, moduleCount: 0 };
    instances.set(info.prefix, {
      totalBytes: existing.totalBytes + mod.sizeBytes,
      moduleCount: existing.moduleCount + 1,
    });
  }

  const duplicates: DuplicatePackage[] = [];

  for (const [pkg, instances] of pkgMap) {
    if (instances.size < 2) continue; // not a duplicate

    const instanceList: PackageInstance[] = Array.from(instances.entries())
      .map(([prefix, data]) => ({
        prefix: prefix || "(root)",
        totalBytes: data.totalBytes,
        moduleCount: data.moduleCount,
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes);

    // Wasted = sum of all instances except the largest
    const wastedBytes = instanceList
      .slice(1)
      .reduce((s, i) => s + i.totalBytes, 0);

    duplicates.push({ name: pkg, instances: instanceList, wastedBytes });
  }

  // Sort by wasted bytes descending
  return duplicates.sort((a, b) => b.wastedBytes - a.wastedBytes);
}

// ─── Formatter ───────────────────────────────────────────────────────────────

function formatDuplicates(
  duplicates: DuplicatePackage[],
  resolvedPath: string,
  isSourceSizes: boolean
): string {
  const lines: string[] = [];
  lines.push(`## Duplicate Package Detection`);
  lines.push(`**Source:** \`${resolvedPath}\``);
  if (isSourceSizes) {
    lines.push(`> ⚠️ Sizes are pre-minification source sizes from rollup-plugin-visualizer.`);
  }
  lines.push("");

  if (duplicates.length === 0) {
    lines.push("✅ No duplicate packages detected. Each dependency appears only once in the bundle.");
    return lines.join("\n");
  }

  const totalWasted = duplicates.reduce((s, d) => s + d.wastedBytes, 0);
  lines.push(`Found **${duplicates.length}** packages with multiple instances.`);
  lines.push(`**Estimated duplicate overhead: ${kb(totalWasted)}**`);
  lines.push("");

  duplicates.forEach((dup, i) => {
    lines.push(`### ${i + 1}. \`${dup.name}\` — ${dup.instances.length} instances, ~${kb(dup.wastedBytes)} wasted`);
    dup.instances.forEach((inst, j) => {
      const label = j === 0 ? " *(largest)*" : "";
      lines.push(`  ${j + 1}. \`${inst.prefix}node_modules/${dup.name}\` — ${kb(inst.totalBytes)} (${inst.moduleCount} module${inst.moduleCount !== 1 ? "s" : ""})${label}`);
    });
    lines.push("");
  });

  lines.push(`### Why this happens`);
  lines.push(`Duplicate packages occur when different dependencies require incompatible versions of the same library.`);
  lines.push(`Node.js resolves this by installing multiple versions in nested \`node_modules\` directories.`);
  lines.push("");
  lines.push(`### How to fix`);
  lines.push(`1. **Check what requires each version:**`);
  lines.push(`   \`npm why <package-name>\` or \`yarn why <package-name>\``);
  lines.push(`2. **Force a single version** via package.json \`overrides\` (npm) or \`resolutions\` (yarn):`);
  lines.push(`   \`\`\`json`);
  lines.push(`   "overrides": { "${duplicates[0]?.name ?? "package"}": "^X.Y.Z" }`);
  lines.push(`   \`\`\``);
  lines.push(`3. **Deduplicate** existing installs: \`npm dedupe\` or \`yarn dedupe\``);
  lines.push(`4. **Use webpack alias** to force a single module resolution:`);
  lines.push(`   \`\`\`js`);
  lines.push(`   resolve: { alias: { "${duplicates[0]?.name ?? "package"}": require.resolve("${duplicates[0]?.name ?? "package"}") } }`);
  lines.push(`   \`\`\``);

  return lines.join("\n");
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function detectDuplicatePackages(statsPath: string): string {
  const resolved = path.resolve(statsPath);

  if (!fs.existsSync(resolved)) {
    return `Error: File not found: ${resolved}`;
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(resolved, "utf-8"));

  // ── Vite / Rollup ──
  if (isRollupVisualizerStats(parsed)) {
    const entries: ModuleEntry[] = [];
    for (const chunk of parsed.tree.children ?? []) {
      collectModulesFromVisualizerNode(chunk, entries);
    }
    const duplicates = detectDuplicates(entries);
    return formatDuplicates(duplicates, resolved, true);
  }

  // ── Webpack ──
  const stats = parsed as WebpackStats;

  if (!stats.modules?.length) {
    return (
      "No module data found. Re-run webpack with `--stats=verbose` or set `stats: 'verbose'` in your config.\n" +
      "Module data is required for duplicate detection."
    );
  }

  const entries = collectModulesFromWebpack(stats.modules);
  const duplicates = detectDuplicates(entries);
  return formatDuplicates(duplicates, resolved, false);
}
