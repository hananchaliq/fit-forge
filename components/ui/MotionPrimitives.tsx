'use client';

import React from 'react';
import {
  motion,
  useScroll,
  useSpring,
  type HTMLMotionProps,
  type Transition,
} from 'motion/react';

/** Snappy spring preset — Apple Fitness / Whoop tactile feel */
export const MOTION_SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

/** Gentle spring for modals, drawers, and larger layout shifts */
export const MOTION_GENTLE: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
  mass: 0.9,
};

/** Crisp editorial ease-out curve */
export const MOTION_EASE: Transition = {
  duration: 0.32,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * GPU-composited top scroll progress bar driven by scroll position + spring smoothing.
 */
export function ScrollProgressBar({ className = '' }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className={`fixed top-0 left-0 right-0 h-[2.5px] z-[60] pointer-events-none bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] ${className}`}
    />
  );
}

interface MotionCardProps extends HTMLMotionProps<'div'> {
  interactive?: boolean;
  delay?: number;
}

/**
 * Tactile kinetic card with subtle hover lift and spring press feedback.
 * Uses initial={false} so SSR First Paint is immediately visible with zero flash.
 */
export function MotionCard({
  children,
  className = '',
  interactive = true,
  delay = 0,
  ...rest
}: MotionCardProps) {
  return (
    <motion.div
      initial={false}
      whileHover={interactive ? { y: -2.5, transition: MOTION_SPRING } : undefined}
      whileTap={interactive ? { scale: 0.992, transition: MOTION_SPRING } : undefined}
      transition={{ ...MOTION_EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface MotionRevealProps extends HTMLMotionProps<'div'> {
  delay?: number;
  yOffset?: number;
}

/**
 * Below-the-fold scroll reveal that animates once on viewport intersection.
 */
export function MotionReveal({
  children,
  className = '',
  delay = 0,
  yOffset = 16,
  ...rest
}: MotionRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface MotionSegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  pillClassName?: string;
  ariaLabel?: string;
}

/**
 * Shared-element spring segmented control (layoutId sliding pill).
 */
export function MotionSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className = '',
  activeClassName = 'text-white dark:text-black',
  inactiveClassName = 'text-[#6B7280] dark:text-neutral-400 hover:text-[#111111] dark:hover:text-white',
  pillClassName = 'bg-[#161616] dark:bg-[#F97316]',
  ariaLabel,
}: MotionSegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-1 rounded-xl bg-[#F4F4F1] dark:bg-[#0D0D11] border border-[#E5E5E0] dark:border-[#27272E] ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`relative z-10 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              active ? activeClassName : inactiveClassName
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={MOTION_SPRING}
                className={`absolute inset-0 rounded-lg shadow-sm -z-10 ${pillClassName}`}
              />
            )}
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Animated linear progress bar with spring physics.
 */
export function MotionProgressBar({
  percent,
  className = '',
  barClassName = 'bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B]',
}: {
  percent: number;
  className?: string;
  barClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={`w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 ${className}`}>
      <motion.div
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={MOTION_GENTLE}
        className={`h-full rounded-full ${barClassName}`}
      />
    </div>
  );
}
