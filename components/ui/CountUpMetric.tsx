'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CountUpMetricProps {
  value: number;
  decimals?: number;
  durationMs?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function CountUpMetric({
  value,
  decimals = 0,
  durationMs = 520,
  className = '',
  suffix = '',
  prefix = '',
}: CountUpMetricProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const startVal = prevRef.current;
    prevRef.current = value;
    if (startVal === value) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      const t = window.setTimeout(() => setDisplay(value), 0);
      return () => window.clearTimeout(t);
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(startVal + (value - startVal) * eased);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        setDisplay(value);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('id-ID');

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
}

export function ProgressRing({
  percent,
  size = 56,
  strokeWidth = 5,
  color = '#F97316',
  trackColor = 'currentColor',
  label,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progres'}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeOpacity={0.14}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-bold font-telemetry">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
