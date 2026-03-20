import { describe, expect, it } from "vitest";
import { parseContentLines, parseSynthesisReport } from "./parseSynthesisReport";

describe("parseSynthesisReport", () => {
  it("extracts score line and sections with bullets", () => {
    const raw = `Overall score: 6.5/10

## Executive summary
Your hero is clear. **CTA** could be stronger.

## Strengths vs competitors
- Fast value prop
- Clear pricing

## Next steps
1. Test headline variants
2. Add social proof above fold
`;
    const p = parseSynthesisReport(raw);
    expect(p.scoreLine).toBe("Overall score: 6.5/10");
    expect(p.sections.map((s) => s.title)).toEqual([
      "Executive summary",
      "Strengths vs competitors",
      "Next steps",
    ]);
    const bullets = p.sections[1].blocks.find((b) => b.type === "list" && !b.ordered);
    expect(bullets && bullets.type === "list" ? bullets.items : []).toEqual([
      "Fast value prop",
      "Clear pricing",
    ]);
    const ordered = p.sections[2].blocks.find((b) => b.type === "list" && b.ordered);
    expect(ordered && ordered.type === "list" ? ordered.items.length : 0).toBe(2);
  });

  it("falls back to flat paragraphs when no headings", () => {
    const raw = `Overall score: 5/10

One paragraph here.

Second paragraph after blank.`;
    const p = parseSynthesisReport(raw);
    expect(p.sections.length).toBe(0);
    expect(p.preamble.some((b) => b.type === "paragraph" && b.text.includes("One paragraph"))).toBe(true);
  });

  it("strips fenced code blocks", () => {
    const raw = `Overall score: 7/10
## Summary
Hello

\`\`\`json
[]
\`\`\`
`;
    const p = parseSynthesisReport(raw);
    expect(p.sections[0].blocks.some((b) => b.type === "paragraph" && b.text === "Hello")).toBe(true);
  });
});

describe("parseContentLines", () => {
  it("handles ### subheadings inside a section", () => {
    const blocks = parseContentLines(["### Detail", "", "Some text"]);
    expect(blocks[0]).toEqual({ type: "subheading", text: "Detail" });
    expect(blocks[1]).toMatchObject({ type: "paragraph" });
  });
});
