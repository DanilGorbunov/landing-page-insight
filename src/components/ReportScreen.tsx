import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Check, X, ExternalLink, ArrowLeft } from "lucide-react";
import type { HistoryEntry } from "@/lib/analysisHistory";
import type { AnalysisResult } from "@/lib/api";
import { getDomain, parseScoreFromReport } from "@/lib/utils";
import { containerVariants, itemVariants } from "@/lib/motion";

const SECTION_TO_BACKEND: Record<string, string> = {
  Hero: "hero",
  "Value Prop": "value proposition",
  Features: "features",
  "Social Proof": "social proof",
  CTA: "CTA",
};

const TABS = ["Overview", "Sections", "Competitors"] as const;
const SECTION_TABS = ["Hero", "Value Prop", "Features", "Social Proof", "CTA"] as const;

type Tab = (typeof TABS)[number];
type SectionTab = (typeof SECTION_TABS)[number];

interface ReportScreenProps {
  url: string;
  result?: AnalysisResult | null;
  savedEntry?: HistoryEntry | null;
  onBack?: () => void;
}

const AnimatedScore = ({ target }: { target: number }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(parseFloat((eased * target).toFixed(1)));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target]);
  return (
    <span className="tabular-nums" style={{ letterSpacing: 0 }}>
      {val.toFixed(1)}
    </span>
  );
};

const PriorityBadge = ({ level }: { level: "P1" | "P2" }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${
      level === "P1" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
    }`}
  >
    {level}
  </span>
);

const ConfidencePill = ({ level }: { level: "High" | "Medium" | "Low" }) => {
  const colors = {
    High: "text-success bg-success/10",
    Medium: "text-primary bg-primary/10",
    Low: "text-muted-foreground bg-muted",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-sm font-medium ${colors[level]}`}>
      {level}
    </span>
  );
};

const criticalGaps = [
  {
    priority: "P1" as const,
    area: "Hero Section",
    problem: "No clear value proposition above the fold",
    recommendation: 'Replace "Welcome to our platform" with a specific outcome statement. linear.app uses "Linear is a purpose-built tool for planning and building products."',
    competitor: "linear.app",
    confidence: "High" as const,
  },
  {
    priority: "P1" as const,
    area: "Social Proof",
    problem: "Missing social proof near primary CTA",
    recommendation: "Add customer logos or a testimonial directly above the sign-up button. hubspot.com shows \"Trusted by 205,000+ businesses\" with logo strip.",
    competitor: "hubspot.com",
    confidence: "High" as const,
  },
  {
    priority: "P2" as const,
    area: "CTA Clarity",
    problem: 'CTA button text "Get Started" is generic',
    recommendation: 'Use specific action copy like "Start free trial" or "See demo". notion.so uses "Get Notion free" which sets expectation.',
    competitor: "notion.so",
    confidence: "Medium" as const,
  },
  {
    priority: "P2" as const,
    area: "Feature Communication",
    problem: "Features listed without user benefits",
    recommendation: "Reframe each feature as an outcome. Instead of \"API Access\", use \"Integrate with your existing stack in minutes.\"",
    competitor: "linear.app",
    confidence: "Medium" as const,
  },
];

