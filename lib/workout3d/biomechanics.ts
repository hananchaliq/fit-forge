import * as THREE from 'three';

/**
 * 180 cm / 70 kg Athletic Human Anatomical Constants (Meters)
 * Calibrated for zero joint gaps, zero stretching, and realistic limb ratios.
 */
export const BODY_METRICS = {
  PELVIS_DROP: 0.078,
  TORSO_LEN: 0.555,
  HEAD_NECK_LEN: 0.255,
  SHOULDER_HALF_WIDTH: 0.172,
  SHOULDER_DROP_FROM_TOP: 0.052,
  HIP_HALF_WIDTH: 0.098,
  HIP_OFFSET_UP: 0.025,
  UPPER_ARM_LEN: 0.30,
  FOREARM_LEN: 0.265,
  HAND_LEN: 0.095,
  THIGH_LEN: 0.43,
  CALF_LEN: 0.41,
  ANKLE_HEIGHT: 0.072, // Vertical offset from sole bottom (y=0) to ankle joint center
  SOLE_THICKNESS: 0.072,
  MAT_TOP_Y: 0.018,
  BENCH_TOP_Y: 0.455,
  BENCH_HALF_LEN: 0.62,
  BENCH_HALF_WIDTH: 0.175,
  BAR_Y: 2.12,
  DIP_BAR_Y: 1.16,
  DIP_BAR_HALF_X: 0.27,
} as const;

export const JOINT_LIMITS_DEG = {
  KNEE_MIN: 0,
  KNEE_MAX: 145,
  ELBOW_MIN: 0,
  ELBOW_MAX: 150,
} as const;

export type FootOrientationMode =
  | 'flat_floor'
  | 'plantar_toes_floor'
  | 'tibia_aligned'
  | 'bench_rest'
  | 'supine_relaxed';

export type HandPoseMode = 'relaxed' | 'grip' | 'flat' | 'temple' | 'clasp';

export interface ConstrainedIKResult {
  midPos: THREE.Vector3;
  clampedEndPos: THREE.Vector3;
  flexionDeg: number;
}

const _ikDiff = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikToPole = new THREE.Vector3();
const _ikProj = new THREE.Vector3();
const _ikBendDir = new THREE.Vector3();

/**
 * Analytical Two-Bone Inverse Kinematics Solver with Strict Anatomical Joint Limits.
 *
 * - Enforces anatomical flexion bounds:
 *   - Knee:  0°..145° (bends strictly backward, patella faces `polePos`)
 *   - Elbow: 0°..150° (bends strictly forward, olecranon points toward `polePos`)
 * - Never stretches limbs beyond `L1 + L2` (zero shoulder/hip/wrist/ankle dislocation).
 * - Returns both the exact `midPos` (knee/elbow) and the anatomically valid `clampedEndPos` (ankle/wrist).
 */
export function solveConstrainedTwoBoneIK(
  rootPos: THREE.Vector3,
  endPos: THREE.Vector3,
  len1: number,
  len2: number,
  polePos: THREE.Vector3,
  maxFlexionDeg: number
): ConstrainedIKResult {
  _ikDiff.subVectors(endPos, rootPos);
  const rawDist = _ikDiff.length();

  // Cosine law: d^2 = L1^2 + L2^2 - 2*L1*L2*cos(pi - flexion)
  // At flexion = 0° (straight): d = L1 + L2
  // At flexion = maxFlexionDeg: d = sqrt(L1^2 + L2^2 + 2*L1*L2*cos(maxFlexionRad))
  const maxFlexRad = THREE.MathUtils.degToRad(maxFlexionDeg);
  const minDistFromLimit = Math.sqrt(
    Math.max(
      0.0025,
      len1 * len1 + len2 * len2 + 2 * len1 * len2 * Math.cos(maxFlexRad)
    )
  );
  const minDist = Math.max(Math.abs(len1 - len2) + 0.02, minDistFromLimit);
  const maxDist = (len1 + len2) * 0.997;

  const d = THREE.MathUtils.clamp(rawDist, minDist, maxDist);

  if (rawDist > 1e-5) {
    _ikDir.copy(_ikDiff).divideScalar(rawDist);
  } else {
    _ikDir.set(0, -1, 0);
  }

  const clampedEndPos = rootPos.clone().addScaledVector(_ikDir, d);

  const cosRootAngle = THREE.MathUtils.clamp(
    (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d),
    -1,
    1
  );
  const rootAngle = Math.acos(cosRootAngle);

  // Compute resulting interior joint flexion angle in degrees (0° = fully extended)
  const cosInterior = THREE.MathUtils.clamp(
    (len1 * len1 + len2 * len2 - d * d) / (2 * len1 * len2),
    -1,
    1
  );
  const flexionDeg = THREE.MathUtils.radToDeg(Math.PI - Math.acos(cosInterior));

  _ikToPole.subVectors(polePos, rootPos);
  _ikProj.copy(_ikDir).multiplyScalar(_ikToPole.dot(_ikDir));
  _ikBendDir.subVectors(_ikToPole, _ikProj);

  if (_ikBendDir.lengthSq() < 1e-6) {
    // Deterministic orthogonal fallback perpendicular to limb axis
    if (Math.abs(_ikDir.z) < 0.85) {
      _ikBendDir.set(0, 0, 1);
    } else {
      _ikBendDir.set(0, 1, 0);
    }
    _ikBendDir.addScaledVector(_ikDir, -_ikBendDir.dot(_ikDir)).normalize();
  } else {
    _ikBendDir.normalize();
  }

  const midPos = rootPos
    .clone()
    .addScaledVector(_ikDir, Math.cos(rootAngle) * len1)
    .addScaledVector(_ikBendDir, Math.sin(rootAngle) * len1);

  return { midPos, clampedEndPos, flexionDeg };
}

