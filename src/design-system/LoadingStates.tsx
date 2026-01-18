/**
 * Loading State Components
 * Skeleton loaders and loading indicators for better perceived performance
 */

import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ANIMATIONS } from './animations';

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

/**
 * Base Skeleton Component
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  width,
  height,
  animate = true,
}) => {
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <motion.div
      className={clsx(
        'bg-white/5',
        animate && 'animate-pulse',
        variantStyles[variant],
        className
      )}
      style={{
        width: width,
        height: height || (variant === 'text' ? '1em' : undefined),
      }}
      {...(animate ? ANIMATIONS.variants.shimmer : {})}
    />
  );
};

/**
 * Shimmer Skeleton with gradient animation
 */
export const ShimmerSkeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
}) => {
  return (
    <div
      className={clsx(
        'relative overflow-hidden bg-white/5 rounded-lg',
        className
      )}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          ease: 'linear',
          repeat: Infinity,
        }}
      />
    </div>
  );
};

// ============================================================================
// SKELETON PATTERNS
// ============================================================================

/**
 * Pattern Card Skeleton
 */
export const PatternCardSkeleton: React.FC = () => {
  return (
    <div className="w-[160px] h-[200px] rounded-[24px] p-5 bg-white/[0.03] border border-white/5 backdrop-blur-2xl flex flex-col justify-between">
      <div>
        {/* Icon */}
        <Skeleton variant="circular" width={40} height={40} className="mb-4" />

        {/* Title */}
        <Skeleton width="80%" height={20} className="mb-2" />

        {/* Tag */}
        <Skeleton width="60%" height={12} />
      </div>

      <div className="pt-4 border-t border-white/5">
        {/* Timing */}
        <Skeleton width="50%" height={12} className="mb-2" />

        {/* Rhythm bar */}
        <Skeleton width="100%" height={6} className="rounded-full" />
      </div>
    </div>
  );
};

/**
 * Live Result Card Skeleton
 */
export const LiveResultCardSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-sm rounded-[16px] p-5 bg-[#161719] border border-white/10 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton variant="circular" width={8} height={8} />
        <Skeleton width={100} height={12} />
      </div>

      <div className="space-y-2">
        <Skeleton width="90%" height={16} />
        <Skeleton width="70%" height={16} />
        <Skeleton width="80%" height={16} />
      </div>
    </div>
  );
};

/**
 * History Item Skeleton
 */
export const HistoryItemSkeleton: React.FC = () => {
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
      <div className="flex justify-between items-start mb-3">
        <Skeleton width={100} height={16} />
        <Skeleton width={60} height={14} />
      </div>

      <div className="space-y-2">
        <Skeleton width="40%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>
    </div>
  );
};

// ============================================================================
// SPINNER COMPONENTS
// ============================================================================

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

/**
 * Circular Spinner
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'currentColor',
  className,
}) => {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  const dimension = sizeMap[size];

  return (
    <motion.svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...ANIMATIONS.variants.spinner}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="60"
        strokeDashoffset="20"
        opacity="0.25"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="15"
        opacity="1"
      />
    </motion.svg>
  );
};

/**
 * Pulse Spinner (breathing orb style)
 */
export const PulseSpinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'currentColor',
  className,
}) => {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  const dimension = sizeMap[size];

  return (
    <div className={clsx('relative', className)} style={{ width: dimension, height: dimension }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: color,
          opacity: 0.6,
        }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.6, 0.2, 0.6],
        }}
        transition={{
          duration: 1.5,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: color,
          opacity: 0.8,
        }}
      />
    </div>
  );
};

/**
 * Dots Spinner
 */
export const DotsSpinner: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={clsx('flex gap-1.5', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-current"
          animate={{
            opacity: [0.3, 1, 0.3],
            y: [0, -8, 0],
          }}
          transition={{
            duration: 0.8,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// PROGRESS INDICATORS
// ============================================================================

interface ProgressBarProps {
  progress: number; // 0 to 1
  variant?: 'line' | 'circle';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  showLabel?: boolean;
  className?: string;
}

/**
 * Linear Progress Bar
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'md',
  color = 'currentColor',
  showLabel = false,
  className,
}) => {
  const sizeMap = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const percentage = Math.round(progress * 100);

  return (
    <div className={clsx('w-full', className)}>
      <div className={clsx('w-full bg-white/10 rounded-full overflow-hidden', sizeMap[size])}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {showLabel && (
        <div className="text-xs text-white/60 mt-1 text-right">
          {percentage}%
        </div>
      )}
    </div>
  );
};

/**
 * Circular Progress
 */
export const CircularProgress: React.FC<ProgressBarProps> = ({
  progress,
  size = 'md',
  color = 'currentColor',
  showLabel = false,
  className,
}) => {
  const sizeMap = {
    sm: 40,
    md: 60,
    lg: 80,
  };

  const dimension = sizeMap[size];
  const strokeWidth = dimension / 10;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <svg width={dimension} height={dimension} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <motion.circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>

      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white/90">
          {Math.round(progress * 100)}%
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
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
};
