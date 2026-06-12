# mcp-devtools

> MCP servers that give AI assistants frontend superpowers.

A collection of [Model Context Protocol](https://modelcontextprotocol.io) servers for frontend developers. Plug into Claude Desktop, Cursor, or any MCP-compatible AI client and ask real questions about your frontend project.

**Prerequisites:** Node.js 18+, [Claude Desktop](https://claude.ai/download) or [Cursor](https://www.cursor.com/)

## Servers

| Package | Description |
|---------|-------------|
| [`@mcp-devtools/bundle-analyzer`](#bundle-analyzer) | Analyze webpack bundle size, find large modules, compare builds |
| [`@mcp-devtools/accessibility`](#accessibility) | Run axe-core audits on any URL — full page or scoped to a component |
| [`@mcp-devtools/lighthouse`](#lighthouse) | Lighthouse audits: scores, Core Web Vitals, opportunities, compare URLs |
| [`@mcp-devtools/component-docs`](#component-docs) | TypeScript-compiler-backed prop docs — resolves inherited, imported, and forwardRef props |

---

## Bundle Analyzer

Analyze webpack bundle sizes, find large modules, and measure the impact of changes.

### Install

```bash
npm install -g @mcp-devtools/bundle-analyzer
```

### Generate a webpack stats file

```bash
npx webpack --json > stats.json
```

### Add to Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bundle-analyzer": {
      "command": "mcp-bundle-analyzer"
    }
  }
}
```

Restart Claude Desktop after editing the config.

### Example prompts

> "Analyze the bundle at ./dist/stats.json — what's making it so large?"

> "Find all modules larger than 100KB in my webpack build"

> "Compare the bundle before and after my lodash refactor"

### Tools

**`analyze_bundle`** — Analyze a webpack stats.json or dist directory.
Returns total size, asset breakdown, top 20 modules by size, and optimization suggestions.

**`find_large_modules`** — Find modules exceeding a size threshold (default 50KB).
Returns grouped list of large vendor and app modules with import context.

**`compare_bundles`** — Diff two builds to measure the impact of a change.
Returns size diff, changed/added/removed assets with percentages.

---

## Accessibility

Run [axe-core](https://github.com/dequelabs/axe-core) accessibility audits on any URL via Playwright.

### Install

```bash
npm install -g @mcp-devtools/accessibility
npx playwright install chromium   # one-time ~280MB download
```

### Add to Claude Desktop

```json
{
  "mcpServers": {
    "accessibility": {
      "command": "mcp-accessibility"
    }
  }
}
```

### Example prompts

> "Audit http://localhost:3000 for accessibility issues"

> "Check the #login-form on my app for WCAG 2.1 AA violations"

> "What's making my navbar inaccessible?"

---

## Lighthouse

Run [Lighthouse](https://github.com/GoogleChrome/lighthouse) audits and get performance scores, Core Web Vitals, and actionable opportunities.

### Install

```bash
npm install -g @mcp-devtools/lighthouse
npx playwright install chromium   # one-time ~280MB download
```

### Add to Claude Desktop

```json
{
  "mcpServers": {
    "lighthouse": {
      "command": "mcp-lighthouse"
    }
  }
}
```

### Example prompts

> "Run a Lighthouse audit on http://localhost:3000"

> "What's the LCP on my homepage and how can I improve it?"

> "Compare performance scores between my staging and production URLs"

---

## Component Docs

Scan a React + TypeScript component library and generate accurate prop documentation using the TypeScript compiler — resolves inherited props, imported types, and `forwardRef` components correctly.

### Install

```bash
npm install -g @mcp-devtools/component-docs
```

### Add to Claude Desktop

```json
{
  "mcpServers": {
    "component-docs": {
      "command": "mcp-component-docs"
    }
  }
}
```

### Example prompts

> "What props does the Button component accept?"

> "Show me all components in src/components that accept an onChange prop"

> "What's the full prop interface for Modal including inherited props?"

---

## Running all servers

```json
{
  "mcpServers": {
    "bundle-analyzer": {
      "command": "mcp-bundle-analyzer"
    },
    "accessibility": {
      "command": "mcp-accessibility"
    },
    "lighthouse": {
      "command": "mcp-lighthouse"
    },
    "component-docs": {
      "command": "mcp-component-docs"
    }
  }
}
```

---

## Development

```bash
# Install all dependencies
npm install

# Build all packages
npm run build

# Build a single package
npm run build --workspace=packages/bundle-analyzer

# Dev mode (bundle-analyzer)
npm run dev:bundle

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node packages/bundle-analyzer/dist/index.js
```

---

## Roadmap

- [ ] Vite bundle report support (`rollup-plugin-visualizer` JSON)
- [ ] Duplicate package detection (same package, multiple versions)
- [ ] Tree-shaking opportunity analysis
- [ ] Lighthouse: scheduled audits with trend tracking
- [ ] Component docs: cross-component dependency graph

---

## License

MIT
