import fs from "node:fs";
import path from "node:path";
import type { WebpackStats, AssetRecord } from "../types.js";
import { isRollupVisualizerStats } from "../types.js";

const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";
const sign = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1);

function readAssets(statsPath: string): { assets: AssetRecord[]; isSourceSizes: boolean } {
  const parsed: unknown = JSON.parse(fs.readFileSync(statsPath, "utf-8"));

  if (isRollupVisualizerStats(parsed)) {
    const assets: AssetRecord[] = (parsed.tree.children ?? []).map((chunk) => ({
      name: chunk.name.replace(/^.*\//, ""),
      sizeBytes: chunk.originalSize ?? 0,
      sizeKb: kb(chunk.originalSize ?? 0),
      isJs: chunk.name.endsWith(".js") && !chunk.name.endsWith(".map"),
      isCss: chunk.name.endsWith(".css"),
    }));
    return { assets, isSourceSizes: true };
  }

  const stats = parsed as WebpackStats;
  const assets: AssetRecord[] = (stats.assets ?? []).map((a) => ({
    name: a.name,
    sizeBytes: a.size,
    sizeKb: kb(a.size),
    isJs: a.name.endsWith(".js") && !a.name.endsWith(".map"),
    isCss: a.name.endsWith(".css"),
  }));
  return { assets, isSourceSizes: false };
}

export function compareBundles(beforePath: string, afterPath: string): string {
  const resolvedBefore = path.resolve(beforePath);
  const resolvedAfter = path.resolve(afterPath);

  if (!fs.existsSync(resolvedBefore)) return `Error: before path not found: ${resolvedBefore}`;
  if (!fs.existsSync(resolvedAfter)) return `Error: after path not found: ${resolvedAfter}`;

  const { assets: beforeAssets, isSourceSizes } = readAssets(resolvedBefore);
  const { assets: afterAssets } = readAssets(resolvedAfter);

  const beforeMap = new Map(beforeAssets.map((a) => [stripHash(a.name), a]));
  const afterMap = new Map(afterAssets.map((a) => [stripHash(a.name), a]));

  const beforeTotalJs = beforeAssets.filter((a) => a.isJs).reduce((s, a) => s + a.sizeBytes, 0);
  const afterTotalJs = afterAssets.filter((a) => a.isJs).reduce((s, a) => s + a.sizeBytes, 0);
  const diffBytes = afterTotalJs - beforeTotalJs;
  const diffKb = diffBytes / 1024;
  const diffPct = beforeTotalJs > 0 ? (diffBytes / beforeTotalJs) * 100 : 0;

  const lines: string[] = [];
  lines.push(`## Bundle Comparison`);
  lines.push(`**Before:** \`${resolvedBefore}\``);
  lines.push(`**After:** \`${resolvedAfter}\``);
  if (isSourceSizes) {
    lines.push(`> ⚠️ Sizes are pre-minification source sizes from rollup-plugin-visualizer.`);
  }
  lines.push("");

  lines.push(`### Overall JS Size`);
  lines.push(`| | Before | After | Diff |`);
  lines.push(`|---|---|---|---|`);
  lines.push(`| Total JS | ${kb(beforeTotalJs)} | ${kb(afterTotalJs)} | **${sign(diffKb)} KB (${sign(diffPct)}%)** |`);
  lines.push("");

  const verdict = diffBytes < 0
    ? `✅ Bundle shrank by ${kb(Math.abs(diffBytes))}`
    : diffBytes > 0
    ? `⚠️ Bundle grew by ${kb(diffBytes)}`
    : `ℹ️ Bundle size unchanged`;
  lines.push(verdict);
  lines.push("");

  // Per-asset diff (match by name ignoring content hash)
  const changed: Array<{ name: string; before: number; after: number; diff: number }> = [];
  const added: AssetRecord[] = [];
  const removed: AssetRecord[] = [];

  afterMap.forEach((asset, key) => {
    const before = beforeMap.get(key);
    if (before) {
      const diff = asset.sizeBytes - before.sizeBytes;
      if (Math.abs(diff) > 100) { // ignore < 100 byte noise
        changed.push({ name: asset.name, before: before.sizeBytes, after: asset.sizeBytes, diff });
      }
    } else {
      added.push(asset);
    }
  });

  beforeMap.forEach((asset, key) => {
    if (!afterMap.has(key)) removed.push(asset);
  });

  if (changed.length > 0) {
    lines.push(`### Changed Assets`);
    changed.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).forEach((c) => {
      const icon = c.diff > 0 ? "📈" : "📉";
      lines.push(`${icon} \`${c.name}\`: ${kb(c.before)} → ${kb(c.after)} (${sign(c.diff / 1024)} KB)`);
    });
    lines.push("");
  }

  if (added.length > 0) {
    lines.push(`### New Assets`);
    added.forEach((a) => lines.push(`➕ \`${a.name}\` — ${a.sizeKb}`));
    lines.push("");
  }

  if (removed.length > 0) {
    lines.push(`### Removed Assets`);
    removed.forEach((a) => lines.push(`➖ \`${a.name}\` — ${a.sizeKb}`));
    lines.push("");
  }

  if (changed.length === 0 && added.length === 0 && removed.length === 0) {
    lines.push("No significant asset changes detected.");
  }

  return lines.join("\n");
}

/** Strip content hash from asset names to allow comparison across builds */
function stripHash(name: string): string {
  // e.g. main.a1b2c3d4.js → main.js
  return name.replace(/\.[a-f0-9]{8,20}\./, ".");
}
