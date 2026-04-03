/**
 * Single source of truth for API response and payload types.
 * Re-exported by @/lib/api for convenience.
 */

export interface CriticalGap {
  priority: "P1" | "P2";
  area: string;
  problem: string;
  recommendation: string;
  competitor: string;
  confidence: "High" | "Medium" | "Low";
  title?: string;
  evidence?: string;
  competitorAction?: string;
  competitorUrl?: string;
}

export interface AnalysisResult {
  report: string;
  userAnalysis: Record<string, string>;
  competitors: Array<{
    url: string;
    analysis: Record<string, string>;
    screenshotUrl?: string | null;
  }>;
  targetScreenshotUrl?: string | null;
  synthesis?: { overall_score?: number };
  gaps?: CriticalGap[];
  siteType?: "saas" | "ecommerce" | "utility" | "marketplace" | string | null;
  bestPractices?: BestPracticeCheck[];
  journeyMap?: JourneyStage[];
  designPatterns?: DesignPattern[];
  actionPlan?: ActionPlanItem[];
  ctaTrust?: CtaTrustData | null;
  copySuggestions?: CopySuggestion[];
  competitiveEdge?: CompetitiveEdgeEntry[];
  uxHints?: UxImprovementHint[];
  uxSignals?: UxSignals | null;
  seoAudit?: SeoAuditData;
  performance?: PerformanceData;
  readability?: ReadabilityData;
  /** Set by frontend when saving to history; not returned by API. */
  jobId?: string;
}

export interface BestPracticeCheck {
  id: string;
  label: string;
  pass: boolean | null;
  impact: "High" | "Medium" | "Low";
  note?: string;
}

export interface JourneyStage {
  stage: string;
  status: "addressed" | "partial" | "missing";
  evidence?: string;
}

export interface DesignPattern {
  id: string;
  label: string;
  present: boolean;
  note?: string;
}

export interface ActionPlanItem {
  week: number;
  impact: "High" | "Medium" | "Low";
  action: string;
  rationale?: string;
}

export interface CopySuggestion {
  section: string;
  current?: string;
  suggestions: string[];
}

export interface CtaCta {
  text: string;
  position: "above_fold" | "below_fold";
  type: "primary" | "secondary" | "text_link";
}

export interface TrustSignals {
  logoBadgeCount: number;
  testimonialCount: number;
  namedTestimonials: boolean;
  caseStudyCount: number;
  securityBadges: string[];
  pressMentions: number;
  ratingScore: string | null;
}

export interface CtaTrustData {
  ctas: CtaCta[];
  frictionReducers: string[];
  stickyCta: boolean | null;
  formFieldCount: number | null;
  trustSignals: TrustSignals;
}

export interface PerformanceScores {
  performance: number | null;
  accessibility: number | null;
  seo: number | null;
  bestPractices: number | null;
}

export interface PerformanceMetrics {
  lcp: number | null;
  fcp: number | null;
  cls: number | null;
  inp: number | null;
  speedIndex: number | null;
  tbt: number | null;
}

export interface PerformanceSite {
  url: string;
  scores: PerformanceScores | null;
  metrics: PerformanceMetrics | null;
  fetchedAt?: string;
}

export interface PerformanceData {
  user: PerformanceSite | null;
  competitors: PerformanceSite[];
}

export interface ReadabilitySite {
  url: string;
  gradeLevel: number | null;
  readingEase: number | null;
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
}

export interface ReadabilityData {
  user: ReadabilitySite | null;
  competitors: ReadabilitySite[];
}

// --- SEO Audit ---

export interface SeoAuditItem {
  id: string;
  category: "Meta" | "Social" | "Structure" | "Content" | "Technical";
  label: string;
  status: "pass" | "warn" | "fail";
  value: string | null;
  hint: string | null;
}

export interface SeoAuditResult {
  items: SeoAuditItem[];
  passCount: number;
  warnCount: number;
  failCount: number;
  total: number;
}

export interface SeoAuditSite extends SeoAuditResult {
  url: string;
}

export interface SeoAuditData {
  user: SeoAuditSite | null;
  competitors: SeoAuditSite[];
}

// --- UX Signals ---

export interface UxSignals {
  visualHierarchy: "strong" | "moderate" | "weak" | null;
  contrastQuality: "good" | "needs_improvement" | "poor" | null;
  whitespaceBalance: "spacious" | "balanced" | "cramped" | null;
  aboveFoldContent: string[];
  navigationComplexity: "minimal" | "moderate" | "complex" | null;
  mobileReadiness: "optimized" | "adequate" | "poor" | null;
  ctaProminence: "dominant" | "visible" | "buried" | null;
  colorConsistency: "cohesive" | "mostly_consistent" | "inconsistent" | null;
  imageQuality: "professional" | "stock" | "low_quality" | "none" | null;
  loadingUxHints: string[];
  accessibilityFlags: string[];
}

// --- Competitive Edge ---

export interface CompetitiveAdvantage {
  element: string;
  theirApproach: string;
  yourWeakness: string;
  stealThis: string;
  effort: "Quick Win" | "Medium" | "Strategic";
}

export interface CompetitiveEdgeEntry {
  competitor: string;
  advantages: CompetitiveAdvantage[];
}

// --- UX Improvement Hints ---

export interface UxImprovementHint {
  section: string;
  score: number;
  issue: string;
  hint: string;
  effort: string;
  impact: "High" | "Medium" | "Low";
  impactReason: string;
  reference: string;
}

export interface JobProgressEntry {
  step?: string;
  message?: string;
  index?: number;
  total?: number;
  competitors?: string[];
  event?: string;
  url?: string;
  section?: string;
  score?: number | null;
  urls?: string[];
}

/** Backend keys for section scores (aligned with analysis output). */
export type LiveSectionKey =
  | "hero"
  | "value proposition"
  | "features"
  | "social proof"
  | "CTA";

export interface LiveSiteState {
  url: string;
  isUser: boolean;
  domain: string;
  screenshotReady: boolean;
  screenshotUrl: string | null;
  sectionScores: Record<LiveSectionKey, number | null>;
}

export interface LiveSynthesisState {
  started: boolean;
  ready: boolean;
  overallScore: number | null;
  gaps: CriticalGap[];
  partialReport: string | null;
}

export interface JobLiveState {
  sites: LiveSiteState[];
  synthesis: LiveSynthesisState;
}

export interface JobStatus {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: JobProgressEntry[];
  /** Progressive UI snapshot while job runs (and mirrors completed state). */
  live?: JobLiveState | null;
  result?: AnalysisResult | null;
  error?: string | null;
}
