import type { ComponentDoc, ScanResult } from "./types.js";

function formatPropTable(props: ComponentDoc["props"]): string {
  if (props.length === 0) return "_No props_\n";
  const lines = [
    "| Prop | Type | Required | Description |",
    "|------|------|:--------:|-------------|",
  ];
  props.forEach((p) => {
    const req = p.required ? "✅" : "❌";
    const desc = p.description || "—";
    // Escape pipe characters in type strings
    const type = `\`${p.type.replace(/\|/g, "\\|")}\``;
    lines.push(`| \`${p.name}\` | ${type} | ${req} | ${desc} |`);
  });
  return lines.join("\n") + "\n";
}

export function formatComponent(comp: ComponentDoc): string {
  const lines: string[] = [];
  lines.push(`### ${comp.name}`);
  lines.push(`**File:** \`${comp.filePath}\` · **Pattern:** ${comp.pattern}`);
  if (comp.description) {
    lines.push("");
    lines.push(comp.description);
  }
  lines.push("");
  lines.push(formatPropTable(comp.props));
  return lines.join("\n");
}

export function formatScanResult(result: ScanResult): string {
  const lines: string[] = [];

  lines.push(`## Component Library Catalog`);
  lines.push(`**Project root:** \`${result.projectRoot}\``);
  lines.push(
    `**TypeScript config:** ${result.tsConfigPath ? `\`${result.tsConfigPath}\`` : "⚠️ not found — types may show as `any`"}`
  );
  lines.push(`**Components found:** ${result.componentCount}`);
  lines.push("");

  if (result.componentCount === 0) {
    lines.push("No React components found. Ensure the path points to a directory containing `.tsx` files with exported uppercase components.");
    return lines.join("\n");
  }

  result.components.forEach((comp) => {
    lines.push("---");
    lines.push(formatComponent(comp));
  });

  // Summary table
  lines.push("---");
  lines.push(`## Quick Reference`);
  lines.push(`| Component | Props | File |`);
  lines.push(`|-----------|-------|------|`);
  result.components.forEach((c) => {
    lines.push(`| \`${c.name}\` | ${c.props.length} | \`${c.filePath}\` |`);
  });

  return lines.join("\n");
}

export function formatSingleComponent(comp: ComponentDoc | null, filePath: string): string {
  if (!comp) {
    return `No React component found in \`${filePath}\`. Ensure the file exports an uppercase component.`;
  }
  const lines = [
    `## Component: ${comp.name}`,
    `**File:** \`${comp.filePath}\``,
    `**Pattern:** ${comp.pattern}`,
    "",
  ];
  if (comp.description) {
    lines.push(comp.description);
    lines.push("");
  }
  lines.push(`### Props (${comp.props.length})`);
  lines.push("");
  lines.push(formatPropTable(comp.props));
  // Separate required and optional
  const required = comp.props.filter((p) => p.required);
  const optional = comp.props.filter((p) => !p.required);
  if (required.length || optional.length) {
    lines.push(`**Required:** ${required.length} · **Optional:** ${optional.length}`);
  }
  return lines.join("\n");
}
