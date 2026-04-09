/** Compare / Screenshot UI hints (English) */

export type ToolbarHintContent = {
  title: string;
  description: string;
  /** What problem or friction this mode helps with */
  problem: string;
  /** What to do in the UI */
  action: string;
};

export const HINT_VIEW_SLIDER: ToolbarHintContent = {
  title: "Slider mode",
  description: "One row of screenshots with a vertical divider: your site on the left, competitor on the right.",
  problem: "Side-by-side views make it hard to align the same feature on both pages.",
  action: "Drag the handle at the top to compare layout and elements.",
};

export const HINT_VIEW: Record<"single" | "split" | "compare", ToolbarHintContent> = {
  single: {
    title: "Single mode",
    description: "Shows one selected site’s screenshot. Switch domains with the tabs above.",
    problem: "You need to focus on one landing without visual noise from other columns.",
    action: "Compare with a competitor in Original or Split.",
  },
  split: {
    title: "Original mode",
    description: "Two screenshots side by side — standard split view without emphasizing per-zone score gaps.",
    problem: "You want a clean A/B style view without gap coloring.",
    action: "Pick a competitor in the “vs” dropdown.",
  },
  compare: {
    title: "Split mode",
    description: "Same screenshots with per-section score gaps highlighted (who leads where).",
    problem: "You need to see where you win or lose per section at a glance.",
    action: "Turn on zones and the lens you need to focus on weak spots.",
  },
};

export const HINT_ANALYZE: Record<string, ToolbarHintContent> = {
  attention: {
    title: "Heatmap (saliency)",
    description: "Overlays a simplified map of where the eye typically goes on the page.",
    problem: "Important actions (e.g. CTA) may sit outside the natural gaze path.",
    action: "Check that the hero and CTA sit in the highest-attention area.",
  },
  heatmap: {
    title: "Gap heat",
    description: "Highlights sections with the largest score gap between you and the competitor.",
    problem: "It’s unclear which sections hurt your score the most versus them.",
    action: "Start with the darkest bands — that’s where you trail most.",
  },
  copy: {
    title: "Copy",
    description: "Highlights text blocks so you can judge readability and headlines.",
    problem: "Messaging may be weaker or harder to scan than the competitor’s.",
    action: "Compare wording with the competitor in Original or Split.",
  },
  conversion: {
    title: "Conversion",
    description: "Scores zones that drive clicks and actions (CTAs, forms, trust).",
    problem: "Conversion blockers (CTA, forms, trust) are scattered across the page.",
    action: "Use pins and the right panel for concrete next steps.",
  },
  mobile: {
    title: "Mobile frame",
    description: "A mobile-width frame around the shot for mobile UX review.",
    problem: "Desktop screenshots hide cramped tap targets and small type on phones.",
    action: "Check tap targets and readability in the narrow column.",
  },
  first5s: {
    title: "First 5 seconds",
    description: "Use this mode to focus review on what appears above the fold (no darkening overlay).",
    problem: "Visitors may leave before they understand your value proposition.",
    action: "Make sure the value prop is clear without scrolling.",
  },
  trust: {
    title: "Trust",
    description: "Highlights zones with logos, testimonials, and guarantees.",
    problem: "Users may not see enough credibility near key decisions.",
    action: "Add social proof where it’s missing.",
  },
  readability: {
    title: "Readability",
    description: "Highlights main body copy blocks to judge hierarchy.",
    problem: "Dense or flat copy makes scanning and comprehension harder.",
    action: "Tighten sentences and subheads for scanning.",
  },
};

export const HINT_LENS: Record<string, ToolbarHintContent> = {
  delta: {
    title: "Δ vs you",
    description: "Shows per-section score deltas vs your site (on the competitor screenshot).",
    problem: "You need to see exactly where the competitor pulls ahead on their page.",
    action: "Available on the competitor shot; compare with your tab.",
  },
};

