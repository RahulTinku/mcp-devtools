import path from "node:path";
import fs from "node:fs";
import { findTsConfig, createProject } from "../project.js";
import { extractComponents } from "../extractor.js";
import { formatSingleComponent } from "../formatter.js";

export async function documentComponent(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    return `Error: File not found: ${resolved}`;
  }
  if (!resolved.endsWith(".tsx") && !resolved.endsWith(".ts")) {
    return `Error: Expected a .tsx or .ts file. Got: ${resolved}`;
  }

  const dir = path.dirname(resolved);
  const tsConfigPath = findTsConfig(dir);
  const project = createProject(tsConfigPath);

  // Ensure the target file and its imports are loaded
  if (!tsConfigPath) {
    project.addSourceFileAtPath(resolved);
  } else {
    // tsconfig already loaded the project — just ensure our target file is included
    if (!project.getSourceFile(resolved)) {
      project.addSourceFileAtPath(resolved);
    }
  }

  const sf = project.getSourceFile(resolved);
  if (!sf) {
    return `Error: Could not load source file: ${resolved}`;
  }

  const checker = project.getTypeChecker();
  const projectRoot = tsConfigPath ? path.dirname(tsConfigPath) : dir;
  const components = extractComponents(sf, checker, projectRoot);

  if (components.length === 0) {
    return formatSingleComponent(null, resolved);
  }

  // Return all components found in the file
  if (components.length === 1) {
    return formatSingleComponent(components[0], resolved);
  }

  const lines = [
    `## Components in \`${path.relative(projectRoot, resolved)}\``,
    `**${components.length} components found**`,
    "",
  ];
  components.forEach((comp) => {
    lines.push("---");
    lines.push(formatSingleComponent(comp, resolved));
  });
  return lines.join("\n");
}
