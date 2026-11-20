'use client';

import React, { useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { useFitForgeStore } from '@/store/useFitForgeStore';

export function MotionAndThemeProvider({ children }: { children: React.ReactNode }) {
  const { darkMode } = useFitForgeStore();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Crisp Gallery-White is the intentional default; respect user's explicit darkMode toggle
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
