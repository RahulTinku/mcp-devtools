import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { auditUrl } from "./tools/audit-url.js";
import { auditSelector } from "./tools/audit-selector.js";

const WCAG_TAGS = [
  "wcag2a", "wcag2aa", "wcag21aa", "wcag22aa",
  "best-practice", "section508",
] as const;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-accessibility",
    version: "0.1.0",
  });

  server.tool(
    "audit_accessibility",
    "Run a full accessibility audit on any URL using axe-core and Playwright. " +
    "Works with local dev servers (localhost), staging, and production URLs. " +
    "Returns violations grouped by severity (critical → serious → moderate → minor) " +
    "with the exact failing HTML, CSS selectors, fix instructions, and WCAG references. " +
    "Optionally filter by WCAG level, scope to specific elements, or wait for SPA content to load.",
    {
      url: z
        .string()
        .describe(
          "URL to audit. Supports http://, https://, and file:// URLs. " +
          "For local dev servers use the full URL e.g. http://localhost:3000"
        ),
      tags: z
        .array(z.enum(WCAG_TAGS))
        .optional()
        .describe(
          "WCAG tag filters. Omit to run all rules. " +
          "Common values: 'wcag2aa' (WCAG 2.0 AA), 'wcag21aa' (WCAG 2.1 AA), 'best-practice'"
        ),
      include: z
        .array(z.string())
        .optional()
        .describe("CSS selectors to scope the audit to. E.g. ['main', '#content']"),
      exclude: z
        .array(z.string())
        .optional()
        .describe("CSS selectors to exclude from the audit. E.g. ['#cookie-banner', '.ads']"),
      wait_for_selector: z
        .string()
        .optional()
        .describe(
          "CSS selector to wait for before running the audit. " +
          "Use this for SPAs or pages that load content dynamically. E.g. '.dashboard-loaded'"
        ),
      timeout: z
        .number()
        .optional()
        .default(30000)
        .describe("Maximum time in milliseconds to wait for the page. Default: 30000 (30s)"),
    },
    async ({ url, tags, include, exclude, wait_for_selector, timeout }) => {
      const result = await auditUrl({
        url,
        tags: tags as string[] | undefined,
        include,
        exclude,
        waitForSelector: wait_for_selector,
        timeout,
      });
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  server.tool(
    "audit_component",
    "Run an accessibility audit scoped to a specific component or region of a page. " +
    "Provide a CSS selector to isolate the audit to that element and its subtree. " +
    "Ideal for testing a single component, navigation menu, modal, form, or widget in isolation " +
    "without noise from the rest of the page.",
    {
      url: z
        .string()
        .describe("URL of the page containing the component"),
      selector: z
        .string()
        .describe(
          "CSS selector for the component to audit. " +
          "E.g. 'nav', '#login-form', '.product-card', '[data-testid=\"modal\"]'"
        ),
      tags: z
        .array(z.enum(WCAG_TAGS))
        .optional()
        .describe("WCAG tag filters (same as audit_accessibility). Omit to run all rules."),
      wait_for_selector: z
        .string()
        .optional()
        .describe("Wait for this selector before auditing. Useful if the component loads async."),
      timeout: z
        .number()
        .optional()
        .default(30000)
        .describe("Maximum wait time in ms. Default: 30000"),
    },
    async ({ url, selector, tags, wait_for_selector, timeout }) => {
      const result = await auditSelector({
        url,
        selector,
        tags: tags as string[] | undefined,
        waitForSelector: wait_for_selector,
        timeout,
      });
      return { content: [{ type: "text" as const, text: result }] };
    }
  );

  return server;
}
