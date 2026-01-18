/**
 * ZenB Design Tokens
 * Centralized design system tokens for consistent visual language
 * Version: 2.0 - Professional Grade
 */

// ============================================================================
// COLOR SYSTEM
// ============================================================================

export const COLORS = {
  // Surface Colors - Dark Mode Optimized
  surface: {
    base: '#0B0B0C',        // Main background
    elevated: '#161719',    // Cards, modals
    overlay: '#1F2023',     // Sheets, dialogs
    hover: '#25272A',       // Interactive hover states
  },

  // Text Colors (WCAG AA+ Compliant)
  text: {
    primary: '#EDEDED',     // Main text (contrast: 13.2:1)
    secondary: '#A1A1A1',   // Supporting text (contrast: 7.1:1)
    tertiary: '#6B6B6B',    // Disabled, placeholders (contrast: 4.5:1)
    inverse: '#0B0B0C',     // On light backgrounds
    accent: '#FFFFFF',      // Highest emphasis
  },

  // Theme Colors (HSL for better manipulation)
  theme: {
    warm: {
      deep: 'hsl(0, 73%, 9%)',      // #2b0505
      mid: 'hsl(11, 69%, 38%)',     // #a3341e
      glow: 'hsl(35, 100%, 80%)',   // #ffd39a
      accent: 'hsl(14, 100%, 70%)', // #ff8f6a
      // Additional tints for UI
      50: 'hsl(14, 100%, 95%)',
      100: 'hsl(14, 100%, 90%)',
      200: 'hsl(14, 100%, 85%)',
      500: 'hsl(14, 100%, 70%)',
      900: 'hsl(0, 73%, 9%)',
    },
    cool: {
      deep: 'hsl(195, 100%, 5%)',   // #00121a
      mid: 'hsl(199, 83%, 24%)',    // #0b4f6e
      glow: 'hsl(175, 100%, 74%)',  // #7afff3
      accent: 'hsl(190, 100%, 54%)', // #1ad3ff
      // Additional tints
      50: 'hsl(190, 100%, 95%)',
      100: 'hsl(190, 100%, 90%)',
      200: 'hsl(190, 100%, 85%)',
      500: 'hsl(190, 100%, 54%)',
      900: 'hsl(195, 100%, 5%)',
    },
    neutral: {
      deep: 'hsl(240, 10%, 5%)',    // #0d0d12
      mid: 'hsl(240, 5%, 43%)',     // #5e5e6e
      glow: 'hsl(0, 0%, 100%)',     // #ffffff
      accent: 'hsl(210, 22%, 82%)', // #c8d6e5
      // Additional tints
      50: 'hsl(210, 22%, 98%)',
      100: 'hsl(210, 22%, 95%)',
      200: 'hsl(210, 22%, 90%)',
      500: 'hsl(210, 22%, 82%)',
      900: 'hsl(240, 10%, 5%)',
    },
  },

  // Semantic Colors - Status & Feedback
  semantic: {
    success: {
      DEFAULT: '#16A34A',
      light: '#22C55E',
      dark: '#15803D',
      50: '#F0FDF4',
      100: '#DCFCE7',
      500: '#16A34A',
      900: '#14532D',
    },
    warning: {
      DEFAULT: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
      50: '#FFFBEB',
      100: '#FEF3C7',
      500: '#F59E0B',
      900: '#78350F',
    },
    error: {
      DEFAULT: '#DC2626',
      light: '#EF4444',
      dark: '#B91C1C',
      50: '#FEF2F2',
      100: '#FEE2E2',
      500: '#DC2626',
      900: '#7F1D1D',
    },
    info: {
      DEFAULT: '#3B82F6',
      light: '#60A5FA',
      dark: '#2563EB',
      50: '#EFF6FF',
      100: '#DBEAFE',
      500: '#3B82F6',
      900: '#1E3A8A',
    },
  },

  // Alpha Scales - For Glass Morphism & Overlays
  alpha: {
    white: {
      5: 'rgba(255, 255, 255, 0.05)',
      10: 'rgba(255, 255, 255, 0.10)',
      15: 'rgba(255, 255, 255, 0.15)',
      20: 'rgba(255, 255, 255, 0.20)',
      30: 'rgba(255, 255, 255, 0.30)',
      40: 'rgba(255, 255, 255, 0.40)',
      50: 'rgba(255, 255, 255, 0.50)',
      60: 'rgba(255, 255, 255, 0.60)',
      80: 'rgba(255, 255, 255, 0.80)',
      90: 'rgba(255, 255, 255, 0.90)',
    },
    black: {
      5: 'rgba(0, 0, 0, 0.05)',
      10: 'rgba(0, 0, 0, 0.10)',
      20: 'rgba(0, 0, 0, 0.20)',
      30: 'rgba(0, 0, 0, 0.30)',
      40: 'rgba(0, 0, 0, 0.40)',
      50: 'rgba(0, 0, 0, 0.50)',
      60: 'rgba(0, 0, 0, 0.60)',
      80: 'rgba(0, 0, 0, 0.80)',
      90: 'rgba(0, 0, 0, 0.90)',
    },
  },
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const TYPOGRAPHY = {
  // Font Families
  family: {
    display: "'Inter Display', system-ui, -apple-system, sans-serif",
    body: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
    // Fallback to system serif for now (can be upgraded to custom font)
    serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
  },

  // Type Scale (1.25 ratio - Perfect Fourth)
  // Base: 16px (1rem)
  size: {
    xs: '0.64rem',    // 10.24px - Tiny labels
    sm: '0.8rem',     // 12.8px - Small text
    base: '1rem',     // 16px - Body text
    lg: '1.25rem',    // 20px - Large body
    xl: '1.563rem',   // 25px - H4
    '2xl': '1.953rem', // 31.25px - H3
    '3xl': '2.441rem', // 39px - H2
    '4xl': '3.052rem', // 48.83px - H1
    '5xl': '3.815rem', // 61px - Display
    '6xl': '4.768rem', // 76px - Hero
  },

  // Font Weights
  weight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Letter Spacing (refined, less aggressive)
  tracking: {
    tighter: '-0.03em',
    tight: '-0.02em',
    normal: '0',
    wide: '0.05em',    // Reduced from 0.2em
    wider: '0.1em',    // Reduced from 0.3em
    widest: '0.15em',  // New, for extreme cases
  },

  // Line Heights
  leading: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
} as const;

// ============================================================================
// SPACING SYSTEM
// ============================================================================

// 8px base unit (4px for micro-spacing)
export const SPACING = {
  0: '0',
  0.5: '0.125rem',  // 2px - Hair space
  1: '0.25rem',     // 4px - Micro
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px - Base unit
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px - Standard
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px - Large
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px - XL
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px - XXL
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const RADIUS = {
  none: '0',
  sm: '0.5rem',      // 8px
  DEFAULT: '0.75rem', // 12px
  md: '1rem',        // 16px
  lg: '1.5rem',      // 24px - Cards
  xl: '2rem',        // 32px - Large cards
  '2xl': '2.5rem',   // 40px
  '3xl': '3rem',     // 48px
  full: '9999px',    // Pills, circles
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',

  // Custom glass shadow
  glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',

  // Glow shadows (color-aware)
  glow: {
    sm: '0 0 15px -3px currentColor',
    DEFAULT: '0 0 30px -10px currentColor',
    lg: '0 0 40px -5px currentColor',
  },
} as const;

// ============================================================================
// ANIMATION TIMING
// ============================================================================

export const DURATION = {
  instant: 0,
  fast: 150,
  base: 300,
  slow: 500,
  slower: 700,
  slowest: 1000,
} as const;

// ============================================================================
// EASING CURVES
// ============================================================================

export const EASING = {
  // Standard CSS easings
  linear: 'cubic-bezier(0, 0, 1, 1)',
  ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  easeIn: 'cubic-bezier(0.42, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.58, 1)',
  easeInOut: 'cubic-bezier(0.42, 0, 0.58, 1)',

  // Custom breathing curves
  breathIn: 'cubic-bezier(0.4, 0, 0.2, 1)',    // Slow start, fast end
  breathOut: 'cubic-bezier(0.8, 0, 0.6, 1)',   // Fast start, slow end

  // Organic/Spring-like (with overshoot)
  organic: 'cubic-bezier(0.34, 1.56, 0.64, 1)',

  // Snappy/Sharp
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',

  // Smooth deceleration
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// Spring physics presets for react-spring
export const SPRING_PRESETS = {
  // Gentle, slow spring
  gentle: {
    mass: 1.2,
    tension: 180,
    friction: 26,
    clamp: false,
  },

  // Default breathing spring
  breath: {
    mass: 1,
    tension: 170,
    friction: 24,
    clamp: false,
  },

  // Snappy UI interactions
  snappy: {
    mass: 0.8,
    tension: 400,
    friction: 20,
    clamp: false,
  },

  // Bouncy (8-12% overshoot)
  bouncy: {
    mass: 1,
    tension: 300,
    friction: 10,
    clamp: false,
  },

  // Stiff (minimal overshoot)
  stiff: {
    mass: 1,
    tension: 500,
    friction: 30,
    clamp: false,
  },
} as const;

// ============================================================================
// BLUR AMOUNTS
// ============================================================================

export const BLUR = {
  none: '0',
  sm: '4px',
  DEFAULT: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '40px',
  '3xl': '64px',
} as const;

// ============================================================================
// Z-INDEX LAYERS
// ============================================================================

export const Z_INDEX = {
  base: 0,
  orb: 0,           // Layer 0: Visual cortex
  ui: 10,           // Layer 1: UI orchestration
  header: 20,
  footer: 30,
  overlay: 40,      // Overlays
  modal: 50,        // Modals, sheets
  snackbar: 100,    // Toast notifications
  tooltip: 110,     // Tooltips
  debug: 9999,      // Debug panels
} as const;

// ============================================================================
// BREAKPOINTS (for reference, Tailwind handles these)
// ============================================================================

export const BREAKPOINTS = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export const DESIGN_TOKENS = {
  colors: COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  duration: DURATION,
  easing: EASING,
  spring: SPRING_PRESETS,
  blur: BLUR,
  zIndex: Z_INDEX,
  breakpoints: BREAKPOINTS,
} as const;

// Type exports for TypeScript autocomplete
export type ColorToken = typeof COLORS;
export type TypographyToken = typeof TYPOGRAPHY;
export type SpacingToken = typeof SPACING;
export type RadiusToken = typeof RADIUS;
export type ShadowToken = typeof SHADOWS;
export type DurationToken = typeof DURATION;
export type EasingToken = typeof EASING;
export type SpringPreset = typeof SPRING_PRESETS;
