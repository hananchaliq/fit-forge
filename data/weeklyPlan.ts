import { EXERCISES, type ExerciseItem } from './exercises';
import type { MuscleGroup } from './exerciseClipMap';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayPlan {
  key: DayKey;
  dayNameId: string;
  dayShortId: string;
  titleEn: string;
  focusId: string;
  colorHex: string;
  badgeBgClass: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  gymExerciseIds: string[];
  homeExerciseIds: string[];
}

export const WEEKLY_PLAN: DayPlan[] = [
  {
    key: 'mon',
    dayNameId: 'SENIN',
    dayShortId: 'Sen',
    titleEn: 'Chest & Triceps',
    focusId: 'Dada & Trisep',
    colorHex: '#E11D2E',
    badgeBgClass: 'bg-[#E11D2E]',
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['shoulders'],
    gymExerciseIds: [
      'bench_press',
      'incline_dumbbell_press',
      'chest_fly',
      'dips',
      'tricep_pushdown',
      'overhead_tricep_ext',
    ],
    homeExerciseIds: [
      'pushup',
      'diamond_pushup',
      'decline_pushup',
      'chair_dips',
      'pike_pushup',
    ],
  },
  {
    key: 'tue',
    dayNameId: 'SELASA',
    dayShortId: 'Sel',
    titleEn: 'Back & Biceps',
    focusId: 'Punggung & Bisep',
    colorHex: '#16A34A',
    badgeBgClass: 'bg-[#16A34A]',
    primaryMuscles: ['back_lats', 'biceps'],
    secondaryMuscles: ['forearms', 'shoulders'],
    gymExerciseIds: [
      'pull_ups',
      'lat_pulldown',
      'barbell_row',
      'seated_cable_row',
      'barbell_curl',
      'hammer_curl',
    ],
    homeExerciseIds: [
      'doorframe_rows',
      'superman_pulls',
      'reverse_snow_angels',
      'towel_bicep_curls',
    ],
  },
  {
    key: 'wed',
    dayNameId: 'RABU',
    dayShortId: 'Rab',
    titleEn: 'Legs',
    focusId: 'Kaki & Bokong',
    colorHex: '#F97316',
    badgeBgClass: 'bg-[#F97316]',
    primaryMuscles: ['quads', 'hamstrings', 'glutes', 'calves'],
    secondaryMuscles: ['abs'],
    gymExerciseIds: [
      'squats',
      'leg_press',
      'romanian_deadlift',
      'walking_lunges',
      'leg_curl',
      'calf_raises',
    ],
    homeExerciseIds: [
      'bodyweight_squats',
      'bulgarian_split_squats',
      'walking_lunges',
      'glute_bridges',
      'calf_raises',
    ],
  },
  {
    key: 'thu',
    dayNameId: 'KAMIS',
    dayShortId: 'Kam',
    titleEn: 'Shoulders',
    focusId: 'Bahu 3D & Trapezius',
    colorHex: '#2563EB',
    badgeBgClass: 'bg-[#2563EB]',
    primaryMuscles: ['shoulders'],
    secondaryMuscles: ['triceps', 'back_lats'],
    gymExerciseIds: [
      'overhead_press',
      'lateral_raises',
      'front_raises',
      'rear_delt_fly',
      'shrugs',
    ],
    homeExerciseIds: [
      'pike_press',
      'lateral_raises',
      'front_raises',
      'rear_delt_fly',
      'plank_downward_dog',
    ],
  },
  {
    key: 'fri',
    dayNameId: 'JUMAT',
    dayShortId: 'Jum',
    titleEn: 'Arms',
    focusId: 'Bisep, Trisep & Lengan',
    colorHex: '#7C3AED',
    badgeBgClass: 'bg-[#7C3AED]',
    primaryMuscles: ['biceps', 'triceps', 'forearms'],
    secondaryMuscles: ['shoulders'],
    gymExerciseIds: [
      'ez_bar_curl',
      'incline_curl',
      'hammer_curl',
      'skull_crushers',
      'rope_pushdown',
      'bench_dips',
    ],
    homeExerciseIds: [
      'close_grip_pushups',
      'bodyweight_tricep_ext',
      'isometric_towel_curls',
      'bench_dips',
    ],
  },
  {
    key: 'sat',
    dayNameId: 'SABTU',
    dayShortId: 'Sab',
    titleEn: 'Core & Cardio',
    focusId: 'Perut Inti & Kardio',
    colorHex: '#EAB308',
    badgeBgClass: 'bg-[#EAB308]',
    primaryMuscles: ['abs'],
    secondaryMuscles: ['quads', 'calves', 'shoulders'],
    gymExerciseIds: [
      'crunches',
      'leg_raises',
      'russian_twists',
      'plank',
      'mountain_climbers',
      'running_cardio',
    ],
    homeExerciseIds: [
      'crunches',
      'leg_raises',
      'russian_twists',
      'plank',
      'mountain_climbers',
      'burpees',
    ],
  },
  {
    key: 'sun',
    dayNameId: 'MINGGU',
    dayShortId: 'Min',
    titleEn: 'Recovery',
    focusId: 'Pemulihan & Mobilitas',
    colorHex: '#0D9488',
    badgeBgClass: 'bg-[#0D9488]',
    primaryMuscles: ['back_lats', 'hamstrings'],
    secondaryMuscles: ['shoulders', 'glutes', 'calves'],
    gymExerciseIds: [
      'stretching_flow',
      'brisk_walk',
      'mobility_work',
      'recovery_sleep',
    ],
    homeExerciseIds: [
      'stretching_flow',
      'brisk_walk',
      'mobility_work',
      'recovery_sleep',
    ],
  },
];

export function getExercisesForDay(dayKey: DayKey, mode: 'gym' | 'home'): ExerciseItem[] {
  const day = WEEKLY_PLAN.find((d) => d.key === dayKey) || WEEKLY_PLAN[0];
  const ids = mode === 'gym' ? day.gymExerciseIds : day.homeExerciseIds;
  return ids.map((id) => EXERCISES[id]).filter(Boolean);
}

export interface GoldenRuleItem {
  key: 'protein' | 'water' | 'sleep' | 'overload' | 'steps';
  title: string;
  target: string;
  desc: string;
}

export const GOLDEN_RULES: GoldenRuleItem[] = [
  {
    key: 'protein',
    title: 'Protein Tinggi',
    target: '1.6–2.2 g/kg',
    desc: 'Penuhi sintesis protein otot harian di setiap waktu makan.',
  },
  {
    key: 'water',
    title: 'Hidrasi Optimal',
    target: '3–4 L / hari',
    desc: 'Minum 250 ml setiap jam aktif antara bangun hingga tidur.',
  },
  {
    key: 'sleep',
    title: 'Tidur Berkualitas',
    target: '7–9 Jam',
    desc: 'Pemulihan sistem saraf pusat dan hormon pertumbuhan.',
  },
  {
    key: 'overload',
    title: 'Progressive Overload',
    target: '+Rep / Beban',
    desc: 'Tingkatkan volume, repetisi, atau kontrol tempo setiap minggu.',
  },
  {
    key: 'steps',
    title: 'Langkah Aktif',
    target: '8.000–10.000',
    desc: 'Jaga pembakaran kalori harian (NEAT) dan kesehatan jantung.',
  },
];
