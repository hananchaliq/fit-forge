'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  type HTMLMotionProps,
  type Transition,
} from 'motion/react';

/** Snappy architectural spring — luxury tactile response */
export const MOTION_SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.78,
};

/** Silky gentle spring for drawers, modals, and container elevation */
export const MOTION_GENTLE: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

/** Architectural ease-out curve for hairlines, reveals, and numeric transitions */
export const MOTION_EASE: Transition = {
  duration: 0.44,
  ease: [0.22, 1, 0.36, 1],
};

/**
 * GPU-composited top scroll progress hairline driven by scroll position + spring smoothing.
 */
export function ScrollProgressBar({ className = '' }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 32,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className={`fixed top-0 left-0 right-0 h-[2.5px] z-[60] pointer-events-none bg-gradient-to-r from-[#5BB808] via-[#84E818] to-[#B0FA4B] ${className}`}
    />
  );
}

/**
 * Architectural Hairline Divider — draws crisply along X or Y axis on viewport enter.
 * Uses GPU-composited scaleX / scaleY only (zero layout thrash).
 */
export function MotionLine({
  orientation = 'horizontal',
  delay = 0,
  accent = false,
  className = '',
}: {
  orientation?: 'horizontal' | 'vertical';
  delay?: number;
  accent?: boolean;
  className?: string;
}) {
  const isHorizontal = orientation === 'horizontal';
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.05 });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`${isHorizontal ? 'h-px w-full' : 'w-px h-full'} ${className}`}
    >
      <motion.div
        initial={isHorizontal ? { scaleX: 0, opacity: 0.4 } : { scaleY: 0, opacity: 0.4 }}
        animate={
          isInView
            ? isHorizontal
              ? { scaleX: 1, opacity: 1 }
              : { scaleY: 1, opacity: 1 }
            : isHorizontal
            ? { scaleX: 0, opacity: 0.4 }
            : { scaleY: 0, opacity: 0.4 }
        }
        transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: isHorizontal ? '0% 50%' : '50% 0%' }}
        className={`w-full h-full ${
          accent
            ? 'bg-gradient-to-r from-[#84E818] via-[#65C80B] to-transparent'
            : 'bg-[#E3E6E0] dark:bg-[#23282D]'
        }`}
      />
    </div>
  );
}

/**
 * Luxury Animated Number Counter — smooth cubic count-up triggered when entering viewport.
 * Renders final value cleanly for SSR & prefers-reduced-motion users.
 */
export function MotionCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  durationMs = 900,
  delayMs = 0,
  className = '',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [display, setDisplay] = useState(value);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimatedRef.current) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      hasAnimatedRef.current = true;
      return;
    }

    hasAnimatedRef.current = true;
    let rafId = 0;
    let timeoutId = 0;

    timeoutId = window.setTimeout(() => {
      const startTime = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        // Quartic ease-out for crisp architectural deceleration
        const eased = 1 - Math.pow(1 - t, 4);
        setDisplay(value * eased);
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          setDisplay(value);
        }
      };
      rafId = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
    };
  }, [inView, value, durationMs, delayMs]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('id-ID');

  return (
    <span ref={ref} className={`tabular-nums inline-block ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

interface MotionCardProps extends HTMLMotionProps<'div'> {
  interactive?: boolean;
  delay?: number;
}

/**
 * Architectural kinetic container with subtle spring lift, tactile press, and hairline response.
 * Uses initial={false} so First Paint is immediately visible with zero blank flash.
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
      whileHover={interactive ? { y: -4, transition: MOTION_SPRING } : undefined}
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
 * Below-the-fold architectural scroll reveal — smooth vertical settle + crisp opacity.
 */
export function MotionReveal({
  children,
  className = '',
  delay = 0,
  yOffset = 18,
  ...rest
}: MotionRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Tactile Icon Frame — subtle spring scale + micro-rotation on hover.
 */
export function MotionIconBox({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.07, rotate: -3 }}
      whileTap={{ scale: 0.94 }}
      transition={MOTION_SPRING}
      className={className}
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
 * Shared-element spring segmented control (layoutId sliding obsidian/lime pill).
 */
export function MotionSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className = '',
  activeClassName = 'text-white dark:text-[#0D0F10]',
  inactiveClassName = 'text-[#5A6068] dark:text-[#9AA2AC] hover:text-[#0D0F10] dark:hover:text-white',
  pillClassName = 'bg-[#0D0F10] dark:bg-[#84E818]',
  ariaLabel,
}: MotionSegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-1 rounded-xl bg-[#EFF1EE] dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#23282D] ${className}`}
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
 * Architectural Electric-Lime Progress Bar — compositor-driven scaleX fill with in-view trigger.
 */
export function MotionProgressBar({
  percent,
  delay = 0,
  inView = false,
  className = 'h-1.5',
  barClassName = 'bg-gradient-to-r from-[#65C80B] via-[#84E818] to-[#A6F73E]',
}: {
  percent: number;
  delay?: number;
  inView?: boolean;
  className?: string;
  barClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const scale = clamped / 100;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isTrackVisible = useInView(trackRef, { once: true, amount: 0.1 });

  if (inView) {
    return (
      <div
        ref={trackRef}
        className={`w-full overflow-hidden rounded-full bg-[#E8EBE5] dark:bg-[#22272C] ${className}`}
      >
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isTrackVisible ? scale : 0 }}
          transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '0% 50%' }}
          className={`h-full w-full rounded-full ${barClassName}`}
        />
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden rounded-full bg-[#E8EBE5] dark:bg-[#22272C] ${className}`}>
      <motion.div
        initial={false}
        animate={{ scaleX: scale }}
        transition={MOTION_GENTLE}
        style={{ transformOrigin: '0% 50%' }}
        className={`h-full w-full rounded-full ${barClassName}`}
      />
    </div>
  );
}
