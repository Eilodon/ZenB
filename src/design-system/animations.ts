/**
 * ZenB Unified Animation Library
 * Centralized animation presets for consistent motion design
 * Compatible with Framer Motion and React Spring
 */

import { Variants, Transition } from 'framer-motion';
import { DURATION, EASING, SPRING_PRESETS } from './tokens';

// ============================================================================
// FRAMER MOTION VARIANTS
// ============================================================================

/**
 * Entrance/Exit Animations
 */
export const FADE_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const SLIDE_UP_VARIANTS: Variants = {
  initial: { y: 40, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 40, opacity: 0 },
};

export const SLIDE_DOWN_VARIANTS: Variants = {
  initial: { y: -40, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -40, opacity: 0 },
};

export const SLIDE_LEFT_VARIANTS: Variants = {
  initial: { x: 40, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

export const SLIDE_RIGHT_VARIANTS: Variants = {
  initial: { x: -40, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 40, opacity: 0 },
};

export const SCALE_VARIANTS: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 },
};

export const SCALE_BOUNCE_VARIANTS: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 10,
      stiffness: 300,
    }
  },
  exit: { scale: 0.8, opacity: 0 },
};

/**
 * Bottom Sheet / Modal Animations
 */
export const BOTTOM_SHEET_VARIANTS: Variants = {
  initial: { y: '100%', opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
      duration: 0.4,
    }
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: {
      duration: 0.3,
    }
  },
};

export const BACKDROP_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.25, ease: [0, 0, 0.58, 1] }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: [0.42, 0, 1, 1] }
  },
};

/**
 * Card Animations
 */
export const CARD_HOVER_VARIANTS: Variants = {
  rest: {
    scale: 1,
    y: 0,
  },
  hover: {
    scale: 1.02,
    y: -2,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    }
  },
  tap: {
    scale: 0.98,
  },
};

/**
 * Snackbar / Toast Animations
 */
export const SNACKBAR_VARIANTS: Variants = {
  initial: {
    y: 40,
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 400,
    }
  },
  exit: {
    y: 20,
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
    }
  },
};

// ============================================================================
// TRANSITION PRESETS
// ============================================================================

export const TRANSITIONS: Record<string, Transition> = {
  // Standard transitions
  fast: {
    duration: DURATION.fast / 1000, // Convert to seconds
    ease: [0.25, 0.1, 0.25, 1],
  },

  base: {
    duration: DURATION.base / 1000,
    ease: [0.25, 0.1, 0.25, 1],
  },

  slow: {
    duration: DURATION.slow / 1000,
    ease: [0.25, 0.1, 0.25, 1],
  },

  slower: {
    duration: DURATION.slower / 1000,
    ease: [0.25, 0.1, 0.25, 1],
  },

  // Spring transitions
  springGentle: {
    type: 'spring',
    ...SPRING_PRESETS.gentle,
  },

  springBreath: {
    type: 'spring',
    ...SPRING_PRESETS.breath,
  },

  springSnappy: {
    type: 'spring',
    ...SPRING_PRESETS.snappy,
  },

  springBouncy: {
    type: 'spring',
    ...SPRING_PRESETS.bouncy,
  },

  // Breathing-specific
  breathIn: {
    duration: 0.4,
    ease: [0.4, 0, 0.2, 1], // Slow start, fast end
  },

  breathOut: {
    duration: 0.4,
    ease: [0.8, 0, 0.6, 1], // Fast start, slow end
  },
};

// ============================================================================
// GESTURE ANIMATIONS (whileHover, whileTap, etc.)
// ============================================================================

export const GESTURES = {
  // Button press
  buttonPress: {
    whileTap: { scale: 0.97 },
    transition: { duration: 0.1 },
  },

  // Subtle lift on hover
  hoverLift: {
    whileHover: {
      y: -2,
      transition: { duration: 0.2 },
    },
  },

  // Scale on hover
  hoverScale: {
    whileHover: {
      scale: 1.05,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 15,
      },
    },
  },

  // Glow on hover (via boxShadow)
  hoverGlow: {
    whileHover: {
      boxShadow: '0 0 30px -10px currentColor',
      transition: { duration: 0.3 },
    },
  },
};

// ============================================================================
// BREATHING ANIMATION VARIANTS
// ============================================================================

/**
 * Breathing pulse animation (for idle states)
 */
export const BREATH_PULSE_VARIANTS: Variants = {
  breathe: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 4,
      ease: [0.4, 0, 0.2, 1],
      repeat: Infinity,
    },
  },
};

/**
 * Phase-specific variants
 */
export const PHASE_VARIANTS = {
  inhale: (progress: number) => ({
    scale: 1 + (progress * 0.08),
  }),
  holdIn: {
    scale: 1.08,
  },
  exhale: (progress: number) => ({
    scale: 1.08 - (progress * 0.08),
  }),
  holdOut: {
    scale: 1,
  },
};

