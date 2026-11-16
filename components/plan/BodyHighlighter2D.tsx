'use client';

import React from 'react';
import type { MuscleGroup } from '@/data/exerciseClipMap';
import { MUSCLE_LABELS_ID } from '@/data/exerciseClipMap';

interface BodyHighlighter2DProps {
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  primaryColor?: string;
  secondaryColor?: string;
  compact?: boolean;
  darkSurface?: boolean;
  onSelectMuscle?: (muscle: MuscleGroup) => void;
}

/**
 * Dual Anterior (Depan) & Posterior (Belakang) 2D Anatomical Muscle Map SVG
 * Highlights target primary and secondary muscle groups with custom tint colors.
 */
export function BodyHighlighter2D({
  primaryMuscles,
  secondaryMuscles = [],
  primaryColor = '#EF4444',
  secondaryColor = '#F59E0B',
  compact = false,
  darkSurface = false,
  onSelectMuscle,
}: BodyHighlighter2DProps) {
  const baseFill = darkSurface ? '#262626' : '#E5E7EB';
  const strokeColor = darkSurface ? '#404040' : '#D1D5DB';
  const silhouetteFill = darkSurface ? '#1A1A1A' : '#F3F4F6';

  const getFill = (m: MuscleGroup) => {
    if (primaryMuscles.includes(m)) return primaryColor;
    if (secondaryMuscles.includes(m)) return secondaryColor;
    return baseFill;
  };

  const getOpacity = (m: MuscleGroup) => {
    if (primaryMuscles.includes(m)) return 0.95;
    if (secondaryMuscles.includes(m)) return 0.58;
    return 0.85;
  };

  const handleMuscleClick = (m: MuscleGroup) => {
    if (onSelectMuscle) onSelectMuscle(m);
  };

  return (
    <div className={`flex items-center justify-center ${compact ? 'gap-2' : 'gap-4'} select-none`}>
      {/* ANTERIOR (DEPAN) */}
      <div className="flex flex-col items-center">
        <svg
          viewBox="0 0 120 240"
          className={compact ? 'w-14 h-28' : 'w-24 h-48'}
          role="img"
          aria-label="Peta Otot Depan"
        >
          {/* Head & Neck */}
          <circle cx="60" cy="22" r="13" fill={silhouetteFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="54" y="34" width="12" height="9" rx="3" fill={silhouetteFill} stroke={strokeColor} strokeWidth="1.2" />

          {/* Shoulders (Deltoids) */}
          <g
            onClick={() => handleMuscleClick('shoulders')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.shoulders}</title>
            <path
              d="M38 43 C27 44 23 54 25 65 L37 64 L41 45 Z"
              fill={getFill('shoulders')}
              fillOpacity={getOpacity('shoulders')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <path
              d="M82 43 C93 44 97 54 95 65 L83 64 L79 45 Z"
              fill={getFill('shoulders')}
              fillOpacity={getOpacity('shoulders')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>

          {/* Chest (Pectorals) */}
          <g
            onClick={() => handleMuscleClick('chest')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.chest}</title>
            <path
              d="M41 44 L59 44 L59 68 C50 70 42 67 39 59 Z"
              fill={getFill('chest')}
              fillOpacity={getOpacity('chest')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <path
              d="M79 44 L61 44 L61 68 C70 70 78 67 81 59 Z"
              fill={getFill('chest')}
              fillOpacity={getOpacity('chest')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
          </g>

          {/* Abs & Obliques */}
          <g
            onClick={() => handleMuscleClick('abs')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.abs}</title>
            <rect
              x="44"
              y="70"
              width="15"
              height="12"
              rx="3"
              fill={getFill('abs')}
              fillOpacity={getOpacity('abs')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <rect
              x="61"
              y="70"
              width="15"
              height="12"
              rx="3"
              fill={getFill('abs')}
              fillOpacity={getOpacity('abs')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <rect
              x="45"
              y="84"
              width="14"
              height="12"
              rx="3"
              fill={getFill('abs')}
              fillOpacity={getOpacity('abs')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <rect
              x="61"
              y="84"
              width="14"
              height="12"
              rx="3"
              fill={getFill('abs')}
              fillOpacity={getOpacity('abs')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <rect
              x="46"
              y="98"
              width="28"
              height="13"
              rx="4"
              fill={getFill('abs')}
              fillOpacity={getOpacity('abs')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>

          {/* Biceps */}
          <g
            onClick={() => handleMuscleClick('biceps')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.biceps}</title>
            <rect
              x="24"
              y="66"
              width="12"
              height="24"
              rx="6"
              fill={getFill('biceps')}
              fillOpacity={getOpacity('biceps')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <rect
              x="84"
              y="66"
              width="12"
              height="24"
              rx="6"
              fill={getFill('biceps')}
              fillOpacity={getOpacity('biceps')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>

          {/* Forearms */}
          <g
            onClick={() => handleMuscleClick('forearms')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.forearms}</title>
            <path
              d="M23 92 L35 92 L32 120 L21 120 Z"
              fill={getFill('forearms')}
              fillOpacity={getOpacity('forearms')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <path
              d="M85 92 L97 92 L99 120 L88 120 Z"
              fill={getFill('forearms')}
              fillOpacity={getOpacity('forearms')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>

          {/* Quadriceps */}
          <g
            onClick={() => handleMuscleClick('quads')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.quads}</title>
            <path
              d="M42 114 L58 114 L56 168 L40 168 C38 148 39 130 42 114 Z"
              fill={getFill('quads')}
              fillOpacity={getOpacity('quads')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <path
              d="M62 114 L78 114 C81 130 82 148 80 168 L64 168 Z"
              fill={getFill('quads')}
              fillOpacity={getOpacity('quads')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
          </g>

          {/* Calves (Front Tibialis / Gastroc) */}
          <g
            onClick={() => handleMuscleClick('calves')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.calves}</title>
            <path
              d="M41 172 L55 172 L53 220 L43 220 Z"
              fill={getFill('calves')}
              fillOpacity={getOpacity('calves')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <path
              d="M65 172 L79 172 L77 220 L67 220 Z"
              fill={getFill('calves')}
              fillOpacity={getOpacity('calves')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>
        </svg>
        {!compact && (
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-1">
            Depan
          </span>
        )}
      </div>

      {/* POSTERIOR (BELAKANG) */}
      <div className="flex flex-col items-center">
        <svg
          viewBox="0 0 120 240"
          className={compact ? 'w-14 h-28' : 'w-24 h-48'}
          role="img"
          aria-label="Peta Otot Belakang"
        >
          {/* Head & Neck */}
          <circle cx="60" cy="22" r="13" fill={silhouetteFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="54" y="34" width="12" height="9" rx="3" fill={silhouetteFill} stroke={strokeColor} strokeWidth="1.2" />

          {/* Rear Shoulders */}
          <g
            onClick={() => handleMuscleClick('shoulders')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.shoulders}</title>
            <path
              d="M38 43 C27 44 23 54 25 65 L37 64 L41 45 Z"
              fill={getFill('shoulders')}
              fillOpacity={getOpacity('shoulders')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <path
              d="M82 43 C93 44 97 54 95 65 L83 64 L79 45 Z"
              fill={getFill('shoulders')}
              fillOpacity={getOpacity('shoulders')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>

          {/* Back / Lats / Traps */}
          <g
            onClick={() => handleMuscleClick('back_lats')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.back_lats}</title>
            <path
              d="M41 44 L79 44 L82 76 L73 106 L47 106 L38 76 Z"
              fill={getFill('back_lats')}
              fillOpacity={getOpacity('back_lats')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <line x1="60" y1="44" x2="60" y2="106" stroke={strokeColor} strokeWidth="1" />
          </g>

          {/* Triceps */}
          <g
            onClick={() => handleMuscleClick('triceps')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.triceps}</title>
            <rect
              x="24"
              y="66"
              width="12"
              height="25"
              rx="6"
              fill={getFill('triceps')}
              fillOpacity={getOpacity('triceps')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <rect
              x="84"
              y="66"
              width="12"
              height="25"
              rx="6"
              fill={getFill('triceps')}
              fillOpacity={getOpacity('triceps')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>

          {/* Forearms Posterior */}
          <g
            onClick={() => handleMuscleClick('forearms')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.forearms}</title>
            <path
              d="M23 92 L35 92 L32 120 L21 120 Z"
              fill={getFill('forearms')}
              fillOpacity={getOpacity('forearms')}
              stroke={strokeColor}
              strokeWidth="1"
            />
            <path
              d="M85 92 L97 92 L99 120 L88 120 Z"
              fill={getFill('forearms')}
              fillOpacity={getOpacity('forearms')}
              stroke={strokeColor}
              strokeWidth="1"
            />
          </g>

          {/* Glutes */}
          <g
            onClick={() => handleMuscleClick('glutes')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.glutes}</title>
            <rect
              x="42"
              y="107"
              width="17"
              height="20"
              rx="7"
              fill={getFill('glutes')}
              fillOpacity={getOpacity('glutes')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <rect
              x="61"
              y="107"
              width="17"
              height="20"
              rx="7"
              fill={getFill('glutes')}
              fillOpacity={getOpacity('glutes')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
          </g>

          {/* Hamstrings */}
          <g
            onClick={() => handleMuscleClick('hamstrings')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.hamstrings}</title>
            <path
              d="M42 129 L58 129 L56 170 L41 170 Z"
              fill={getFill('hamstrings')}
              fillOpacity={getOpacity('hamstrings')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <path
              d="M62 129 L78 129 L79 170 L64 170 Z"
              fill={getFill('hamstrings')}
              fillOpacity={getOpacity('hamstrings')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
          </g>

          {/* Calves Posterior */}
          <g
            onClick={() => handleMuscleClick('calves')}
            className={onSelectMuscle ? 'cursor-pointer hover:opacity-80' : ''}
          >
            <title>{MUSCLE_LABELS_ID.calves}</title>
            <path
              d="M40 173 C39 188 41 205 44 220 L53 220 C56 205 56 188 55 173 Z"
              fill={getFill('calves')}
              fillOpacity={getOpacity('calves')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            <path
              d="M65 173 C64 188 64 205 67 220 L76 220 C79 205 81 188 80 173 Z"
              fill={getFill('calves')}
              fillOpacity={getOpacity('calves')}
              stroke={strokeColor}
              strokeWidth="1.2"
            />
          </g>
        </svg>
        {!compact && (
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-1">
            Belakang
          </span>
        )}
      </div>
    </div>
  );
}
