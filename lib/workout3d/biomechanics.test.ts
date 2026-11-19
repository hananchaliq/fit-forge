import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EXERCISES } from '@/data/exercises';
import {
  BODY_METRICS,
  JOINT_LIMITS_DEG,
  computeAnatomicalFootBasis,
  computeOrthonormalFrame,
  computeTwoBoneAnatomicalFrames,
  solveConstrainedTwoBoneIK,
} from '@/lib/workout3d/biomechanics';
import {
  SUPPORTED_EXERCISE_IDS,
  evaluateExercisePose,
} from '@/lib/workout3d/exercisePoses';

const KEYFRAMES = [0, 15, 30, 45, 60];

test('Every single exercise in data/exercises.ts (all 56) is explicitly registered in SUPPORTED_EXERCISE_IDS', () => {
  const exerciseIds = Object.keys(EXERCISES);
  assert.equal(exerciseIds.length, 56, `Expected 56 exercises, got ${exerciseIds.length}`);

  for (const id of exerciseIds) {
    assert.ok(
      (SUPPORTED_EXERCISE_IDS as readonly string[]).includes(id),
      `Exercise "${id}" is missing from SUPPORTED_EXERCISE_IDS`
    );
  }
});

test('All 56 exercises respect anatomical IK limits, zero NaN, and hard ground-floor clamp across all keyframes', () => {
  const torsoRight = new THREE.Vector3();
  const torsoUp = new THREE.Vector3();
  const torsoAnt = new THREE.Vector3();

  for (const ex of Object.values(EXERCISES)) {
    for (const frame of KEYFRAMES) {
      const pose = evaluateExercisePose(ex.id, ex.clip, ex.name, frame);
      assert.equal(pose.exerciseKey, ex.id, `Expected explicit pose key for ${ex.id}`);

      const rawTorso = new THREE.Vector3().subVectors(pose.shoulderCenter, pose.hipsPos);
      assert.ok(
        rawTorso.length() > 0.35 && rawTorso.length() < 0.75,
        `${ex.id} frame ${frame}: torso length out of anatomical range (${rawTorso.length().toFixed(3)}m)`
      );

      computeOrthonormalFrame(rawTorso, pose.torsoAnterior, torsoRight, torsoUp, torsoAnt);

      const shoulderDrop = -BODY_METRICS.SHOULDER_DROP_FROM_TOP + pose.shoulderShrugY;
      const shoulderL = pose.shoulderCenter
        .clone()
        .addScaledVector(torsoRight, -BODY_METRICS.SHOULDER_HALF_WIDTH)
        .addScaledVector(torsoUp, shoulderDrop);
      const shoulderR = pose.shoulderCenter
        .clone()
        .addScaledVector(torsoRight, BODY_METRICS.SHOULDER_HALF_WIDTH)
        .addScaledVector(torsoUp, shoulderDrop);

      const hipL = pose.hipsPos
        .clone()
        .addScaledVector(torsoRight, -BODY_METRICS.HIP_HALF_WIDTH)
        .addScaledVector(torsoUp, BODY_METRICS.HIP_OFFSET_UP);
      const hipR = pose.hipsPos
        .clone()
        .addScaledVector(torsoRight, BODY_METRICS.HIP_HALF_WIDTH)
        .addScaledVector(torsoUp, BODY_METRICS.HIP_OFFSET_UP);

      const armL = solveConstrainedTwoBoneIK(
        shoulderL,
        pose.handL,
        BODY_METRICS.UPPER_ARM_LEN,
        BODY_METRICS.FOREARM_LEN,
        pose.elbowPoleL,
        JOINT_LIMITS_DEG.ELBOW_MAX
      );
      const armR = solveConstrainedTwoBoneIK(
        shoulderR,
        pose.handR,
        BODY_METRICS.UPPER_ARM_LEN,
        BODY_METRICS.FOREARM_LEN,
        pose.elbowPoleR,
        JOINT_LIMITS_DEG.ELBOW_MAX
      );
      const legL = solveConstrainedTwoBoneIK(
        hipL,
        pose.footL,
        BODY_METRICS.THIGH_LEN,
        BODY_METRICS.CALF_LEN,
        pose.kneePoleL,
        JOINT_LIMITS_DEG.KNEE_MAX
      );
      const legR = solveConstrainedTwoBoneIK(
        hipR,
        pose.footR,
        BODY_METRICS.THIGH_LEN,
        BODY_METRICS.CALF_LEN,
        pose.kneePoleR,
        JOINT_LIMITS_DEG.KNEE_MAX
      );

      // Verify zero NaN across all solved joints
      for (const v of [
        pose.hipsPos,
        pose.shoulderCenter,
        armL.midPos,
        armL.clampedEndPos,
        armR.midPos,
        armR.clampedEndPos,
        legL.midPos,
        legL.clampedEndPos,
        legR.midPos,
        legR.clampedEndPos,
      ]) {
        assert.ok(
          Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z),
          `${ex.id} frame ${frame}: non-finite joint coordinate`
        );
      }

      // Verify strict anatomical joint limits
      assert.ok(
        armL.flexionDeg >= 0 && armL.flexionDeg <= JOINT_LIMITS_DEG.ELBOW_MAX + 0.5,
        `${ex.id} frame ${frame}: left elbow flexion ${armL.flexionDeg.toFixed(1)}° exceeds limit`
      );
      assert.ok(
        armR.flexionDeg >= 0 && armR.flexionDeg <= JOINT_LIMITS_DEG.ELBOW_MAX + 0.5,
        `${ex.id} frame ${frame}: right elbow flexion ${armR.flexionDeg.toFixed(1)}° exceeds limit`
      );
      assert.ok(
        legL.flexionDeg >= 0 && legL.flexionDeg <= JOINT_LIMITS_DEG.KNEE_MAX + 0.5,
        `${ex.id} frame ${frame}: left knee flexion ${legL.flexionDeg.toFixed(1)}° exceeds limit`
      );
      assert.ok(
        legR.flexionDeg >= 0 && legR.flexionDeg <= JOINT_LIMITS_DEG.KNEE_MAX + 0.5,
        `${ex.id} frame ${frame}: right knee flexion ${legR.flexionDeg.toFixed(1)}° exceeds limit`
      );

      // Verify hard floor contact bounds (zero sinking below y = 0)
      assert.ok(
        pose.hipsPos.y >= pose.groundY &&
          pose.shoulderCenter.y >= pose.groundY &&
          legL.clampedEndPos.y >= pose.groundY &&
          legR.clampedEndPos.y >= pose.groundY,
        `${ex.id} frame ${frame}: body penetrated ground plane`
      );
    }
  }
});

