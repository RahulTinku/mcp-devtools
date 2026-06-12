/** Webpack stats.json module entry */
export interface WebpackModule {
  id: number | string;
  identifier?: string;
  name: string;
  size: number;
  chunks?: (number | string)[];
  reasons?: Array<{ moduleName: string; type: string }>;
  modules?: WebpackModule[]; // concatenated modules
}

/** Webpack stats.json asset entry */
export interface WebpackAsset {
  name: string;
  size: number;
  chunks: (number | string)[];
  chunkNames: string[];
  emitted?: boolean;
}

/** Webpack stats.json chunk entry */
export interface WebpackChunk {
  id: number | string;
  names: string[];
  size: number;
  files: string[];
  modules?: WebpackModule[];
}

/** Top-level webpack stats.json shape */
export interface WebpackStats {
  hash?: string;
  version?: string;
  time?: number;
  builtAt?: number;
  outputPath?: string;
  assets?: WebpackAsset[];
  chunks?: WebpackChunk[];
  modules?: WebpackModule[];
  entrypoints?: Record<string, {
    chunks: (number | string)[];
    assets: Array<{ name: string } | string>;
  }>;
  errors?: unknown[];
  warnings?: unknown[];
}

/** Normalised module record used internally */
export interface ModuleRecord {
  name: string;
  sizeBytes: number;
  sizeKb: string;
  chunks: (number | string)[];
  importedBy: string[];
}

/** Normalised asset record */
export interface AssetRecord {
  name: string;
  sizeBytes: number;
  sizeKb: string;
  isJs: boolean;
  isCss: boolean;
}

/** Result of a bundle analysis */
export interface BundleAnalysis {
  totalSizeBytes: number;
  totalSizeKb: string;
  assetCount: number;
  jsAssets: AssetRecord[];
  cssAssets: AssetRecord[];
  otherAssets: AssetRecord[];
  topModules: ModuleRecord[];
  entrypoints: string[];
  hasSourceMaps: boolean;
  buildTime?: number;
  webpackVersion?: string;
  /** Bundler name when parsed from rollup-plugin-visualizer (e.g. "rollup", "vite") */
  bundler?: string;
  /** When true, sizes are pre-minification source sizes (rollup-plugin-visualizer) */
  sizesAreSourceSizes?: boolean;
}

// ─── rollup-plugin-visualizer ────────────────────────────────────────────────

/** A node in the rollup-plugin-visualizer stats tree */
export interface RollupVisualizerNode {
  name: string;
  uid?: string;
  originalSize?: number;
  gzipSize?: number;
  isEntry?: boolean;
  children?: RollupVisualizerNode[];
}

/** Top-level shape of a rollup-plugin-visualizer stats JSON file */
export interface RollupVisualizerStats {
  version?: string;
  bundler?: { name: string; version?: string };
  tree: RollupVisualizerNode;
}

/** Type guard — returns true when the parsed JSON looks like rollup-plugin-visualizer output */
export function isRollupVisualizerStats(json: unknown): json is RollupVisualizerStats {
  return (
    typeof json === "object" &&
    json !== null &&
    "tree" in json &&
    typeof (json as Record<string, unknown>).tree === "object" &&
    !("assets" in json) &&   // webpack stats always have "assets"
    !("modules" in json)     // webpack stats always have "modules"
  );
}
