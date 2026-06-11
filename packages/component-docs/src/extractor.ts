import type { SourceFile, TypeChecker, Node } from "ts-morph";
import type { ComponentDoc, PropDoc } from "./types.js";

/**
 * Cleans up type strings for readability:
 * - `string | undefined` → `string` (optional is shown via the required column)
 * - `(() => void) | undefined` → `() => void`
 */
function cleanType(typeStr: string): string {
  return typeStr
    .replace(/\s*\|\s*undefined$/, "")
    .replace(/^undefined\s*\|\s*/, "")
    .replace(/^\((.+)\)$/, "$1"); // unwrap unnecessary parens
}

/** Extract JSDoc comment text from a ts-morph node */
function extractJsDoc(node: Node): string {
  if (!("getJsDocs" in node)) return "";
  const jsDocs = (node as unknown as { getJsDocs(): Array<{ getComment(): unknown }> }).getJsDocs();
  if (!jsDocs.length) return "";
  const comment = jsDocs[0].getComment();
  if (typeof comment === "string") return comment.trim();
  if (Array.isArray(comment)) {
    return comment.map((c: unknown) =>
      typeof c === "string" ? c : (c as { getText(): string }).getText()
    ).join("").trim();
  }
  return "";
}

/** Detect component pattern from the initializer */
function detectPattern(init: Node): ComponentDoc["pattern"] {
  const kind = init.getKindName();
  const text = init.getText();
  if (kind === "ArrowFunction") {
    if (text.includes("React.FC") || text.includes("React.FunctionComponent")) return "React.FC";
    return "arrow";
  }
  if (kind === "CallExpression") {
    if (text.startsWith("React.forwardRef") || text.startsWith("forwardRef")) return "forwardRef";
    if (text.startsWith("React.memo") || text.startsWith("memo")) {
      // Unwrap memo — treat inner as its pattern
      return "arrow";
    }
  }
  if (kind === "FunctionExpression") return "function";
  return "unknown";
}

/** Extract props from the first parameter of a function/arrow/forwardRef */
function extractPropsNode(init: Node): Node | null {
  const kind = init.getKindName();
  const getParamsFromFn = (fn: Node): Node | null => {
    if (!("getParameters" in fn)) return null;
    const params = (fn as unknown as { getParameters(): Node[] }).getParameters();
    return params.length > 0 ? params[0] : null;
  };

  if (kind === "ArrowFunction" || kind === "FunctionExpression") {
    return getParamsFromFn(init);
  }
  if (kind === "CallExpression") {
    // React.forwardRef((props, ref) => ...) — first arg is the render fn
    const args = (init as unknown as { getArguments(): Node[] }).getArguments();
    if (args.length > 0) {
      const renderFn = args[0];
      const rk = renderFn.getKindName();
      if (rk === "ArrowFunction" || rk === "FunctionExpression") {
        return getParamsFromFn(renderFn);
      }
    }
  }
  return null;
}

/**
 * Extract all exported React components from a source file.
 * Uses the TypeScript type checker to resolve extended + imported props.
 */
export function extractComponents(sf: SourceFile, checker: TypeChecker, projectRoot: string): ComponentDoc[] {
  const components: ComponentDoc[] = [];
  const co = checker.compilerObject;

  sf.getExportedDeclarations().forEach((decls, name) => {
    // Skip non-component names, default exports alias, and utility types
    if (name === "default" || !/^[A-Z]/.test(name)) return;

    for (const decl of decls) {
      if (decl.getKindName() !== "VariableDeclaration") continue;

      const init = (decl as unknown as { getInitializer(): Node | undefined }).getInitializer();
      if (!init) continue;

      const propsNode = extractPropsNode(init);
      if (!propsNode) continue;

      const pattern = detectPattern(init);

      // Get component-level JSDoc (on the VariableStatement parent)
      const parent = decl.getParent();
      const componentDoc = parent ? extractJsDoc(parent as Node) : "";

      // Resolve the FULL props type via the checker (includes inherited + imported)
      const propsType = checker.getTypeAtLocation(propsNode);
      const properties = propsType.getProperties();

      // Filter out React internal symbols
      const SKIP_PROPS = new Set(["ref", "key"]);
      const propDocs: PropDoc[] = properties
        .filter((sym) => !SKIP_PROPS.has(sym.getName()) && !sym.getName().startsWith("__"))
        .map((sym) => {
          const rawType = co.typeToString(co.getTypeOfSymbol(sym.compilerSymbol));
          const type = cleanType(rawType);
          // SymbolFlags.Optional = 16777216
          const required = !(sym.compilerSymbol.flags & 16777216);
          // JSDoc from the symbol's original declaration (may be in another file)
          const symDecls = sym.getDeclarations();
          const description = symDecls.length > 0 ? extractJsDoc(symDecls[0]) : "";
          return { name: sym.getName(), type, required, description };
        });

      if (propDocs.length === 0 && pattern === "unknown") continue;

      const relPath = sf.getFilePath().replace(projectRoot, "").replace(/^\//, "");

      components.push({
        name,
        filePath: relPath,
        description: componentDoc,
        props: propDocs,
        pattern,
      });
      break; // take first matching decl
    }
  });

  return components;
}
