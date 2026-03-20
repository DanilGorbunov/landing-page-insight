import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Eyebrow label — use sparingly above page/section titles */
export function ReportEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Primary page title (reports) */
export function ReportPageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1
      className={cn(
        "font-display text-[1.75rem] sm:text-[2rem] font-medium tracking-[-0.02em] text-foreground mt-2 leading-[1.15]",
        className
      )}
    >
      {children}
    </h1>
  );
}

/** Metadata row as accessible chips */
export function ReportMetaChips({
  items,
  className,
}: {
  items: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("mt-5 flex flex-wrap gap-2", className)} aria-label="Report details">
      {items.map((item) => (
        <li
          key={`${item.label}-${item.value}`}
          className="inline-flex items-baseline gap-2 rounded-full border border-white/[0.08] bg-secondary/40 px-3.5 py-1.5 text-xs"
        >
          <span className="text-muted-foreground font-medium">{item.label}</span>
          <span className="text-foreground tabular-nums">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Standard section with heading + optional lede */
export function ReportSection({
  id,
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-[5.5rem] border-b border-white/[0.06] pb-12 pt-12 first:pt-6 last:border-b-0 last:pb-8",
        className
      )}
      aria-labelledby={headingId}
    >
      <header className="mb-8 max-w-2xl">
        <h2 id={headingId} className="text-lg font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </header>
      <div className={cn(contentClassName)}>{children}</div>
    </section>
  );
}

/** In-page jump links (long reports) */
export function ReportJumpNav({
  links,
  className,
}: {
  links: { href: string; label: string }[];
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "sticky top-14 z-10 -mx-4 mb-0 border-b border-white/[0.06] bg-background/85 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:mx-0 sm:mb-2 sm:rounded-xl sm:border sm:py-2.5",
        className
      )}
      aria-label="On this page"
    >
      <p className="sr-only">Jump to section</p>
      <ul className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
        {links.map((l) => (
          <li key={l.href} className="shrink-0">
            <a
              href={l.href}
              className="block rounded-full border border-transparent px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Card surface for data-dense blocks */
export function ReportSurface({
  children,
  className,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "muted" | "highlight";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6 md:p-7",
        variant === "default" && "border-white/[0.07] bg-card/35 shadow-sm shadow-black/10",
        variant === "muted" && "border-dashed border-white/[0.1] bg-muted/15",
        variant === "highlight" && "border-primary/20 bg-gradient-to-b from-primary/[0.07] to-transparent",
        className
      )}
    >
      {children}
    </div>
  );
}
