/**
 * ZenB Design System
 * Centralized export for all design system components and tokens
 * Version: 2.0
 */

// ============================================================================
// DESIGN TOKENS
// ============================================================================

export * from './tokens';
export { DESIGN_TOKENS, COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, DURATION, EASING, SPRING_PRESETS, BLUR, Z_INDEX, BREAKPOINTS } from './tokens';
export type { ColorToken, TypographyToken, SpacingToken, RadiusToken, ShadowToken, DurationToken, EasingToken, SpringPreset } from './tokens';

// ============================================================================
// ANIMATIONS
// ============================================================================

export * from './animations';
export { ANIMATIONS } from './animations';
export type { AnimationVariants, AnimationTransitions, AnimationGestures } from './animations';

// ============================================================================
// GLASS COMPONENTS
// ============================================================================

export { GlassCard, GlassButton, GlassPanel, GlassBadge, GlassDivider, GlassInput } from './GlassCard';
export { default as Glass } from './GlassCard';

// ============================================================================
// LOADING STATES
// ============================================================================

export {
  Skeleton,
  ShimmerSkeleton,
  PatternCardSkeleton,
  LiveResultCardSkeleton,
  HistoryItemSkeleton,
  Spinner,
  PulseSpinner,
  DotsSpinner,
  ProgressBar,
  CircularProgress,
} from './LoadingStates';
export { default as Loading } from './LoadingStates';

// ============================================================================
// PRIMITIVES (Legacy - re-export for compatibility)
// ============================================================================

export { SecurityCue, LiveResultCard, KineticSnackbar, GestureBottomSheet } from './Primitives';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Create an alpha variant of a color
 */
export function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if device supports hover (not touch-only)
 */
export function supportsHover(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover)').matches;
}

/**
 * Get responsive breakpoint
 */
export function getBreakpoint(): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
  if (typeof window === 'undefined') return 'md';

  const width = window.innerWidth;
  if (width < 640) return 'xs';
  if (width < 768) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1280) return 'lg';
  if (width < 1536) return 'xl';
  return '2xl';
}

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Extract CSS variable value
 */
export function getCSSVariable(variable: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

/**
 * Set CSS variable
 */
export function setCSSVariable(variable: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(variable, value);
}

// ============================================================================
// DESIGN SYSTEM METADATA
// ============================================================================

export const DESIGN_SYSTEM_VERSION = '2.0.0';

export const DESIGN_SYSTEM_INFO = {
  version: DESIGN_SYSTEM_VERSION,
  name: 'ZenB Design System',
  description: 'Professional-grade design system for breathing meditation app',
  author: 'ZenB Team',
  license: 'Proprietary',
  components: [
    'GlassCard',
    'GlassButton',
    'GlassPanel',
    'GlassBadge',
    'GlassDivider',
    'GlassInput',
    'Skeleton',
    'Spinner',
    'ProgressBar',
    'CircularProgress',
  ],
  tokens: [
    'colors',
    'typography',
    'spacing',
    'radius',
    'shadows',
    'duration',
    'easing',
    'spring',
    'blur',
    'zIndex',
  ],
} as const;