export const HINT_CONTROLS = {
  pins: {
    title: "Pins on screenshot",
    description: "Per-section markers: click to open a short analysis next to the shot.",
    problem: "Section-level insight is buried in the side panel until you open a pin.",
    action: "Click “More” on a pin to open details in the right panel.",
  },
  zones: {
    title: "Page zones",
    description: "Colored bands for Hero, Value Prop, Features, etc. — section boundaries for review.",
    problem: "Without bands it’s unclear which part of the page each score refers to.",
    action: "Pair with Hot lens or Split mode for problem context.",
  },
  rightPanelToggle: {
    title: "Analysis panel",
    description: "Hide or show the right analysis column.",
    problem: "The panel uses horizontal space when you only need the screenshots.",
    action: "Use the chevron in the panel header (left of the tabs), or Wide layout in the toolbar.",
  },
  wide: {
    title: "Wide layout",
    description: "Hides the right action panel so screenshots use the full width. Turn off to show the panel again.",
    problem: "Narrow columns hide small UI details on large monitors.",
    action: "Useful for fine detail on large displays.",
  },
  aiTips: {
    title: "AI Tips",
    description: "Shows AI tip pills on screenshots in Split / Compare — per-section suggestions on each shot.",
    problem: "Insights stay in the side panel until you turn on labels on the screenshots.",
    action: "Toggle for all columns at once; works in Split or Compare view.",
  },
  zoomOut: {
    title: "Zoom out",
    description: "Shows more of the page in the viewport.",
    problem: "Zoomed in, you lose context of sections above or below.",
    action: "Scroll to see the full height.",
  },
  zoomIn: {
    title: "Zoom in",
    description: "Magnifies the shot for small text and UI elements.",
    problem: "Small type and controls are hard to read at 100% scale.",
    action: "After zooming, scroll inside the screenshot frame.",
  },
  prevSite: {
    title: "Previous site",
    description: "Switches to the previous tab in the compare list.",
    problem: "You need to cycle competitors without using the mouse on each tab.",
    action: "Use repeatedly to review each domain in order.",
  },
  nextSite: {
    title: "Next site",
    description: "Switches to the next tab in the compare list.",
    problem: "You need to move forward through the competitor list quickly.",
    action: "Use repeatedly to review each domain in order.",
  },
  moreMenu: {
    title: "More modes",
    description: "Slider, Trust, Read, and other analysis options.",
    problem: "Primary toolbar doesn’t fit every analysis mode on small screens.",
    action: "Slider — drag the divider between the two screenshots.",
  },
  vsSelect: {
    title: "Competitor to compare",
    description: "Which domain to show next to yours in Original / Split / Slider.",
    problem: "The wrong competitor makes the comparison misleading for your niche.",
    action: "Pick the most relevant competitor for your niche.",
  },
  slider: {
    title: "Comparison slider",
    description: "Moves the vertical divider between your screenshot and the competitor’s.",
    problem: "You want to compare the same vertical slice on both pages.",
    action: "Quickly compare the left vs right half of the layout.",
  },
  sparklesRow: {
    title: "Sections & scores",
    description: "Quick chips: section score for the current site; click centers the zone on the shot.",
    problem: "Jumping to a weak section on the tall screenshot takes too long.",
    action: "Hover a chip — tooltip shows gap vs competitor and priority.",
  },
} as const satisfies Record<string, ToolbarHintContent>;

export function hintSiteTab(isUser: boolean, domain: string, delta: number | null | undefined): ToolbarHintContent {
  if (isUser) {
    return {
      title: "Your site",
      description: `Current screenshot and analysis for ${domain}.`,
      problem: "You need to confirm you’re editing the correct property before comparing.",
      action: "Switch to a competitor to see their shot and comparison.",
    };
  }
  if (delta == null) {
    return {
      title: domain,
      description: "This competitor’s screenshot and section scores.",
      problem: "You need a baseline read of this competitor before diving into gaps.",
      action: "Use Heatmap, zones, and pins to compare against your tab.",
    };
  }
  if (delta > 0) {
    return {
      title: domain,
      description: `Overall score is ${delta.toFixed(1)} points higher than yours in this report.`,
      problem: "They may still win key sections — overall score hides local weaknesses.",
      action: "Open Compare and the right panel — find ideas to borrow.",
    };
  }
  if (delta < 0) {
    return {
      title: domain,
      description: `Overall score is ${Math.abs(delta).toFixed(1)} points lower than yours.`,
      problem: "They might still beat you on specific hero or CTA moments.",
      action: "Check whether they still win individual sections (chips and Hot).",
    };
  }
  return {
    title: domain,
    description: "Overall score matches yours within rounding.",
    problem: "Tie scores still differ section by section — check zones and pins.",
    action: "Use Split mode and gap overlays to find decisive sections.",
  };
}

/** Shown by default at the top of the right Compare panel: balanced “where to look” + next steps. */
export const COMPARE_DEFAULT_PANEL_GUIDE = {
  title: "Where to look & what to try",
  lead: "Comparison is about clarity: see where you lead, where the page can tighten, and what to test next — not a verdict that “they always win.”",
  pairs: [
    {
      focus: "You want to see attention flow — does the hero and CTA get fair eye share on both sides?",
      nextStep: "Heatmap, First 5s, and pins on Hero / CTA. Compare both screenshots: strengths show up as clearly as gaps.",
    },
    {
      focus: "You want a fair map of who leads which section — wins and gaps in one view.",
      nextStep: "Split or Compare, Gap heat, zones, and HOT. Green/red bands show both “we’re stronger here” and “tighten here” — use both.",
    },
    {
      focus: "You want story, trust, and readability side by side — to borrow ideas and double down on what already works.",
      nextStep: "Copy, Trust, or Readability overlays; Simulate for priorities and impact; Insight for detail and competitor angles. Steal patterns; keep what already scores well.",
    },
    {
      focus: "Scores look decent but outcomes still feel soft — you want concrete levers, not blame.",
      nextStep: "Conversion overlay, pins on forms and CTAs, then Simulate for impact and action steps. Tie metrics to specific blocks you can change.",
    },
  ],
} as const;
