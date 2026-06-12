import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runLighthouse } from "./tools/run-lighthouse.js";
import { compareUrls } from "./tools/compare-urls.js";
import { trackLighthouse, getLighthouseTrend } from "./tools/track-lighthouse.js";

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

  server.tool(
    "track_lighthouse",
    "Run a Lighthouse audit and store the result for trend tracking. " +
    "Each run saves scores and Core Web Vitals to ~/.mcp-lighthouse/history.json. " +
    "Returns the current audit result with a ↑/↓/→ trend indicator vs the previous run. " +
    "Use get_lighthouse_trend to view the full history table.",
    {
      url: z.string().describe("URL to audit and track. E.g. https://example.com"),
      mobile: z.boolean().optional().default(false)
        .describe("Simulate mobile device. Default: desktop."),
    },
    async ({ url, mobile }) => {
      const result = await trackLighthouse({ url, mobile });
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.tool(
    "get_lighthouse_trend",
    "Show the Lighthouse score history for a URL that was previously tracked with track_lighthouse. " +
    "Returns a table of scores over time and a trend summary (improving / degrading / stable). " +
    "Scores are stored in ~/.mcp-lighthouse/history.json (up to 50 audits per URL).",
    {
      url: z.string().describe("URL to retrieve history for."),
      mobile: z.boolean().optional().default(false)
        .describe("Show mobile or desktop history. Default: desktop."),
      limit: z.number().optional().default(10)
        .describe("Maximum number of historical entries to show. Default: 10."),
    },
    async ({ url, mobile, limit }) => {
      const result = await getLighthouseTrend(url, mobile, limit);
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  return server;
}
