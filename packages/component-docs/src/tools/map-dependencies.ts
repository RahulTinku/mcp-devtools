/**
 * map_component_dependencies
 *
 * Builds a cross-component dependency graph by scanning JSX usage within each
 * component file. A dependency edge A → B means "component A renders component B."
 *
 * Uses ts-morph to find JsxOpeningElement and JsxSelfClosingElement nodes with
 * tag names that start with an uppercase letter (component usage conventions).
 */

import fs from "node:fs";
import path from "node:path";
import { Project, SyntaxKind } from "ts-morph";
import { findTsConfig, createProject, shouldSkipFile } from "../project.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComponentNode {
  name: string;
  filePath: string;
  /** Components this node renders (outgoing edges) */
  uses: string[];
  /** Components that render this node (incoming edges) */
  usedBy: string[];
}

// ── Scanner ───────────────────────────────────────────────────────────────────

function collectJsxComponentNames(project: Project, filePath: string): Set<string> {
  const found = new Set<string>();
  const sf = project.addSourceFileAtPathIfExists(filePath);
  if (!sf) return found;

  // Find all JSX open/self-close tags and collect uppercase tag names
  for (const node of [
    ...sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]) {
    const tagName = node.getTagNameNode().getText().split(".")[0]; // handle Foo.Bar → Foo
    if (/^[A-Z]/.test(tagName)) {
      found.add(tagName);
    }
  }

  return found;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function mapComponentDependencies(dirPath: string, maxComponents = 100): string {
  const resolved = path.resolve(dirPath);

  if (!fs.existsSync(resolved)) {
    return `Error: Directory not found: ${resolved}`;
  }

  const tsConfigPath = findTsConfig(resolved);
  const project = createProject(tsConfigPath);

  // Collect all .tsx files in the directory (recursive)
  const allFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !shouldSkipFile(full)) {
        walk(full);
      } else if (entry.isFile() && full.endsWith(".tsx") && !shouldSkipFile(full)) {
        allFiles.push(full);
      }
    }
  };
  walk(resolved);

  if (allFiles.length === 0) {
    return `No .tsx files found in ${resolved}.`;
  }

  // Add all files to the project so cross-file resolution works
  for (const f of allFiles) {
    project.addSourceFileAtPathIfExists(f);
  }

  // Build a map of exported component names → file path
  const componentFiles = new Map<string, string>(); // name → absolute path
  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath();
    if (shouldSkipFile(fp)) continue;
    if (!fp.endsWith(".tsx")) continue;

    for (const [exportName] of sf.getExportedDeclarations()) {
      if (/^[A-Z]/.test(exportName)) {
        componentFiles.set(exportName, fp);
      }
    }
  }

  const knownComponents = new Set(componentFiles.keys());

  if (knownComponents.size === 0) {
    return `No exported React components found in ${resolved}.`;
  }

  // Limit component count
  const components = [...componentFiles.entries()].slice(0, maxComponents);

  // Build dependency graph
  const nodes = new Map<string, ComponentNode>();
  for (const [name, fp] of components) {
    nodes.set(name, { name, filePath: fp.replace(resolved, "").replace(/^\//, ""), uses: [], usedBy: [] });
  }

  for (const [name, fp] of components) {
    const usedNames = collectJsxComponentNames(project, fp);
    for (const used of usedNames) {
      if (used !== name && knownComponents.has(used)) {
        nodes.get(name)!.uses.push(used);
        if (nodes.has(used)) {
          nodes.get(used)!.usedBy.push(name);
        }
      }
    }
  }

  return formatDependencyGraph(nodes, resolved);
}

// ── Formatter ─────────────────────────────────────────────────────────────────

function formatDependencyGraph(nodes: Map<string, ComponentNode>, rootDir: string): string {
  const lines: string[] = [];
  lines.push(`## Component Dependency Graph`);
  lines.push(`**Root:** \`${rootDir}\``);
  lines.push(`**Components:** ${nodes.size}`);
  lines.push("");

  // Separate into categories
  const leaves: ComponentNode[] = []; // used but uses nothing
  const roots: ComponentNode[] = []; // not used by anything
  const composites: ComponentNode[] = []; // both uses and is used

  for (const node of nodes.values()) {
    const usesAny = node.uses.length > 0;
    const usedByAny = node.usedBy.length > 0;
    if (!usesAny && usedByAny) leaves.push(node); // pure leaf (primitives)
    else if (usesAny && !usedByAny) roots.push(node); // top-level / page components
    else if (usesAny && usedByAny) composites.push(node); // composite
  }

  const isolated = [...nodes.values()].filter((n) => n.uses.length === 0 && n.usedBy.length === 0);

  if (roots.length > 0) {
    lines.push(`### Top-level components (not used by others)`);
    for (const n of roots.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`**${n.name}** \`${n.filePath}\``);
      lines.push(`  Uses: ${n.uses.map((u) => `\`${u}\``).join(", ")}`);
    }
    lines.push("");
  }

  if (composites.length > 0) {
    lines.push(`### Composite components (uses others, used by others)`);
    for (const n of composites.sort((a, b) => b.uses.length + b.usedBy.length - (a.uses.length + a.usedBy.length))) {
      lines.push(`**${n.name}** \`${n.filePath}\``);
      if (n.uses.length > 0) lines.push(`  Uses: ${n.uses.map((u) => `\`${u}\``).join(", ")}`);
      if (n.usedBy.length > 0) lines.push(`  Used by: ${n.usedBy.map((u) => `\`${u}\``).join(", ")}`);
    }
    lines.push("");
  }

  if (leaves.length > 0) {
    lines.push(`### Leaf components (no internal dependencies)`);
    for (const n of leaves.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`**${n.name}** \`${n.filePath}\` ← used by: ${n.usedBy.map((u) => `\`${u}\``).join(", ")}`);
    }
    lines.push("");
  }

  if (isolated.length > 0) {
    lines.push(`### Isolated components (no dependency edges detected)`);
    for (const n of isolated.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`- **${n.name}** \`${n.filePath}\``);
    }
    lines.push("");
  }

  // High-value components (most depended-upon)
  const mostUsed = [...nodes.values()]
    .filter((n) => n.usedBy.length > 0)
    .sort((a, b) => b.usedBy.length - a.usedBy.length)
    .slice(0, 5);

  if (mostUsed.length > 0) {
    lines.push(`### Most reused components`);
    for (const n of mostUsed) {
      lines.push(`- **${n.name}** — used by ${n.usedBy.length} component${n.usedBy.length !== 1 ? "s" : ""}: ${n.usedBy.map((u) => `\`${u}\``).join(", ")}`);
    }
  }

  return lines.join("\n");
}
