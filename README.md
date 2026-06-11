# mcp-devtools

> MCP servers that give AI assistants frontend superpowers.

A collection of [Model Context Protocol](https://modelcontextprotocol.io) servers for frontend developers. Plug into Claude Desktop, Cursor, or any MCP-compatible AI client and ask real questions about your frontend project.

## Servers

| Package | Status | Description |
|---------|--------|-------------|
| [`@mcp-devtools/bundle-analyzer`](./packages/bundle-analyzer) | ✅ Available | Analyze webpack bundle size, find large modules, compare builds |
| [`@mcp-devtools/accessibility`](./packages/accessibility) | 🚧 Coming soon | Run axe-core against any URL |
| [`@mcp-devtools/lighthouse`](./packages/lighthouse) | 🚧 Coming soon | Core Web Vitals + Lighthouse scores |
| [`@mcp-devtools/component-docs`](./packages/component-docs) | 🚧 Coming soon | Generate docs from your React component tree |

---

## Quick Start — Bundle Analyzer

### 1. Install

```bash
npm install -g @mcp-devtools/bundle-analyzer
```

### 2. Generate a webpack stats.json

```bash
# webpack CLI
npx webpack --json > stats.json

# Or in webpack.config.js
module.exports = { stats: 'verbose' }
```

### 3. Add to Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bundle-analyzer": {
      "command": "mcp-bundle-analyzer"
    }
  }
}
```

### 4. Ask questions

> "Analyze the bundle at ./dist/stats.json and tell me what's making it so large"

> "Find all modules larger than 100KB in my webpack build"

> "Compare the bundle before and after my lodash refactor"

---

## Tools

### `analyze_bundle`

Analyze a webpack bundle or dist directory.

```
path: string  — Path to stats.json or dist/ directory
```

Returns: total size, asset breakdown, top 20 modules by size, optimization suggestions.

### `find_large_modules`

Find modules exceeding a size threshold.

```
stats_path: string      — Path to webpack stats.json
threshold_kb?: number   — Size threshold in KB (default: 50)
```

Returns: grouped list of large vendor and app modules with import context.

### `compare_bundles`

Diff two builds to measure the impact of a change.

```
before_path: string  — Path to baseline stats.json
after_path: string   — Path to new stats.json
```

Returns: size diff, changed/added/removed assets with percentages.

---

## Development

```bash
# Install dependencies
npm install

# Build bundle-analyzer
npm run build --workspace=packages/bundle-analyzer

# Run in dev mode (hot reload)
npm run dev:bundle

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node packages/bundle-analyzer/dist/index.js
```

---

## Roadmap

- [ ] Vite bundle report support (`rollup-plugin-visualizer` JSON)
- [ ] Duplicate package detection (same package, multiple versions)
- [ ] Tree-shaking opportunity analysis
- [ ] `@mcp-devtools/accessibility` — axe-core via Playwright
- [ ] `@mcp-devtools/lighthouse` — Core Web Vitals
- [ ] `@mcp-devtools/component-docs` — React component tree docs

---

## License

MIT
