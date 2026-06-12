# @mcp-devtools/component-docs

> MCP server — generate accurate React component prop documentation using the TypeScript compiler. Resolves inherited props, imported types, and forwardRef patterns correctly.

## Install

```bash
npm install -g @mcp-devtools/component-docs
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
