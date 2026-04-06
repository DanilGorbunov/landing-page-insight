/** Compare / Screenshot UI hints (English) */

export const HINT_VIEW_SLIDER = {
  title: "Slider mode",
  description: "One row of screenshots with a vertical divider: your site on the left, competitor on the right.",
  action: "Drag the handle at the top to compare layout and elements.",
} as const;

export const HINT_VIEW = {
  single: {
    title: "Single mode",
    description: "Shows one selected site’s screenshot. Switch domains with the tabs above.",
    action: "Compare with a competitor in Original or Split.",
  },
  split: {
    title: "Original mode",
    description: "Two screenshots side by side — standard split view without emphasizing per-zone score gaps.",
    action: "Pick a competitor in the “vs” dropdown.",
  },
  compare: {
    title: "Split mode",
    description: "Same screenshots with per-section score gaps highlighted (who leads where).",
    action: "Turn on zones and the lens you need to focus on weak spots.",
  },
} as const;

export const HINT_ANALYZE: Record<
  string,
  { title: string; description: string; action: string }
> = {
  attention: {
    title: "Attention (saliency)",
    description: "Overlays a simplified map of where the eye typically goes on the page.",
    action: "Check that the hero and CTA sit in the highest-attention area.",
  },
  heatmap: {
    title: "Gap heat",
    description: "Highlights sections with the largest score gap between you and the competitor.",
    action: "Start with the darkest bands — that’s where you trail most.",
  },
  copy: {
    title: "Copy",
    description: "Highlights text blocks so you can judge readability and headlines.",
    action: "Compare wording with the competitor in Original or Split.",
  },
  conversion: {
    title: "Conversion",
    description: "Scores zones that drive clicks and actions (CTAs, forms, trust).",
    action: "Use pins and the right panel for concrete next steps.",
  },
  mobile: {
    title: "Mobile frame",
    description: "A mobile-width frame around the shot for mobile UX review.",
    action: "Check tap targets and readability in the narrow column.",
  },
  first5s: {
    title: "First 5 seconds",
    description: "Dims everything below the fold to simulate first impression.",
    action: "Make sure the value prop is clear without scrolling.",
  },
  trust: {
    title: "Trust",
    description: "Highlights zones with logos, testimonials, and guarantees.",
    action: "Add social proof where it’s missing.",
  },
  readability: {
    title: "Readability",
    description: "Highlights main body copy blocks to judge hierarchy.",
    action: "Tighten sentences and subheads for scanning.",
  },
};

export const HINT_LENS: Record<string, { title: string; description: string; action: string }> = {
  hot: {
    title: "Hot zones",
    description: "Highlights sections scoring below 7 — likely weak spots.",
    action: "Open a pin or the right panel for priority fixes.",
  },
  delta: {
    title: "Δ vs you",
    description: "Shows per-section score deltas vs your site (on the competitor screenshot).",
    action: "Available on the competitor shot; compare with your tab.",
  },
};

export const HINT_CONTROLS = {
  pins: {
    title: "Pins on screenshot",
    description: "Per-section markers: click to open a short analysis next to the shot.",
    action: "Click “More” on a pin to open details in the right panel.",
  },
  zones: {
    title: "Page zones",
    description: "Colored bands for Hero, Value Prop, Features, etc. — section boundaries for review.",
    action: "Pair with Hot lens or Split mode for problem context.",
  },
  wide: {
    title: "Wide layout",
    description: "Stretches the screenshot column full width; the action panel may move below.",
    action: "Useful for fine detail on large displays.",
  },
  zoomOut: {
    title: "Zoom out",
    description: "Shows more of the page in the viewport.",
    action: "Scroll to see the full height.",
  },
  zoomIn: {
    title: "Zoom in",
    description: "Magnifies the shot for small text and UI elements.",
    action: "After zooming, scroll inside the screenshot frame.",
  },
  prevSite: {
    title: "Previous site",
    description: "Switches to the previous tab in the compare list.",
  },
  nextSite: {
    title: "Next site",
    description: "Switches to the next tab in the compare list.",
  },
  moreMenu: {
    title: "More modes",
    description: "Slider, Trust, Read, and other analysis options.",
    action: "Slider — drag the divider between the two screenshots.",
  },
  vsSelect: {
    title: "Competitor to compare",
    description: "Which domain to show next to yours in Original / Split / Slider.",
    action: "Pick the most relevant competitor for your niche.",
  },
  slider: {
    title: "Comparison slider",
    description: "Moves the vertical divider between your screenshot and the competitor’s.",
    action: "Quickly compare the left vs right half of the layout.",
  },
  sparklesRow: {
    title: "Sections & scores",
    description: "Quick chips: section score for the current site; click centers the zone on the shot.",
    action: "Hover a chip — tooltip shows gap vs competitor and priority.",
  },
} as const;

export function hintSiteTab(isUser: boolean, domain: string, delta: number | null | undefined): {
  title: string;
  description: string;
  action?: string;
} {
  if (isUser) {
    return {
      title: "Your site",
      description: `Current screenshot and analysis for ${domain}.`,
      action: "Switch to a competitor to see their shot and comparison.",
    };
  }
  if (delta == null) {
    return {
      title: domain,
      description: "This competitor’s screenshot and section scores.",
    };
  }
  if (delta > 0) {
    return {
      title: domain,
      description: `Overall score is ${delta.toFixed(1)} points higher than yours in this report.`,
      action: "Open Compare and the right panel — find ideas to borrow.",
    };
  }
  if (delta < 0) {
    return {
      title: domain,
      description: `Overall score is ${Math.abs(delta).toFixed(1)} points lower than yours.`,
      action: "Check whether they still win individual sections (chips and Hot).",
    };
  }
  return {
    title: domain,
    description: "Overall score matches yours within rounding.",
  };
}