// ============================================================================
// LOADING ANIMATIONS
// ============================================================================

export const SHIMMER_VARIANTS: Variants = {
  animate: {
    backgroundPosition: ['200% 0', '-200% 0'],
    transition: {
      duration: 2,
      ease: 'linear',
      repeat: Infinity,
    },
  },
};

export const PULSE_VARIANTS: Variants = {
  animate: {
    opacity: [0.4, 1, 0.4],
    transition: {
      duration: 1.5,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  },
};

export const SPINNER_VARIANTS: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      ease: 'linear',
      repeat: Infinity,
    },
  },
};

// ============================================================================
// STAGGER ANIMATIONS
// ============================================================================

export const STAGGER_CONTAINER_VARIANTS: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const STAGGER_ITEM_VARIANTS: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

// ============================================================================
// MICRO-INTERACTION UTILITIES
// ============================================================================

/**
 * Success checkmark animation
 */
export const SUCCESS_CHECKMARK_VARIANTS: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        type: 'spring',
        duration: 0.6,
        bounce: 0,
      },
      opacity: { duration: 0.2 },
    },
  },
};

/**
 * Error shake animation
 */
export const ERROR_SHAKE_VARIANTS: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.4,
    },
  },
};

/**
 * Notification badge pulse
 */
export const BADGE_PULSE_VARIANTS: Variants = {
  pulse: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 0.6,
      repeat: 3,
    },
  },
};

// ============================================================================
// REACT-SPRING PRESETS (for 3D animations)
// ============================================================================

/**
 * Material property spring config (for Orb)
 */
export const ORB_MATERIAL_SPRING = {
  mass: 1.2,
  tension: 180,
  friction: 26,
  clamp: false, // Allow 8-12% overshoot for organic feel
};

/**
 * Scale spring config (for breathing)
 */
export const BREATH_SCALE_SPRING = {
  mass: 1,
  tension: 170,
  friction: 24,
  clamp: false,
};

/**
 * UI interaction spring (snappy)
 */
export const UI_SPRING = {
  mass: 0.8,
  tension: 400,
  friction: 20,
  clamp: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a custom stagger animation
 */
export function createStagger(
  staggerDelay: number = 0.1,
  childDelay: number = 0
): Variants {
  return {
    initial: {},
    animate: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: childDelay,
      },
    },
  };
}

/**
 * Create a custom breathing animation based on phase and duration
 */
export function createBreathAnimation(
  phaseDuration: number,
  targetScale: number = 1.08
) {
  return {
    scale: [1, targetScale, 1],
    transition: {
      duration: phaseDuration,
      ease: [0.4, 0, 0.2, 1],
      repeat: Infinity,
    },
  };
}

/**
 * Create a glow pulse animation with custom color
 */
export function createGlowPulse(color: string, duration: number = 2) {
  return {
    boxShadow: [
      `0 0 20px -10px ${color}`,
      `0 0 40px -5px ${color}`,
      `0 0 20px -10px ${color}`,
    ],
    transition: {
      duration,
      ease: 'easeInOut',
      repeat: Infinity,
    },
  };
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const ANIMATIONS = {
  variants: {
    fade: FADE_VARIANTS,
    slideUp: SLIDE_UP_VARIANTS,
    slideDown: SLIDE_DOWN_VARIANTS,
    slideLeft: SLIDE_LEFT_VARIANTS,
    slideRight: SLIDE_RIGHT_VARIANTS,
    scale: SCALE_VARIANTS,
    scaleBounce: SCALE_BOUNCE_VARIANTS,
    bottomSheet: BOTTOM_SHEET_VARIANTS,
    backdrop: BACKDROP_VARIANTS,
    cardHover: CARD_HOVER_VARIANTS,
    snackbar: SNACKBAR_VARIANTS,
    breathPulse: BREATH_PULSE_VARIANTS,
    phase: PHASE_VARIANTS,
    shimmer: SHIMMER_VARIANTS,
    pulse: PULSE_VARIANTS,
    spinner: SPINNER_VARIANTS,
    staggerContainer: STAGGER_CONTAINER_VARIANTS,
    staggerItem: STAGGER_ITEM_VARIANTS,
    successCheckmark: SUCCESS_CHECKMARK_VARIANTS,
    errorShake: ERROR_SHAKE_VARIANTS,
    badgePulse: BADGE_PULSE_VARIANTS,
  },
  transitions: TRANSITIONS,
  gestures: GESTURES,
  spring: {
    orbMaterial: ORB_MATERIAL_SPRING,
    breathScale: BREATH_SCALE_SPRING,
    ui: UI_SPRING,
  },
  utils: {
    createStagger,
    createBreathAnimation,
    createGlowPulse,
  },
} as const;

// Type exports
export type AnimationVariants = typeof ANIMATIONS.variants;
export type AnimationTransitions = typeof TRANSITIONS;
export type AnimationGestures = typeof GESTURES;
