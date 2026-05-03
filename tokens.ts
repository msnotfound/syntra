// packages/ui/tokens.ts
// SOURCE OF TRUTH for all Syntra design tokens.
// Mirrors syntra_design_guide.md §3-5, §12.
// Changes here require a CCR (this is a contract surface).
//
// DO NOT hardcode hex values, Tailwind color classes, spacing literals,
// radii, or transition durations anywhere in module code. Import from here.
//
// Supervisor agent (orchestration.md §5.2 step 1f) flags any commit that
// hardcodes legacy v1 zinc tokens: zinc-9XX, #27272A, #3F3F46, #52525B.

export const colors = {
  bg: {
    base:     '#0B0E14', // app shell background
    surface:  '#151921', // cards, panels, sidebar
    surface2: '#1E2530', // borders, hairlines, hover/selected states
    surface3: '#262C36', // input fields, code blocks, deep wells
  },
  border: {
    subtle:  '#1E2530',
    default: '#262C36',
    strong:  '#3B82F6', // accent, used sparingly for active indicators
  },
  text: {
    primary:   '#FAFAFA', // headings, primary copy
    secondary: '#94A3B8', // labels, captions, tab inactive
    muted:     '#64748B', // timestamps, disclaimers, metadata
    disabled:  '#475569', // disabled controls
  },
  accent: {
    DEFAULT: '#3B82F6', // primary actions, links, focus rings, active indicators
  },
  severity: {
    critical: '#EF4444',
    high:     '#F97316',
    medium:   '#EAB308',
    low:      '#60A5FA',
    info:     '#94A3B8',
  },
} as const;

export const spacing = {
  base: 4, // 4px grid — Tailwind defaults
} as const;

export const radii = {
  sm: '4px', // chips, badges, status pills
  md: '6px', // cards, inputs, buttons
  // No radii larger than 6px allowed in operational suite.
} as const;

export const transitions = {
  // All transitions use this duration + easing. Do not introduce others.
  default: '150ms ease-out',
} as const;

export const typography = {
  fonts: {
    body: 'Inter, "Geist Sans", system-ui, sans-serif',
    // Mandatory for: IDs, timestamps, coordinates, API keys, currency
    // values, severity scores, anything tabular.
    mono: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
  },
  sizes: {
    xs:    '12px',
    sm:    '13px',
    base:  '14px',
    md:    '16px',
    lg:    '20px',
    xl:    '24px',
    '2xl': '32px',
  },
  weights: {
    regular: 400,
    medium:  500,
    semibold: 600,
  },
} as const;

export const interactions = {
  // Apply to all buttons and nav items.
  buttonPress: 'active:scale-95',
  // 2px accent outline, no offset.
  focusRing: 'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#3B82F6]',
  // Background shift only on hover. No translateY, no shadow lift.
  hoverSurface: 'hover:bg-[#1E2530]',
} as const;

export const sidebar = {
  // v2: 256px (was 224px in v1).
  width: '256px',
  widthClass: 'w-64',
} as const;

// Type exports for downstream consumers.
export type ColorToken = typeof colors;
export type SpacingToken = typeof spacing;
export type RadiiToken = typeof radii;
export type TransitionToken = typeof transitions;
export type TypographyToken = typeof typography;
