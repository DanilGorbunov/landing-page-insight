import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract domain from URL (strip protocol and trailing slash). */
export function getDomain(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Parse "X/10" score from report text. */
export function parseScoreFromReport(report: string | undefined): number | null {
  if (!report) return null;
  const m = report.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
  return m ? parseFloat(m[1], 10) : null;
}