/**
 * Builds a right-handed orthonormal frame where:
 * - `outY` points along `tangentDir`
 * - `outZ` faces `anteriorHint` (orthogonalized against `outY`)
 * - `outX` = `outY × outZ` (character's anatomical left / +X when upright facing +Z)
 */
export function computeOrthonormalFrame(
  tangentDir: THREE.Vector3,
  anteriorHint: THREE.Vector3,
  outX: THREE.Vector3,
  outY: THREE.Vector3,
  outZ: THREE.Vector3
): void {
  outY.copy(tangentDir);
  if (outY.lengthSq() < 1e-6) {
    outY.set(0, 1, 0);
  } else {
    outY.normalize();
  }

  outX.crossVectors(outY, anteriorHint);
  if (outX.lengthSq() < 1e-6) {
    const fallbackX = Math.abs(outY.y) < 0.9 ? 0 : 1;
    const fallbackY = Math.abs(outY.y) < 0.9 ? 1 : 0;
    outX.set(
      outY.y * 0 - outY.z * fallbackY,
      outY.z * fallbackX - outY.x * 0,
      outY.x * fallbackY - outY.y * fallbackX
    );
  }
  outX.normalize();
  outZ.crossVectors(outX, outY).normalize();
}

/**
 * Computes singularity-free anatomical anterior directions (`outAntRoot`, `outAntEnd`)
 * for a 2-bone limb (`rootPos -> midPos -> endPos`) from its hinge plane (`polePos`).
 * Guarantees smooth twist-free skinning across overhead, horizontal, prone, and supine poses.
 */
export function computeTwoBoneAnatomicalFrames(
  rootPos: THREE.Vector3,
  midPos: THREE.Vector3,
  endPos: THREE.Vector3,
  polePos: THREE.Vector3,
  isArm: boolean,
  fallbackAnterior: THREE.Vector3,
  outAntRoot: THREE.Vector3,
  outAntEnd: THREE.Vector3
): void {
  const u1 = new THREE.Vector3().subVectors(midPos, rootPos);
  if (u1.lengthSq() < 1e-8) u1.set(0, -1, 0);
  else u1.normalize();

  const u2 = new THREE.Vector3().subVectors(endPos, midPos);
  if (u2.lengthSq() < 1e-8) u2.copy(u1);
  else u2.normalize();

  const toPole = new THREE.Vector3().subVectors(polePos, rootPos);
  const polePerp1 = toPole.clone().addScaledVector(u1, -toPole.dot(u1));
  if (polePerp1.lengthSq() < 1e-5) {
    polePerp1.copy(fallbackAnterior).addScaledVector(u1, -fallbackAnterior.dot(u1));
    if (polePerp1.lengthSq() < 1e-5) {
      polePerp1.set(0, 0, 1).addScaledVector(u1, -u1.z);
    }
  }
  polePerp1.normalize();

  if (isArm) {
    // Arm elbow pole points behind olecranon (triceps = -Z local), so anterior bicep (+Z) is -polePerp1
    const bicepDir = polePerp1.clone().negate();
    outAntRoot.copy(bicepDir).multiplyScalar(0.78).addScaledVector(fallbackAnterior, 0.22);
    outAntRoot.addScaledVector(u1, -outAntRoot.dot(u1));
    if (outAntRoot.lengthSq() < 1e-5) outAntRoot.copy(bicepDir);
    outAntRoot.normalize();
  } else {
    // Leg knee pole points forward through patella (+Z local)
    outAntRoot.copy(polePerp1);
  }

  const hingeAxis = new THREE.Vector3().crossVectors(u1, outAntRoot);
  if (hingeAxis.lengthSq() < 1e-6) {
    outAntEnd.copy(outAntRoot);
  } else {
    hingeAxis.normalize();
    outAntEnd.crossVectors(hingeAxis, u2).normalize();
  }
}

