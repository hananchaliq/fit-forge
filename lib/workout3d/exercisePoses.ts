import * as THREE from 'three';
import type { AnimationClipName } from '@/data/exerciseClipMap';
import {
  BODY_METRICS,
  type FootOrientationMode,
  type HandPoseMode,
} from './biomechanics';

export type CameraGroup = 'floor' | 'hanging' | 'bench' | 'standing' | 'sleep';

export interface EquipmentState {
  showMat: boolean;
  showPillow: boolean;
  showPullupRig: boolean;
  showDipBars: boolean;
  showFlatBench: boolean;
  showInclineBench: boolean;
  inclineAngleRad: number;
  benchPos: THREE.Vector3;
  showBarbell: boolean;
  barbellPos: THREE.Vector3;
  showDumbbells: boolean;
  dumbbellLRot: THREE.Euler;
  dumbbellRRot: THREE.Euler;
  showCableBar: boolean;
  cableBarPos: THREE.Vector3;
  cableAnchorTop: THREE.Vector3;
  showTowel: boolean;
  towelFootPos: THREE.Vector3;
  showRowBar: boolean;
  rowBarY: number;
  rowBarZ: number;
}

export interface ExercisePoseResult {
  exerciseKey: string;
  cameraGroup: CameraGroup;
  groundY: number;
  hipsPos: THREE.Vector3;
  shoulderCenter: THREE.Vector3;
  torsoAnterior: THREE.Vector3;
  headLookDir: THREE.Vector3;
  spineArchOffset: number;
  shoulderShrugY: number;
  breathAmplitude: number;
  handL: THREE.Vector3;
  handR: THREE.Vector3;
  elbowPoleL: THREE.Vector3;
  elbowPoleR: THREE.Vector3;
  handMode: HandPoseMode;
  palmNormalHint: THREE.Vector3 | null;
  footL: THREE.Vector3;
  footR: THREE.Vector3;
  kneePoleL: THREE.Vector3;
  kneePoleR: THREE.Vector3;
  footModeL: FootOrientationMode;
  footModeR: FootOrientationMode;
  footPitchL: number;
  footPitchR: number;
  equipment: EquipmentState;
}

export const SUPPORTED_EXERCISE_IDS = [
  'bench_press',
  'incline_dumbbell_press',
  'chest_fly',
  'dips',
  'tricep_pushdown',
  'overhead_tricep_ext',
  'pushup',
  'diamond_pushup',
  'decline_pushup',
  'chair_dips',
  'pike_pushup',
  'pull_ups',
  'lat_pulldown',
  'barbell_row',
  'seated_cable_row',
  'barbell_curl',
  'hammer_curl',
  'doorframe_rows',
  'superman_pulls',
  'reverse_snow_angels',
  'towel_bicep_curls',
  'squats',
  'leg_press',
  'romanian_deadlift',
  'walking_lunges',
  'leg_curl',
  'calf_raises',
  'bodyweight_squats',
  'bulgarian_split_squats',
  'glute_bridges',
  'overhead_press',
  'lateral_raises',
  'front_raises',
  'rear_delt_fly',
  'shrugs',
  'pike_press',
  'plank_downward_dog',
  'ez_bar_curl',
  'incline_curl',
  'skull_crushers',
  'rope_pushdown',
  'bench_dips',
  'close_grip_pushups',
  'bodyweight_tricep_ext',
  'isometric_towel_curls',
  'crunches',
  'leg_raises',
  'russian_twists',
  'plank',
  'mountain_climbers',
  'burpees',
  'running_cardio',
  'stretching_flow',
  'brisk_walk',
  'mobility_work',
  'recovery_sleep',
] as const;

export type SupportedExerciseId = (typeof SUPPORTED_EXERCISE_IDS)[number];

/** Smooth concentric-eccentric cycle easing (0 -> 1 -> 0 over norm in [0, 1]) */
function easeCycle(norm: number): number {
  const s = 0.5 - 0.5 * Math.cos(norm * Math.PI * 2);
  // Subtle S-curve polish for human acceleration/deceleration at turnarounds
  return s * s * (3 - 2 * s);
}

/** Smoothstep helper */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Resolve canonical exerciseId from optional ID, display name, or legacy clip fallback */
export function resolveExerciseId(
  exerciseId: string | undefined,
  exerciseName: string | undefined,
  clip: AnimationClipName
): SupportedExerciseId {
  if (
    exerciseId &&
    (SUPPORTED_EXERCISE_IDS as readonly string[]).includes(exerciseId)
  ) {
    return exerciseId as SupportedExerciseId;
  }

  const n = (exerciseName || '').toLowerCase();
  if (n.includes('incline dumbbell')) return 'incline_dumbbell_press';
  if (n.includes('bench press')) return 'bench_press';
  if (n.includes('chest fly')) return 'chest_fly';
  if (n.includes('chair dip')) return 'chair_dips';
  if (n.includes('bench dip')) return 'bench_dips';
  if (n.includes('dip')) return 'dips';
  if (n.includes('rope pushdown')) return 'rope_pushdown';
  if (n.includes('tricep pushdown')) return 'tricep_pushdown';
  if (n.includes('overhead tricep')) return 'overhead_tricep_ext';
  if (n.includes('diamond')) return 'diamond_pushup';
  if (n.includes('decline')) return 'decline_pushup';
  if (n.includes('close-grip') || n.includes('close grip')) return 'close_grip_pushups';
  if (n.includes('pike press')) return 'pike_press';
  if (n.includes('pike')) return 'pike_pushup';
  if (n.includes('bodyweight tricep')) return 'bodyweight_tricep_ext';
  if (n.includes('pull-up') || n.includes('pull up')) return 'pull_ups';
  if (n.includes('lat pulldown')) return 'lat_pulldown';
  if (n.includes('barbell row')) return 'barbell_row';
  if (n.includes('seated cable row')) return 'seated_cable_row';
  if (n.includes('doorframe') || n.includes('table row')) return 'doorframe_rows';
  if (n.includes('superman')) return 'superman_pulls';
  if (n.includes('snow angel')) return 'reverse_snow_angels';
  if (n.includes('isometric towel')) return 'isometric_towel_curls';
  if (n.includes('towel')) return 'towel_bicep_curls';
  if (n.includes('ez bar')) return 'ez_bar_curl';
  if (n.includes('incline curl')) return 'incline_curl';
  if (n.includes('hammer curl')) return 'hammer_curl';
  if (n.includes('barbell curl')) return 'barbell_curl';
  if (n.includes('skull crusher')) return 'skull_crushers';
  if (n.includes('bulgarian')) return 'bulgarian_split_squats';
  if (n.includes('bodyweight squat')) return 'bodyweight_squats';
  if (n.includes('leg press')) return 'leg_press';
  if (n.includes('deadlift')) return 'romanian_deadlift';
  if (n.includes('lunge')) return 'walking_lunges';
  if (n.includes('leg curl')) return 'leg_curl';
  if (n.includes('calf')) return 'calf_raises';
  if (n.includes('glute bridge')) return 'glute_bridges';
  if (n.includes('squat')) return 'squats';
  if (n.includes('overhead press')) return 'overhead_press';
  if (n.includes('lateral raise')) return 'lateral_raises';
  if (n.includes('front raise')) return 'front_raises';
  if (n.includes('rear delt')) return 'rear_delt_fly';
  if (n.includes('shrug')) return 'shrugs';
  if (n.includes('downward')) return 'plank_downward_dog';
  if (n.includes('leg raise')) return 'leg_raises';
  if (n.includes('russian twist')) return 'russian_twists';
  if (n.includes('crunch')) return 'crunches';
  if (n.includes('mountain')) return 'mountain_climbers';
  if (n.includes('plank')) return 'plank';
  if (n.includes('burpee')) return 'burpees';
  if (n.includes('running') || n.includes('cycling')) return 'running_cardio';
  if (n.includes('walking')) return 'brisk_walk';
  if (n.includes('stretch')) return 'stretching_flow';
  if (n.includes('mobility')) return 'mobility_work';
  if (n.includes('recovery') || n.includes('sleep')) return 'recovery_sleep';

  switch (clip) {
    case 'pushup':
      return 'pushup';
    case 'diamond_pushup':
      return 'diamond_pushup';
    case 'squat':
      return 'bodyweight_squats';
    case 'pullup':
      return 'pull_ups';
    case 'lunge':
      return 'walking_lunges';
    case 'plank':
      return 'plank';
    case 'burpee':
      return 'burpees';
    case 'mountain_climber':
      return 'mountain_climbers';
    case 'crunch':
      return 'crunches';
    case 'glute_bridge':
      return 'glute_bridges';
    case 'jog':
      return 'running_cardio';
    case 'stretch_flow':
      return 'stretching_flow';
    default:
      return 'recovery_sleep';
  }
}

function createDefaultEquipment(): EquipmentState {
  return {
    showMat: false,
    showPillow: false,
    showPullupRig: false,
    showDipBars: false,
    showFlatBench: false,
    showInclineBench: false,
    inclineAngleRad: 0.62,
    benchPos: new THREE.Vector3(0, 0, -0.1),
    showBarbell: false,
    barbellPos: new THREE.Vector3(0, 0.9, 0.2),
    showDumbbells: false,
    dumbbellLRot: new THREE.Euler(0, 0, 0),
    dumbbellRRot: new THREE.Euler(0, 0, 0),
    showCableBar: false,
    cableBarPos: new THREE.Vector3(0, 1.4, 0.2),
    cableAnchorTop: new THREE.Vector3(0, 2.25, 0.2),
    showTowel: false,
    towelFootPos: new THREE.Vector3(0.14, 0.08, 0.14),
    showRowBar: false,
    rowBarY: 0.96,
    rowBarZ: 0.12,
  };
}

/**
 * Computes the complete anatomically calibrated 3D pose for ANY of the 56 FitForge exercises
 * at normalized animation frame `frame` ∈ [0, 60).
 */
