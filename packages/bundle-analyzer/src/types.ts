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
}
