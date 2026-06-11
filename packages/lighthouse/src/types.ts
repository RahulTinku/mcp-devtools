export type ScoreRating = "good" | "needs-improvement" | "poor" | "n/a";

export interface CategoryScore {
  id: string;
  title: string;
  score: number | null;
  rating: ScoreRating;
}

export interface CwvMetric {
  id: string;
  title: string;
  displayValue: string;
  numericValue: number | null;
  score: number | null;
  rating: ScoreRating;
  threshold: string;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  savingsMs: number | null;
  savingsBytes: number | null;
  displayValue: string | null;
}

export interface FailingAudit {
  id: string;
  title: string;
  description: string;
  displayValue: string | null;
  score: number | null;
  category: string;
}

export interface LighthouseReport {
  url: string;
  fetchTime: string;
  categories: CategoryScore[];
  cwv: CwvMetric[];
  opportunities: Opportunity[];
  failingAudits: FailingAudit[];
  passingCount: number;
}

export interface RunOptions {
  url: string;
  /** Categories to audit. Default: all four. */
  categories?: Array<"performance" | "accessibility" | "best-practices" | "seo">;
  /** Simulate mobile throttling (default: false = desktop) */
  mobile?: boolean;
  /** Max wait time in ms (default: 60000) */
  timeout?: number;
}