export function evaluateExercisePose(
  exerciseId: string | undefined,
  clip: AnimationClipName,
  exerciseName: string | undefined,
  frame: number
): ExercisePoseResult {
  const key = resolveExerciseId(exerciseId, exerciseName, clip);
  const norm = (((frame % 60) + 60) % 60) / 60;
  const p = easeCycle(norm);
  const linP = 0.5 - 0.5 * Math.cos(norm * Math.PI * 2);

  const {
    TORSO_LEN,
    UPPER_ARM_LEN,
    FOREARM_LEN,
    CALF_LEN,
    ANKLE_HEIGHT,
    MAT_TOP_Y,
    BENCH_TOP_Y,
    BAR_Y,
    DIP_BAR_Y,
    DIP_BAR_HALF_X,
  } = BODY_METRICS;

  const eq = createDefaultEquipment();

  // Default standing anatomical neutral pose (strictly grounded at y = 0)
  const res: ExercisePoseResult = {
    exerciseKey: key,
    cameraGroup: 'standing',
    groundY: 0,
    hipsPos: new THREE.Vector3(0, 0.935, 0),
    shoulderCenter: new THREE.Vector3(0, 0.935 + TORSO_LEN, 0),
    torsoAnterior: new THREE.Vector3(0, 0, 1),
    headLookDir: new THREE.Vector3(0, 0, 1),
    spineArchOffset: 0.012,
    shoulderShrugY: 0,
    breathAmplitude: 0.007,
    handL: new THREE.Vector3(-0.23, 0.79, 0.05),
    handR: new THREE.Vector3(0.23, 0.79, 0.05),
    elbowPoleL: new THREE.Vector3(-0.34, 1.12, -0.24),
    elbowPoleR: new THREE.Vector3(0.34, 1.12, -0.24),
    handMode: 'relaxed',
    palmNormalHint: null,
    footL: new THREE.Vector3(-0.145, ANKLE_HEIGHT, 0),
    footR: new THREE.Vector3(0.145, ANKLE_HEIGHT, 0),
    kneePoleL: new THREE.Vector3(-0.16, 0.52, 0.52),
    kneePoleR: new THREE.Vector3(0.16, 0.52, 0.52),
    footModeL: 'flat_floor',
    footModeR: 'flat_floor',
    footPitchL: 0,
    footPitchR: 0,
    equipment: eq,
  };

  switch (key) {
    // =========================================================================
    // MONDAY: CHEST & TRICEPS (GYM)
    // =========================================================================
    case 'bench_press': {
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, -0.08);
      const press = 1 - p;
      const bodyY = BENCH_TOP_Y + 0.105; // Posterior flush on bench top

      res.hipsPos.set(0, bodyY, -0.34);
      res.shoulderCenter.set(0, bodyY, -0.34 + TORSO_LEN);
      res.torsoAnterior.set(0, 1, 0);
      res.headLookDir.set(0, 1, 0);
      res.spineArchOffset = 0.018; // Athletic scapular arch on bench

      const barY = bodyY + 0.19 + 0.31 * press;
      const barZ = 0.14;
      eq.showBarbell = true;
      eq.barbellPos.set(0, barY, barZ);

      res.handL.set(-0.32, barY, barZ);
      res.handR.set(0.32, barY, barZ);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, 0.6, -0.8).normalize();
      res.elbowPoleL.set(-0.48, bodyY - 0.16, -0.02);
      res.elbowPoleR.set(0.48, bodyY - 0.16, -0.02);

      res.footL.set(-0.22, ANKLE_HEIGHT, -0.78);
      res.footR.set(0.22, ANKLE_HEIGHT, -0.78);
      res.kneePoleL.set(-0.23, 0.56, -0.74);
      res.kneePoleR.set(0.23, 0.56, -0.74);
      res.footModeL = 'flat_floor';
      res.footModeR = 'flat_floor';
      break;
    }

    case 'incline_dumbbell_press': {
      res.cameraGroup = 'bench';
      eq.showInclineBench = true;
      eq.inclineAngleRad = 0.58; // ~33 deg incline
      eq.benchPos.set(0, 0, -0.10);
      const press = 1 - p;
      const inc = eq.inclineAngleRad;

      const hipY = BENCH_TOP_Y + 0.095;
      const hipZ = -0.04;
      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(
        0,
        hipY + Math.sin(inc) * TORSO_LEN,
        hipZ - Math.cos(inc) * TORSO_LEN
      );
      res.torsoAnterior.set(0, Math.cos(inc), Math.sin(inc)).normalize();
      res.headLookDir.set(0, 0.38, 0.92).normalize();
      res.spineArchOffset = 0.014;

      // Press straight vertically above upper chest with natural gentle convergence
      const shY = res.shoulderCenter.y - 0.04;
      const shZ = res.shoulderCenter.z + 0.06;
      const dbY = shY + 0.12 + 0.36 * press;
      const dbX = 0.31 - 0.09 * press;
      const dbZ = shZ + 0.06;

      eq.showDumbbells = true;
      res.handL.set(-dbX, dbY, dbZ);
      res.handR.set(dbX, dbY, dbZ);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, 0.5, 0.86).normalize();
      res.elbowPoleL.set(-0.46, shY - 0.18, shZ - 0.16);
      res.elbowPoleR.set(0.46, shY - 0.18, shZ - 0.16);

      res.footL.set(-0.20, ANKLE_HEIGHT, 0.48);
      res.footR.set(0.20, ANKLE_HEIGHT, 0.48);
      res.kneePoleL.set(-0.21, 0.54, 0.36);
      res.kneePoleR.set(0.21, 0.54, 0.36);
      res.footModeL = 'flat_floor';
      res.footModeR = 'flat_floor';
      break;
    }

    case 'chest_fly': {
      // Authentic Supine Flat-Bench Dumbbell Chest Fly (Hugging arc over sternum, soft 22° elbow bend)
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, -0.08);
      const close = p; // 0 = wide stretch, 1 = peak hug squeeze over sternum
      const bodyY = BENCH_TOP_Y + 0.105;

      res.hipsPos.set(0, bodyY, -0.34);
      res.shoulderCenter.set(0, bodyY, -0.34 + TORSO_LEN);
      res.torsoAnterior.set(0, 1, 0);
      res.headLookDir.set(0, 1, 0);
      res.spineArchOffset = 0.016;

      // Sweeping arc from 76° wide to 10° top hug with soft bent elbow
      const arcAngle = THREE.MathUtils.degToRad(76 - 66 * close);
      const arcRadius = 0.51; // Slightly less than full 0.565 arm length -> natural ~22° soft elbow bend
      const chestZ = 0.13;
      const shY = bodyY;

      res.handL.set(
        -0.16 - Math.sin(arcAngle) * arcRadius,
        shY + Math.cos(arcAngle) * arcRadius,
        chestZ
      );
      res.handR.set(
        0.16 + Math.sin(arcAngle) * arcRadius,
        shY + Math.cos(arcAngle) * arcRadius,
        chestZ
      );
      eq.showDumbbells = true;
      eq.dumbbellLRot.set(0, Math.PI / 2, 0);
      eq.dumbbellRRot.set(0, Math.PI / 2, 0);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, 0, 0); // Hand inward facing

      // Elbow pole drops slightly toward floor-outer so soft bend faces downward/outward naturally
      res.elbowPoleL.set(
        -0.28 - Math.sin(arcAngle) * 0.28,
        shY + Math.cos(arcAngle) * 0.24 - 0.18,
        chestZ - 0.04
      );
      res.elbowPoleR.set(
        0.28 + Math.sin(arcAngle) * 0.28,
        shY + Math.cos(arcAngle) * 0.24 - 0.18,
        chestZ - 0.04
      );

      res.footL.set(-0.22, ANKLE_HEIGHT, -0.78);
      res.footR.set(0.22, ANKLE_HEIGHT, -0.78);
      res.kneePoleL.set(-0.23, 0.56, -0.74);
      res.kneePoleR.set(0.23, 0.56, -0.74);
      res.footModeL = 'flat_floor';
      res.footModeR = 'flat_floor';
      break;
    }

    case 'dips': {
      // Authentic Parallel Bar Gym Dips: Suspended upright with 15° chest lean, hands gripping bars
      res.cameraGroup = 'standing';
      eq.showDipBars = true;
      const dip = p; // 0 = lockout at top, 1 = 90° bottom dip
      const lean = 0.24; // ~14° forward chest lean

      const hipY = 1.06 - 0.26 * dip;
      const hipZ = -0.08;
      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(lean) * TORSO_LEN,
        hipZ + Math.sin(lean) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(lean), Math.cos(lean)).normalize();
      res.headLookDir.set(0, -0.18, 0.98).normalize();

      // Hands firmly gripping parallel dip bars
      res.handL.set(-DIP_BAR_HALF_X, DIP_BAR_Y, 0.02);
      res.handR.set(DIP_BAR_HALF_X, DIP_BAR_Y, 0.02);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      // Elbows flex strictly backward behind dip bars
      res.elbowPoleL.set(-0.34, res.shoulderCenter.y - 0.14, -0.45);
      res.elbowPoleR.set(0.34, res.shoulderCenter.y - 0.14, -0.45);

      // Legs suspended with knees bent cleanly behind
      res.footL.set(-0.10, hipY - 0.54, hipZ - 0.36);
      res.footR.set(0.10, hipY - 0.54, hipZ - 0.36);
      res.kneePoleL.set(-0.12, hipY - 0.34, hipZ + 0.32);
      res.kneePoleR.set(0.12, hipY - 0.34, hipZ + 0.32);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      res.footPitchL = 0.28;
      res.footPitchR = 0.28;
      break;
    }

    case 'tricep_pushdown':
    case 'rope_pushdown': {
      res.cameraGroup = 'standing';
      const isRope = key === 'rope_pushdown';
      const push = p; // 0 = 95° top start, 1 = full lockout at bottom
      const lean = 0.12;

      res.hipsPos.set(0, 0.92, -0.04);
      res.shoulderCenter.set(
        0,
        0.92 + Math.cos(lean) * TORSO_LEN,
        -0.04 + Math.sin(lean) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(lean), Math.cos(lean)).normalize();
      res.headLookDir.set(0, -0.06, 1).normalize();

      // Elbows pinned strictly UPPER_ARM_LEN below shoulders
      const shY = res.shoulderCenter.y - BODY_METRICS.SHOULDER_DROP_FROM_TOP;
      const shZ = res.shoulderCenter.z;
      const elbowY = shY - UPPER_ARM_LEN * 0.96;
      const elbowZ = shZ + 0.05;

      // Forearm rotates from 95° forward-up to 15° straight-down lockout
      const extRad = THREE.MathUtils.degToRad(95 - 82 * push);
      const handY = elbowY - Math.cos(extRad) * FOREARM_LEN;
      const handZ = elbowZ + Math.sin(extRad) * FOREARM_LEN;
      const handX = isRope ? 0.15 + 0.13 * Math.pow(push, 1.4) : 0.17;

      res.handL.set(-handX, handY, handZ);
      res.handR.set(handX, handY, handZ);
      res.elbowPoleL.set(-0.24, elbowY, elbowZ - 0.32);
      res.elbowPoleR.set(0.24, elbowY, elbowZ - 0.32);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      eq.showCableBar = true;
      eq.cableBarPos.set(0, handY, handZ);
      eq.cableAnchorTop.set(0, 2.22, handZ + 0.08);

      res.footL.set(-0.15, ANKLE_HEIGHT, -0.02);
      res.footR.set(0.15, ANKLE_HEIGHT, 0.06);
      res.kneePoleL.set(-0.16, 0.50, 0.48);
      res.kneePoleR.set(0.16, 0.50, 0.52);
      break;
    }

    case 'overhead_tricep_ext': {
      res.cameraGroup = 'standing';
      const ext = p; // 0 = behind head stretch, 1 = full overhead lockout
      res.hipsPos.set(0, 0.935, 0);
      res.shoulderCenter.set(0, 0.935 + TORSO_LEN, 0);
      res.torsoAnterior.set(0, 0, 1);
      res.headLookDir.set(0, 0.04, 1).normalize();

      const shY = res.shoulderCenter.y - BODY_METRICS.SHOULDER_DROP_FROM_TOP;
      const elbowY = shY + UPPER_ARM_LEN * 0.95;
      const elbowZ = 0.04;
      // Forearm arcs from behind head (-115° from straight up) to vertical overhead (-8°)
      const flexFromUp = THREE.MathUtils.degToRad(118 - 108 * ext);
      const handY = elbowY + Math.cos(flexFromUp) * FOREARM_LEN;
      const handZ = elbowZ - Math.sin(flexFromUp) * FOREARM_LEN;

      res.handL.set(-0.12, handY, handZ);
      res.handR.set(0.12, handY, handZ);
      res.elbowPoleL.set(-0.21, elbowY + 0.04, 0.32);
      res.elbowPoleR.set(0.21, elbowY + 0.04, 0.32);
      res.handMode = 'grip';
      eq.showDumbbells = true;
      eq.dumbbellLRot.set(0, 0, Math.PI / 2);
      eq.dumbbellRRot.set(0, 0, Math.PI / 2);

      res.footL.set(-0.15, ANKLE_HEIGHT, -0.02);
      res.footR.set(0.15, ANKLE_HEIGHT, 0.04);
      break;
    }

    // =========================================================================
    // MONDAY: CHEST & TRICEPS (HOME)
    // =========================================================================
    case 'pushup':
    case 'diamond_pushup':
    case 'close_grip_pushups':
    case 'decline_pushup': {
      res.cameraGroup = 'floor';
      const lift = 1 - p; // 1 = top plank (F0/F60), 0 = bottom chest near floor (F30)
      const isDiamond = key === 'diamond_pushup';
      const isClose = key === 'close_grip_pushups';
      const isDecline = key === 'decline_pushup';

      eq.showMat = !isDecline;
      res.groundY = eq.showMat ? MAT_TOP_Y : 0;

      const handSpread = isDiamond ? 0.085 : isClose ? 0.145 : 0.255;
      const footY = isDecline ? BENCH_TOP_Y + 0.065 : res.groundY + 0.072;
      const footZ = -0.84;

      if (isDecline) {
        eq.showFlatBench = true;
        eq.benchPos.set(0, 0, -1.08);
      }

      const plankAngle = isDecline
        ? THREE.MathUtils.degToRad(-12 + 16 * lift)
        : THREE.MathUtils.degToRad(7.5 + 16.5 * lift);
      const legDist = 0.785;
      const hipY = footY + legDist * Math.sin(plankAngle);
      const hipZ = footZ + legDist * Math.cos(plankAngle);
      const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
      const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

      res.hipsPos.set(0, Math.max(res.groundY + 0.13, hipY), hipZ);
      res.shoulderCenter.set(0, Math.max(res.groundY + 0.17, chestY), chestZ);
      res.torsoAnterior.set(0, -Math.cos(plankAngle), Math.sin(plankAngle)).normalize();
      res.headLookDir.set(0, -0.58, 0.81).normalize();
      res.spineArchOffset = 0.004;

      res.handL.set(-handSpread, res.groundY + 0.026, 0.36);
      res.handR.set(handSpread, res.groundY + 0.026, 0.36);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      const elbowSpread = isDiamond || isClose ? 0.24 : 0.42;
      res.elbowPoleL.set(-elbowSpread, res.shoulderCenter.y + 0.12, 0.06);
      res.elbowPoleR.set(elbowSpread, res.shoulderCenter.y + 0.12, 0.06);

      res.footL.set(-0.11, footY, footZ);
      res.footR.set(0.11, footY, footZ);
      res.kneePoleL.set(-0.11, (res.hipsPos.y + footY) * 0.5 - 0.22, (res.hipsPos.z + footZ) * 0.5);
      res.kneePoleR.set(0.11, (res.hipsPos.y + footY) * 0.5 - 0.22, (res.hipsPos.z + footZ) * 0.5);
      res.footModeL = isDecline ? 'bench_rest' : 'plantar_toes_floor';
      res.footModeR = isDecline ? 'bench_rest' : 'plantar_toes_floor';
      break;
    }

    case 'chair_dips':
    case 'bench_dips': {
      // ZERO BENCH CLIPPING:
      // Bench sits cleanly BEHIND athlete (bench center z = -0.76 -> front edge at z = -0.14, top at y = 0.455).
      // Palms press strictly ON TOP of front edge (z = -0.16, y = 0.468).
      // Hips stay strictly IN FRONT of bench edge (z = +0.11 -> back at z ≈ 0.0, clear by 14 cm!).
      // Elbows flex strictly backward ABOVE bench pad (never passing through pad!).
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, -0.76); // Front edge strictly at z = -0.14
      const isChair = key === 'chair_dips';
      const dip = p; // 0 = top lockout, 1 = bottom 90° dip

      const hipY = 0.50 - 0.19 * dip; // 0.50m down to 0.31m (strictly above floor y=0)
      const hipZ = 0.11; // Strictly in front of bench edge (-0.14)
      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(0, hipY + TORSO_LEN, hipZ - 0.04);
      res.torsoAnterior.set(0, 0.07, 0.997).normalize();
      res.headLookDir.set(0, -0.05, 0.998).normalize();
      res.spineArchOffset = 0.008;

      // Palms anchored squarely on top front edge of bench
      res.handL.set(-0.22, BENCH_TOP_Y + 0.015, -0.16);
      res.handR.set(0.22, BENCH_TOP_Y + 0.015, -0.16);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      // Elbows flex cleanly backward and slightly upward above the bench pad
      res.elbowPoleL.set(-0.26, Math.max(BENCH_TOP_Y + 0.20, hipY + 0.36), -0.58);
      res.elbowPoleR.set(0.26, Math.max(BENCH_TOP_Y + 0.20, hipY + 0.36), -0.58);

      // Chair Dips: knees slightly bent (~45°) closer in; Bench Dips: straighter legs extended forward
      if (isChair) {
        res.footL.set(-0.13, ANKLE_HEIGHT, 0.62);
        res.footR.set(0.13, ANKLE_HEIGHT, 0.62);
        res.kneePoleL.set(-0.14, 0.48, 0.46);
        res.kneePoleR.set(0.14, 0.48, 0.46);
      } else {
        res.footL.set(-0.12, ANKLE_HEIGHT, 0.84);
        res.footR.set(0.12, ANKLE_HEIGHT, 0.84);
        res.kneePoleL.set(-0.13, 0.42, 0.50);
        res.kneePoleR.set(0.13, 0.42, 0.50);
      }
      res.footModeL = 'flat_floor';
      res.footModeR = 'flat_floor';
      break;
    }

    case 'pike_pushup':
    case 'pike_press': {
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const dip = p; // 0 = top inverted-V, 1 = head lowered forward in triangle
      const isDeep = key === 'pike_press';

      const hipY = 0.86 - 0.08 * dip;
      const hipZ = -0.20 + 0.04 * dip;
      res.hipsPos.set(0, hipY, hipZ);

      const shY = 0.49 - (isDeep ? 0.21 : 0.17) * dip;
      const shZ = 0.24 + 0.10 * dip;
      res.shoulderCenter.set(0, shY, shZ);
      res.torsoAnterior.set(0, -0.62, -0.78).normalize();
      res.headLookDir.set(0, -0.82, 0.57).normalize();
      res.spineArchOffset = 0.005;

      res.handL.set(-0.24, res.groundY + 0.026, 0.34);
      res.handR.set(0.24, res.groundY + 0.026, 0.34);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);
      res.elbowPoleL.set(-0.42, shY + 0.12, 0.10);
      res.elbowPoleR.set(0.42, shY + 0.12, 0.10);

      res.footL.set(-0.14, res.groundY + 0.072, -0.66);
      res.footR.set(0.14, res.groundY + 0.072, -0.66);
      res.kneePoleL.set(-0.14, 0.44, -0.34);
      res.kneePoleR.set(0.14, 0.44, -0.34);
      res.footModeL = 'plantar_toes_floor';
      res.footModeR = 'plantar_toes_floor';
      break;
    }

    // =========================================================================
    // TUESDAY: BACK & BICEPS (GYM & HOME)
    // =========================================================================
    case 'pull_ups': {
      res.cameraGroup = 'hanging';
      eq.showPullupRig = true;
      const pull = p; // 0 = active dead hang, 1 = chin clearly over bar (y > 2.12)

      // Calibrated strictly within arm reach (max shoulder->bar <= 0.545 < 0.565) so shoulders NEVER detach!
      const hipY = 1.09 + 0.37 * pull; // 1.09m -> 1.46m
      const hipZ = -0.02 - 0.05 * pull;
      res.hipsPos.set(0, hipY, hipZ);

      const arch = -0.14 * pull;
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(arch) * TORSO_LEN, // 1.645 -> 2.01
        hipZ + Math.sin(arch) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(arch), Math.cos(arch)).normalize();
      res.headLookDir.set(0, 0.12 * pull, 1).normalize();
      res.spineArchOffset = 0.015 * pull;

      // Hands firmly gripping overhead pull-up bar at BAR_Y = 2.12
      res.handL.set(-0.34, BAR_Y, 0.0);
      res.handR.set(0.34, BAR_Y, 0.0);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, -0.35, -0.94).normalize();

      // Elbows drive down and slightly outward-back (lat activation)
      res.elbowPoleL.set(-0.62, res.shoulderCenter.y - 0.22, -0.14);
      res.elbowPoleR.set(0.62, res.shoulderCenter.y - 0.22, -0.14);

      // Legs hang cleanly with slight athletic knee bend behind
      res.footL.set(-0.10, hipY - 0.77, hipZ - 0.14 - 0.04 * pull);
      res.footR.set(0.10, hipY - 0.77, hipZ - 0.14 - 0.04 * pull);
      res.kneePoleL.set(-0.11, hipY - 0.38, hipZ + 0.30);
      res.kneePoleR.set(0.11, hipY - 0.38, hipZ + 0.30);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      res.footPitchL = 0.24;
      res.footPitchR = 0.24;
      break;
    }

    case 'lat_pulldown': {
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, -0.10);
      const pull = p;

      const hipY = BENCH_TOP_Y + 0.085;
      res.hipsPos.set(0, hipY, -0.06);
      const leanBack = -0.16 * pull;
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(leanBack) * TORSO_LEN,
        -0.06 + Math.sin(leanBack) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(leanBack), Math.cos(leanBack)).normalize();
      res.headLookDir.set(0, 0.12, 0.99).normalize();

      const barY = 1.56 - 0.44 * pull;
      const barZ = 0.10;
      eq.showCableBar = true;
      eq.cableBarPos.set(0, barY, barZ);
      eq.cableAnchorTop.set(0, 2.24, barZ);

      res.handL.set(-0.36, barY, barZ);
      res.handR.set(0.36, barY, barZ);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, -0.4, -0.9).normalize();
      res.elbowPoleL.set(-0.58, 0.90, -0.14);
      res.elbowPoleR.set(0.58, 0.90, -0.14);

      res.footL.set(-0.18, ANKLE_HEIGHT, 0.36);
      res.footR.set(0.18, ANKLE_HEIGHT, 0.36);
      res.kneePoleL.set(-0.19, 0.56, 0.42);
      res.kneePoleR.set(0.19, 0.56, 0.42);
      break;
    }

    case 'barbell_row': {
      res.cameraGroup = 'standing';
      const pull = p;
      const hipY = 0.85;
      const hipZ = -0.16;
      const torsoAngle = 0.76; // ~44 deg neutral hip hinge

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(torsoAngle) * TORSO_LEN,
        hipZ + Math.sin(torsoAngle) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
      res.headLookDir.set(0, -0.35, 0.94).normalize();
      res.spineArchOffset = 0.006;

      const barY = 0.68 + 0.25 * pull;
      const barZ = 0.24 - 0.13 * pull;
      eq.showBarbell = true;
      eq.barbellPos.set(0, barY, barZ);

      res.handL.set(-0.27, barY, barZ);
      res.handR.set(0.27, barY, barZ);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, 0.3, -0.95).normalize();
      res.elbowPoleL.set(-0.38, res.shoulderCenter.y + 0.14, hipZ - 0.26);
      res.elbowPoleR.set(0.38, res.shoulderCenter.y + 0.14, hipZ - 0.26);

      res.footL.set(-0.16, ANKLE_HEIGHT, 0.02);
      res.footR.set(0.16, ANKLE_HEIGHT, 0.02);
      res.kneePoleL.set(-0.17, 0.50, 0.42);
      res.kneePoleR.set(0.17, 0.50, 0.42);
      break;
    }

    case 'seated_cable_row': {
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, -0.14);
      const pull = p;

      const hipY = BENCH_TOP_Y + 0.085;
      res.hipsPos.set(0, hipY, -0.16);
      const torsoAngle = 0.14 * (1 - pull) - 0.06 * pull;
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(torsoAngle) * TORSO_LEN,
        -0.16 + Math.sin(torsoAngle) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
      res.headLookDir.set(0, 0, 1);

      const handZ = 0.34 - 0.32 * pull;
      const handY = 0.80 + 0.04 * pull;
      eq.showCableBar = true;
      eq.cableBarPos.set(0, handY, handZ);
      eq.cableAnchorTop.set(0, handY, 1.25);

      res.handL.set(-0.15, handY, handZ);
      res.handR.set(0.15, handY, handZ);
      res.handMode = 'grip';
      res.elbowPoleL.set(-0.34, 0.78, -0.45);
      res.elbowPoleR.set(0.34, 0.78, -0.45);

      res.footL.set(-0.15, 0.16, 0.58);
      res.footR.set(0.15, 0.16, 0.58);
      res.kneePoleL.set(-0.16, 0.46, 0.30);
      res.kneePoleR.set(0.16, 0.46, 0.30);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      break;
    }

    case 'barbell_curl':
    case 'ez_bar_curl':
    case 'hammer_curl': {
      res.cameraGroup = 'standing';
      const isBar = key === 'barbell_curl' || key === 'ez_bar_curl';
      const isHammer = key === 'hammer_curl';
      const curl = p;

      res.hipsPos.set(0, 0.935, 0);
      res.shoulderCenter.set(0, 0.935 + TORSO_LEN, 0);
      res.torsoAnterior.set(0, 0, 1);
      res.headLookDir.set(0, 0, 1);

      const shY = res.shoulderCenter.y - BODY_METRICS.SHOULDER_DROP_FROM_TOP;
      const elbowY = shY - UPPER_ARM_LEN * 0.98;
      const elbowZ = 0.02 + 0.02 * curl;

      const flexRad = THREE.MathUtils.degToRad(14 + 118 * curl); // 14° to 132° strictly within 150° limit
      const handY = elbowY - Math.cos(flexRad) * FOREARM_LEN;
      const handZ = elbowZ + Math.sin(flexRad) * FOREARM_LEN;
      const spreadX = key === 'ez_bar_curl' ? 0.21 : 0.24;

      res.handL.set(-spreadX, handY, handZ);
      res.handR.set(spreadX, handY, handZ);
      res.elbowPoleL.set(-0.24, elbowY, elbowZ - 0.32);
      res.elbowPoleR.set(0.24, elbowY, elbowZ - 0.32);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, 0.6, 0.8).normalize();

      if (isBar) {
        eq.showBarbell = true;
        eq.barbellPos.set(0, handY, handZ);
      } else {
        eq.showDumbbells = true;
        if (isHammer) {
          eq.dumbbellLRot.set(0, Math.PI / 2, 0);
          eq.dumbbellRRot.set(0, Math.PI / 2, 0);
        }
      }
      break;
    }

    case 'incline_curl': {
      // Reclined 45° on Incline Bench: upper arms hang vertically BEHIND torso for full bicep long-head stretch
      res.cameraGroup = 'bench';
      eq.showInclineBench = true;
      eq.inclineAngleRad = 0.78; // 45° incline backrest
      eq.benchPos.set(0, 0, -0.08);
      const curl = p;
      const inc = eq.inclineAngleRad;

      const hipY = BENCH_TOP_Y + 0.09;
      const hipZ = -0.02;
      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(
        0,
        hipY + Math.sin(inc) * TORSO_LEN,
        hipZ - Math.cos(inc) * TORSO_LEN
      );
      res.torsoAnterior.set(0, Math.cos(inc), Math.sin(inc)).normalize();
      res.headLookDir.set(0, 0.22, 0.97).normalize();

      const shY = res.shoulderCenter.y - 0.04;
      const shZ = res.shoulderCenter.z;
      const elbowY = shY - UPPER_ARM_LEN * 0.96;
      const elbowZ = shZ - 0.03;

      const flexRad = THREE.MathUtils.degToRad(12 + 112 * curl);
      const handY = elbowY - Math.cos(flexRad) * FOREARM_LEN;
      const handZ = elbowZ + Math.sin(flexRad) * FOREARM_LEN;

      res.handL.set(-0.24, handY, handZ);
      res.handR.set(0.24, handY, handZ);
      res.elbowPoleL.set(-0.27, elbowY, elbowZ - 0.30);
      res.elbowPoleR.set(0.27, elbowY, elbowZ - 0.30);
      res.handMode = 'grip';
      eq.showDumbbells = true;

      res.footL.set(-0.18, ANKLE_HEIGHT, 0.46);
      res.footR.set(0.18, ANKLE_HEIGHT, 0.46);
      res.kneePoleL.set(-0.19, 0.54, 0.34);
      res.kneePoleR.set(0.19, 0.54, 0.34);
      break;
    }

    case 'doorframe_rows': {
      // Inverted / Inclined Bodyweight Table/Bar Row: straight plank body pulling chest up to horizontal bar
      res.cameraGroup = 'floor';
      const pull = p;
      eq.showRowBar = true;
      eq.rowBarY = 0.92;
      eq.rowBarZ = 0.14;

      const footZ = -0.78;
      const footY = ANKLE_HEIGHT;
      const bodyAngle = THREE.MathUtils.degToRad(26 + 18 * pull); // Rises cleanly toward bar
      const legDist = 0.80;
      const hipY = footY + legDist * Math.sin(bodyAngle);
      const hipZ = footZ + legDist * Math.cos(bodyAngle);
      const chestY = hipY + TORSO_LEN * Math.sin(bodyAngle);
      const chestZ = hipZ + TORSO_LEN * Math.cos(bodyAngle);

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(0, chestY, chestZ);
      res.torsoAnterior.set(0, Math.cos(bodyAngle), -Math.sin(bodyAngle)).normalize();
      res.headLookDir.set(0, 0.72, -0.69).normalize();

      res.handL.set(-0.26, eq.rowBarY, eq.rowBarZ);
      res.handR.set(0.26, eq.rowBarY, eq.rowBarZ);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);
      res.elbowPoleL.set(-0.42, chestY - 0.18, chestZ - 0.20);
      res.elbowPoleR.set(0.42, chestY - 0.18, chestZ - 0.20);

      res.footL.set(-0.13, footY, footZ);
      res.footR.set(0.13, footY, footZ);
      res.kneePoleL.set(-0.14, (hipY + footY) * 0.5 + 0.18, (hipZ + footZ) * 0.5);
      res.kneePoleR.set(0.14, (hipY + footY) * 0.5 + 0.18, (hipZ + footZ) * 0.5);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      break;
    }

    case 'superman_pulls':
    case 'reverse_snow_angels': {
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const isAngel = key === 'reverse_snow_angels';
      const lift = p;

      res.hipsPos.set(0, res.groundY + 0.095, -0.10);
      res.shoulderCenter.set(0, res.groundY + 0.125 + 0.13 * lift, -0.10 + TORSO_LEN);
      res.torsoAnterior.set(0, -1, 0.20 * lift).normalize();
      res.headLookDir.set(0, -0.50 + 0.28 * lift, 0.88).normalize();
      res.spineArchOffset = -0.025 * lift;

      if (isAngel) {
        // Wide 160° horizontal hover arc from overhead to sides of thighs
        const sweepRad = THREE.MathUtils.degToRad(15 + 145 * lift);
        const reach = 0.52;
        const shY = res.shoulderCenter.y + 0.04;
        const shZ = res.shoulderCenter.z;
        res.handL.set(-0.18 - Math.sin(sweepRad) * reach, shY + 0.03, shZ + Math.cos(sweepRad) * reach);
        res.handR.set(0.18 + Math.sin(sweepRad) * reach, shY + 0.03, shZ + Math.cos(sweepRad) * reach);
        res.elbowPoleL.set(-0.46, shY + 0.18, shZ);
        res.elbowPoleR.set(0.46, shY + 0.18, shZ);
      } else {
        // Superman W-Pull: extended forward -> pull elbows back into W beside ribs
        const handZ = res.shoulderCenter.z + 0.44 - 0.38 * lift;
        const handX = 0.22 + 0.16 * lift;
        const handY = res.shoulderCenter.y + 0.06 + 0.06 * lift;
        res.handL.set(-handX, handY, handZ);
        res.handR.set(handX, handY, handZ);
        res.elbowPoleL.set(-0.46, handY + 0.12, res.shoulderCenter.z - 0.26);
        res.elbowPoleR.set(0.46, handY + 0.12, res.shoulderCenter.z - 0.26);
      }
      res.handMode = 'relaxed';

      const legLiftY = res.groundY + 0.075 + 0.11 * lift;
      res.footL.set(-0.14, legLiftY, -0.90);
      res.footR.set(0.14, legLiftY, -0.90);
      res.kneePoleL.set(-0.14, res.groundY - 0.12, -0.50); // Patella faces downward toward mat!
      res.kneePoleR.set(0.14, res.groundY - 0.12, -0.50);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      res.footPitchL = 0.45; // Natural pointed toes along mat
      res.footPitchR = 0.45;
      break;
    }

    case 'towel_bicep_curls':
    case 'isometric_towel_curls': {
      res.cameraGroup = 'standing';
      const isIso = key === 'isometric_towel_curls';
      const curl = isIso ? 0.62 + 0.08 * Math.sin(norm * Math.PI * 6) : p;

      res.hipsPos.set(0, 0.92, 0);
      res.shoulderCenter.set(0, 0.92 + TORSO_LEN, 0);
      res.torsoAnterior.set(0, 0, 1);
      res.headLookDir.set(0, -0.08, 1).normalize();

      const shY = res.shoulderCenter.y - BODY_METRICS.SHOULDER_DROP_FROM_TOP;
      const elbowY = shY - UPPER_ARM_LEN * 0.96;
      const elbowZ = 0.04;
      const flexRad = THREE.MathUtils.degToRad(32 + 90 * curl);
      const handY = elbowY - Math.cos(flexRad) * FOREARM_LEN;
      const handZ = elbowZ + Math.sin(flexRad) * FOREARM_LEN;

      res.handL.set(-0.18, handY, handZ);
      res.handR.set(0.18, handY, handZ);
      res.elbowPoleL.set(-0.24, elbowY, elbowZ - 0.30);
      res.elbowPoleR.set(0.24, elbowY, elbowZ - 0.30);
      res.handMode = 'grip';

      // Right foot steps slightly forward into towel loop
      res.footL.set(-0.15, ANKLE_HEIGHT, -0.06);
      res.footR.set(0.08, ANKLE_HEIGHT + (isIso ? 0 : 0.06 * curl), handZ);
      res.kneePoleL.set(-0.16, 0.50, 0.40);
      res.kneePoleR.set(0.08, 0.54, 0.52);
      res.footModeL = 'flat_floor';
      res.footModeR = isIso ? 'flat_floor' : 'tibia_aligned';

      eq.showTowel = true;
      eq.towelFootPos.set(res.footR.x, Math.max(0.02, res.footR.y - 0.05), res.footR.z + 0.04);
      break;
    }

    // =========================================================================
    // WEDNESDAY: LEGS (GYM & HOME)
    // =========================================================================
    case 'squats':
    case 'bodyweight_squats': {
      res.cameraGroup = 'standing';
      const isBarbell = key === 'squats';
      const depth = p;

      const hipY = 0.935 - 0.38 * depth;
      const hipZ = -0.22 * depth;
      res.hipsPos.set(0, hipY, hipZ);

      const leanAngle = (isBarbell ? 0.46 : 0.40) * depth;
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(leanAngle) * TORSO_LEN,
        hipZ + Math.sin(leanAngle) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(leanAngle), Math.cos(leanAngle)).normalize();
      res.headLookDir.set(0, 0.04, 1).normalize();

      res.footL.set(-0.17, ANKLE_HEIGHT, 0.02);
      res.footR.set(0.17, ANKLE_HEIGHT, 0.02);
      res.kneePoleL.set(-0.23, 0.48, 0.60);
      res.kneePoleR.set(0.23, 0.48, 0.60);
      res.footModeL = 'flat_floor';
      res.footModeR = 'flat_floor';

      if (isBarbell) {
        // High-bar back squat: barbell rests on upper traps behind neck, hands gripping bar
        const barY = res.shoulderCenter.y - 0.03;
        const barZ = res.shoulderCenter.z - 0.11;
        eq.showBarbell = true;
        eq.barbellPos.set(0, barY, barZ);
        res.handL.set(-0.34, barY, barZ);
        res.handR.set(0.34, barY, barZ);
        res.handMode = 'grip';
        res.elbowPoleL.set(-0.42, barY - 0.26, barZ - 0.14);
        res.elbowPoleR.set(0.42, barY - 0.26, barZ - 0.14);
      } else {
        // Bodyweight squat with parallel forward counterbalance arms
        const armSwing = depth * THREE.MathUtils.degToRad(86);
        const reach = 0.54;
        const shY = res.shoulderCenter.y - 0.05;
        const shZ = res.shoulderCenter.z;
        res.handL.set(-0.19, shY - Math.cos(armSwing) * reach, shZ + Math.sin(armSwing) * reach + 0.03 * (1 - depth));
        res.handR.set(0.19, shY - Math.cos(armSwing) * reach, shZ + Math.sin(armSwing) * reach + 0.03 * (1 - depth));
        res.elbowPoleL.set(-0.22, shY - Math.cos(armSwing) * 0.26 - 0.20 * depth, shZ + Math.sin(armSwing) * 0.24 - 0.20 * (1 - depth));
        res.elbowPoleR.set(0.22, shY - Math.cos(armSwing) * 0.26 - 0.20 * depth, shZ + Math.sin(armSwing) * 0.24 - 0.20 * (1 - depth));
        res.handMode = 'relaxed';
      }
      break;
    }

    case 'leg_press': {
      // Authentic 45° Seated Leg Press on Incline Bench
      res.cameraGroup = 'bench';
      eq.showInclineBench = true;
      eq.inclineAngleRad = 0.65; // ~37° reclined sled seat
      eq.benchPos.set(0, 0, -0.18);
      const press = 1 - p; // 0 = knees bent 95° toward chest, 1 = extended along 45° sled
      const inc = eq.inclineAngleRad;

      const hipY = BENCH_TOP_Y + 0.095;
      const hipZ = -0.10;
      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(
        0,
        hipY + Math.sin(inc) * TORSO_LEN,
        hipZ - Math.cos(inc) * TORSO_LEN
      );
      res.torsoAnterior.set(0, Math.cos(inc), Math.sin(inc)).normalize();
      res.headLookDir.set(0, 0.35, 0.94).normalize();

      // Hands grip seat handles beside hips
      res.handL.set(-0.24, hipY - 0.02, hipZ + 0.04);
      res.handR.set(0.24, hipY - 0.02, hipZ + 0.04);
      res.elbowPoleL.set(-0.34, hipY + 0.16, hipZ - 0.22);
      res.elbowPoleR.set(0.34, hipY + 0.16, hipZ - 0.22);
      res.handMode = 'grip';

      // Feet travel cleanly along 45° forward-upward sled vector
      const sledDist = 0.46 + 0.34 * press;
      const sledAngle = THREE.MathUtils.degToRad(38);
      const fy = hipY + Math.sin(sledAngle) * sledDist;
      const fz = hipZ + Math.cos(sledAngle) * sledDist;
      res.footL.set(-0.16, fy, fz);
      res.footR.set(0.16, fy, fz);
      res.kneePoleL.set(-0.18, fy + 0.32, fz - 0.38);
      res.kneePoleR.set(0.18, fy + 0.32, fz - 0.38);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      break;
    }

    case 'romanian_deadlift': {
      res.cameraGroup = 'standing';
      const depth = p;
      const hipY = 0.92 - 0.13 * depth;
      const hipZ = -0.24 * depth;
      res.hipsPos.set(0, hipY, hipZ);

      const torsoAngle = 0.96 * depth;
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(torsoAngle) * TORSO_LEN,
        hipZ + Math.sin(torsoAngle) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
      res.headLookDir.set(0, -0.35 * depth, 1).normalize();
      res.spineArchOffset = 0.008;

      const barY = Math.max(0.32, res.shoulderCenter.y - 0.54);
      const barZ = 0.13;
      eq.showBarbell = true;
      eq.barbellPos.set(0, barY, barZ);
      res.handL.set(-0.25, barY, barZ);
      res.handR.set(0.25, barY, barZ);
      res.handMode = 'grip';
      res.elbowPoleL.set(-0.34, barY + 0.28, -0.14);
      res.elbowPoleR.set(0.34, barY + 0.28, -0.14);

      res.footL.set(-0.15, ANKLE_HEIGHT, 0);
      res.footR.set(0.15, ANKLE_HEIGHT, 0);
      res.kneePoleL.set(-0.16, 0.50, 0.36);
      res.kneePoleR.set(0.16, 0.50, 0.36);
      break;
    }

    case 'walking_lunges': {
      // Alternating Left/Right Lunge Cycle with Natural Depth & Upright Torso
      res.cameraGroup = 'standing';
      const half = norm < 0.5 ? norm * 2 : (norm - 0.5) * 2;
      const isLeftFront = norm < 0.5;
      const depth = easeCycle(half);

      const hipY = 0.91 - 0.27 * depth;
      res.hipsPos.set(0, hipY, 0);
      res.shoulderCenter.set(0, hipY + TORSO_LEN, 0.05 * depth);
      res.torsoAnterior.set(0, -0.07 * depth, 1).normalize();
      res.headLookDir.set(0, 0, 1);

      const frontZ = 0.16 + 0.24 * depth;
      const backZ = -0.16 - 0.32 * depth;

      if (isLeftFront) {
        res.footL.set(-0.14, ANKLE_HEIGHT, frontZ);
        res.footR.set(0.14, ANKLE_HEIGHT + 0.015 * depth, backZ);
        res.kneePoleL.set(-0.15, 0.50, frontZ + 0.45);
        res.kneePoleR.set(0.15, 0.14, backZ + 0.62);
        res.footModeL = 'flat_floor';
        res.footModeR = 'plantar_toes_floor';
      } else {
        res.footR.set(0.14, ANKLE_HEIGHT, frontZ);
        res.footL.set(-0.14, ANKLE_HEIGHT + 0.015 * depth, backZ);
        res.kneePoleR.set(0.15, 0.50, frontZ + 0.45);
        res.kneePoleL.set(-0.15, 0.14, backZ + 0.62);
        res.footModeR = 'flat_floor';
        res.footModeL = 'plantar_toes_floor';
      }

      eq.showDumbbells = true;
      eq.dumbbellLRot.set(0, Math.PI / 2, 0);
      eq.dumbbellRRot.set(0, Math.PI / 2, 0);
      res.handL.set(-0.24, hipY - 0.04, 0.04);
      res.handR.set(0.24, hipY - 0.04, 0.04);
      res.elbowPoleL.set(-0.32, hipY + 0.24, -0.20);
      res.elbowPoleR.set(0.32, hipY + 0.24, -0.20);
      res.handMode = 'grip';
      break;
    }

    case 'bulgarian_split_squats': {
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, -1.04); // Front edge at z = -0.42
      const depth = p;

      const hipY = 0.90 - 0.26 * depth;
      res.hipsPos.set(0, hipY, 0.08);
      res.shoulderCenter.set(0, hipY + TORSO_LEN, 0.12 + 0.05 * depth);
      res.torsoAnterior.set(0, -0.10 * depth, 0.995).normalize();
      res.headLookDir.set(0, 0, 1);

      res.footL.set(-0.14, ANKLE_HEIGHT, 0.44);
      res.footR.set(0.14, BENCH_TOP_Y + 0.06, -0.44);
      res.kneePoleL.set(-0.15, 0.50, 0.88);
      res.kneePoleR.set(0.15, 0.18, 0.22);
      res.footModeL = 'flat_floor';
      res.footModeR = 'bench_rest';

      res.handL.set(-0.24, hipY - 0.02, 0.12);
      res.handR.set(0.24, hipY - 0.02, 0.12);
      res.elbowPoleL.set(-0.32, hipY + 0.26, -0.14);
      res.elbowPoleR.set(0.32, hipY + 0.26, -0.14);
      res.handMode = 'relaxed';
      break;
    }

    case 'leg_curl': {
      // Prone Hamstring Leg Curl on Flat Bench (Knees at bench rear edge, curling heels up toward glutes)
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, 0.04); // Rear edge at z = -0.58
      const curl = p;
      const bodyY = BENCH_TOP_Y + 0.105;

      res.hipsPos.set(0, bodyY, -0.16);
      res.shoulderCenter.set(0, bodyY + 0.02, -0.16 + TORSO_LEN);
      res.torsoAnterior.set(0, -1, 0.06).normalize();
      res.headLookDir.set(0, -0.55, 0.83).normalize();

      // Hands hold front bench edge for stability
      res.handL.set(-0.20, BENCH_TOP_Y - 0.02, 0.48);
      res.handR.set(0.20, BENCH_TOP_Y - 0.02, 0.48);
      res.elbowPoleL.set(-0.34, bodyY + 0.12, 0.26);
      res.elbowPoleR.set(0.34, bodyY + 0.12, 0.26);
      res.handMode = 'grip';

      // Knees rest cleanly at bench edge (z = -0.56); shins curl upward 14° -> 118°
      const curlAngle = THREE.MathUtils.degToRad(14 + 104 * curl);
      const kneeY = bodyY - 0.02;
      const kneeZ = -0.57;
      res.footL.set(-0.13, kneeY + Math.sin(curlAngle) * CALF_LEN, kneeZ - Math.cos(curlAngle) * CALF_LEN);
      res.footR.set(0.13, kneeY + Math.sin(curlAngle) * CALF_LEN, kneeZ - Math.cos(curlAngle) * CALF_LEN);
      res.kneePoleL.set(-0.13, kneeY - 0.36, kneeZ - 0.05); // Patella faces downward onto bench pad
      res.kneePoleR.set(0.13, kneeY - 0.36, kneeZ - 0.05);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      break;
    }

    case 'calf_raises': {
      res.cameraGroup = 'standing';
      const lift = p;
      const riseY = 0.082 * lift;

      res.hipsPos.set(0, 0.935 + riseY, 0.015 * lift);
      res.shoulderCenter.set(0, 0.935 + TORSO_LEN + riseY, 0.015 * lift);
      res.torsoAnterior.set(0, 0, 1);
      res.headLookDir.set(0, 0, 1);

      eq.showDumbbells = true;
      eq.dumbbellLRot.set(0, Math.PI / 2, 0);
      eq.dumbbellRRot.set(0, Math.PI / 2, 0);
      res.handL.set(-0.24, 0.80 + riseY, 0.04);
      res.handR.set(0.24, 0.80 + riseY, 0.04);
      res.elbowPoleL.set(-0.33, 1.14 + riseY, -0.22);
      res.elbowPoleR.set(0.33, 1.14 + riseY, -0.22);
      res.handMode = 'grip';

      res.footL.set(-0.145, ANKLE_HEIGHT + riseY, 0);
      res.footR.set(0.145, ANKLE_HEIGHT + riseY, 0);
      res.kneePoleL.set(-0.15, 0.54 + riseY, 0.48);
      res.kneePoleR.set(0.15, 0.54 + riseY, 0.48);
      res.footModeL = lift > 0.08 ? 'plantar_toes_floor' : 'flat_floor';
      res.footModeR = lift > 0.08 ? 'plantar_toes_floor' : 'flat_floor';
      res.footPitchL = 0.52 * lift;
      res.footPitchR = 0.52 * lift;
      break;
    }

    case 'glute_bridges': {
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const lift = p;

      res.hipsPos.set(0, res.groundY + 0.115 + 0.25 * lift, -0.06);
      res.shoulderCenter.set(0, res.groundY + 0.125, -0.06 - TORSO_LEN);
      res.torsoAnterior.set(0, 1, -0.35 * lift).normalize();
      res.headLookDir.set(0, 0.88, 0.47).normalize();
      res.spineArchOffset = 0.01;

      res.handL.set(-0.24, res.groundY + 0.032, -0.08);
      res.handR.set(0.24, res.groundY + 0.032, -0.08);
      res.elbowPoleL.set(-0.34, res.groundY + 0.07, -0.36);
      res.elbowPoleR.set(0.34, res.groundY + 0.07, -0.36);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      res.footL.set(-0.15, res.groundY + ANKLE_HEIGHT, 0.46);
      res.footR.set(0.15, res.groundY + ANKLE_HEIGHT, 0.46);
      res.kneePoleL.set(-0.16, 0.58, 0.26);
      res.kneePoleR.set(0.16, 0.58, 0.26);
      res.footModeL = 'flat_floor';
      res.footModeR = 'flat_floor';
      break;
    }

    // =========================================================================
    // THURSDAY: SHOULDERS (GYM & HOME)
    // =========================================================================
    case 'overhead_press': {
      res.cameraGroup = 'standing';
      const press = p;

      res.hipsPos.set(0, 0.935, 0);
      res.shoulderCenter.set(0, 0.935 + TORSO_LEN, -0.02 * (1 - press));
      res.torsoAnterior.set(0, 0, 1);
      res.headLookDir.set(0, 0.06, 1).normalize();

      const barY = 1.44 + 0.50 * press;
      const barZ = 0.14 - 0.12 * press;
      eq.showBarbell = true;
      eq.barbellPos.set(0, barY, barZ);

      res.handL.set(-0.30, barY, barZ);
      res.handR.set(0.30, barY, barZ);
      res.handMode = 'grip';
      res.palmNormalHint = new THREE.Vector3(0, 0.4, 0.9).normalize();
      res.elbowPoleL.set(-0.42, 1.16 + 0.30 * press, 0.24 - 0.10 * press);
      res.elbowPoleR.set(0.42, 1.16 + 0.30 * press, 0.24 - 0.10 * press);
      break;
    }

    case 'lateral_raises': {
      res.cameraGroup = 'standing';
      const raise = p;
      res.hipsPos.set(0, 0.935, 0);
      res.shoulderCenter.set(0, 0.935 + TORSO_LEN, 0);

      const shY = res.shoulderCenter.y - BODY_METRICS.SHOULDER_DROP_FROM_TOP;
      const abd = THREE.MathUtils.degToRad(14 + 74 * raise);
      const reach = 0.525; // Soft ~15° elbow bend

      res.handL.set(-0.18 - Math.sin(abd) * reach, shY - Math.cos(abd) * reach, 0.12 * Math.sin(abd));
      res.handR.set(0.18 + Math.sin(abd) * reach, shY - Math.cos(abd) * reach, 0.12 * Math.sin(abd));
      res.elbowPoleL.set(-0.22 - Math.sin(abd) * 0.26, shY - Math.cos(abd) * 0.26 + 0.12, -0.18);
      res.elbowPoleR.set(0.22 + Math.sin(abd) * 0.26, shY - Math.cos(abd) * 0.26 + 0.12, -0.18);
      res.handMode = 'grip';

      eq.showDumbbells = true;
      eq.dumbbellLRot.set(0, Math.PI / 2, 0);
      eq.dumbbellRRot.set(0, Math.PI / 2, 0);
      break;
    }

    case 'front_raises': {
      res.cameraGroup = 'standing';
      const raise = p;
      res.hipsPos.set(0, 0.935, 0);
      res.shoulderCenter.set(0, 0.935 + TORSO_LEN, 0);

      const shY = res.shoulderCenter.y - BODY_METRICS.SHOULDER_DROP_FROM_TOP;
      const flx = THREE.MathUtils.degToRad(12 + 78 * raise);
      const reach = 0.525;

      res.handL.set(-0.20, shY - Math.cos(flx) * reach, Math.sin(flx) * reach + 0.04);
      res.handR.set(0.20, shY - Math.cos(flx) * reach, Math.sin(flx) * reach + 0.04);
      res.elbowPoleL.set(-0.24, shY - Math.cos(flx) * 0.25 - 0.16, Math.sin(flx) * 0.22 - 0.18);
      res.elbowPoleR.set(0.24, shY - Math.cos(flx) * 0.25 - 0.16, Math.sin(flx) * 0.22 - 0.18);
      res.handMode = 'grip';
      eq.showDumbbells = true;
      break;
    }

    case 'rear_delt_fly': {
      res.cameraGroup = 'standing';
      const fly = p;
      const hipY = 0.86;
      const hipZ = -0.18;
      const torsoAngle = 0.86; // ~49° bent-over hinge

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(torsoAngle) * TORSO_LEN,
        hipZ + Math.sin(torsoAngle) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
      res.headLookDir.set(0, -0.45, 0.89).normalize();

      const shY = res.shoulderCenter.y - 0.03;
      const shZ = res.shoulderCenter.z;
      const abd = THREE.MathUtils.degToRad(14 + 74 * fly);
      const reach = 0.51;

      res.handL.set(-0.18 - Math.sin(abd) * reach, shY - Math.cos(abd) * reach, shZ + 0.05 * (1 - fly));
      res.handR.set(0.18 + Math.sin(abd) * reach, shY - Math.cos(abd) * reach, shZ + 0.05 * (1 - fly));
      res.elbowPoleL.set(-0.46, shY + 0.18, shZ - 0.18);
      res.elbowPoleR.set(0.46, shY + 0.18, shZ - 0.18);
      res.handMode = 'grip';
      eq.showDumbbells = true;

      res.footL.set(-0.16, ANKLE_HEIGHT, 0.02);
      res.footR.set(0.16, ANKLE_HEIGHT, 0.02);
      res.kneePoleL.set(-0.17, 0.50, 0.40);
      res.kneePoleR.set(0.17, 0.50, 0.40);
      break;
    }

    case 'shrugs': {
      // Authentic Standing Dumbbell Shrugs:
      // Shoulders/traps elevate vertically (+0.058m) toward ears while arms hang straight & connected (ZERO detachment!)
      res.cameraGroup = 'standing';
      const shrug = p;
      const elev = 0.058 * shrug;

      res.hipsPos.set(0, 0.935, 0);
      res.shoulderCenter.set(0, 0.935 + TORSO_LEN, 0); // Torso/neck length stays anatomical!
      res.shoulderShrugY = elev; // Elevates shoulder sockets & trapezius ridge cleanly!
      res.torsoAnterior.set(0, 0, 1);
      res.headLookDir.set(0, 0, 1);

      const shY = res.shoulderCenter.y - BODY_METRICS.SHOULDER_DROP_FROM_TOP + elev;
      // Straight arms hanging strictly (UPPER_ARM + FOREARM - 0.015) below elevated shoulder sockets
      const armDrop = UPPER_ARM_LEN + FOREARM_LEN - 0.018;
      res.handL.set(-0.235, shY - armDrop, 0.03);
      res.handR.set(0.235, shY - armDrop, 0.03);
      res.elbowPoleL.set(-0.28, shY - UPPER_ARM_LEN, -0.18);
      res.elbowPoleR.set(0.28, shY - UPPER_ARM_LEN, -0.18);
      res.handMode = 'grip';

      eq.showDumbbells = true;
      eq.dumbbellLRot.set(0, Math.PI / 2, 0);
      eq.dumbbellRRot.set(0, Math.PI / 2, 0);
      break;
    }

    case 'plank_downward_dog': {
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const dog = p; // 0 = High Plank, 1 = Inverted-V Downward Dog

      const footZ = -0.80;
      const footY = res.groundY + 0.072;
      const hipY = THREE.MathUtils.lerp(0.32, 0.88, dog);
      const hipZ = THREE.MathUtils.lerp(-0.04, -0.26, dog);
      const chestY = THREE.MathUtils.lerp(0.49, 0.48, dog);
      const chestZ = THREE.MathUtils.lerp(0.46, 0.16, dog);

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(0, chestY, chestZ);
      res.torsoAnterior.set(0, -Math.cos(0.3 + 0.65 * dog), Math.sin(0.3 - 0.9 * dog)).normalize();
      res.headLookDir.set(0, -0.6 - 0.25 * dog, 0.78 - 0.9 * dog).normalize();

      res.handL.set(-0.23, res.groundY + 0.026, 0.46);
      res.handR.set(0.23, res.groundY + 0.026, 0.46);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);
      res.elbowPoleL.set(-0.34, chestY + 0.12, 0.20);
      res.elbowPoleR.set(0.34, chestY + 0.12, 0.20);

      res.footL.set(-0.13, footY, footZ);
      res.footR.set(0.13, footY, footZ);
      res.kneePoleL.set(-0.13, (hipY + footY) * 0.5 - 0.10, (hipZ + footZ) * 0.5 + 0.18 * dog);
      res.kneePoleR.set(0.13, (hipY + footY) * 0.5 - 0.10, (hipZ + footZ) * 0.5 + 0.18 * dog);
      res.footModeL = dog > 0.7 ? 'flat_floor' : 'plantar_toes_floor';
      res.footModeR = dog > 0.7 ? 'flat_floor' : 'plantar_toes_floor';
      break;
    }

    // =========================================================================
    // FRIDAY: ARMS (GYM & HOME — Additional Specifics)
    // =========================================================================
    case 'skull_crushers': {
      // Authentic Supine Flat-Bench EZ-Bar Skull Crushers (Upper arms fixed slightly angled back, elbows flexing to forehead)
      res.cameraGroup = 'bench';
      eq.showFlatBench = true;
      eq.benchPos.set(0, 0, -0.08);
      const ext = 1 - p; // 1 = arms extended vertically above chest, 0 = bar lowered smoothly above forehead
      const bodyY = BENCH_TOP_Y + 0.105;

      res.hipsPos.set(0, bodyY, -0.34);
      res.shoulderCenter.set(0, bodyY, -0.34 + TORSO_LEN);
      res.torsoAnterior.set(0, 1, 0);
      res.headLookDir.set(0, 1, 0);

      const shZ = res.shoulderCenter.z - 0.04;
      const elbowY = bodyY + UPPER_ARM_LEN * 0.96;
      const elbowZ = shZ + 0.07; // Slight backward upper-arm tilt toward head

      // Forearms hinge cleanly from 112° flexion (bar hovering near forehead) to 12° vertical lockout
      const flexRad = THREE.MathUtils.degToRad(112 - 100 * ext);
      const barY = elbowY + Math.cos(flexRad) * FOREARM_LEN;
      const barZ = elbowZ + Math.sin(flexRad) * FOREARM_LEN;

      eq.showBarbell = true;
      eq.barbellPos.set(0, barY, barZ);
      res.handL.set(-0.18, barY, barZ);
      res.handR.set(0.18, barY, barZ);
      res.handMode = 'grip';
      res.elbowPoleL.set(-0.22, elbowY, elbowZ - 0.28);
      res.elbowPoleR.set(0.22, elbowY, elbowZ - 0.28);

      res.footL.set(-0.22, ANKLE_HEIGHT, -0.78);
      res.footR.set(0.22, ANKLE_HEIGHT, -0.78);
      res.kneePoleL.set(-0.23, 0.56, -0.74);
      res.kneePoleR.set(0.23, 0.56, -0.74);
      break;
    }

    case 'bodyweight_tricep_ext': {
      // Authentic Plank Bodyweight Tricep Extensions on Mat:
      // Rigid straight body, palms planted ahead of shoulders, elbows lowering symmetrically to touch mat & extending back up!
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const ext = 1 - p; // 1 = extended high plank, 0 = forearms/elbows lowered onto mat

      const footZ = -0.84;
      const footY = res.groundY + 0.072;
      const plankAngle = THREE.MathUtils.degToRad(9.5 + 11.5 * ext);
      const legDist = 0.79;
      const hipY = footY + legDist * Math.sin(plankAngle);
      const hipZ = footZ + legDist * Math.cos(plankAngle);
      const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
      const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(0, chestY, chestZ);
      res.torsoAnterior.set(0, -Math.cos(plankAngle), Math.sin(plankAngle)).normalize();
      res.headLookDir.set(0, -0.58, 0.81).normalize();
      res.spineArchOffset = 0.004;

      // Hands stay planted ahead of shoulders; elbows hinge straight down onto mat
      res.handL.set(-0.19, res.groundY + 0.026, 0.52);
      res.handR.set(0.19, res.groundY + 0.026, 0.52);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);
      res.elbowPoleL.set(-0.21, res.groundY + 0.04, 0.16);
      res.elbowPoleR.set(0.21, res.groundY + 0.04, 0.16);

      res.footL.set(-0.11, footY, footZ);
      res.footR.set(0.11, footY, footZ);
      res.kneePoleL.set(-0.11, (hipY + footY) * 0.5 - 0.22, (hipZ + footZ) * 0.5);
      res.kneePoleR.set(0.11, (hipY + footY) * 0.5 - 0.22, (hipZ + footZ) * 0.5);
      res.footModeL = 'plantar_toes_floor';
      res.footModeR = 'plantar_toes_floor';
      break;
    }

    // =========================================================================
    // SATURDAY: CORE & CARDIO
    // =========================================================================
    case 'crunches': {
      // Lower back & pelvis anchored flat on mat, thoracic spine curls naturally upward, feet FLAT on mat!
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const curl = p;

      const baseY = res.groundY + 0.105;
      res.hipsPos.set(0, baseY, -0.06);
      const curlAngle = THREE.MathUtils.degToRad(4 + 30 * curl);
      res.shoulderCenter.set(
        0,
        baseY + Math.sin(curlAngle) * TORSO_LEN,
        -0.06 - Math.cos(curlAngle) * TORSO_LEN
      );
      res.torsoAnterior.set(0, Math.cos(curlAngle), Math.sin(curlAngle)).normalize();
      res.headLookDir.set(0, 0.72 - 0.22 * curl, 0.69 + 0.22 * curl).normalize();
      res.spineArchOffset = -0.038 * curl; // Natural spinal flexion curve (crunching ribs toward pelvis)

      // Fingertips rest lightly near temples (not pulling behind neck)
      const headMidY = res.shoulderCenter.y + 0.11 * Math.sin(curlAngle) + 0.09;
      const headMidZ = res.shoulderCenter.z - 0.11 * Math.cos(curlAngle) + 0.05;
      res.handL.set(-0.14, headMidY, headMidZ);
      res.handR.set(0.14, headMidY, headMidZ);
      res.elbowPoleL.set(-0.44, res.shoulderCenter.y + 0.06, res.shoulderCenter.z - 0.04);
      res.elbowPoleR.set(0.44, res.shoulderCenter.y + 0.06, res.shoulderCenter.z - 0.04);
      res.handMode = 'temple';

      // Feet strictly FLAT on mat, knees bent ~90° pointing skyward
      res.footL.set(-0.15, res.groundY + ANKLE_HEIGHT, 0.44);
      res.footR.set(0.15, res.groundY + ANKLE_HEIGHT, 0.44);
      res.kneePoleL.set(-0.16, 0.62, 0.24);
      res.kneePoleR.set(0.16, 0.62, 0.24);
      res.footModeL = 'flat_floor';
      res.footModeR = 'flat_floor';
      break;
    }

    case 'leg_raises': {
      // Supine Lying Leg Raises:
      // Lower back flat on mat, legs straight lifting smoothly 12° -> 84°,
      // kneePole strictly anterior (above-toward-head), feet strictly 'tibia_aligned' (toes face head/up, NEVER backward!)
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const lift = p;

      const baseY = res.groundY + 0.105;
      res.hipsPos.set(0, baseY, -0.06);
      res.shoulderCenter.set(0, baseY + 0.015, -0.06 - TORSO_LEN);
      res.torsoAnterior.set(0, 1, 0.03).normalize();
      res.headLookDir.set(0, 0.94, 0.34).normalize();
      res.spineArchOffset = 0.004;

      // Arms flat beside hips on mat stabilizing pelvis
      res.handL.set(-0.24, res.groundY + 0.028, -0.06);
      res.handR.set(0.24, res.groundY + 0.028, -0.06);
      res.elbowPoleL.set(-0.34, res.groundY + 0.06, -0.34);
      res.elbowPoleR.set(0.34, res.groundY + 0.06, -0.34);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      // Straight legs (tiny 6° micro-bend so IK pole is 100% deterministic)
      const legAngle = THREE.MathUtils.degToRad(12 + 72 * lift);
      const legReach = 0.815;
      const fx = 0.105;
      const fy = baseY + Math.sin(legAngle) * legReach;
      const fz = -0.06 + Math.cos(legAngle) * legReach;

      res.footL.set(-fx, fy, fz);
      res.footR.set(fx, fy, fz);

      // Anterior direction perpendicular to the leg vector (points UP & BACKWARD toward torso/head!)
      const antY = Math.cos(legAngle);
      const antZ = -Math.sin(legAngle);
      const midLegY = baseY + Math.sin(legAngle) * 0.42;
      const midLegZ = -0.06 + Math.cos(legAngle) * 0.42;
      res.kneePoleL.set(-fx, midLegY + antY * 0.40, midLegZ + antZ * 0.40);
      res.kneePoleR.set(fx, midLegY + antY * 0.40, midLegZ + antZ * 0.40);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      res.footPitchL = 0.14;
      res.footPitchR = 0.14;
      break;
    }

    case 'russian_twists': {
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const twist = Math.sin(norm * Math.PI * 2); // -1..+1 smooth left-right rotation

      res.hipsPos.set(0, res.groundY + 0.11, -0.08);
      res.shoulderCenter.set(0.06 * twist, res.groundY + 0.50, -0.46);
      res.torsoAnterior.set(0.55 * twist, 0.58, 0.60).normalize();
      res.headLookDir.set(0.40 * twist, 0.18, 0.90).normalize();
      res.spineArchOffset = 0.012;

      const claspX = 0.28 * twist;
      const claspY = res.groundY + 0.36;
      const claspZ = -0.10;
      res.handL.set(claspX - 0.04, claspY, claspZ);
      res.handR.set(claspX + 0.04, claspY, claspZ);
      res.elbowPoleL.set(-0.34 + 0.14 * twist, res.groundY + 0.30, -0.38);
      res.elbowPoleR.set(0.34 + 0.14 * twist, res.groundY + 0.30, -0.38);
      res.handMode = 'clasp';

      res.footL.set(-0.11 - 0.03 * twist, res.groundY + 0.20, 0.50);
      res.footR.set(0.11 - 0.03 * twist, res.groundY + 0.20, 0.50);
      res.kneePoleL.set(-0.13, res.groundY + 0.54, 0.22);
      res.kneePoleR.set(0.13, res.groundY + 0.54, 0.22);
      res.footModeL = 'tibia_aligned';
      res.footModeR = 'tibia_aligned';
      break;
    }

    case 'plank': {
      // Authentic Forearm Plank Hold on Exercise Mat:
      // Elbows directly beneath shoulders, forearms flat forward on mat, razor-straight head-to-heel line, subtle core breathing!
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const breath = Math.sin(norm * Math.PI * 2);

      const footZ = -0.86;
      const footY = res.groundY + 0.072;
      const plankAngle = THREE.MathUtils.degToRad(11.5);
      const legDist = 0.80;
      const hipY = footY + legDist * Math.sin(plankAngle) + breath * 0.006;
      const hipZ = footZ + legDist * Math.cos(plankAngle);
      const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
      const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(0, chestY, chestZ);
      res.torsoAnterior.set(0, -Math.cos(plankAngle), Math.sin(plankAngle)).normalize();
      res.headLookDir.set(0, -0.68, 0.73).normalize();
      res.spineArchOffset = 0.002;
      res.breathAmplitude = 0.009;

      // Forearms flat forward on mat; elbows directly beneath shoulders at y = matTop + 0.042
      const elbowZ = chestZ - 0.02;
      res.handL.set(-0.15, res.groundY + 0.028, elbowZ + FOREARM_LEN);
      res.handR.set(0.15, res.groundY + 0.028, elbowZ + FOREARM_LEN);
      res.elbowPoleL.set(-0.19, res.groundY + 0.03, elbowZ - 0.06);
      res.elbowPoleR.set(0.19, res.groundY + 0.03, elbowZ - 0.06);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      res.footL.set(-0.11, footY, footZ);
      res.footR.set(0.11, footY, footZ);
      res.kneePoleL.set(-0.11, (hipY + footY) * 0.5 - 0.22, (hipZ + footZ) * 0.5);
      res.kneePoleR.set(0.11, (hipY + footY) * 0.5 - 0.22, (hipZ + footZ) * 0.5);
      res.footModeL = 'plantar_toes_floor';
      res.footModeR = 'plantar_toes_floor';
      break;
    }

    case 'mountain_climbers': {
      res.cameraGroup = 'floor';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const driveL = p;
      const driveR = 1 - p;

      const footZBase = -0.84;
      const footYBase = res.groundY + 0.072;
      const plankAngle = THREE.MathUtils.degToRad(18);
      const legDist = 0.79;
      const hipY = footYBase + legDist * Math.sin(plankAngle);
      const hipZ = footZBase + legDist * Math.cos(plankAngle);
      const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
      const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(0, chestY, chestZ);
      res.torsoAnterior.set(0, -Math.cos(plankAngle), Math.sin(plankAngle)).normalize();
      res.headLookDir.set(0, -0.58, 0.81).normalize();
      res.spineArchOffset = 0.004;

      res.handL.set(-0.22, res.groundY + 0.026, chestZ + 0.02);
      res.handR.set(0.22, res.groundY + 0.026, chestZ + 0.02);
      res.elbowPoleL.set(-0.30, chestY + 0.05, chestZ - 0.24);
      res.elbowPoleR.set(0.30, chestY + 0.05, chestZ - 0.24);
      res.handMode = 'flat';
      res.palmNormalHint = new THREE.Vector3(0, -1, 0);

      res.footL.set(-0.12, footYBase + 0.14 * driveL, footZBase + 0.44 * driveL);
      res.footR.set(0.12, footYBase + 0.14 * driveR, footZBase + 0.44 * driveR);
      res.kneePoleL.set(-0.12, hipY - 0.14, (hipZ + res.footL.z) * 0.5 + 0.25 * driveL);
      res.kneePoleR.set(0.12, hipY - 0.14, (hipZ + res.footR.z) * 0.5 + 0.25 * driveR);
      res.footModeL = driveL > 0.25 ? 'tibia_aligned' : 'plantar_toes_floor';
      res.footModeR = driveR > 0.25 ? 'tibia_aligned' : 'plantar_toes_floor';
      break;
    }

    case 'burpees': {
      // Full Authentic 4-Phase Burpee Cycle (Squat -> Plank/Push-up -> Squat Snap -> Explosive Overhead Jump)
      res.cameraGroup = 'standing';
      res.groundY = 0;

      // Keyframe poses interpolated smoothly across norm ∈ [0, 1):
      // 0.00 - 0.22: Standing -> Deep Squat palms down
      // 0.22 - 0.50: Kick back into Push-Up Plank & chest dip
      // 0.50 - 0.72: Snap feet forward to Squat
      // 0.72 - 0.88: Explosive Vertical Jump with arms overhead
      // 0.88 - 1.00: Soft landing back to standing
      let hipY = 0.935;
      let hipZ = 0;
      let shY = 0.935 + TORSO_LEN;
      let shZ = 0;
      let antY = 0;
      let antZ = 1;
      let hY = 0.82;
      let hZ = 0.06;
      let hX = 0.23;
      let fY = ANKLE_HEIGHT;
      let fZ = 0;
      let isPlankPhase = false;

      if (norm < 0.22) {
        const t = smoothstep(0, 0.22, norm);
        hipY = THREE.MathUtils.lerp(0.935, 0.46, t);
        hipZ = THREE.MathUtils.lerp(0, -0.26, t);
        shY = THREE.MathUtils.lerp(1.49, 0.56, t);
        shZ = THREE.MathUtils.lerp(0, 0.24, t);
        antY = -0.82 * t;
        antZ = Math.sqrt(Math.max(0.05, 1 - antY * antY));
        hY = THREE.MathUtils.lerp(0.82, 0.03, t);
        hZ = THREE.MathUtils.lerp(0.06, 0.34, t);
        fZ = THREE.MathUtils.lerp(0, -0.08, t);
      } else if (norm < 0.50) {
        isPlankPhase = true;
        const tKick = smoothstep(0.22, 0.32, norm);
        const dip = Math.sin(smoothstep(0.30, 0.50, norm) * Math.PI);
        hipY = THREE.MathUtils.lerp(0.46, 0.30, tKick) - 0.11 * dip;
        hipZ = THREE.MathUtils.lerp(-0.26, -0.06, tKick);
        shY = THREE.MathUtils.lerp(0.56, 0.44, tKick) - 0.20 * dip;
        shZ = THREE.MathUtils.lerp(0.24, 0.44, tKick);
        antY = -0.96;
        antZ = 0.28;
        hY = 0.028;
        hZ = 0.38;
        hX = 0.24;
        fZ = THREE.MathUtils.lerp(-0.08, -0.82, tKick);
        fY = ANKLE_HEIGHT;
      } else if (norm < 0.72) {
        const tSnap = smoothstep(0.50, 0.68, norm);
        hipY = THREE.MathUtils.lerp(0.30, 0.54, tSnap);
        hipZ = THREE.MathUtils.lerp(-0.06, -0.22, tSnap);
        shY = THREE.MathUtils.lerp(0.44, 0.86, tSnap);
        shZ = THREE.MathUtils.lerp(0.44, 0.16, tSnap);
        antY = THREE.MathUtils.lerp(-0.96, -0.52, tSnap);
        antZ = Math.sqrt(Math.max(0.05, 1 - antY * antY));
        hY = THREE.MathUtils.lerp(0.028, 0.48, tSnap);
        hZ = THREE.MathUtils.lerp(0.38, 0.26, tSnap);
        fZ = THREE.MathUtils.lerp(-0.82, -0.02, tSnap);
        fY = ANKLE_HEIGHT;
      } else {
        const jumpWave = Math.sin(smoothstep(0.72, 0.98, norm) * Math.PI);
        const stand = smoothstep(0.72, 0.80, norm);
        const airY = 0.24 * jumpWave;
        hipY = THREE.MathUtils.lerp(0.54, 0.935, stand) + airY;
        hipZ = THREE.MathUtils.lerp(-0.22, 0, stand);
        shY = hipY + TORSO_LEN;
        shZ = hipZ;
        antY = 0;
        antZ = 1;
        hY = shY + 0.48 * jumpWave - 0.65 * (1 - jumpWave);
        hZ = 0.05;
        hX = 0.21;
        fY = ANKLE_HEIGHT + airY;
        fZ = 0;
      }

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(0, shY, shZ);
      res.torsoAnterior.set(0, antY, antZ).normalize();
      res.headLookDir.set(0, isPlankPhase ? -0.5 : 0.08, 0.86).normalize();

      res.handL.set(-hX, hY, hZ);
      res.handR.set(hX, hY, hZ);
      res.elbowPoleL.set(-0.38, Math.max(0.24, shY - 0.04), shZ - 0.22);
      res.elbowPoleR.set(0.38, Math.max(0.24, shY - 0.04), shZ - 0.22);
      res.handMode = isPlankPhase ? 'flat' : 'relaxed';
      res.palmNormalHint = isPlankPhase ? new THREE.Vector3(0, -1, 0) : null;

      res.footL.set(-0.15, fY, fZ);
      res.footR.set(0.15, fY, fZ);
      res.kneePoleL.set(-0.17, isPlankPhase ? hipY - 0.20 : 0.52 + (fY - ANKLE_HEIGHT), fZ + 0.45);
      res.kneePoleR.set(0.17, isPlankPhase ? hipY - 0.20 : 0.52 + (fY - ANKLE_HEIGHT), fZ + 0.45);
      res.footModeL = isPlankPhase
        ? 'plantar_toes_floor'
        : fY > ANKLE_HEIGHT + 0.04
        ? 'tibia_aligned'
        : 'flat_floor';
      res.footModeR = res.footModeL;
      break;
    }

    case 'running_cardio':
    case 'brisk_walk': {
      // Natural Contralateral Human Gait Cycle (Opposing Arm & Leg Drive, Heel-Strike -> Toe-Off Foot Roll)
      res.cameraGroup = 'standing';
      const isWalk = key === 'brisk_walk';
      const phase = norm * Math.PI * 2;
      const swing = Math.sin(phase); // Leg R forward when >0, Leg L forward when <0
      const bounce = (isWalk ? 0.022 : 0.062) * Math.abs(Math.sin(phase));

      const lean = isWalk ? 0.04 : 0.15;
      res.hipsPos.set(0, (isWalk ? 0.925 : 0.91) + bounce, 0);
      res.shoulderCenter.set(
        0,
        res.hipsPos.y + Math.cos(lean) * TORSO_LEN,
        Math.sin(lean) * TORSO_LEN
      );
      // Subtle counter-rotation of torso opposite pelvis
      res.torsoAnterior.set(0.10 * swing, -Math.sin(lean), Math.cos(lean)).normalize();
      res.headLookDir.set(0, 0, 1);
      res.spineArchOffset = 0.012;

      // Contralateral arms (Left arm swings forward when Right leg swings forward)
      const armAmp = isWalk ? 0.20 : 0.30;
      const armBaseY = isWalk ? 0.88 : 1.05;
      res.handL.set(-0.22, armBaseY + bounce + (isWalk ? 0.05 : 0.11) * swing, 0.12 + armAmp * swing);
      res.handR.set(0.22, armBaseY + bounce - (isWalk ? 0.05 : 0.11) * swing, 0.12 - armAmp * swing);
      res.elbowPoleL.set(-0.30, 1.12 + bounce, -0.26 - 0.16 * swing);
      res.elbowPoleR.set(0.30, 1.12 + bounce, -0.26 + 0.16 * swing);
      res.handMode = 'relaxed';

      // Stance & swing leg trajectory (feet strictly grounded during stance, clean knee recovery during swing!)
      const stride = isWalk ? 0.24 : 0.34;
      const liftAmp = isWalk ? 0.065 : 0.18;
      const liftL = Math.max(0, -Math.cos(phase)) * liftAmp;
      const liftR = Math.max(0, Math.cos(phase)) * liftAmp;

      const zL = -stride * swing;
      const zR = stride * swing;

      res.footL.set(-0.13, ANKLE_HEIGHT + liftL, zL);
      res.footR.set(0.13, ANKLE_HEIGHT + liftR, zR);
      res.kneePoleL.set(-0.14, 0.50 + liftL * 0.7, zL + 0.48);
      res.kneePoleR.set(0.14, 0.50 + liftR * 0.7, zR + 0.48);

      // Grounded stance foot stays flat/plantar; airborne swing foot aligns cleanly with tibia!
      res.footModeL = liftL < 0.015 ? (zL < -0.06 ? 'plantar_toes_floor' : 'flat_floor') : 'tibia_aligned';
      res.footModeR = liftR < 0.015 ? (zR < -0.06 ? 'plantar_toes_floor' : 'flat_floor') : 'tibia_aligned';
      res.footPitchL = liftL >= 0.015 ? 0.22 : 0;
      res.footPitchR = liftR >= 0.015 ? 0.22 : 0;
      break;
    }

    // =========================================================================
    // SUNDAY: RECOVERY, MOBILITY & SLEEP
    // =========================================================================
    case 'stretching_flow': {
      // Dynamic Overhead Reach -> Controlled Forward-Fold Hamstring Stretch on Mat
      res.cameraGroup = 'standing';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const fold = p; // 0 = tall overhead stretch, 1 = smooth hamstring forward fold

      const hipY = res.groundY + 0.92 - 0.08 * fold;
      const hipZ = -0.18 * fold;
      const bendAngle = THREE.MathUtils.degToRad(-8 + 94 * fold);

      res.hipsPos.set(0, hipY, hipZ);
      res.shoulderCenter.set(
        0,
        hipY + Math.cos(bendAngle) * TORSO_LEN,
        hipZ + Math.sin(bendAngle) * TORSO_LEN
      );
      res.torsoAnterior.set(0, -Math.sin(bendAngle), Math.cos(bendAngle)).normalize();
      res.headLookDir.set(0, -0.55 * fold + 0.15 * (1 - fold), 0.85).normalize();
      res.spineArchOffset = -0.02 * fold;

      // Arms glide smoothly from overhead stretch down toward shins/toes
      const reachY = THREE.MathUtils.lerp(1.98, res.groundY + 0.30, fold);
      const reachZ = THREE.MathUtils.lerp(0.02, 0.26, fold);
      res.handL.set(-0.20, reachY, reachZ);
      res.handR.set(0.20, reachY, reachZ);
      res.elbowPoleL.set(-0.34, THREE.MathUtils.lerp(1.70, 0.64, fold), -0.06);
      res.elbowPoleR.set(0.34, THREE.MathUtils.lerp(1.70, 0.64, fold), -0.06);
      res.handMode = 'relaxed';

      res.footL.set(-0.15, res.groundY + ANKLE_HEIGHT, 0);
      res.footR.set(0.15, res.groundY + ANKLE_HEIGHT, 0);
      res.kneePoleL.set(-0.16, 0.50, 0.36);
      res.kneePoleR.set(0.16, 0.50, 0.36);
      break;
    }

    case 'mobility_work': {
      // Controlled Articular Rotations (Thoracic Open-Book & Hip Mobility Squat Flow)
      res.cameraGroup = 'standing';
      eq.showMat = true;
      res.groundY = MAT_TOP_Y;
      const phase = norm * Math.PI * 2;
      const sway = Math.sin(phase);
      const deep = linP;

      const hipY = res.groundY + 0.86 - 0.16 * deep;
      res.hipsPos.set(0.06 * sway, hipY, -0.08 * deep);
      res.shoulderCenter.set(0.04 * sway, hipY + TORSO_LEN, 0.08 * deep);
      res.torsoAnterior.set(0.38 * sway, -0.10 * deep, 0.92).normalize();
      res.headLookDir.set(0.28 * sway, 0.08, 0.95).normalize();

      // Smooth shoulder CARs circle with alternating thoracic opening
      const shY = res.shoulderCenter.y - 0.04;
      res.handL.set(-0.38 - 0.14 * Math.cos(phase), shY + 0.26 * Math.sin(phase), 0.18 + 0.14 * sway);
      res.handR.set(0.38 + 0.14 * Math.cos(phase), shY - 0.26 * Math.sin(phase), 0.18 - 0.14 * sway);
      res.elbowPoleL.set(-0.46, shY - 0.12, -0.18);
      res.elbowPoleR.set(0.46, shY - 0.12, -0.18);
      res.handMode = 'relaxed';

      res.footL.set(-0.22, res.groundY + ANKLE_HEIGHT, 0.02);
      res.footR.set(0.22, res.groundY + ANKLE_HEIGHT, 0.02);
      res.kneePoleL.set(-0.28, 0.50, 0.52);
      res.kneePoleR.set(0.28, 0.50, 0.52);
      break;
    }

    case 'recovery_sleep': {
      // Peaceful Supine Rest / Sleep Pose on Exercise Mat with Soft Pillow & Smooth Tidal Breathing Cycle!
      res.cameraGroup = 'sleep';
      eq.showMat = true;
      eq.showPillow = true;
      res.groundY = MAT_TOP_Y;

      const breath = Math.sin(norm * Math.PI * 2); // Smooth slow inhale/exhale cycle
      const baseY = res.groundY + 0.105;

      // Body lying completely flat & relaxed on back along Z axis (head on pillow at -Z, feet at +Z)
      res.hipsPos.set(0, baseY, -0.08);
      res.shoulderCenter.set(0, baseY + 0.018 + 0.012 * breath, -0.08 - TORSO_LEN);
      res.torsoAnterior.set(0, 1, 0.02).normalize();
      res.headLookDir.set(0.08, 0.96, 0.24).normalize(); // Gently relaxed head turn on pillow
      res.spineArchOffset = 0.006 + 0.014 * breath; // Visible calm chest/ribcage rise & fall
      res.breathAmplitude = 0.022;

      // Arms resting comfortably outward on the mat (Savasana / supine sleep posture)
      res.handL.set(-0.36, res.groundY + 0.042, -0.10);
      res.handR.set(0.36, res.groundY + 0.042, -0.10);
      res.elbowPoleL.set(-0.34, res.groundY + 0.055, -0.38);
      res.elbowPoleR.set(0.34, res.groundY + 0.055, -0.38);
      res.handMode = 'relaxed';
      res.palmNormalHint = new THREE.Vector3(0, 1, 0); // Palms resting open upward

      // Legs stretched gently straight with slight natural knee relaxation & heels resting on mat
      res.footL.set(-0.15, res.groundY + 0.072, 0.74);
      res.footR.set(0.15, res.groundY + 0.072, 0.74);
      res.kneePoleL.set(-0.16, res.groundY + 0.24, 0.34);
      res.kneePoleR.set(0.16, res.groundY + 0.24, 0.34);
      res.footModeL = 'supine_relaxed';
      res.footModeR = 'supine_relaxed';
      break;
    }
  }

  // =========================================================================
  // HARD GROUND COLLISION CLAMP (Zero Floor Clipping Guaranteed Across All 56!)
  // =========================================================================
  const minJointY = res.groundY + 0.022;
  res.hipsPos.y = Math.max(res.groundY + 0.095, res.hipsPos.y);
  res.shoulderCenter.y = Math.max(res.groundY + 0.11, res.shoulderCenter.y);
  res.handL.y = Math.max(minJointY, res.handL.y);
  res.handR.y = Math.max(minJointY, res.handR.y);
  res.footL.y = Math.max(res.groundY + 0.064, res.footL.y);
  res.footR.y = Math.max(res.groundY + 0.064, res.footR.y);

  return res;
}
