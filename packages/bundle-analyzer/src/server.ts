import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeBundle } from "./tools/analyze-bundle.js";
import { findLargeModules } from "./tools/find-large-modules.js";
import { compareBundles } from "./tools/compare-bundles.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-bundle-analyzer",
    version: "0.1.0",
  });

  // tool(name, description, rawZodShape, handler)
  server.tool(
    "analyze_bundle",
    "Analyze a frontend bundle. Provide a path to a webpack stats.json file or a dist/ directory. " +
    "Returns bundle size breakdown, asset list, top modules by size, and actionable optimization suggestions. " +
    "Generate stats.json with: webpack --json > stats.json",
    {
      path: z
        .string()
        .describe(
          "Path to webpack stats.json file or a dist/ directory. " +
          "Generate stats.json with: webpack --json > stats.json"
        ),
    },
    async ({ path: inputPath }) => {
      const result = analyzeBundle(inputPath);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.tool(
    "find_large_modules",
    "Find modules in a webpack bundle that exceed a size threshold. " +
    "Requires a webpack stats.json file with module data (run with --stats=verbose). " +
    "Returns a list of large modules grouped by type (vendor vs app code) with import context.",
    {
      stats_path: z
        .string()
        .describe("Path to webpack stats.json file"),
      threshold_kb: z
        .number()
        .optional()
        .default(50)
        .describe("Size threshold in KB. Modules larger than this are reported. Default: 50"),
    },
    async ({ stats_path, threshold_kb }) => {
      const result = findLargeModules(stats_path, threshold_kb);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.tool(
    "compare_bundles",
    "Compare two webpack stats.json files to see what changed between builds. " +
    "Shows total size diff, per-asset changes, newly added and removed assets. " +
    "Use this to measure the impact of an optimization, dependency upgrade, or code change.",
    {
      before_path: z
        .string()
        .describe("Path to the BEFORE webpack stats.json (baseline)"),
      after_path: z
        .string()
        .describe("Path to the AFTER webpack stats.json (new build)"),
    },
    async ({ before_path, after_path }) => {
      const result = compareBundles(before_path, after_path);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  return server;
}