test('Chair Dips and Bench Dips keep hips strictly in front of bench edge (zero bench clipping)', () => {
  for (const id of ['chair_dips', 'bench_dips'] as const) {
    for (const frame of KEYFRAMES) {
      const pose = evaluateExercisePose(id, 'pushup', id, frame);
      assert.equal(pose.equipment.showFlatBench, true, `${id} must display flat bench`);
      const benchFrontEdgeZ = pose.equipment.benchPos.z + BODY_METRICS.BENCH_HALF_LEN;
      assert.ok(
        pose.hipsPos.z > benchFrontEdgeZ + 0.14,
        `${id} frame ${frame}: hips z (${pose.hipsPos.z.toFixed(3)}) clips bench front edge (${benchFrontEdgeZ.toFixed(3)})`
      );
      assert.ok(
        pose.handL.y >= BODY_METRICS.BENCH_TOP_Y - 0.01 &&
          pose.handR.y >= BODY_METRICS.BENCH_TOP_Y - 0.01,
        `${id} frame ${frame}: hands must rest on top of bench edge`
      );
    }
  }
});

test('Feet never invert backward on Leg Raises, Crunches, Pull-Ups, and Brisk Walk', () => {
  const legAntRoot = new THREE.Vector3();
  const legAntEnd = new THREE.Vector3();
  const footOutPos = new THREE.Vector3();
  const footOutMat = new THREE.Matrix4();

  for (const id of ['leg_raises', 'crunches', 'pull_ups', 'brisk_walk'] as const) {
    const ex = EXERCISES[id];
    for (const frame of KEYFRAMES) {
      const pose = evaluateExercisePose(id, ex.clip, ex.name, frame);
      const rawTorso = new THREE.Vector3().subVectors(pose.shoulderCenter, pose.hipsPos);
      const torsoRight = new THREE.Vector3();
      const torsoUp = new THREE.Vector3();
      const torsoAnt = new THREE.Vector3();
      computeOrthonormalFrame(rawTorso, pose.torsoAnterior, torsoRight, torsoUp, torsoAnt);

      const hipL = pose.hipsPos
        .clone()
        .addScaledVector(torsoRight, -BODY_METRICS.HIP_HALF_WIDTH)
        .addScaledVector(torsoUp, BODY_METRICS.HIP_OFFSET_UP);

      const legIkL = solveConstrainedTwoBoneIK(
        hipL,
        pose.footL,
        BODY_METRICS.THIGH_LEN,
        BODY_METRICS.CALF_LEN,
        pose.kneePoleL,
        JOINT_LIMITS_DEG.KNEE_MAX
      );

      computeTwoBoneAnatomicalFrames(
        hipL,
        legIkL.midPos,
        legIkL.clampedEndPos,
        pose.kneePoleL,
        false,
        torsoAnt,
        legAntRoot,
        legAntEnd
      );

      const { footForward } = computeAnatomicalFootBasis(
        legIkL.midPos,
        legIkL.clampedEndPos,
        legAntEnd,
        pose.footModeL,
        pose.footPitchL,
        'left',
        pose.groundY,
        footOutPos,
        footOutMat
      );

      // Foot forward direction MUST align positively with anterior shin direction (never backward!)
      const dot = footForward.dot(legAntEnd);
      assert.ok(
        dot > 0.25,
        `${id} frame ${frame}: foot inverted/misaligned with tibia (dot=${dot.toFixed(3)})`
      );
    }
  }
});