/**
 * Computes the exact world-space orientation basis for an anatomical barefoot foot
 * attached at `anklePos`.
 *
 * Foot local coordinate convention:
 * - Local `+Z`: heel -> toes (anterior)
 * - Local `+Y`: sole -> ankle dorsum (superior)
 * - Local `+X`: lateral/medial right-hand axis (`+Y × +Z`)
 * - Origin `(0, 0, 0)` is the ankle joint center; sole bottom sits at local `y = -ANKLE_HEIGHT`.
 *
 * Guarantees:
 * - Zero backward/reversed feet (toes ALWAYS align positively with `legAnteriorEnd` / shin front).
 * - Zero floor penetration when grounded (`flat_floor`, `plantar_toes_floor`).
 */
export function computeAnatomicalFootBasis(
  kneePos: THREE.Vector3,
  anklePos: THREE.Vector3,
  legAnteriorEnd: THREE.Vector3,
  mode: FootOrientationMode,
  extraPitchRad: number,
  side: 'left' | 'right',
  groundY: number,
  outPos: THREE.Vector3,
  outMatrix: THREE.Matrix4
): { footForward: THREE.Vector3; footUp: THREE.Vector3 } {
  const tibiaUp = new THREE.Vector3().subVectors(kneePos, anklePos);
  if (tibiaUp.lengthSq() < 1e-6) tibiaUp.set(0, 1, 0);
  else tibiaUp.normalize();

  // Project anterior shin vector perpendicular to tibia
  const shinFront = legAnteriorEnd
    .clone()
    .addScaledVector(tibiaUp, -legAnteriorEnd.dot(tibiaUp));
  if (shinFront.lengthSq() < 1e-5) {
    shinFront.set(0, 0, 1).addScaledVector(tibiaUp, -tibiaUp.z);
  }
  shinFront.normalize();

  const footUp = new THREE.Vector3();
  const footForward = new THREE.Vector3();
  const footRight = new THREE.Vector3();

  outPos.copy(anklePos);

  if (mode === 'flat_floor') {
    // Sole completely flat on ground plane (+Y up), toes point horizontally along shin anterior projection
    footUp.set(0, 1, 0);
    footForward.set(shinFront.x, 0, shinFront.z);
    if (footForward.lengthSq() < 1e-4) {
      footForward.set(0, 0, 1);
    } else {
      footForward.normalize();
    }
    // Slight natural outward athletic toe turnout (~6 deg)
    const toeOut = side === 'left' ? -0.10 : 0.10;
    footForward.applyAxisAngle(footUp, toeOut);

    // Clamp ankle height so flat sole never sinks below groundY
    if (outPos.y < groundY + BODY_METRICS.ANKLE_HEIGHT) {
      outPos.y = groundY + BODY_METRICS.ANKLE_HEIGHT;
    }
  } else if (mode === 'plantar_toes_floor') {
    // Push-ups / Plank / Calf Raises / Rear Lunge:
    // Ball of foot & toes contact groundY while heel lifts with tibia
    footForward.copy(shinFront);
    footUp.copy(tibiaUp);

    // Blend slightly toward floor contact pitch so toes press firmly on floor/bench
    const pitchAxis = new THREE.Vector3().crossVectors(footUp, footForward).normalize();
    const angle = extraPitchRad !== 0 ? extraPitchRad : -0.28; // Slight dorsiflexion so toes plant flat
    footForward.applyAxisAngle(pitchAxis, angle).normalize();
    footUp.applyAxisAngle(pitchAxis, angle).normalize();

    if (outPos.y < groundY + 0.068) {
      outPos.y = groundY + 0.068;
    }
  } else if (mode === 'bench_rest') {
    // Foot top/instep resting cleanly on bench surface (Bulgarian Split Squat / Decline Push-Up)
    footForward.copy(tibiaUp).negate(); // Plantarflexed instep along bench
    footUp.copy(shinFront).negate();
    if (outPos.y < BODY_METRICS.BENCH_TOP_Y + 0.04) {
      outPos.y = BODY_METRICS.BENCH_TOP_Y + 0.04;
    }
  } else if (mode === 'supine_relaxed') {
    // Sleeping / resting flat on back on mat: heels rest on mat, toes point relaxed up & gently outward
    footForward.set(side === 'left' ? -0.24 : 0.24, 0.86, 0.44).normalize();
    footUp.copy(tibiaUp);
    footRight.crossVectors(footUp, footForward).normalize();
    footUp.crossVectors(footForward, footRight).normalize();
    if (outPos.y < groundY + 0.065) {
      outPos.y = groundY + 0.065;
    }
  } else {
    // 'tibia_aligned': Leg Raises, Pull-Ups, Leg Curl, Russian Twists, Superman, Running Swing
    // Foot stays anatomically aligned with tibia & patella (never inverted or backward!)
    footUp.copy(tibiaUp);
    footForward.copy(shinFront);
    if (extraPitchRad !== 0) {
      const pitchAxis = new THREE.Vector3().crossVectors(footUp, footForward).normalize();
      footForward.applyAxisAngle(pitchAxis, extraPitchRad).normalize();
      footUp.applyAxisAngle(pitchAxis, extraPitchRad).normalize();
    }
  }

  // Ensure exact right-handed orthonormal matrix
  footRight.crossVectors(footUp, footForward);
  if (footRight.lengthSq() < 1e-6) {
    footRight.set(1, 0, 0);
  } else {
    footRight.normalize();
  }
  footUp.crossVectors(footForward, footRight).normalize();

  outMatrix.makeBasis(footRight, footUp, footForward);
  return { footForward, footUp };
}

