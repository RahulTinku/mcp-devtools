import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scanComponents } from "./tools/scan-components.js";
import { documentComponent } from "./tools/document-component.js";
import { mapComponentDependencies } from "./tools/map-dependencies.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-component-docs",
    version: "0.1.0",
  });

  server.tool(
    "scan_components",
    "Scan a React/TypeScript component directory and generate a full prop documentation catalog. " +
    "Uses the TypeScript compiler to resolve the COMPLETE prop set for each component — including " +
    "props from extended interfaces, imported types, and forwardRef patterns. " +
    "Returns a table of every prop with its type, required/optional status, and JSDoc description. " +
    "Requires a directory containing .tsx files. Works best when a tsconfig.json is present.",
    {
      path: z
        .string()
        .describe(
          "Path to a directory containing React .tsx component files. " +
          "E.g. './src/components' or '/Users/you/project/src/ui'. " +
          "The tool will search upward for tsconfig.json automatically."
        ),
      max_components: z
        .number()
        .optional()
        .default(50)
        .describe("Maximum number of components to include. Default: 50."),
    },
    async ({ path: dirPath, max_components }) => {
      const result = await scanComponents(dirPath, max_components);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.tool(
    "document_component",
    "Generate detailed prop documentation for a single React component file. " +
    "Resolves the full prop interface including inherited and imported types. " +
    "Returns component description, complete prop table with types and JSDoc, " +
    "and a required/optional summary. " +
    "Use this when you need a deep-dive on one specific component rather than a full library scan.",
    {
      path: z
        .string()
        .describe(
          "Path to a .tsx file containing the component. " +
          "E.g. './src/components/Button/Button.tsx'"
        ),
    },
    async ({ path: filePath }) => {
      const result = await documentComponent(filePath);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.tool(
    "map_component_dependencies",
    "Build a cross-component dependency graph for a React/TypeScript component library. " +
    "Scans JSX usage within each component file to detect which components render which others. " +
    "Returns components grouped by role: top-level (not reused), composite (uses and is used), " +
    "leaf (no internal deps), and isolated. Also lists the most reused components by usage count.",
    {
      path: z
        .string()
        .describe(
          "Path to a directory containing React .tsx component files. " +
          "E.g. './src/components' or '/Users/you/project/src/ui'."
        ),
      max_components: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum number of components to include in the graph. Default: 100."),
    },
    async ({ path: dirPath, max_components }) => {
      const result = mapComponentDependencies(dirPath, max_components);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  return server;
}