const sectionData: Record<SectionTab, { sites: { name: string; score: number; isTarget?: boolean; insights: { pass: boolean; text: string; confidence: "High" | "Medium" | "Low" }[] }[] }> = {
  Hero: {
    sites: [
      {
        name: "apollo.io",
        score: 5.8,
        isTarget: true,
        insights: [
          { pass: false, text: 'H1 "Welcome to Apollo" lacks specificity', confidence: "High" },
          { pass: true, text: "CTA visible above fold at 1440px", confidence: "High" },
          { pass: false, text: "No supporting visual or product screenshot", confidence: "Medium" },
        ],
      },
      {
        name: "linear.app",
        score: 8.9,
        insights: [
          { pass: true, text: '"Linear is a purpose-built tool for planning and building products"', confidence: "High" },
          { pass: true, text: "Animated product demo visible in hero", confidence: "High" },
          { pass: true, text: "Contrast ratio 7.2:1 (AAA pass)", confidence: "High" },
        ],
      },
    ],
  },
  "Value Prop": {
    sites: [
      {
        name: "apollo.io",
        score: 5.5,
        isTarget: true,
        insights: [
          { pass: false, text: "Value props use internal jargon", confidence: "Medium" },
          { pass: true, text: "3-column layout scans well", confidence: "High" },
        ],
      },
      {
        name: "hubspot.com",
        score: 8.4,
        insights: [
          { pass: true, text: "Each prop tied to a specific business outcome", confidence: "High" },
          { pass: true, text: "Supporting stats: \"205K+ businesses\"", confidence: "High" },
        ],
      },
    ],
  },
  Features: {
    sites: [
      {
        name: "apollo.io",
        score: 6.0,
        isTarget: true,
        insights: [
          { pass: false, text: "Features listed without user benefit framing", confidence: "High" },
          { pass: true, text: "Visual icons for each feature", confidence: "Medium" },
        ],
      },
      {
        name: "notion.so",
        score: 9.1,
        insights: [
          { pass: true, text: "Interactive demos for each feature", confidence: "High" },
          { pass: true, text: "Benefit-first headlines with feature details below", confidence: "High" },
        ],
      },
    ],
  },
  "Social Proof": {
    sites: [
      {
        name: "apollo.io",
        score: 4.2,
        isTarget: true,
        insights: [
          { pass: false, text: "Only 2 customer logos visible", confidence: "High" },
          { pass: false, text: "No testimonials on page", confidence: "High" },
          { pass: false, text: "No case study links", confidence: "Medium" },
        ],
      },
      {
        name: "hubspot.com",
        score: 9.3,
        insights: [
          { pass: true, text: "Logo strip with 8+ recognizable brands", confidence: "High" },
          { pass: true, text: "Video testimonial from VP-level customer", confidence: "High" },
        ],
      },
    ],
  },
  CTA: {
    sites: [
      {
        name: "apollo.io",
        score: 6.8,
        isTarget: true,
        insights: [
          { pass: true, text: "CTA above fold", confidence: "High" },
          { pass: false, text: '"Get Started" is generic—no value signal', confidence: "High" },
        ],
      },
      {
        name: "notion.so",
        score: 8.7,
        insights: [
          { pass: true, text: '"Get Notion free" sets clear expectation', confidence: "High" },
          { pass: true, text: "Secondary CTA for sales demo", confidence: "Medium" },
        ],
      },
    ],
  },
};

