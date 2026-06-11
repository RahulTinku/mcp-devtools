import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runLighthouse } from "./tools/run-lighthouse.js";
import { compareUrls } from "./tools/compare-urls.js";

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-lighthouse",
    version: "0.1.0",
  });

  server.tool(
    "audit_lighthouse",
    "Run a full Google Lighthouse audit on any URL. " +
    "Returns category scores (Performance, Accessibility, Best Practices, SEO), " +
    "Core Web Vitals (LCP, FCP, TBT, CLS, TTI, Speed Index) with ratings, " +
    "performance opportunities with estimated savings, and all failing audits. " +
    "Works on localhost, staging, and production URLs. " +
    "Set LIGHTHOUSE_NO_SANDBOX=1 env var when running inside Docker or CI.",
    {
      url: z
        .string()
        .describe("URL to audit. E.g. https://example.com or http://localhost:3000"),
      categories: z
        .array(z.enum(CATEGORIES))
        .optional()
        .describe(
          "Categories to include. Default: all four. " +
          "E.g. ['performance'] for a focused perf audit."
        ),
      mobile: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Simulate a mobile device with network/CPU throttling. " +
          "Default: false (desktop, no throttling). " +
          "Mobile scores are typically 20-40 points lower than desktop."
        ),
      timeout: z
        .number()
        .optional()
        .default(60000)
        .describe("Max time in ms for the audit. Default: 60000 (60s). Increase for slow pages."),
    },
    async ({ url, categories, mobile, timeout }) => {
      const result = await runLighthouse({ url, categories, mobile, timeout });
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.tool(
    "compare_lighthouse",
    "Compare Lighthouse scores between two URLs — ideal for measuring the impact of a performance optimization. " +
    "Runs a full audit on both URLs sequentially and returns a side-by-side diff of scores and Core Web Vitals. " +
    "Use this to answer 'did my change actually improve performance?' before and after a deploy.",
    {
      before_url: z
        .string()
        .describe("Baseline URL (the 'before' state). E.g. a staging branch or the old deploy."),
      after_url: z
        .string()
        .describe("New URL (the 'after' state). E.g. the optimized deploy or new branch."),
      mobile: z
        .boolean()
        .optional()
        .default(false)
        .describe("Run in mobile mode (throttled). Default: desktop."),
    },
    async ({ before_url, after_url, mobile }) => {
      const result = await compareUrls(before_url, after_url, mobile);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  return server;
}
