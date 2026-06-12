# @mcp-devtools/bundle-analyzer

> MCP server — analyze webpack and Vite bundle sizes, detect duplicate packages, identify tree-shaking opportunities, and compare builds.

## Install

```bash
npm install -g @mcp-devtools/bundle-analyzer
```

## Generate a stats file

**Webpack:**
```bash
npx webpack --json > stats.json

# For module-level analysis (find_large_modules, detect_duplicate_packages, analyze_tree_shaking):
npx webpack --stats=verbose --json > stats.json
```

**Vite** — add `rollup-plugin-visualizer` to `vite.config.ts`:
```ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [visualizer({ filename: 'stats.json', json: true })]
})
```

## Add to Claude Desktop

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

## Tools

### `analyze_bundle`

Analyze a webpack stats.json, rollup-plugin-visualizer JSON, or dist/ directory. Auto-detects the format.

```
path: string  — Path to stats.json, visualizer JSON, or dist/ directory
```

Returns total size, JS/CSS asset breakdown, top 20 modules by size, and optimization suggestions.

---

### `find_large_modules`

Find modules exceeding a size threshold. Requires module data (`--stats=verbose`).

```
stats_path: string       — Path to stats.json or visualizer JSON
threshold_kb?: number    — Size threshold in KB (default: 50)
```

Returns modules grouped by vendor vs. app code with import context.

---

### `detect_duplicate_packages`

Find npm packages bundled at multiple versions. Common when dependencies have conflicting peer requirements.

```
stats_path: string  — Path to stats.json (--stats=verbose) or visualizer JSON
```

Returns duplicate packages with all instance paths, wasted size estimate, and fix guidance (`npm dedupe`, `overrides`, webpack `alias`).

---

### `analyze_tree_shaking`

Identify tree-shaking opportunities: CommonJS modules that can't be eliminated, webpack optimization bailouts, and partially used modules (barrel file suspects).

```
stats_path: string  — Path to webpack stats.json
```

For full analysis, set `optimization: { usedExports: true }` in your webpack config and run with `--stats=verbose`.

---

### `compare_bundles`

Diff two builds to measure the impact of a change.

```
before_path: string  — Path to baseline stats.json
after_path: string   — Path to new stats.json
```

Returns total JS size diff, changed/added/removed assets with size percentages.

## Example prompts

> "Analyze the bundle at ./dist/stats.json — what's making it large?"

> "Find all modules larger than 100KB in my webpack build"

> "Are there duplicate packages in my bundle?"

> "Which packages can't be tree-shaken and why?"

> "Compare my bundle before and after removing lodash"

## Development

```bash
npm install
npm run build
npm run dev   # watch mode
```

## License

MIT
