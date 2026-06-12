/**
 * Persistent Lighthouse audit history store.
 * Saves results to ~/.mcp-lighthouse/history.json — survives across sessions.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STORE_DIR = path.join(os.homedir(), ".mcp-lighthouse");
const STORE_PATH = path.join(STORE_DIR, "history.json");
const MAX_RECORDS_PER_URL = 50;

export interface AuditRecord {
  timestamp: number;
  /** ISO date string */
  date: string;
  url: string;
  mobile: boolean;
  scores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  cwv: {
    lcp: string | null;
    fcp: string | null;
    cls: string | null;
    tbt: string | null;
    speedIndex: string | null;
    tti: string | null;
  };
}

type HistoryStore = Record<string, AuditRecord[]>;

function readStore(): HistoryStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as HistoryStore;
  } catch {
    return {};
  }
}

function writeStore(store: HistoryStore): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/** Stable key: url + mode */
export function storeKey(url: string, mobile: boolean): string {
  return `${url}__${mobile ? "mobile" : "desktop"}`;
}

export function saveRecord(record: AuditRecord): void {
  const store = readStore();
  const key = storeKey(record.url, record.mobile);
  const existing = store[key] ?? [];
  store[key] = [record, ...existing].slice(0, MAX_RECORDS_PER_URL);
  writeStore(store);
}

export function getHistory(url: string, mobile: boolean, limit = 10): AuditRecord[] {
  const store = readStore();
  const key = storeKey(url, mobile);
  return (store[key] ?? []).slice(0, limit);
}

export function getAllTrackedUrls(): Array<{ url: string; mobile: boolean; count: number }> {
  const store = readStore();
  return Object.entries(store).map(([key, records]) => {
    const [url, mode] = key.split("__");
    return { url, mobile: mode === "mobile", count: records.length };
  });
}

export function clearHistory(url: string, mobile: boolean): void {
  const store = readStore();
  delete store[storeKey(url, mobile)];
  writeStore(store);
}
