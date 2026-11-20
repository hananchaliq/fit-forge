'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Activity } from 'lucide-react';

interface BiomechanicalLoaderProps {
  label?: string;
  sublabel?: string;
  compact?: boolean;
}

export function BiomechanicalLoader({
  label = 'MENYINKRONKAN TELEMETRI FITFORGE',
  sublabel = 'Engine Biomekanik 22-Bone IK · Cloud Firestore · Kalman GPS',
  compact = false,
}: BiomechanicalLoaderProps) {
  return (
    <div
      className={`w-full ${
        compact ? 'h-full min-h-[380px] rounded-2xl' : 'min-h-screen'
      } bg-[#0D0F10] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none`}
      role="status"
      aria-live="polite"
    >
      {/* Soft radial electric-lime ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-72 h-72 rounded-full opacity-20 blur-[90px]"
        style={{
          background: 'radial-gradient(circle, #84E818 0%, #5BB808 50%, transparent 75%)',
        }}
      />

      {/* Precision Kinetic Telemetry Ring */}
      <div className="relative w-24 h-24 flex items-center justify-center mb-6">
        <motion.svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#23282D"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="url(#loaderGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="72 220"
          />
          <defs>
            <linearGradient id="loaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A6F73E" />
              <stop offset="50%" stopColor="#84E818" />
              <stop offset="100%" stopColor="#5BB808" />
            </linearGradient>
          </defs>
        </motion.svg>

        <motion.svg
          className="absolute inset-2 w-20 h-20"
          viewBox="0 0 100 100"
          animate={{ rotate: -360 }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="#84E818"
            strokeWidth="1.5"
            strokeOpacity="0.45"
            strokeLinecap="round"
            strokeDasharray="36 180"
          />
        </motion.svg>

        <motion.div
          animate={{ scale: [0.95, 1.04, 0.95] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-11 h-11 rounded-2xl bg-[#84E818] text-[#0D0F10] font-black text-lg flex items-center justify-center shadow-[0_0_24px_rgba(132,232,24,0.35)]"
        >
          F
        </motion.div>
      </div>

      {/* Typography & Animated Scan Hairline */}
      <div className="text-center max-w-xs space-y-2 relative z-10">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase text-[#84E818]">
          <Activity className="w-3.5 h-3.5 text-[#84E818]" />
          <span>{label}</span>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">{sublabel}</p>

        <div className="w-48 h-1 bg-[#1B1F23] rounded-full overflow-hidden mx-auto mt-3">
          <motion.div
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#5BB808] via-[#84E818] to-[#A6F73E]"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  );
}
