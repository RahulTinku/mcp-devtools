# mcp-devtools — Agent Instructions

## This is a PUBLIC repository

## 🔴 Commit message rule
Never add Wibey attribution. No `🌀 Magic applied with Wibey CLI`, no `Co-Authored-By: Wibey CLI`.
Plain commit messages only. Reason: Walmart IP exposure risk + looks unprofessional on personal GitHub.

Before committing, always run:

```bash
grep -ri "walmart\|npme\.\|gecgithub\|@gtpjs\|@walmart\|wibey\|wcnp\|r0k067s\|ceecore" \
  . --include="*.ts" --include="*.json" --include="*.md" --include="*.yml" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git
```

Zero matches required before pushing.

## Known issue: `package-lock.json`

Installing on Walmart network fills `package-lock.json` with `npme.walmart.com` URLs.
This file is **gitignored** — never unignore it.

## Stack

- TypeScript + `@modelcontextprotocol/sdk@^1.29.0`
- `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- Tool registration: `server.tool(name, description, rawZodShape, handler)`
- Build: `tsc` → `dist/` (ESM, Node16 module resolution)

## Test

```bash
# Build
npm run build --workspace=packages/bundle-analyzer

# Smoke test with MCP Inspector
npx @modelcontextprotocol/inspector node packages/bundle-analyzer/dist/index.js
```
