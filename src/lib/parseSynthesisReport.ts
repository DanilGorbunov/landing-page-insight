/**
 * Parse the synthesis `report` markdown string into sections for structured UI / PDF.
 * Tolerant of missing headings (falls back to paragraphs).
 */

export type SynthesisBlock =
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

export type SynthesisSection = {
  level: 2 | 3;
  title: string;
  blocks: SynthesisBlock[];
};

export type ParsedSynthesisReport = {
  scoreLine: string | null;
  preamble: SynthesisBlock[];
  sections: SynthesisSection[];
};

function stripFencedCodeBlocks(text: string): string {
  return text.replace(/```[\w]*\s*[\s\S]*?```/g, "").trim();
}

/** Strip common inline markdown for display. */
export function stripInlineMarkdown(s: string): string {
  if (!s || typeof s !== "string") return s;
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function parseHeadingLine(line: string): { level: 1 | 2 | 3; title: string } | null {
  const m = line.match(/^(#{1,3})\s+(.+)$/);
  if (!m) return null;
  return {
    level: m[1].length as 1 | 2 | 3,
    title: stripInlineMarkdown(m[2].trim()),
  };
}

function isBulletLine(line: string): { ordered: boolean; content: string } | null {
  const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
  if (ordered) return { ordered: true, content: stripInlineMarkdown(ordered[2]) };
  const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
  if (bullet) return { ordered: false, content: stripInlineMarkdown(bullet[1]) };
  return null;
}

function flushParagraph(buf: string[]): SynthesisBlock | null {
  const t = buf
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  if (!t) return null;
  return { type: "paragraph", text: stripInlineMarkdown(t.replace(/\n+/g, " ")) };
}

/** Parse body lines under one heading into blocks (paragraphs, lists, ### subheadings). */
export function parseContentLines(lines: string[]): SynthesisBlock[] {
  const blocks: SynthesisBlock[] = [];
  let i = 0;
  let paraBuf: string[] = [];

  const flushPara = () => {
    const p = flushParagraph(paraBuf);
    if (p) blocks.push(p);
    paraBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    const sub = trimmed.match(/^###\s+(.+)$/);
    if (sub) {
      flushPara();
      blocks.push({ type: "subheading", text: stripInlineMarkdown(sub[1]) });
      i++;
      continue;
    }

    const bul = isBulletLine(line);
    if (bul) {
      flushPara();
      const ordered = bul.ordered;
      const items: string[] = [bul.content];
      i++;
      while (i < lines.length) {
        const b2 = isBulletLine(lines[i]);
        if (b2 && b2.ordered === ordered) {
          items.push(b2.content);
          i++;
        } else break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (!trimmed) {
      flushPara();
      i++;
      continue;
    }

    paraBuf.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

/**
 * Split markdown report into score line, preamble, and ## / # / ### titled sections.
 */
export function parseSynthesisReport(raw: string): ParsedSynthesisReport {
  const text = stripFencedCodeBlocks(raw || "");
  const lines = text.split(/\n/);

  let scoreLine: string | null = null;
  const bodyLines: string[] = [];
  for (const line of lines) {
    if (scoreLine == null && /^Overall score:\s*/i.test(line.trim())) {
      scoreLine = stripInlineMarkdown(line.trim());
      continue;
    }
    bodyLines.push(line);
  }

  const preambleLines: string[] = [];
  const sectionChunks: Array<{ level: 2 | 3; title: string; lines: string[] }> = [];
  let cur: { level: 2 | 3; title: string; lines: string[] } | null = null;

  for (const line of bodyLines) {
    const h = parseHeadingLine(line);
    if (h) {
      if (cur) sectionChunks.push(cur);
      if (h.level === 1) {
        cur = { level: 2, title: h.title, lines: [] };
      } else if (h.level === 2) {
        cur = { level: 2, title: h.title, lines: [] };
      } else {
        cur = { level: 3, title: h.title, lines: [] };
      }
      continue;
    }
    if (cur) {
      cur.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  }
  if (cur) sectionChunks.push(cur);

  if (sectionChunks.length === 0 && bodyLines.some((l) => l.trim())) {
    return {
      scoreLine,
      preamble: parseContentLines(bodyLines),
      sections: [],
    };
  }

  return {
    scoreLine,
    preamble: parseContentLines(preambleLines),
    sections: sectionChunks.map((ch) => ({
      level: ch.level,
      title: ch.title,
      blocks: parseContentLines(ch.lines),
    })),
  };
}
