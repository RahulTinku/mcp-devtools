import fs from "node:fs";
import path from "node:path";
import { Project, type SourceFile } from "ts-morph";

/**
 * Walk up directory tree to find the nearest tsconfig.json.
 * Returns null if not found before filesystem root.
 */
export function findTsConfig(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    const candidate = path.join(dir, "tsconfig.json");
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Create a ts-morph Project from a tsconfig path, or a minimal one if not found.
 */
export function createProject(tsConfigPath: string | null): Project {
  if (tsConfigPath) {
    return new Project({
      tsConfigFilePath: tsConfigPath,
      // Don't add files from tsconfig automatically — we'll add them ourselves
      skipAddingFilesFromTsConfig: false,
    });
  }
  // Fallback: no tsconfig — types will resolve to `any` but structure still works
  return new Project({
    compilerOptions: {
      jsx: 4, // React JSX
      strict: false,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
  });
}

/** File patterns to exclude from component scanning */
const SKIP_PATTERNS = [
  "node_modules",
  "/dist/",
  "/build/",
  "/.next/",
  "/out/",
  ".stories.",
  ".test.",
  ".spec.",
  ".d.ts",
];

export function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATTERNS.some((p) => filePath.includes(p));
}

/**
 * Heuristic: is this source file likely to contain React components?
 * - Must be .tsx
 * - Must have at least one export starting with uppercase
 */
export function likelyComponentFile(sf: SourceFile): boolean {
  const fp = sf.getFilePath();
  if (!fp.endsWith(".tsx")) return false;
  if (shouldSkipFile(fp)) return false;
  // Quick check: any exported uppercase name
  return sf.getExportedDeclarations().size > 0 &&
    [...sf.getExportedDeclarations().keys()].some((k) => /^[A-Z]/.test(k));
}
