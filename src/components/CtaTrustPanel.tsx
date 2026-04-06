import {
  MousePointerClick,
  Shield,
  MessageSquareQuote,
  Star,
  FileText,
  Newspaper,
  Smartphone,
  FormInput,
  Sparkles,
} from "lucide-react";
import type { CtaTrustData } from "@/types/api";
import { cn } from "@/lib/utils";

function StatBox({ icon: Icon, label, value, color }: { icon: typeof Shield; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/25 px-4 py-3">
      <Icon className={cn("h-5 w-5 shrink-0", color || "text-muted-foreground")} />
      <div>
        <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function CtaTrustPanel({ data }: { data: CtaTrustData }) {
  if (!data) return null;
  const { ctas, frictionReducers, stickyCta, formFieldCount, trustSignals } = data;

  const primaryCtas = ctas?.filter((c) => c.type === "primary") || [];
  const aboveFold = ctas?.filter((c) => c.position === "above_fold") || [];

  return (
    <div className="space-y-6">
      {/* CTA Overview */}
      {ctas && ctas.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">CTAs Found</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {ctas.map((cta, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border",
                  cta.type === "primary"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : cta.type === "secondary"
                      ? "bg-secondary text-foreground border-border"
                      : "bg-transparent text-muted-foreground border-border"
                )}
              >
                <MousePointerClick className="h-3 w-3" />
                {cta.text}
                <span className="text-[9px] opacity-60">{cta.position === "above_fold" ? "↑" : "↓"}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>{primaryCtas.length} primary</span>
            <span>{aboveFold.length} above fold</span>
            {stickyCta !== null && (
              <span className={stickyCta ? "text-primary" : "text-destructive"}>
                Sticky CTA: {stickyCta ? "Yes" : "No"}
              </span>
            )}
            {formFieldCount !== null && (
              <span className={formFieldCount <= 3 ? "text-primary" : formFieldCount <= 5 ? "text-amber-500" : "text-destructive"}>
                Form fields: {formFieldCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Friction Reducers */}
      {frictionReducers && frictionReducers.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Friction Reducers</h3>
          <div className="flex flex-wrap gap-2">
            {frictionReducers.map((fr, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary"
              >
                <Sparkles className="h-3 w-3" />
                {fr}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trust Signals */}
      {trustSignals && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Trust Signals</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <StatBox icon={Shield} label="Logo/Trust Badges" value={trustSignals.logoBadgeCount ?? 0} color="text-primary" />
            <StatBox icon={MessageSquareQuote} label="Testimonials" value={trustSignals.testimonialCount ?? 0} color="text-amber-500" />
            <StatBox icon={FileText} label="Case Studies" value={trustSignals.caseStudyCount ?? 0} color="text-primary" />
            <StatBox icon={Newspaper} label="Press Mentions" value={trustSignals.pressMentions ?? 0} />
            {trustSignals.ratingScore && (
              <StatBox icon={Star} label="Rating" value={trustSignals.ratingScore} color="text-amber-400" />
            )}
            {trustSignals.namedTestimonials && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 col-span-2">
                <MessageSquareQuote className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary">Named testimonials (names + companies)</span>
              </div>
            )}
          </div>
          {trustSignals.securityBadges && trustSignals.securityBadges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {trustSignals.securityBadges.map((badge, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  <Shield className="h-3 w-3" />
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