const ReportScreen = ({ url, result, savedEntry, onBack }: ReportScreenProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [activeSection, setActiveSection] = useState<SectionTab>("Hero");
  const domain = getDomain(url);
  const apiResult = result ?? savedEntry?.result;
  const score =
    apiResult?.synthesis?.overall_score ??
    parseScoreFromReport(apiResult?.report) ??
    6.2;
  const synthesisText =
    apiResult?.report ??
    "Your landing page communicates core features but lacks the persuasive elements that top competitors use.";
  const hasRealData = Boolean(apiResult?.userAnalysis || apiResult?.competitors?.length);

  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Top bar — aligned to content container start */}
      <div className="h-14 flex items-center border-b border-border">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 flex items-center">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mr-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <span className="font-display italic text-lg font-semibold text-foreground mr-6">Landing Lens</span>
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm rounded-sm transition-colors ${
                  activeTab === tab
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 md:px-8 py-8 max-w-6xl mx-auto w-full">
        {activeTab === "Overview" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            {/* Synthesis card */}
            <motion.div
              variants={itemVariants}
              className="glass-surface-elevated rounded-md p-6 mb-8 border-l-2 border-primary"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-xs text-muted-foreground">{domain}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-primary/15 text-primary text-[10px] font-semibold">
                      You
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-7xl font-mono font-bold text-foreground tabular-nums leading-none">
                      <AnimatedScore target={score} />
                    </span>
                    <span className="text-2xl font-mono text-muted-foreground tabular-nums" style={{ letterSpacing: 0 }}>/10</span>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Moderate competitive position</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl whitespace-pre-wrap">
                    {synthesisText}
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="glass-surface rounded-sm px-3 py-2 flex items-center gap-2">
                    <span className="text-muted-foreground">Competitors analyzed:</span>
                    <span className="font-mono text-foreground">{hasRealData && apiResult?.competitors ? apiResult.competitors.length : 3}</span>
                  </div>
                  <div className="glass-surface rounded-sm px-3 py-2 flex items-center gap-2">
                    <span className="text-muted-foreground">Confidence:</span>
                    <ConfidencePill level="High" />
                    <span className="font-mono text-foreground">(94%)</span>
                  </div>
                  <div className="glass-surface rounded-sm px-3 py-2 flex items-center gap-2">
                    <span className="text-muted-foreground">Sections scored:</span>
                    <span className="font-mono text-foreground">5</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {hasRealData && apiResult?.report && (
              <motion.div variants={itemVariants} className="mb-8">
                <h2 className="text-sm font-semibold text-foreground mb-4">Full Report</h2>
                <div className="glass-surface rounded-md p-6 prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                    {apiResult.report}
                  </pre>
                </div>
              </motion.div>
            )}

            {!hasRealData && (
              <>
                <motion.div variants={itemVariants}>
                  <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    Critical Gaps
                    <span className="text-xs font-normal text-muted-foreground">({criticalGaps.length} identified)</span>
                  </h2>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {criticalGaps.map((gap, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className="glass-surface rounded-md p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <PriorityBadge level={gap.priority} />
                    <span className="text-xs text-muted-foreground">{gap.area}</span>
                    <div className="ml-auto">
                      <ConfidencePill level={gap.confidence} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-2">{gap.problem}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{gap.recommendation}</p>
                  <a
                    href="#"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    {gap.competitor} does it better
                  </a>
                </motion.div>
              ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "Sections" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <motion.div variants={itemVariants} className="flex gap-1 mb-6 flex-wrap">
              {SECTION_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSection(tab)}
                  className={`px-4 py-2 text-xs rounded-sm transition-colors ${
                    activeSection === tab
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "glass-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hasRealData && apiResult ? (
                <>
                  {/* Target site */}
                  <motion.div
                    variants={itemVariants}
                    className="glass-surface rounded-md overflow-hidden border-l-2 border-primary"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-foreground">{domain}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary font-semibold">
                            You
                          </span>
                        </div>
                      </div>
                      {apiResult.targetScreenshotUrl ? (
                        <img
                          src={apiResult.targetScreenshotUrl}
                          alt={`Screenshot of ${domain}`}
                          className="w-full h-40 rounded-sm object-cover object-top border border-white/5 mb-4"
                        />
                      ) : (
                        <div className="w-full h-40 rounded-sm bg-secondary/50 border border-white/5 mb-4 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground font-mono">Screenshot unavailable</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {apiResult.userAnalysis?.[SECTION_TO_BACKEND[activeSection]] ?? "—"}
                      </p>
                    </div>
                  </motion.div>
                  {/* Competitors */}
                  {apiResult.competitors?.map((comp) => {
                    const compDomain = getDomain(comp.url);
                    return (
                      <motion.div
                        key={comp.url}
                        variants={itemVariants}
                        className="glass-surface rounded-md overflow-hidden border-l-2 border-primary/50"
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono text-sm text-foreground">{compDomain}</span>
                          </div>
                          {comp.screenshotUrl ? (
                            <img
                              src={comp.screenshotUrl}
                              alt={`Screenshot of ${compDomain}`}
                              className="w-full h-40 rounded-sm object-cover object-top border border-white/5 mb-4"
                            />
                          ) : (
                            <div className="w-full h-40 rounded-sm bg-secondary/50 border border-white/5 mb-4 flex items-center justify-center">
                              <span className="text-xs text-muted-foreground font-mono">Screenshot unavailable</span>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {comp.analysis?.[SECTION_TO_BACKEND[activeSection]] ?? "—"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              ) : (
                sectionData[activeSection].sites.map((site, i) => (
                  <motion.div
                    key={site.name}
                    variants={itemVariants}
                    className="glass-surface rounded-md overflow-hidden"
                    style={{
                      borderTop: `2px solid ${site.isTarget ? "hsl(var(--primary))" : "hsl(176 56% 55%)"}`,
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-foreground">{site.name}</span>
                          {site.isTarget && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary font-semibold">
                              You
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono text-lg font-bold tabular-nums`}
                          style={{ letterSpacing: 0 }}
                        >
                          {site.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full h-32 rounded-sm bg-secondary/50 border-thin mb-4 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground font-mono">Screenshot: {site.name}</span>
                      </div>
                      <div className="space-y-2">
                        {site.insights.map((insight, j) => (
                          <div key={j} className="flex items-start gap-2">
                            {insight.pass ? (
                              <Check className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                            )}
                            <span className="text-xs text-muted-foreground leading-relaxed">{insight.text}</span>
                            <ConfidencePill level={insight.confidence} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "Competitors" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <motion.div variants={itemVariants} className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-1">Competitor Overview</h2>
              <p className="text-xs text-muted-foreground">
                {hasRealData && apiResult?.competitors
                  ? `${apiResult.competitors.length} competitors analyzed across 5 sections`
                  : "4 competitors analyzed across 5 sections"}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {hasRealData && apiResult?.competitors ? (
                apiResult.competitors.map((comp, i) => {
                  const compDomain = getDomain(comp.url);
                  return (
                    <motion.div
                      key={comp.url}
                      variants={itemVariants}
                      className="glass-surface rounded-md overflow-hidden"
                      style={{ borderTop: "2px solid hsl(176 56% 55%)" }}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-accent font-semibold">#{i + 1}</span>
                          <a
                            href={comp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        {comp.screenshotUrl ? (
                          <img
                            src={comp.screenshotUrl}
                            alt={`Screenshot of ${compDomain}`}
                            className="w-full h-24 rounded-sm object-cover object-top mb-3 border border-white/5"
                          />
                        ) : (
                          <div className="w-full h-24 rounded-sm bg-secondary/50 border border-white/5 mb-3 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground font-mono">No screenshot</span>
                          </div>
                        )}
                        <p className="font-mono text-sm text-foreground mb-1">{compDomain}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">/10 overall</p>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                [
                  { name: "linear.app", score: 8.9, position: "#1" },
                  { name: "notion.so", score: 8.7, position: "#2" },
                  { name: "hubspot.com", score: 8.4, position: "#3" },
                  { name: "monday.com", score: 7.1, position: "#4" },
                ].map((comp) => (
                  <motion.div
                    key={comp.name}
                    variants={itemVariants}
                    className="glass-surface rounded-md p-4"
                    style={{ borderTop: "2px solid hsl(176 56% 55%)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-accent font-semibold">{comp.position}</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <p className="font-mono text-sm text-foreground mb-1">{comp.name}</p>
                    <p className="font-mono text-3xl font-bold text-success tabular-nums" style={{ letterSpacing: 0 }}>
                      {comp.score.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">/10 overall</p>
                  </motion.div>
                ))
              )}
            </div>

            <motion.div
              variants={itemVariants}
              className="mt-4 glass-surface rounded-md p-4 border-l-2 border-primary"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-primary font-semibold">
                  #{hasRealData && apiResult?.competitors ? apiResult.competitors.length + 1 : "5"}
                </span>
                <span className="font-mono text-sm text-foreground">{domain}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/15 text-primary font-semibold">You</span>
                <span className="ml-auto font-mono text-3xl font-bold text-primary tabular-nums" style={{ letterSpacing: 0 }}>
                  {score.toFixed(1)}
                </span>
                <span className="text-muted-foreground font-mono text-sm">/10</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ReportScreen;
