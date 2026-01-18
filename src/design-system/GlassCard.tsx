/**
 * Enhanced Glass Morphism Card Component
 * Multi-layer glass effect with noise texture and gradient rims
 */

import React, { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import { ANIMATIONS } from './animations';

// ============================================================================
// TYPES
// ============================================================================

type GlassIntensity = 'subtle' | 'medium' | 'strong' | 'ultra';
type GlassVariant = 'default' | 'elevated' | 'overlay';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  intensity?: GlassIntensity;
  variant?: GlassVariant;
  glow?: boolean;
  glowColor?: string;
  hover?: boolean;
  padding?: boolean;
  className?: string;
}

// ============================================================================
// GLASS CARD COMPONENT
// ============================================================================

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      intensity = 'medium',
      variant = 'default',
      glow = false,
      glowColor,
      hover = false,
      padding = true,
      className,
      ...motionProps
    },
    ref
  ) => {
    // Map intensity to blur and opacity values
    const intensityMap = {
      subtle: { blur: 'backdrop-blur-sm', bg: 'bg-white/[0.03]', border: 'border-white/5' },
      medium: { blur: 'backdrop-blur-md', bg: 'bg-white/[0.05]', border: 'border-white/10' },
      strong: { blur: 'backdrop-blur-xl', bg: 'bg-white/[0.08]', border: 'border-white/15' },
      ultra: { blur: 'backdrop-blur-3xl', bg: 'bg-white/[0.12]', border: 'border-white/20' },
    };

    // Variant-specific styles
    const variantMap = {
      default: 'shadow-lg',
      elevated: 'shadow-xl shadow-black/20',
      overlay: 'shadow-2xl shadow-black/40',
    };

    const styles = intensityMap[intensity];
    const variantStyle = variantMap[variant];

    return (
      <motion.div
        ref={ref}
        className={clsx(
          'relative overflow-hidden rounded-2xl',
          className
        )}
        {...(hover ? ANIMATIONS.gestures.hoverLift : {})}
        {...motionProps}
      >
        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '128px 128px',
          }}
        />

        {/* Main glass surface */}
        <div
          className={clsx(
            'relative',
            styles.blur,
            styles.bg,
            'border',
            styles.border,
            variantStyle,
            padding && 'p-6',
          )}
        >
          {/* Top gradient rim (subtle light reflection) */}
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />

          {/* Inner glow gradient */}
          <div
            className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Optional glow effect */}
          {glow && (
            <div
              className="absolute -inset-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl blur-xl"
              style={{
                background: glowColor
                  ? `radial-gradient(circle at 50% 0%, ${glowColor}, transparent 70%)`
                  : 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.1), transparent 70%)',
              }}
              aria-hidden="true"
            />
          )}

          {/* Content */}
          <div className="relative z-10">{children}</div>
        </div>
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

// ============================================================================
// SPECIALIZED GLASS COMPONENTS
// ============================================================================

/**
 * Glass Button - Interactive glass surface
 */
interface GlassButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  className?: string;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ children, variant = 'primary', size = 'md', glow = false, className, ...props }, ref) => {
    const sizeMap = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const variantMap = {
      primary: 'bg-white/10 hover:bg-white/15 border-white/20 text-white',
      secondary: 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80',
      ghost: 'bg-transparent hover:bg-white/5 border-transparent text-white/60 hover:text-white',
    };

    return (
      <motion.button
        ref={ref}
        className={clsx(
          'relative rounded-xl backdrop-blur-md border transition-all',
          'font-medium tracking-wide',
          'focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent',
          sizeMap[size],
          variantMap[variant],
          glow && 'shadow-[0_0_30px_-10px_currentColor]',
          className
        )}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        {...props}
      >
        {/* Gradient overlay on hover */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-xl pointer-events-none"
          aria-hidden="true"
        />

        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

/**
 * Glass Panel - For larger content areas
 */
interface GlassPanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, title, className }) => {
  return (
    <div className={clsx('rounded-2xl backdrop-blur-xl bg-white/[0.05] border border-white/10 overflow-hidden', className)}>
      {title && (
        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-lg font-medium text-white/90">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

/**
 * Glass Badge - Small pill-shaped glass element
 */
interface GlassBadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  children,
  variant = 'default',
  className,
}) => {
  const variantMap = {
    default: 'bg-white/10 border-white/20 text-white/90',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'backdrop-blur-sm border text-xs font-medium tracking-wide',
        variantMap[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

/**
 * Glass Divider - Subtle separator
 */
interface GlassDividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const GlassDivider: React.FC<GlassDividerProps> = ({
  orientation = 'horizontal',
  className,
}) => {
  return (
    <div
      className={clsx(
        'bg-gradient-to-r from-transparent via-white/10 to-transparent',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full',
        className
      )}
      aria-hidden="true"
    />
  );
};

/**
 * Glass Input - Form input with glass styling
 */
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'w-full px-4 py-2.5 rounded-xl',
          'backdrop-blur-md bg-white/5 border',
          error ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-white/30',
          'text-white placeholder:text-white/40',
          'focus:outline-none focus:ring-2 focus:ring-white/20',
          'transition-all',
          className
        )}
        {...props}
      />
    );
  }
);

GlassInput.displayName = 'GlassInput';

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  Card: GlassCard,
  Button: GlassButton,
  Panel: GlassPanel,
  Badge: GlassBadge,
  Divider: GlassDivider,
  Input: GlassInput,
};