/**
 * Computes the world-space orientation basis for the sculpted 3D anatomical hand
 * attached at `wristPos`.
 *
 * Hand local coordinate convention:
 * - Local `+Y`: wrist -> fingertips (distal axis)
 * - Local `+Z`: dorsal -> palmar (inside palm face)
 * - Local `+X`: ulnar/radial thumb axis (`+Y × +Z`)
 */
export function computeAnatomicalHandBasis(
  elbowPos: THREE.Vector3,
  wristPos: THREE.Vector3,
  armAnteriorEnd: THREE.Vector3,
  mode: HandPoseMode,
  palmNormalHint: THREE.Vector3 | null,
  outMatrix: THREE.Matrix4
): void {
  const forearmDir = new THREE.Vector3().subVectors(wristPos, elbowPos);
  if (forearmDir.lengthSq() < 1e-6) forearmDir.set(0, -1, 0);
  else forearmDir.normalize();

  const handY = new THREE.Vector3();
  const handZ = new THREE.Vector3();
  const handX = new THREE.Vector3();

  if (mode === 'flat') {
    // Palm pressed flat on floor or bench top; fingers point forward along +Z (or hint)
    const normal = palmNormalHint ? palmNormalHint.clone().normalize() : new THREE.Vector3(0, -1, 0);
    handZ.copy(normal);
    // Project forward direction onto palm surface
    const forward = new THREE.Vector3(0, 0, 1);
    handY.copy(forward).addScaledVector(handZ, -forward.dot(handZ));
    if (handY.lengthSq() < 1e-4) {
      handY.set(0, 1, 0).addScaledVector(handZ, -handZ.y);
    }
    handY.normalize();
  } else if (mode === 'grip') {
    // Hand continues forearm axis, palm faces grip normal or inward toward anterior bicep
    handY.copy(forearmDir);
    const hint = palmNormalHint ? palmNormalHint : armAnteriorEnd;
    handZ.copy(hint).addScaledVector(handY, -hint.dot(handY));
    if (handZ.lengthSq() < 1e-4) {
      handZ.set(0, 0, 1).addScaledVector(handY, -handY.z);
    }
    handZ.normalize();
  } else {
    // 'relaxed' | 'temple' | 'clasp'
    handY.copy(forearmDir);
    const hint = palmNormalHint ? palmNormalHint : armAnteriorEnd;
    handZ.copy(hint).addScaledVector(handY, -hint.dot(handY));
    if (handZ.lengthSq() < 1e-4) {
      handZ.set(0, 0, 1).addScaledVector(handY, -handY.z);
    }
    handZ.normalize();
  }

  handX.crossVectors(handY, handZ);
  if (handX.lengthSq() < 1e-6) {
    handX.set(1, 0, 0);
  } else {
    handX.normalize();
  }
  handZ.crossVectors(handX, handY).normalize();
  outMatrix.makeBasis(handX, handY, handZ);
}
