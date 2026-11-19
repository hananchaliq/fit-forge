'use client';

import React, { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useFitForgeStore } from '@/store/useFitForgeStore';

export function MotionAndThemeProvider({ children }: { children: React.ReactNode }) {
  const { darkMode, setDarkMode } = useFitForgeStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Respect prefers-color-scheme only if user has not explicitly saved a preference
    const stored = window.localStorage.getItem('fitforge-cloud-zero-v2');
    if (!stored) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark !== darkMode) {
        setDarkMode(prefersDark);
      }
    }
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode, setDarkMode]);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
