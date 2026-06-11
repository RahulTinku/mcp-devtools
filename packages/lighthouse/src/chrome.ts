import fs from "node:fs";
import { chromium } from "playwright";
import { launch, type LaunchedChrome } from "chrome-launcher";

/**
 * Resolve Playwright's cached Chromium executable.
 * Throws a user-friendly error if not installed yet.
 */
export function resolveChromiumPath(): string {
  const execPath = chromium.executablePath();
  if (!fs.existsSync(execPath)) {
    throw new Error(
      `Chromium not found at: ${execPath}\n` +
      `Run: npx playwright install chromium`
    );
  }
  return execPath;
}

/**
 * Build Chrome launch flags.
 * --no-sandbox is NOT included by default (macOS sandbox works fine).
 * Set env LIGHTHOUSE_NO_SANDBOX=1 or CI=true to enable it (required in Docker/CI).
 */
export function buildChromeFlags(mobile: boolean): string[] {
  const flags = [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
  ];

  const needsSandboxDisabled =
    process.env.LIGHTHOUSE_NO_SANDBOX === "1" ||
    process.env.CI === "true" ||
    fs.existsSync("/.dockerenv");

  if (needsSandboxDisabled) {
    flags.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  if (!mobile) {
    // Desktop window size
    flags.push("--window-size=1350,940");
  }

  return flags;
}

/**
 * Launch Chrome via chrome-launcher using Playwright's Chromium binary.
 * Returns the launched instance — caller MUST call chrome.kill() in a finally block.
 */
export async function launchChrome(mobile: boolean): Promise<LaunchedChrome> {
  const chromePath = resolveChromiumPath();
  return launch({
    chromePath,
    chromeFlags: buildChromeFlags(mobile),
    logLevel: "silent",
  });
}
