# mcp-accessibility

[![npm](https://img.shields.io/npm/v/mcp-accessibility)](https://www.npmjs.com/package/mcp-accessibility)

> MCP server — run axe-core accessibility audits on any URL via Playwright.

## Install

```bash
npm install -g mcp-accessibility
npx playwright install chromium   # one-time ~280MB download
```

## Add to Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "accessibility": {
      "command": "mcp-accessibility"
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Tools

### `audit_accessibility`

Run a full accessibility audit on any URL using axe-core and Playwright. Works with localhost, staging, and production.

```
url: string                — URL to audit (http://, https://, file://)
tags?: string[]            — WCAG filter: 'wcag2aa', 'wcag21aa', 'best-practice', 'section508'
include?: string[]         — CSS selectors to scope the audit to. E.g. ['main', '#content']
exclude?: string[]         — CSS selectors to exclude. E.g. ['#cookie-banner', '.ads']
wait_for_selector?: string — Wait for this selector before auditing (useful for SPAs)
timeout?: number           — Max wait time in ms (default: 30000)
```

Returns violations grouped by severity (critical → serious → moderate → minor) with failing HTML, CSS selectors, fix instructions, and WCAG references.

---

### `audit_component`

Run an accessibility audit scoped to a specific component or region. Isolates results to a single CSS selector — no noise from the rest of the page.

```
url: string                — URL of the page containing the component
selector: string           — CSS selector. E.g. 'nav', '#login-form', '.modal'
tags?: string[]            — WCAG filter (same as audit_accessibility)
wait_for_selector?: string — Wait for this selector before auditing
timeout?: number           — Max wait time in ms (default: 30000)
```

## Example prompts

> "Audit http://localhost:3000 for accessibility issues"

> "Check the #login-form on my app for WCAG 2.1 AA violations"

> "What WCAG issues does my navigation have?"

> "Audit the .product-card component for accessibility problems"

> "Check my dashboard for best-practice violations, ignore the cookie banner"

## Development

```bash
npm install
npx playwright install chromium
npm run build
npm run dev
```

## License

MIT
