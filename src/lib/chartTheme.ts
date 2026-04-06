/** Resolved `hsl(...)` / hex / rgb from a `--*` custom property (works in light & dark). */
export function colorFromCssVar(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return fallback;
  if (raw.startsWith("#") || raw.includes("(")) return raw;
  return `hsl(${raw})`;
}
