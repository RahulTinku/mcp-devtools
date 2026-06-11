import fs from "node:fs";
import path from "node:path";
import type { WebpackStats, BundleAnalysis, AssetRecord, ModuleRecord } from "../types.js";

const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";

function parseWebpackStats(statsPath: string): BundleAnalysis {
  const raw = fs.readFileSync(statsPath, "utf-8");
  const stats: WebpackStats = JSON.parse(raw);

  const assets: AssetRecord[] = (stats.assets ?? []).map((a) => ({
    name: a.name,
    sizeBytes: a.size,
    sizeKb: kb(a.size),
    isJs: a.name.endsWith(".js") && !a.name.endsWith(".map"),
    isCss: a.name.endsWith(".css"),
  }));

  const jsAssets = assets.filter((a) => a.isJs).sort((a, b) => b.sizeBytes - a.sizeBytes);
  const cssAssets = assets.filter((a) => a.isCss).sort((a, b) => b.sizeBytes - a.sizeBytes);
  const otherAssets = assets.filter((a) => !a.isJs && !a.isCss && !a.name.endsWith(".map"));

  const totalSizeBytes = jsAssets.reduce((s, a) => s + a.sizeBytes, 0) +
    cssAssets.reduce((s, a) => s + a.sizeBytes, 0);

  // Flatten all modules including concatenated ones
  const allModules: ModuleRecord[] = [];
  const flattenModules = (mods: WebpackStats["modules"] = []) => {
    for (const m of mods) {
      if (m.modules?.length) {
        flattenModules(m.modules);
      } else {
        allModules.push({
          name: m.name,
          sizeBytes: m.size,
          sizeKb: kb(m.size),
          chunks: m.chunks ?? [],
          importedBy: (m.reasons ?? []).map((r) => r.moduleName).filter(Boolean),
        });
      }
    }
  };
  flattenModules(stats.modules);

  const topModules = allModules
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 20);

  const entrypoints = Object.keys(stats.entrypoints ?? {});
  const hasSourceMaps = (stats.assets ?? []).some((a) => a.name.endsWith(".map"));

  return {
    totalSizeBytes,
    totalSizeKb: kb(totalSizeBytes),
    assetCount: assets.length,
    jsAssets,
    cssAssets,
    otherAssets,
    topModules,
    entrypoints,
    hasSourceMaps,
    buildTime: stats.time,
    webpackVersion: stats.version,
  };
}

function scanDistDirectory(distPath: string): BundleAnalysis {
  const files = fs.readdirSync(distPath, { recursive: true, encoding: "utf-8" }) as string[];

  const assets: AssetRecord[] = files
    .filter((f) => !fs.statSync(path.join(distPath, f)).isDirectory())
    .map((f) => {
      const size = fs.statSync(path.join(distPath, f)).size;
      return {
        name: f,
        sizeBytes: size,
        sizeKb: kb(size),
        isJs: f.endsWith(".js") && !f.endsWith(".js.map"),
        isCss: f.endsWith(".css"),
      };
    });

  const jsAssets = assets.filter((a) => a.isJs).sort((a, b) => b.sizeBytes - a.sizeBytes);
  const cssAssets = assets.filter((a) => a.isCss).sort((a, b) => b.sizeBytes - a.sizeBytes);
  const otherAssets = assets.filter((a) => !a.isJs && !a.isCss && !a.name.endsWith(".map"));
  const totalSizeBytes = jsAssets.reduce((s, a) => s + a.sizeBytes, 0) +
    cssAssets.reduce((s, a) => s + a.sizeBytes, 0);

  return {
    totalSizeBytes,
    totalSizeKb: kb(totalSizeBytes),
    assetCount: assets.length,
    jsAssets,
    cssAssets,
    otherAssets,
    topModules: [],
    entrypoints: [],
    hasSourceMaps: assets.some((a) => a.name.endsWith(".map")),
  };
}

export function analyzeBundle(inputPath: string): string {
  const resolved = path.resolve(inputPath);

  if (!fs.existsSync(resolved)) {
    return `Error: Path not found: ${resolved}`;
  }

  const stat = fs.statSync(resolved);
  const isDir = stat.isDirectory();
  const isJson = resolved.endsWith(".json") && !isDir;

  let analysis: BundleAnalysis;
  let source: string;

  if (isJson) {
    analysis = parseWebpackStats(resolved);
    source = `webpack stats.json at ${resolved}`;
  } else if (isDir) {
    // Check for stats.json inside the directory
    const statsJson = path.join(resolved, "stats.json");
    if (fs.existsSync(statsJson)) {
      analysis = parseWebpackStats(statsJson);
      source = `webpack stats.json inside ${resolved}`;
    } else {
      analysis = scanDistDirectory(resolved);
      source = `dist directory at ${resolved}`;
    }
  } else {
    return `Error: Expected a directory or a webpack stats.json file. Got: ${resolved}`;
  }

  return formatAnalysis(analysis, source);
}