test('Key problem exercises have accurate posture semantics (Recovery Sleep, Shrugs, Chest Fly, Burpees)', () => {
  // 1. Recovery & Sleep lies horizontally supine on mat with pillow
  const sleepPose = evaluateExercisePose('recovery_sleep', 'idle', 'Recovery & Sleep', 15);
  assert.equal(sleepPose.cameraGroup, 'sleep');
  assert.equal(sleepPose.equipment.showMat, true);
  assert.equal(sleepPose.equipment.showPillow, true);
  assert.ok(sleepPose.hipsPos.y < 0.25 && sleepPose.shoulderCenter.y < 0.25);

  // 2. Shrugs visibly elevate shoulders vertically at peak (frame 30 vs frame 0)
  const shrugStart = evaluateExercisePose('shrugs', EXERCISES.shrugs.clip, 'Shrugs', 0);
  const shrugPeak = evaluateExercisePose('shrugs', EXERCISES.shrugs.clip, 'Shrugs', 30);
  assert.ok(
    shrugPeak.shoulderShrugY - shrugStart.shoulderShrugY > 0.035,
    'Shrugs must visibly elevate shoulders at peak contraction'
  );

  // 3. Chest Fly is supine on flat bench (not standing T-pose)
  const flyPose = evaluateExercisePose('chest_fly', EXERCISES.chest_fly.clip, 'Chest Fly', 30);
  assert.equal(flyPose.equipment.showFlatBench, true);
  assert.equal(flyPose.equipment.showDumbbells, true);
  assert.ok(Math.abs(flyPose.hipsPos.y - flyPose.shoulderCenter.y) < 0.08);

  // 4. Burpees transitions from upright jump to floor plank
  const burpeePlank = evaluateExercisePose('burpees', EXERCISES.burpees.clip, 'Burpees', 30);
  const burpeeJump = evaluateExercisePose('burpees', EXERCISES.burpees.clip, 'Burpees', 52);
  assert.ok(burpeePlank.hipsPos.y < 0.50, 'Burpee plank phase must drop down to floor');
  assert.ok(burpeeJump.hipsPos.y > 0.95, 'Burpee jump phase must rise upright');
});
