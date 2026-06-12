# mcp-component-docs

[![npm](https://img.shields.io/npm/v/mcp-component-docs)](https://www.npmjs.com/package/mcp-component-docs)

> MCP server — generate accurate React component prop documentation using the TypeScript compiler. Resolves inherited props, imported types, and forwardRef patterns correctly.

## Install

```bash
npm install -g mcp-component-docs
```

## Add to Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "component-docs": {
      "command": "mcp-component-docs"
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Tools

### `scan_components`

Scan a directory of React `.tsx` files and generate a full prop documentation catalog. Uses the TypeScript compiler to resolve the complete prop set — including props from extended interfaces, imported types, and `forwardRef` patterns.

```
path: string              — Path to a directory of .tsx files. E.g. './src/components'
max_components?: number   — Maximum components to include. Default: 50
```

Returns a table of every prop with its type, required/optional status, and JSDoc description. Works best when a `tsconfig.json` is present.

---

### `document_component`

Generate detailed prop documentation for a single component file.

```
path: string  — Path to a .tsx file. E.g. './src/components/Button/Button.tsx'
```

Returns the component description, complete prop table with types and JSDoc, and a required/optional summary.

## Example prompts

> "What props does the Button component accept?"

> "Scan ./src/components and document all components"

> "Show me all components that accept an onChange prop"

> "What's the full prop interface for Modal including inherited props?"

> "Which props are required in the DataTable component?"

## Development

```bash
npm install
npm run build
npm run dev
```

## License

MIT

---

### `map_component_dependencies`

Build a cross-component dependency graph by scanning JSX usage within each component file.

```
path: string              — Path to a directory of .tsx component files
max_components?: number   — Maximum components to include. Default: 100
```

Returns components grouped by role:
- **Top-level** — not reused by other components (likely pages or entry points)
- **Composite** — both uses other components and is used by others
- **Leaf** — no internal dependencies (primitives like Button, Icon)
- **Isolated** — no dependency edges detected

Also lists the most reused components ranked by usage count.

## Example prompts (dependency graph)

> "Map the component dependencies in src/components"

> "Which components does my Modal depend on?"

> "What are the most reused components in my UI library?"