function formatAnalysis(a: BundleAnalysis, source: string): string {
  const lines: string[] = [];

  lines.push(`## Bundle Analysis`);
  lines.push(`**Source:** ${source}`);
  if (a.webpackVersion) lines.push(`**Webpack:** ${a.webpackVersion}`);
  if (a.buildTime) lines.push(`**Build time:** ${(a.buildTime / 1000).toFixed(2)}s`);
  lines.push("");

  lines.push(`### Summary`);
  lines.push(`- **Total JS+CSS size:** ${a.totalSizeKb}`);
  lines.push(`- **Total assets:** ${a.assetCount}`);
  lines.push(`- **JS chunks:** ${a.jsAssets.length}`);
  lines.push(`- **CSS files:** ${a.cssAssets.length}`);
  lines.push(`- **Source maps:** ${a.hasSourceMaps ? "Yes" : "No"}`);
  if (a.entrypoints.length) {
    lines.push(`- **Entry points:** ${a.entrypoints.join(", ")}`);
  }
  lines.push("");

  lines.push(`### JS Assets (largest first)`);
  if (a.jsAssets.length === 0) {
    lines.push("No JS assets found.");
  } else {
    a.jsAssets.forEach((asset, i) => {
      const pct = ((asset.sizeBytes / a.totalSizeBytes) * 100).toFixed(1);
      lines.push(`${i + 1}. \`${asset.name}\` — **${asset.sizeKb}** (${pct}% of total)`);
    });
  }
  lines.push("");

  if (a.cssAssets.length > 0) {
    lines.push(`### CSS Assets`);
    a.cssAssets.forEach((asset) => {
      lines.push(`- \`${asset.name}\` — ${asset.sizeKb}`);
    });
    lines.push("");
  }

  if (a.topModules.length > 0) {
    lines.push(`### Top 20 Modules by Size`);
    a.topModules.forEach((mod, i) => {
      lines.push(`${i + 1}. \`${mod.name}\` — ${mod.sizeKb}`);
    });
    lines.push("");
  }

  // Suggestions
  const suggestions = generateSuggestions(a);
  if (suggestions.length > 0) {
    lines.push(`### Optimization Suggestions`);
    suggestions.forEach((s) => lines.push(`- ${s}`));
  }

  return lines.join("\n");
}

function generateSuggestions(a: BundleAnalysis): string[] {
  const suggestions: string[] = [];
  const totalKb = a.totalSizeBytes / 1024;

  if (totalKb > 500) {
    suggestions.push(
      `Total bundle is ${a.totalSizeKb} — consider code splitting with React.lazy() and dynamic import() to defer non-critical routes.`
    );
  }

  if (a.jsAssets.length === 1 && a.jsAssets[0]) {
    suggestions.push(
      `Only one JS chunk detected (\`${a.jsAssets[0].name}\`). Consider splitting vendor libraries from app code using SplitChunksPlugin or Vite's manualChunks.`
    );
  }

  const largeModules = a.topModules.filter((m) => m.sizeBytes > 100 * 1024);
  if (largeModules.length > 0) {
    largeModules.slice(0, 3).forEach((m) => {
      suggestions.push(
        `\`${m.name}\` is ${m.sizeKb} — check if the full package is needed or if a lighter alternative exists.`
      );
    });
  }

  if (!a.hasSourceMaps) {
    suggestions.push(
      "No source maps detected. Add source maps in production for better error tracking (use hidden-source-map to avoid exposing source code)."
    );
  }

  const nodeModulesModules = a.topModules.filter((m) => m.name.includes("node_modules"));
  if (nodeModulesModules.length > 5) {
    const vendorSize = nodeModulesModules.reduce((s, m) => s + m.sizeBytes, 0);
    suggestions.push(
      `${nodeModulesModules.length} node_modules in bundle totalling ~${kb(vendorSize)} — consider a separate vendor chunk for better long-term caching.`
    );
  }

  return suggestions;
}
