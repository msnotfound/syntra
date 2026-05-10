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
    hover:   '#60A5FA',
    muted:   '#1E3A8A',
  },
  severity: {
    critical: '#EF4444',
    high:     '#F97316',
    medium:   '#EAB308',
    low:      '#60A5FA',
    info:     '#94A3B8',
  },
  state: {
    success: '#22C55E',
    warning: '#F59E0B',
    error:   '#EF4444',
  },
  map: {
    bg:           '#0A0A0A',
    water:        '#151921',
    land:         '#1E2530',
    border:       '#262C36',
    watchlistPin: '#3B82F6',
    eventGlow:    'rgba(239, 68, 68, 0.4)',
  },
} as const;

export const spacing = {
  base: 4, // 4px grid — Tailwind defaults
  px: {
    0:  '0px',
    1:  '4px',
    2:  '8px',
    3:  '12px',
    4:  '16px',
    5:  '20px',
    6:  '24px',
    7:  '28px',
    8:  '32px',
    9:  '36px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
} as const;

export const radii = {
  sm: '4px', // chips, badges, status pills
  md: '6px', // cards, inputs, buttons
  // No radii larger than 6px allowed in operational suite.
} as const;

export const transitions = {
  instant:    '0ms',
  quick:      '150ms ease-out',
  poised:     '250ms cubic-bezier(0.16, 1, 0.3, 1)',
  considered: '400ms cubic-bezier(0.16, 1, 0.3, 1)',
  default:    '150ms ease-out',
} as const;

export const elevation = {
  0: {
    bg: colors.bg.base,
    border: 'transparent',
    className: 'bg-bg-base border-transparent',
  },
  1: {
    bg: colors.bg.surface,
    border: colors.border.subtle,
    className: 'bg-bg-surface border border-border-subtle',
  },
  2: {
    bg: colors.bg.surface2,
    border: colors.border.default,
    className: 'bg-bg-surface-2 border border-border-default',
  },
  3: {
    bg: colors.bg.surface3,
    border: colors.border.strong,
    className: 'bg-bg-surface-3 border border-border-strong',
  },
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
    light:    300,
    regular: 400,
    medium:  500,
    semibold: 600,
  },
} as const;

export const interactions = {
  // Apply to all buttons and nav items.
  buttonPress: 'active:scale-95',
  // 1px accent ring, 2px offset, 0.6 opacity. Keyboard-visible only.
  focusRing: 'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent/60',
  // Background shift only on hover. No translateY, no shadow lift.
  hoverSurface: 'hover:bg-bg-surface-2',
} as const;

export const focusRing = {
  width: '1px',
  color: 'rgba(59, 130, 246, 0.6)',
  offset: '2px',
  className: interactions.focusRing,
} as const;

export const sidebar = {
  width: '288px',
  widthClass: 'w-72',
} as const;

// Type exports for downstream consumers.
export type ColorToken = typeof colors;
export type SpacingToken = typeof spacing;
export type RadiiToken = typeof radii;
export type TransitionToken = typeof transitions;
export type ElevationToken = typeof elevation;
export type TypographyToken = typeof typography;
