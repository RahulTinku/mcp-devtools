# @mcp-devtools/lighthouse

> MCP server — run Lighthouse audits and get performance scores, Core Web Vitals, and actionable opportunities.

## Install

```bash
npm install -g @mcp-devtools/lighthouse
npx playwright install chromium   # one-time ~280MB download
```

## Add to Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lighthouse": {
      "command": "mcp-lighthouse"
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Tools

### `audit_lighthouse`

Run a full Google Lighthouse audit on any URL. Works with localhost, staging, and production.

```
url: string           — URL to audit. E.g. https://example.com or http://localhost:3000
categories?: string[] — 'performance', 'accessibility', 'best-practices', 'seo'. Default: all four
mobile?: boolean      — Simulate mobile with network/CPU throttling. Default: false (desktop)
timeout?: number      — Max audit time in ms. Default: 60000 (60s)
```

Returns category scores (0–100), Core Web Vitals (LCP, FCP, TBT, CLS, TTI, Speed Index) with ratings, performance opportunities with estimated savings, and all failing audits.

> **Docker / CI:** Set `LIGHTHOUSE_NO_SANDBOX=1` env var when running in a sandboxed environment.

---

### `compare_lighthouse`

Compare Lighthouse scores between two URLs. Runs a full audit on both and returns a side-by-side diff.

```
before_url: string  — Baseline URL (staging branch, old deploy)
after_url: string   — New URL (optimized deploy, new branch)
mobile?: boolean    — Run in mobile mode. Default: false (desktop)
```

## Example prompts

> "Run a Lighthouse audit on http://localhost:3000"

> "What's the LCP on my homepage and how can I improve it?"

> "Run a mobile performance audit on my product page"

> "Compare performance scores between my staging and production URLs"

> "Which SEO issues is Lighthouse flagging on my site?"

## Development

```bash
npm install
npx playwright install chromium
npm run build
npm run dev
```

## License

MIT
