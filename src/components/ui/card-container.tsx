import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** When true, applies primary border and ring (e.g. recommended plan). */
  highlighted?: boolean;
}

/**
 * Card container: glass surface, rounded, padding, border. Use for pricing cards, content panels.
 */
function CardContainer({ className, highlighted, ...props }: CardContainerProps) {
  return (
    <div
      className={cn(
        "glass-surface rounded-lg p-6 flex flex-col border transition-colors",
        highlighted
          ? "border-primary ring-1 ring-primary/30 md:scale-[1.02]"
          : "border-white/5 hover:border-primary/30",
        className
      )}
      {...props}
    />
  );
}

export { CardContainer };
