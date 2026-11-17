export type AnimationClipName =
  | 'idle'
  | 'pushup'
  | 'diamond_pushup'
  | 'squat'
  | 'pullup'
  | 'lunge'
  | 'plank'
  | 'burpee'
  | 'mountain_climber'
  | 'crunch'
  | 'glute_bridge'
  | 'stretch_flow'
  | 'jog';

export type MuscleGroup =
  | 'chest'
  | 'back_lats'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'abs'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'forearms';

export const MUSCLE_LABELS_ID: Record<MuscleGroup, string> = {
  chest: 'Dada (Pectorals)',
  back_lats: 'Punggung & Sayap (Latissimus)',
  shoulders: 'Bahu (Deltoids)',
  biceps: 'Bisep (Biceps Brachii)',
  triceps: 'Trisep (Triceps Brachii)',
  abs: 'Perut & Inti (Core / Abs)',
  glutes: 'Bokong (Gluteus)',
  quads: 'Paha Depan (Quadriceps)',
  hamstrings: 'Paha Belakang (Hamstrings)',
  calves: 'Betis (Gastrocnemius)',
  forearms: 'Lengan Bawah (Forearms)',
};

export interface ClipMapping {
  clip: AnimationClipName;
  timeScaleDefault: number;
  isApproximate: boolean;
  biomechanicalVariant:
    | 'standard'
    | 'wide_press'
    | 'narrow_press'
    | 'overhead_push'
    | 'row_pull'
    | 'curl'
    | 'tricep_ext'
    | 'hinge';
}

export const EXERCISE_CLIP_MAP: Record<string, ClipMapping> = {
  // Home Monday
  pushup: { clip: 'pushup', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  diamond_pushup: { clip: 'diamond_pushup', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'narrow_press' },
  decline_pushup: { clip: 'pushup', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'wide_press' },
  chair_dips: { clip: 'pushup', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'tricep_ext' },
  pike_pushup: { clip: 'pushup', timeScaleDefault: 0.85, isApproximate: false, biomechanicalVariant: 'overhead_push' },

  // Gym Monday
  bench_press: { clip: 'pushup', timeScaleDefault: 0.85, isApproximate: false, biomechanicalVariant: 'wide_press' },
  incline_dumbbell_press: { clip: 'pushup', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'wide_press' },
  chest_fly: { clip: 'stretch_flow', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'wide_press' },
  dips: { clip: 'pushup', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'tricep_ext' },
  tricep_pushdown: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'tricep_ext' },
  overhead_tricep_ext: { clip: 'stretch_flow', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'tricep_ext' },

  // Tuesday Back & Biceps
  pull_ups: { clip: 'pullup', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  lat_pulldown: { clip: 'pullup', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'row_pull' },
  barbell_row: { clip: 'stretch_flow', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'row_pull' },
  seated_cable_row: { clip: 'stretch_flow', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'row_pull' },
  barbell_curl: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'curl' },
  hammer_curl: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'curl' },
  doorframe_rows: { clip: 'stretch_flow', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'row_pull' },
  superman_pulls: { clip: 'plank', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'row_pull' },
  reverse_snow_angels: { clip: 'plank', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'row_pull' },
  towel_bicep_curls: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'curl' },

  // Wednesday Legs
  squats: { clip: 'squat', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  bodyweight_squats: { clip: 'squat', timeScaleDefault: 1.05, isApproximate: false, biomechanicalVariant: 'standard' },
  leg_press: { clip: 'squat', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'standard' },
  romanian_deadlift: { clip: 'squat', timeScaleDefault: 0.85, isApproximate: false, biomechanicalVariant: 'hinge' },
  walking_lunges: { clip: 'lunge', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  bulgarian_split_squats: { clip: 'lunge', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'standard' },
  leg_curl: { clip: 'glute_bridge', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'hinge' },
  glute_bridges: { clip: 'glute_bridge', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  calf_raises: { clip: 'idle', timeScaleDefault: 1.2, isApproximate: false, biomechanicalVariant: 'standard' },

  // Thursday Shoulders
  overhead_press: { clip: 'stretch_flow', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'overhead_push' },
  pike_press: { clip: 'pushup', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'overhead_push' },
  lateral_raises: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'overhead_push' },
  front_raises: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'overhead_push' },
  rear_delt_fly: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'row_pull' },
  shrugs: { clip: 'idle', timeScaleDefault: 1.1, isApproximate: false, biomechanicalVariant: 'row_pull' },
  plank_downward_dog: { clip: 'plank', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'overhead_push' },

  // Friday Arms
  ez_bar_curl: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'curl' },
  incline_curl: { clip: 'stretch_flow', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'curl' },
  skull_crushers: { clip: 'stretch_flow', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'tricep_ext' },
  rope_pushdown: { clip: 'stretch_flow', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'tricep_ext' },
  bench_dips: { clip: 'pushup', timeScaleDefault: 0.95, isApproximate: false, biomechanicalVariant: 'tricep_ext' },
  close_grip_pushups: { clip: 'diamond_pushup', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'narrow_press' },
  bodyweight_tricep_ext: { clip: 'diamond_pushup', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'tricep_ext' },
  isometric_towel_curls: { clip: 'stretch_flow', timeScaleDefault: 0.85, isApproximate: false, biomechanicalVariant: 'curl' },

  // Saturday Core & Cardio
  crunches: { clip: 'crunch', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  leg_raises: { clip: 'crunch', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'standard' },
  russian_twists: { clip: 'crunch', timeScaleDefault: 1.1, isApproximate: false, biomechanicalVariant: 'standard' },
  plank: { clip: 'plank', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  mountain_climbers: { clip: 'mountain_climber', timeScaleDefault: 1.15, isApproximate: false, biomechanicalVariant: 'standard' },
  burpees: { clip: 'burpee', timeScaleDefault: 1.0, isApproximate: false, biomechanicalVariant: 'standard' },
  running_cardio: { clip: 'jog', timeScaleDefault: 1.1, isApproximate: false, biomechanicalVariant: 'standard' },

  // Sunday Recovery
  stretching_flow: { clip: 'stretch_flow', timeScaleDefault: 0.85, isApproximate: false, biomechanicalVariant: 'standard' },
  brisk_walk: { clip: 'jog', timeScaleDefault: 0.75, isApproximate: false, biomechanicalVariant: 'standard' },
  mobility_work: { clip: 'stretch_flow', timeScaleDefault: 0.9, isApproximate: false, biomechanicalVariant: 'standard' },
  recovery_sleep: { clip: 'idle', timeScaleDefault: 0.7, isApproximate: false, biomechanicalVariant: 'standard' },
};
