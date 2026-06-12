#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { execSync } from "node:child_process";

function checkChromium(): void {
  try {
    execSync("node -e \"require('playwright').chromium.executablePath()\"", {
      stdio: "ignore",
    });
  } catch {
    console.error(
      "\n[mcp-lighthouse] Chromium browser not found.\n" +
      "Run this once to install it:\n\n" +
      "  npx playwright install chromium\n"
    );
    process.exit(1);
  }
}

async function main() {
  checkChromium();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-lighthouse running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
