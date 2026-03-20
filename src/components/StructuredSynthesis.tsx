import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { parseSynthesisReport, type SynthesisBlock, type SynthesisSection } from "@/lib/parseSynthesisReport";

function renderBlocks(blocks: SynthesisBlock[], keyPrefix: string) {
  return blocks.map((b, j) => {
    const key = `${keyPrefix}-${j}`;
    switch (b.type) {
      case "subheading":
        return (
          <h4 key={key} className="text-sm font-semibold text-foreground pt-3 first:pt-0">
            {b.text}
          </h4>
        );
      case "paragraph":
        return (
          <p key={key} className="text-sm text-muted-foreground leading-relaxed">
            {b.text}
          </p>
        );
      case "list":
        return b.ordered ? (
          <ol
            key={key}
            className="list-decimal list-outside pl-5 space-y-2 text-sm text-foreground/95 marker:text-muted-foreground"
          >
            {b.items.map((item, k) => (
              <li key={k} className="leading-relaxed pl-1">
                {item}
              </li>
            ))}
          </ol>
        ) : (
          <ul
            key={key}
            className="list-disc list-outside pl-5 space-y-2 text-sm text-foreground/95 marker:text-primary/70"
          >
            {b.items.map((item, k) => (
              <li key={k} className="leading-relaxed pl-1">
                {item}
              </li>
            ))}
          </ul>
        );
      default:
        return null;
    }
  });
}

function SectionCard({ section, index }: { section: SynthesisSection; index: number }) {
  if (!section.title && section.blocks.length === 0) return null;
  return (
    <article
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-card/30 p-5 space-y-3 shadow-sm shadow-black/[0.03]",
        section.level === 3 && "border-dashed border-white/[0.1] bg-muted/10"
      )}
    >
      <h3 className="text-base font-semibold text-foreground leading-snug tracking-tight">{section.title}</h3>
      <div className="space-y-3">{renderBlocks(section.blocks, `sec-${index}`)}</div>
    </article>
  );
}

type Props = {
  report: string | undefined;
  className?: string;
};

/** Structured full synthesis: score callout, preamble, and cards per markdown section. */
export function StructuredSynthesis({ report, className }: Props) {
  const parsed = useMemo(() => parseSynthesisReport(report ?? ""), [report]);

  if (!report?.trim()) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  const hasStructure =
    parsed.scoreLine ||
    parsed.preamble.length > 0 ||
    parsed.sections.some((s) => s.title || s.blocks.length > 0);

  if (!hasStructure) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.07] bg-card/25 p-5 sm:p-6 space-y-6 shadow-sm shadow-black/5",
        className
      )}
    >
      {parsed.scoreLine && (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.12] to-transparent px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/90 mb-1">Overall</p>
          <p className="text-lg font-mono font-bold tabular-nums text-primary">{parsed.scoreLine}</p>
        </div>
      )}

      {parsed.preamble.length > 0 && (
        <div className="space-y-3 pb-2 border-b border-white/[0.06]">{renderBlocks(parsed.preamble, "pre")}</div>
      )}

      {parsed.sections.length > 0 && (
        <div className="space-y-4">
          {parsed.sections.map((section, i) => (
            <SectionCard key={`${section.title}-${i}`} section={section} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
