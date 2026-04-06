import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";

/**
 * Contextual hover hint: що це → пояснення → що робити / рішення.
 */
export function HintTooltip({
  children,
  title,
  description,
  action,
  side = "bottom",
  className,
  delayDuration = 280,
  disabled,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  /** Порада, крок або рішення */
  action?: string;
  side?: Side;
  className?: string;
  delayDuration?: number;
  disabled?: boolean;
}) {
  if (disabled) {
    return <>{children}</>;
  }
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild className={cn(className)}>
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[min(320px,calc(100vw-2rem))] space-y-1.5 p-3 text-left"
      >
        <p className="text-xs font-semibold leading-snug text-foreground">{title}</p>
        {description ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {action ? (
          <p className="mt-1 border-t border-border pt-2 text-[11px] leading-relaxed text-foreground/95">
            <span className="font-medium">Дія: </span>
            <span className="text-muted-foreground">{action}</span>
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
