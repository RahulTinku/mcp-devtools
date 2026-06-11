import path from "node:path";
import fs from "node:fs";
import { findTsConfig, createProject, likelyComponentFile } from "../project.js";
import { extractComponents } from "../extractor.js";
import { formatScanResult } from "../formatter.js";
import type { ScanResult } from "../types.js";

export async function scanComponents(dirPath: string, maxComponents = 50): Promise<string> {
  const resolved = path.resolve(dirPath);

  if (!fs.existsSync(resolved)) {
    return `Error: Directory not found: ${resolved}`;
  }
  if (!fs.statSync(resolved).isDirectory()) {
    return `Error: Expected a directory, got a file. Use document_component for single files.`;
  }

  const tsConfigPath = findTsConfig(resolved);
  const project = createProject(tsConfigPath);

  // If no tsconfig was loaded, add the target files directly
  if (!tsConfigPath) {
    project.addSourceFilesAtPaths([
      path.join(resolved, "**/*.tsx"),
      path.join(resolved, "**/*.ts"),
    ]);
  }

  const checker = project.getTypeChecker();
  const sourceFiles = project.getSourceFiles().filter(likelyComponentFile);

  if (sourceFiles.length === 0) {
    return (
      `No .tsx files with exported React components found in \`${resolved}\`.\n\n` +
      `Make sure:\n` +
      `- The path contains \`.tsx\` files\n` +
      `- Components are exported with PascalCase names\n` +
      `- Files aren't in \`node_modules\`, \`dist\`, or \`build\`\n`
    );
  }

  const allComponents: ScanResult["components"] = [];

  for (const sf of sourceFiles) {
    if (allComponents.length >= maxComponents) break;
    const comps = extractComponents(sf, checker, resolved);
    allComponents.push(...comps);
  }

  const result: ScanResult = {
    projectRoot: resolved,
    tsConfigPath,
    componentCount: allComponents.length,
    components: allComponents.slice(0, maxComponents),
  };

  if (allComponents.length > maxComponents) {
    return (
      formatScanResult(result) +
      `\n\n> ⚠️ Output capped at ${maxComponents} components. Use \`document_component\` for deep-dives on specific files.`
    );
  }

  return formatScanResult(result);
}
