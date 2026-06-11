import { chromium, type Page } from "playwright";

/**
 * Launches a headless Chromium browser, runs fn with the page,
 * and unconditionally closes the browser in finally.
 * Per-call browser ensures no state leakage between MCP tool invocations.
 */
export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  timeout = 30_000
): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      // Reasonable viewport for accessibility audits
      viewport: { width: 1280, height: 800 },
      // Ignore HTTPS errors for local dev servers
      ignoreHTTPSErrors: true,
    });
    context.setDefaultTimeout(timeout);
    const page = await context.newPage();
    return await fn(page);
  } finally {
    // Unconditional — always closes even if fn throws
    await browser.close();
  }
}
