export interface PropDoc {
  name: string;
  /** Fully resolved type string (e.g. `string`, `"sm" | "md" | "lg"`, `() => void`) */
  type: string;
  required: boolean;
  /** JSDoc comment from the prop's original declaration */
  description: string;
}

export interface ComponentDoc {
  name: string;
  /** Relative path from project root */
  filePath: string;
  /** JSDoc comment on the component declaration */
  description: string;
  props: PropDoc[];
  /** How the component is defined */
  pattern: "React.FC" | "forwardRef" | "function" | "arrow" | "unknown";
}

export interface ScanResult {
  projectRoot: string;
  tsConfigPath: string | null;
  componentCount: number;
  components: ComponentDoc[];
}
