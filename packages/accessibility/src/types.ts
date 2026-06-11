export type ImpactLevel = "critical" | "serious" | "moderate" | "minor";

export interface AuditNode {
  html: string;
  target: string[];
  failureSummary: string;
  impact: ImpactLevel | null;
}

export interface Violation {
  id: string;
  impact: ImpactLevel;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AuditNode[];
}

export interface AxeResults {
  violations: Violation[];
  passes: Array<{ id: string; description: string }>;
  incomplete: Array<{ id: string; description: string; nodes: AuditNode[] }>;
  inapplicable: Array<{ id: string }>;
  url: string;
  timestamp: string;
}

export interface AuditOptions {
  url: string;
  /** WCAG tag filters, e.g. ["wcag2aa", "best-practice"] */
  tags?: string[];
  /** Only audit within these CSS selectors */
  include?: string[];
  /** Skip these CSS selectors */
  exclude?: string[];
  /** Wait for this selector before auditing (good for SPAs) */
  waitForSelector?: string;
  /** Navigation timeout in ms (default: 30000) */
  timeout?: number;
}
