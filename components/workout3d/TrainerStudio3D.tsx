'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AnimationClipName, MuscleGroup } from '@/data/exerciseClipMap';
import { BLUEPRINT_EXERCISES } from '@/data/blueprintPack';

export type CameraPreset = 'front' | 'side' | 'back' | 'top';

export interface TrainerStudio3DProps {
  clip: AnimationClipName;
  exerciseId?: string;
  biomechanicalVariant?: string;
  exerciseName?: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  timeScale: number;
  isPaused: boolean;
  cameraPreset: CameraPreset;
  debugMuscleMask?: boolean;
  lockedFrame?: number | null; // 0, 15, 30, 45, 60 or null for continuous loop
  quadView?: boolean; // 4-angle Blueprint Split View (Front, Side, Back, Top)
  onReady?: () => void;
}

/**
 * Analytical Two-Bone Inverse Kinematics Solver in World Space
 * Places `midPos` (elbow or knee) at the exact law-of-cosines intersection
 * between `rootPos` (shoulder/hip) and `endPos` (wrist/ankle), oriented toward `polePos`.
 */
export function solveTwoBoneIK(
  rootPos: THREE.Vector3,
  endPos: THREE.Vector3,
  len1: number,
  len2: number,
  polePos: THREE.Vector3
): THREE.Vector3 {
  const diff = new THREE.Vector3().subVectors(endPos, rootPos);
  const rawDist = diff.length();
  const minDist = Math.abs(len1 - len2) + 0.015;
  const maxDist = len1 + len2 - 0.003;
  const d = Math.max(minDist, Math.min(maxDist, rawDist));

  const dir = diff.clone();
  if (rawDist > 1e-5) {
    dir.divideScalar(rawDist);
  } else {
    dir.set(0, -1, 0);
  }

  const cosAngle = Math.max(
    -1,
    Math.min(1, (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d))
  );
  const angle = Math.acos(cosAngle);

  const toPole = new THREE.Vector3().subVectors(polePos, rootPos);
  const proj = dir.clone().multiplyScalar(toPole.dot(dir));
  const bendDir = toPole.sub(proj);
  if (bendDir.lengthSq() < 1e-6) {
    bendDir.set(0, 0, 1);
  } else {
    bendDir.normalize();
  }

  return rootPos
    .clone()
    .addScaledVector(dir, Math.cos(angle) * len1)
    .addScaledVector(bendDir, Math.sin(angle) * len1);
}

/**
 * Computes a right-handed orthonormal basis (det = +1) where:
 * - `outY` points along `tangentDir`
 * - `outZ` faces `anteriorHint` (anterior/front surface of body or limb)
 * - `outX` = `outY × outZ`
 */
export function computeOrthonormalFrame(
  tangentDir: THREE.Vector3,
  anteriorHint: THREE.Vector3,
  outX: THREE.Vector3,
  outY: THREE.Vector3,
  outZ: THREE.Vector3
) {
  outY.copy(tangentDir);
  if (outY.lengthSq() < 1e-6) {
    outY.set(0, 1, 0);
  } else {
    outY.normalize();
  }

  outX.crossVectors(outY, anteriorHint);
  if (outX.lengthSq() < 1e-6) {
    const fallback =
      Math.abs(outY.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    outX.crossVectors(outY, fallback);
  }
  outX.normalize();

  outZ.crossVectors(outX, outY).normalize();
}

/**
 * Computes a gimbal-free anterior vector for a 2-bone limb from its pole vector.
 * - For arms (`invertPole = true`), `polePos` is the back of the elbow (triceps/olecranon),
 *   so the anterior surface (biceps/palm side) points AWAY from `polePos`.
 * - For legs (`invertPole = false`), `polePos` is the front of the knee (patella/quads),
 *   so the anterior surface (quads/shin) points TOWARD `polePos`.
 */
function computeLimbAnteriorFromPole(
  rootPos: THREE.Vector3,
  endPos: THREE.Vector3,
  polePos: THREE.Vector3,
  invertPole: boolean
): THREE.Vector3 {
  const axis = new THREE.Vector3().subVectors(endPos, rootPos);
  if (axis.lengthSq() < 1e-6) {
    axis.set(0, -1, 0);
  } else {
    axis.normalize();
  }
  const toPole = new THREE.Vector3().subVectors(polePos, rootPos);
  const proj = axis.clone().multiplyScalar(toPole.dot(axis));
  const perp = toPole.sub(proj);
  if (perp.lengthSq() < 1e-6) {
    perp.set(0, 0, 1);
  } else {
    perp.normalize();
  }
  if (invertPole) {
    perp.negate();
  }
  return perp;
}

interface LoftSection {
  s: number;
  rx: number;
  rzAnt: number;
  rzPost: number;
  cx?: number;
  cz?: number;
  pinchCenterZ?: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleSections(sections: LoftSection[], s: number): LoftSection {
  const clamped = Math.max(0, Math.min(1, s));
  let idx = 0;
  for (let i = 0; i < sections.length - 1; i++) {
    if (clamped >= sections[i].s && clamped <= sections[i + 1].s) {
      idx = i;
      break;
    }
  }
  const s0 = sections[Math.max(0, idx - 1)];
  const s1 = sections[idx];
  const s2 = sections[Math.min(sections.length - 1, idx + 1)];
  const s3 = sections[Math.min(sections.length - 1, idx + 2)];
  const span = Math.max(1e-5, s2.s - s1.s);
  const localT = Math.max(0, Math.min(1, (clamped - s1.s) / span));

  return {
    s: clamped,
    rx: Math.max(0.001, catmullRom(s0.rx, s1.rx, s2.rx, s3.rx, localT)),
    rzAnt: Math.max(0.001, catmullRom(s0.rzAnt, s1.rzAnt, s2.rzAnt, s3.rzAnt, localT)),
    rzPost: Math.max(0.001, catmullRom(s0.rzPost, s1.rzPost, s2.rzPost, s3.rzPost, localT)),
    cx: catmullRom(s0.cx || 0, s1.cx || 0, s2.cx || 0, s3.cx || 0, localT),
    cz: catmullRom(s0.cz || 0, s1.cz || 0, s2.cz || 0, s3.cz || 0, localT),
    pinchCenterZ: catmullRom(
      s0.pinchCenterZ || 0,
      s1.pinchCenterZ || 0,
      s2.pinchCenterZ || 0,
      s3.pinchCenterZ || 0,
      localT
    ),
  };
}

interface SkinnedLoftMeshData {
  mesh: THREE.Mesh;
  numRows: number;
  numCols: number;
  restLocalX: Float32Array;
  restLocalZ: Float32Array;
  restNormX: Float32Array;
  restNormY: Float32Array;
  restNormZ: Float32Array;
  deformBySpineCurve: (
    evalRingFn: (
      s: number,
      outCenter: THREE.Vector3,
      outX: THREE.Vector3,
      outY: THREE.Vector3,
      outZ: THREE.Vector3
    ) => void
  ) => void;
}

/**
 * Builds a continuous, multi-material skinned loft mesh whose rings `r = 0..heightSegs`
 * are smoothly deformed in real time along an arbitrary skeletal spine/limb curve
 * with zero joint breaks, zero gaps, and zero interpenetration.
 */
function createContinuousSkinnedLoft(
  refLength: number,
  sections: LoftSection[],
  radialSegs: number,
  heightSegs: number,
  materials: THREE.Material[],
  sculptFn: (
    s: number,
    theta: number,
    nx: number,
    nz: number,
    pos: { x: number; y: number; z: number }
  ) => void,
  groupFn: (s: number, nx: number, nz: number) => number,
  vertexShadeFn?: (s: number, nx: number, nz: number, matGroup: number) => [number, number, number]
): SkinnedLoftMeshData {
  const numCols = radialSegs + 1;
  const numRows = heightSegs + 1;
  const totalVerts = numRows * numCols;

  const restLocalX = new Float32Array(totalVerts);
  const restLocalZ = new Float32Array(totalVerts);
  const restNormX = new Float32Array(totalVerts);
  const restNormY = new Float32Array(totalVerts);
  const restNormZ = new Float32Array(totalVerts);

  const positions = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  for (let r = 0; r < numRows; r++) {
    const s = r / heightSegs;
    const sec = sampleSections(sections, s);
    const y = s * refLength;

    for (let c = 0; c < numCols; c++) {
      const u = c === radialSegs ? 0 : c / radialSegs;
      const theta = u * Math.PI * 2;
      const nx = Math.cos(theta);
      const nz = Math.sin(theta);

      let x = nx * sec.rx + (sec.cx || 0);
      const rz = nz >= 0 ? sec.rzAnt : sec.rzPost;
      let z = nz * rz + (sec.cz || 0);

      if (sec.pinchCenterZ) {
        const centerFactor = Math.exp(-nx * nx * 14);
        if (nz >= 0) {
          z -= sec.pinchCenterZ * centerFactor * nz;
        } else {
          z += sec.pinchCenterZ * 0.85 * centerFactor * -nz;
        }
      }

      const pt = { x, y, z };
      sculptFn(s, theta, nx, nz, pt);

      const idx = r * numCols + c;
      restLocalX[idx] = pt.x;
      restLocalZ[idx] = pt.z;

      const vIdx = idx * 3;
      positions[vIdx] = pt.x;
      positions[vIdx + 1] = pt.y;
      positions[vIdx + 2] = pt.z;

      const matG = groupFn(s, nx, nz);
      const [cr, cg, cb] = vertexShadeFn ? vertexShadeFn(s, nx, nz, matG) : [1, 1, 1];
      colors[vIdx] = cr;
      colors[vIdx + 1] = cg;
      colors[vIdx + 2] = cb;

      const uvIdx = idx * 2;
      uvs[uvIdx] = c / radialSegs;
      uvs[uvIdx + 1] = s;
    }
  }

  const buckets: Map<number, number[]> = new Map();
  for (let r = 0; r < heightSegs; r++) {
    const sMid = (r + 0.5) / heightSegs;
    for (let c = 0; c < radialSegs; c++) {
      const thetaMid = ((c + 0.5) / radialSegs) * Math.PI * 2;
      const nx = Math.cos(thetaMid);
      const nz = Math.sin(thetaMid);
      const g = groupFn(sMid, nx, nz);

      const a = r * numCols + c;
      const b = r * numCols + c + 1;
      const d = (r + 1) * numCols + c;
      const e = (r + 1) * numCols + c + 1;

      let list = buckets.get(g);
      if (!list) {
        list = [];
        buckets.set(g, list);
      }
      // Outward-facing counter-clockwise winding: (a, d, b) and (b, d, e)
      list.push(a, d, b, b, d, e);
    }
  }

  const allIndices: number[] = [];
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const sortedGroups = Array.from(buckets.keys()).sort((a, b) => a - b);
  for (const g of sortedGroups) {
    const list = buckets.get(g)!;
    const start = allIndices.length;
    for (let i = 0; i < list.length; i++) {
      allIndices.push(list[i]);
    }
    geo.addGroup(start, list.length, g);
  }

  geo.setIndex(allIndices);
  geo.computeVertexNormals();

  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  normAttr.setUsage(THREE.DynamicDrawUsage);
  for (let r = 0; r < numRows; r++) {
    const i0 = r * numCols;
    const i1 = r * numCols + radialSegs;
    const nx = (normAttr.getX(i0) + normAttr.getX(i1)) * 0.5;
    const ny = (normAttr.getY(i0) + normAttr.getY(i1)) * 0.5;
    const nz = (normAttr.getZ(i0) + normAttr.getZ(i1)) * 0.5;
    const len = Math.hypot(nx, ny, nz) || 1;
    normAttr.setXYZ(i0, nx / len, ny / len, nz / len);
    normAttr.setXYZ(i1, nx / len, ny / len, nz / len);
  }

  for (let i = 0; i < totalVerts; i++) {
    restNormX[i] = normAttr.getX(i);
    restNormY[i] = normAttr.getY(i);
    restNormZ[i] = normAttr.getZ(i);
  }

  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const ringCenter = new THREE.Vector3();
  const ringX = new THREE.Vector3();
  const ringY = new THREE.Vector3();
  const ringZ = new THREE.Vector3();

  const deformBySpineCurve = (
    evalRingFn: (
      s: number,
      outCenter: THREE.Vector3,
      outX: THREE.Vector3,
      outY: THREE.Vector3,
      outZ: THREE.Vector3
    ) => void
  ) => {
    const posArr = posAttr.array as Float32Array;
    const normArr = normAttr.array as Float32Array;

    for (let r = 0; r < numRows; r++) {
      const s = r / heightSegs;
      evalRingFn(s, ringCenter, ringX, ringY, ringZ);

      const cx = ringCenter.x;
      const cy = ringCenter.y;
      const cz = ringCenter.z;

      const xx = ringX.x,
        xy = ringX.y,
        xz = ringX.z;
      const yx = ringY.x,
        yy = ringY.y,
        yz = ringY.z;
      const zx = ringZ.x,
        zy = ringZ.y,
        zz = ringZ.z;

      const rowOffset = r * numCols;
      for (let c = 0; c < numCols; c++) {
        const idx = rowOffset + c;
        const lx = restLocalX[idx];
        const lz = restLocalZ[idx];

        const vIdx = idx * 3;
        posArr[vIdx] = cx + lx * xx + lz * zx;
        posArr[vIdx + 1] = cy + lx * xy + lz * zy;
        posArr[vIdx + 2] = cz + lx * xz + lz * zz;

        const rnx = restNormX[idx];
        const rny = restNormY[idx];
        const rnz = restNormZ[idx];

        normArr[vIdx] = rnx * xx + rny * yx + rnz * zx;
        normArr[vIdx + 1] = rnx * xy + rny * yy + rnz * zy;
        normArr[vIdx + 2] = rnx * xz + rny * yz + rnz * zz;
      }
    }

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  };

  return {
    mesh,
    numRows,
    numCols,
    restLocalX,
    restLocalZ,
    restNormX,
    restNormY,
    restNormZ,
    deformBySpineCurve,
  };
}

/**
 * Evaluates a smooth 2-bone limb centerline and orthonormal frame with a Quadratic Bezier
 * skinning blend zone (`[jointS - blendRadius, jointS + blendRadius]`) across the elbow or knee.
 * Eliminates rigid hinge breaks, ball joints, and mesh interpenetration at any bend angle.
 */
function evaluateTwoBoneSkinnedRing(
  s: number,
  jointS: number,
  blendHalfWidth: number,
  rootPos: THREE.Vector3,
  midPos: THREE.Vector3,
  endPos: THREE.Vector3,
  anteriorRoot: THREE.Vector3,
  anteriorEnd: THREE.Vector3,
  jointBulgeForward: number,
  outCenter: THREE.Vector3,
  outX: THREE.Vector3,
  outY: THREE.Vector3,
  outZ: THREE.Vector3
) {
  const sStart = jointS - blendHalfWidth;
  const sEnd = jointS + blendHalfWidth;

  const seg1Dir = new THREE.Vector3().subVectors(midPos, rootPos);
  const seg2Dir = new THREE.Vector3().subVectors(endPos, midPos);
  const tangent = new THREE.Vector3();

  if (s <= sStart) {
    const u = Math.max(0, s / jointS);
    outCenter.lerpVectors(rootPos, midPos, u);
    tangent.copy(seg1Dir);
  } else if (s >= sEnd) {
    const u = Math.min(1, (s - jointS) / (1 - jointS));
    outCenter.lerpVectors(midPos, endPos, u);
    tangent.copy(seg2Dir);
  } else {
    const t = (s - sStart) / (2 * blendHalfWidth);
    const u0 = sStart / jointS;
    const u1 = (sEnd - jointS) / (1 - jointS);

    const p0 = new THREE.Vector3().lerpVectors(rootPos, midPos, u0);
    const p2 = new THREE.Vector3().lerpVectors(midPos, endPos, u1);

    const omt = 1 - t;
    outCenter
      .set(0, 0, 0)
      .addScaledVector(p0, omt * omt)
      .addScaledVector(midPos, 2 * omt * t)
      .addScaledVector(p2, t * t);

    const d0 = new THREE.Vector3().subVectors(midPos, p0);
    const d1 = new THREE.Vector3().subVectors(p2, midPos);
    tangent.set(0, 0, 0).addScaledVector(d0, omt).addScaledVector(d1, t);
  }

  const ant = new THREE.Vector3().lerpVectors(anteriorRoot, anteriorEnd, s).normalize();
  computeOrthonormalFrame(tangent, ant, outX, outY, outZ);

  if (s > sStart && s < sEnd && jointBulgeForward !== 0) {
    const n1 = seg1Dir.clone().normalize();
    const n2 = seg2Dir.clone().normalize();
    const bendFactor = Math.max(0, 0.5 * (1 - n1.dot(n2)));
    const bell = Math.sin(((s - sStart) / (2 * blendHalfWidth)) * Math.PI);
    outCenter.addScaledVector(outZ, jointBulgeForward * bendFactor * bell);
  }
}

export function TrainerStudio3D({
  clip: clipName,
  exerciseId = '',
  biomechanicalVariant = 'standard',
  exerciseName = '',
  primaryMuscles,
  secondaryMuscles,
  timeScale: tempoScale,
  isPaused,
  cameraPreset,
  debugMuscleMask: showMaskDebug = false,
  lockedFrame: activeKeyframe = null,
  quadView = false,
  onReady,
}: TrainerStudio3DProps) {
  const isPlaying = !isPaused;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameBadgeRef = useRef<HTMLSpanElement | null>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);

  const stateRef = useRef({
    clipName,
    exerciseId,
    biomechanicalVariant,
    exerciseName,
    primaryMuscles,
    secondaryMuscles,
    tempoScale,
    isPlaying,
    cameraPreset,
    showMaskDebug,
    activeKeyframe,
    quadView,
    onReady,
  });

  useEffect(() => {
    stateRef.current = {
      clipName,
      exerciseId,
      biomechanicalVariant,
      exerciseName,
      primaryMuscles,
      secondaryMuscles,
      tempoScale,
      isPlaying,
      cameraPreset,
      showMaskDebug,
      activeKeyframe,
      quadView,
      onReady,
    };
  }, [
    clipName,
    exerciseId,
    biomechanicalVariant,
    exerciseName,
    primaryMuscles,
    secondaryMuscles,
    tempoScale,
    isPlaying,
    cameraPreset,
    showMaskDebug,
    activeKeyframe,
    quadView,
    onReady,
  ]);

  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    updateMuscleMaterials: () => void;
    applyCameraPreset: (preset: CameraPreset) => void;
  } | null>(null);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.updateMuscleMaterials();
    }
  }, [primaryMuscles, secondaryMuscles, showMaskDebug, clipName, exerciseId]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.applyCameraPreset(cameraPreset);
    }
  }, [cameraPreset, clipName, exerciseId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setWebGLSupported(false));
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b16);
    scene.fog = new THREE.FogExp2(0x060b16, 0.055);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    const auxCamera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 1.4;
    controls.maxDistance = 6.5;

    // Studio Blueprint Lighting — dramatic sculpted contrast matching reference_blueprint.png
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.44);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x090d16, 0.46);
    hemiLight.position.set(0, 4, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.45);
    keyLight.position.set(2.4, 4.4, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    const d = 2.4;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.65);
    fillLight.position.set(-2.8, 2.4, -2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.90);
    rimLight.position.set(0, 3.2, -3.2);
    scene.add(rimLight);

    // Clean Blueprint Floor & Grid
    const floorGeo = new THREE.CircleGeometry(6.5, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080f1e,
      roughness: 0.88,
      metalness: 0.12,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(6.0, 24, 0x0369a1, 0x16243b);
    gridHelper.position.y = 0.002;
    scene.add(gridHelper);

    // Materials (vertexColors enabled for sculpted anatomical grooves & striations)
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x9aa6b8,
      roughness: 0.45,
      metalness: 0.14,
      vertexColors: true,
    });

    const shortsMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.78,
      metalness: 0.06,
      vertexColors: true,
    });

    const shortsTrimMat = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      roughness: 0.65,
      metalness: 0.10,
      vertexColors: true,
    });

    const trimWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.42,
      metalness: 0.1,
      vertexColors: true,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.82,
      metalness: 0.06,
      vertexColors: true,
    });

    const shoeDarkMat = new THREE.MeshStandardMaterial({
      color: 0x11151c,
      roughness: 0.65,
      metalness: 0.12,
    });

    const equipMetalMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.25,
      metalness: 0.85,
    });

    const equipChromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.92,
    });

    const equipDarkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.72,
      metalness: 0.2,
    });

    const muscleIds: MuscleGroup[] = [
      'chest',
      'back_lats',
      'shoulders',
      'biceps',
      'triceps',
      'forearms',
      'abs',
      'glutes',
      'quads',
      'hamstrings',
      'calves',
    ];

    const debugColors: Record<MuscleGroup, number> = {
      chest: 0xff2222,
      back_lats: 0x0088ff,
      shoulders: 0xffaa00,
      biceps: 0xff00ff,
      triceps: 0x00ffcc,
      forearms: 0x88ff00,
      abs: 0xffff00,
      glutes: 0xaa00ff,
      quads: 0x00ff44,
      hamstrings: 0xff6600,
      calves: 0x00ccff,
    };

    const muscleMaterials: Record<MuscleGroup, THREE.MeshStandardMaterial> = {} as Record<
      MuscleGroup,
      THREE.MeshStandardMaterial
    >;

    muscleIds.forEach((id) => {
      muscleMaterials[id] = new THREE.MeshStandardMaterial({
        color: 0x9aa6b8,
        roughness: 0.45,
        metalness: 0.14,
        vertexColors: true,
      });
    });

    const shortsGlutesMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.78,
      metalness: 0.06,
      vertexColors: true,
    });

    // ============================================================================
    // CONTINUOUS SKINNED ANATOMICAL LOFTS (180cm / 70kg Athletic Male)
    // ============================================================================
    const PELVIS_DROP = 0.075;
    const TORSO_LEN = 0.56;
    const HEAD_NECK_LEN = 0.25;
    const UPPER_ARM_LEN = 0.30;
    const FOREARM_LEN = 0.27;
    const HAND_LEN = 0.08;
    const THIGH_LEN = 0.43;
    const CALF_LEN = 0.41;

    // 1. UNIFIED AXIAL BODY MESH (Shorts Crotch Saddle s=0 -> Pelvis -> Waist -> Chest -> Neck -> Face -> Closed Skull Crown s=1)
    const buildUnifiedAxialBody = (): SkinnedLoftMeshData => {
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.045, rzAnt: 0.052, rzPost: 0.058, pinchCenterZ: 0.006 },
        { s: 0.04, rx: 0.178, rzAnt: 0.106, rzPost: 0.122, pinchCenterZ: 0.022 },
        { s: 0.09, rx: 0.168, rzAnt: 0.108, rzPost: 0.132, pinchCenterZ: 0.026 },
        { s: 0.16, rx: 0.152, rzAnt: 0.102, rzPost: 0.112, pinchCenterZ: 0.012 },
        { s: 0.24, rx: 0.138, rzAnt: 0.098, rzPost: 0.098, pinchCenterZ: 0.010 },
        { s: 0.34, rx: 0.150, rzAnt: 0.108, rzPost: 0.106, pinchCenterZ: 0.014 },
        { s: 0.45, rx: 0.178, rzAnt: 0.126, rzPost: 0.118, pinchCenterZ: 0.020 },
        { s: 0.55, rx: 0.198, rzAnt: 0.134, rzPost: 0.124, pinchCenterZ: 0.022 },
        { s: 0.63, rx: 0.206, rzAnt: 0.112, rzPost: 0.108, pinchCenterZ: 0.008 },
        { s: 0.68, rx: 0.108, rzAnt: 0.076, rzPost: 0.078, pinchCenterZ: 0.002 },
        { s: 0.71, rx: 0.058, rzAnt: 0.056, rzPost: 0.058, pinchCenterZ: 0.000 },
        { s: 0.76, rx: 0.055, rzAnt: 0.055, rzPost: 0.056, pinchCenterZ: 0.000 },
        { s: 0.80, rx: 0.058, rzAnt: 0.068, rzPost: 0.060, pinchCenterZ: 0.000 },
        { s: 0.83, rx: 0.068, rzAnt: 0.094, rzPost: 0.074, pinchCenterZ: 0.000 },
        { s: 0.87, rx: 0.076, rzAnt: 0.096, rzPost: 0.088, pinchCenterZ: 0.000 },
        { s: 0.91, rx: 0.079, rzAnt: 0.092, rzPost: 0.092, pinchCenterZ: 0.000 },
        { s: 0.95, rx: 0.074, rzAnt: 0.084, rzPost: 0.086, pinchCenterZ: 0.000 },
        { s: 0.98, rx: 0.048, rzAnt: 0.052, rzPost: 0.054, pinchCenterZ: 0.000 },
        { s: 1.00, rx: 0.001, rzAnt: 0.001, rzPost: 0.001, pinchCenterZ: 0.000 },
      ];

      // Groups: 0: skin, 1: shorts, 2: shortsTrim, 3: chest, 4: abs, 5: back_lats, 6: shoulders, 7: glutes(shorts), 8: hair
      const groupFn = (s: number, nx: number, nz: number): number => {
        const absX = Math.abs(nx);
        const isAnt = nz >= 0;

        if (s >= 0.78) {
          if (s >= 0.93) return 8;
          if (s >= 0.89 && (nz < 0.36 || absX > 0.70)) return 8;
          if (s >= 0.83 && nz < -0.15) return 8;
          return 0;
        }

        if (s < 0.18) {
          if (s >= 0.162 && s < 0.18) return 2;
          if (!isAnt && s >= 0.02 && s < 0.155 && absX > 0.12 && absX < 0.90) return 7;
          return 1;
        }

        if (s >= 0.54 && s <= 0.67 && absX > 0.72) {
          return 6;
        }
        if (isAnt && s >= 0.40 && s <= 0.62 && absX >= 0.05 && absX <= 0.82 && nz > 0.20) {
          return 3;
        }
        if (isAnt && s >= 0.18 && s < 0.40 && absX <= 0.68 && nz > 0.26) {
          return 4;
        }
        if (!isAnt && s >= 0.22 && s <= 0.65 && absX >= 0.06 && nz < -0.15) {
          return 5;
        }
        return 0;
      };

      const sculptFn = (
        s: number,
        _theta: number,
        nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        const absX = Math.abs(nx);

        if (s < 0.70) {
          const ts = s / 0.70;
          if (nz > 0.15 && ts > 0.55 && ts < 0.87 && absX > 0.05 && absX < 0.84) {
            const pecS = Math.sin(((ts - 0.55) / 0.32) * Math.PI);
            const pecX = Math.sin(((absX - 0.05) / 0.79) * Math.PI);
            const lowerShelf = ts < 0.65 ? Math.sin(((ts - 0.55) / 0.10) * (Math.PI * 0.5)) : 1.0;
            pos.z += 0.022 * pecS * pecX * lowerShelf * nz;
          }
          if (nz > 0.32 && ts > 0.24 && ts < 0.55 && absX > 0.05 && absX < 0.45) {
            const rowPhase = ((ts - 0.24) / 0.31) * 3 * Math.PI;
            const abRow = Math.pow(Math.max(0, Math.sin(rowPhase)), 0.75);
            const abCol = Math.sin(((absX - 0.05) / 0.40) * Math.PI);
            pos.z += 0.012 * abRow * abCol * nz;
          }
          if (nz > -0.1 && nz < 0.65 && ts > 0.32 && ts < 0.62 && absX > 0.55 && absX < 0.92) {
            const ribWave = Math.max(0, Math.sin(((ts - 0.32) / 0.30) * 4 * Math.PI));
            pos.x += (nx > 0 ? 1 : -1) * 0.005 * ribWave;
          }
          if (nz < -0.15 && ts > 0.32 && ts < 0.86 && absX > 0.12 && absX < 0.88) {
            const latS = Math.sin(((ts - 0.32) / 0.54) * Math.PI);
            const latX = Math.sin(((absX - 0.12) / 0.76) * Math.PI);
            pos.z -= 0.018 * latS * latX * -nz;
            pos.x += (nx > 0 ? 1 : -1) * 0.010 * latS * latX;
          }
          if (nz < -0.2 && ts > 0.02 && ts < 0.19 && absX > 0.12 && absX < 0.86) {
            const gluteS = Math.sin(((ts - 0.02) / 0.17) * Math.PI);
            const gluteX = Math.sin(((absX - 0.12) / 0.74) * Math.PI);
            pos.z -= 0.020 * gluteS * gluteX * -nz;
          }
        } else {
          const hs = (s - 0.70) / 0.30;
          if (nz > 0.68 && hs > 0.46 && hs < 0.66 && absX < 0.22) {
            const noseS = Math.sin(((hs - 0.46) / 0.20) * Math.PI);
            const noseX = Math.cos((absX / 0.22) * (Math.PI * 0.5));
            pos.z += 0.017 * noseS * noseX;
          }
          if (nz > 0.55 && hs > 0.62 && hs < 0.72 && absX < 0.62) {
            pos.z += 0.007 * Math.sin(((hs - 0.62) / 0.10) * Math.PI);
          }
          if (nz > 0.55 && hs > 0.56 && hs < 0.64 && absX > 0.18 && absX < 0.54) {
            pos.z -= 0.006;
          }
          if (nz > 0.35 && hs > 0.34 && hs < 0.46 && absX < 0.58) {
            pos.z += 0.008 * Math.sin(((hs - 0.34) / 0.12) * Math.PI);
          }
          if (absX > 0.90 && Math.abs(nz) < 0.32 && hs > 0.48 && hs < 0.65) {
            pos.x += (nx > 0 ? 1 : -1) * 0.009 * Math.sin(((hs - 0.48) / 0.17) * Math.PI);
          }
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number,
        matGroup: number
      ): [number, number, number] => {
        if (matGroup === 8) return [0.92, 0.94, 0.98];
        const absX = Math.abs(nx);
        let shade = 0.93;

        if (s < 0.70) {
          const ts = s / 0.70;
          if (nz > 0.25 && absX < 0.09 && ts > 0.24 && ts < 0.86) {
            shade -= 0.28 * (1 - absX / 0.09);
          }
          if (nz > 0.25 && ts > 0.54 && ts < 0.60 && absX > 0.08 && absX < 0.80) {
            const groove = 1 - Math.abs(ts - 0.57) / 0.03;
            shade -= 0.30 * Math.max(0, groove);
          }
          if (nz > 0.15 && ts > 0.65 && ts < 0.88 && absX > 0.70 && absX < 0.80) {
            shade -= 0.22;
          }
          if (nz > 0.30 && ts > 0.24 && ts < 0.55 && absX < 0.44) {
            for (const gS of [0.33, 0.43, 0.52]) {
              const dist = Math.abs(ts - gS);
              if (dist < 0.022) {
                shade -= 0.26 * (1 - dist / 0.022);
              }
            }
            if (absX > 0.38 && absX < 0.46) {
              shade -= 0.24 * (1 - Math.abs(absX - 0.42) / 0.04);
            }
          }
          if (nz > 0.0 && nz < 0.70 && ts > 0.36 && ts < 0.60 && absX > 0.46 && absX < 0.85) {
            const ribGroove = Math.abs(Math.sin(((ts - 0.36) / 0.24) * 3 * Math.PI));
            if (ribGroove < 0.25) shade -= 0.18;
          }
          if (nz < -0.25 && ts > 0.25 && ts < 0.88) {
            if (absX < 0.10) shade -= 0.26 * (1 - absX / 0.10);
            if (ts > 0.60 && ts < 0.84 && absX > 0.42 && absX < 0.54) shade -= 0.18;
          }
          if (matGroup === 1 || matGroup === 7) {
            shade = 0.90 + 0.08 * Math.sin(nx * 6);
            if (nz < -0.2 && absX < 0.12) shade -= 0.25;
          }
        } else {
          const hs = (s - 0.70) / 0.30;
          if (nz > 0.55 && hs > 0.56 && hs < 0.65 && absX > 0.18 && absX < 0.52) shade -= 0.28;
          if (nz > 0.1 && hs > 0.26 && hs < 0.36) shade -= 0.22;
          if (nz > 0.65 && hs > 0.42 && hs < 0.47 && absX < 0.28) shade -= 0.18;
        }

        const c = Math.max(0.48, Math.min(1.06, shade));
        return [c, c, c];
      };

      const materials = [
        skinMat,
        shortsMat,
        shortsTrimMat,
        muscleMaterials.chest,
        muscleMaterials.abs,
        muscleMaterials.back_lats,
        muscleMaterials.shoulders,
        shortsGlutesMat,
        hairMat,
      ];

      return createContinuousSkinnedLoft(
        PELVIS_DROP + TORSO_LEN + HEAD_NECK_LEN,
        sections,
        64,
        96,
        materials,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
    };

    // 2. CONTINUOUS SKINNED ARM MESH (Shoulder Deltoid Cap s=0 -> Elbow s=0.48 -> Wrist s=0.88 -> Hand Tip s=1.0)
    const buildSkinnedArm = (): SkinnedLoftMeshData => {
      const totalArmLen = UPPER_ARM_LEN + FOREARM_LEN + HAND_LEN; // 0.65m
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.012, rzAnt: 0.012, rzPost: 0.012 },
        { s: 0.04, rx: 0.062, rzAnt: 0.062, rzPost: 0.060 },
        { s: 0.11, rx: 0.072, rzAnt: 0.072, rzPost: 0.070 },
        { s: 0.20, rx: 0.062, rzAnt: 0.066, rzPost: 0.064 },
        { s: 0.30, rx: 0.056, rzAnt: 0.068, rzPost: 0.064 },
        { s: 0.42, rx: 0.048, rzAnt: 0.052, rzPost: 0.052 },
        { s: 0.48, rx: 0.045, rzAnt: 0.044, rzPost: 0.046 },
        { s: 0.56, rx: 0.047, rzAnt: 0.045, rzPost: 0.045 },
        { s: 0.72, rx: 0.036, rzAnt: 0.032, rzPost: 0.032 },
        { s: 0.86, rx: 0.029, rzAnt: 0.023, rzPost: 0.023 },
        { s: 0.92, rx: 0.038, rzAnt: 0.016, rzPost: 0.018 },
        { s: 0.98, rx: 0.032, rzAnt: 0.012, rzPost: 0.012 },
        { s: 1.00, rx: 0.004, rzAnt: 0.004, rzPost: 0.004 },
      ];

      // Groups: 0: skin, 1: shoulders, 2: biceps, 3: triceps, 4: forearms
      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s < 0.21) return 1;
        if (s >= 0.21 && s < 0.45) {
          if (nz >= 0.08) return 2;
          if (nz <= -0.08) return 3;
        }
        if (s >= 0.50 && s < 0.84) return 4;
        return 0;
      };

      const sculptFn = (
        s: number,
        _theta: number,
        nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        if (nz > 0.2 && s > 0.20 && s < 0.44) {
          pos.z += 0.010 * Math.sin(((s - 0.20) / 0.24) * Math.PI) * nz;
        }
        if (nz < -0.2 && s > 0.18 && s < 0.44) {
          pos.z -= 0.010 * Math.sin(((s - 0.18) / 0.26) * Math.PI) * -nz;
        }
        if (s > 0.50 && s < 0.76) {
          pos.x += nx * 0.005 * Math.sin(((s - 0.50) / 0.26) * Math.PI);
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number
      ): [number, number, number] => {
        let shade = 0.93;
        if (Math.abs(nz) < 0.16 && s > 0.18 && s < 0.46) {
          shade -= 0.22 * (1 - Math.abs(nz) / 0.16);
        }
        if (s > 0.19 && s < 0.23 && Math.abs(nx) > 0.3) {
          shade -= 0.18;
        }
        if (s > 0.93 && Math.abs(Math.sin(nx * 10)) < 0.25) {
          shade -= 0.16;
        }
        const c = Math.max(0.52, Math.min(1.04, shade));
        return [c, c, c];
      };

      const materials = [
        skinMat,
        muscleMaterials.shoulders,
        muscleMaterials.biceps,
        muscleMaterials.triceps,
        muscleMaterials.forearms,
      ];

      return createContinuousSkinnedLoft(
        totalArmLen,
        sections,
        32,
        64,
        materials,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
    };

    // 3. CONTINUOUS SKINNED LEG MESH (Hip Socket s=0 -> Knee s=0.51 -> Ankle s=0.95 -> Foot/Shoe Base s=1.0)
    const buildSkinnedLeg = (): SkinnedLoftMeshData => {
      const totalLegLen = THIGH_LEN + CALF_LEN; // 0.84m
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.052, rzAnt: 0.052, rzPost: 0.052 },
        { s: 0.05, rx: 0.095, rzAnt: 0.094, rzPost: 0.102 },
        { s: 0.20, rx: 0.102, rzAnt: 0.098, rzPost: 0.100 },
        { s: 0.30, rx: 0.088, rzAnt: 0.094, rzPost: 0.088 },
        { s: 0.43, rx: 0.070, rzAnt: 0.072, rzPost: 0.068 },
        { s: 0.51, rx: 0.058, rzAnt: 0.060, rzPost: 0.056 },
        { s: 0.64, rx: 0.062, rzAnt: 0.054, rzPost: 0.074 },
        { s: 0.82, rx: 0.042, rzAnt: 0.044, rzPost: 0.046 },
        { s: 0.94, rx: 0.038, rzAnt: 0.040, rzPost: 0.040 },
        { s: 1.00, rx: 0.035, rzAnt: 0.038, rzPost: 0.038 },
      ];

      // Groups: 0: skin, 1: shorts, 2: shortsTrim, 3: quads, 4: hamstrings, 5: calves, 6: trimWhite(sock)
      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s <= 0.22) {
          if (s >= 0.205) return 2;
          return 1;
        }
        if (s > 0.22 && s < 0.47) {
          if (nz >= 0.06) return 3;
          if (nz <= -0.06) return 4;
        }
        if (s >= 0.56 && s < 0.85 && nz < 0.12) {
          return 5;
        }
        if (s >= 0.91) {
          return 6;
        }
        return 0;
      };

      const sculptFn = (
        s: number,
        _theta: number,
        nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        if (nz > 0.15 && s > 0.14 && s < 0.46) {
          const quadProfile = Math.sin(((s - 0.14) / 0.32) * Math.PI);
          pos.z += 0.015 * quadProfile * nz;
          pos.x += nx * 0.008 * quadProfile;
        }
        if (nz < -0.15 && s > 0.16 && s < 0.46) {
          pos.z -= 0.013 * Math.sin(((s - 0.16) / 0.30) * Math.PI) * -nz;
        }
        if (nz < -0.15 && s > 0.56 && s < 0.82) {
          pos.z -= 0.015 * Math.sin(((s - 0.56) / 0.26) * Math.PI) * -nz;
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number,
        matGroup: number
      ): [number, number, number] => {
        if (matGroup === 1 || matGroup === 2) return [0.92, 0.92, 0.94];
        const absX = Math.abs(nx);
        let shade = 0.94;
        if (nz > 0.35 && s > 0.22 && s < 0.46 && absX > 0.32 && absX < 0.44) {
          shade -= 0.22 * (1 - Math.abs(absX - 0.38) / 0.06);
        }
        if (Math.abs(nz) < 0.16 && s > 0.22 && s < 0.46) {
          shade -= 0.20;
        }
        if (nz < -0.4 && s > 0.58 && s < 0.80 && absX < 0.12) {
          shade -= 0.20;
        }
        const c = Math.max(0.52, Math.min(1.04, shade));
        return [c, c, c];
      };

      const materials = [
        skinMat,
        shortsMat,
        shortsTrimMat,
        muscleMaterials.quads,
        muscleMaterials.hamstrings,
        muscleMaterials.calves,
        trimWhiteMat,
      ];

      return createContinuousSkinnedLoft(
        totalLegLen,
        sections,
        36,
        64,
        materials,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
    };

    // Athletic Training Shoe Mesh
    const buildShoeGroup = (): THREE.Group => {
      const shoeGroup = new THREE.Group();
      const upperShoeGeo = new THREE.CapsuleGeometry(0.046, 0.125, 12, 16);
      const upperShoe = new THREE.Mesh(upperShoeGeo, shoeDarkMat);
      upperShoe.rotation.x = Math.PI / 2;
      upperShoe.scale.set(1.02, 1.0, 0.78);
      upperShoe.position.set(0, -0.036, 0.048);
      upperShoe.castShadow = true;
      shoeGroup.add(upperShoe);

      const soleGeo = new THREE.CapsuleGeometry(0.049, 0.138, 10, 16);
      const sole = new THREE.Mesh(soleGeo, trimWhiteMat);
      sole.rotation.x = Math.PI / 2;
      sole.scale.set(1.06, 1.0, 0.36);
      sole.position.set(0, -0.066, 0.050);
      sole.castShadow = true;
      shoeGroup.add(sole);

      return shoeGroup;
    };

    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    const axialBody = buildUnifiedAxialBody();
    const armL = buildSkinnedArm();
    const armR = buildSkinnedArm();
    const legL = buildSkinnedLeg();
    const legR = buildSkinnedLeg();
    const shoeL = buildShoeGroup();
    const shoeR = buildShoeGroup();

    characterRoot.add(
      axialBody.mesh,
      armL.mesh,
      armR.mesh,
      legL.mesh,
      legR.mesh,
      shoeL,
      shoeR
    );

    // ============================================================================
    // MODULAR GYM EQUIPMENT PROPS (Pull-Up Rig, Adjustable Bench, Dip Bars, Cable Bar, Barbell, Dumbbells, Towel)
    // ============================================================================
    const equipmentRoot = new THREE.Group();
    scene.add(equipmentRoot);

    // 1. Pull-Up Rig (`pullupRigGroup`)
    const pullupRigGroup = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.032, 0.032, 2.22, 20);
    const postL = new THREE.Mesh(postGeo, equipDarkMat);
    postL.position.set(-0.68, 1.11, 0);
    postL.castShadow = true;
    const postR = new THREE.Mesh(postGeo, equipDarkMat);
    postR.position.set(0.68, 1.11, 0);
    postR.castShadow = true;

    const basePlateGeo = new THREE.BoxGeometry(0.24, 0.03, 0.56);
    const baseL = new THREE.Mesh(basePlateGeo, equipDarkMat);
    baseL.position.set(-0.68, 0.015, 0);
    const baseR = new THREE.Mesh(basePlateGeo, equipDarkMat);
    baseR.position.set(0.68, 0.015, 0);

    const crossbarGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.48, 24);
    const crossbar = new THREE.Mesh(crossbarGeo, equipChromeMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, 2.10, 0);
    crossbar.castShadow = true;

    const gripGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.16, 16);
    const gripL = new THREE.Mesh(gripGeo, equipDarkMat);
    gripL.rotation.z = Math.PI / 2;
    gripL.position.set(-0.34, 2.10, 0);
    const gripR = new THREE.Mesh(gripGeo, equipDarkMat);
    gripR.rotation.z = Math.PI / 2;
    gripR.position.set(0.34, 2.10, 0);

    pullupRigGroup.add(postL, postR, baseL, baseR, crossbar, gripL, gripR);
    pullupRigGroup.visible = false;
    equipmentRoot.add(pullupRigGroup);

    // 2. Adjustable Flat / Incline Bench (`benchGroup`)
    const benchGroup = new THREE.Group();
    const benchSeatPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.42), equipDarkMat);
    benchSeatPad.position.set(0, 0.41, 0.22);
    benchSeatPad.castShadow = true;
    benchSeatPad.receiveShadow = true;

    const benchBackPivot = new THREE.Group();
    benchBackPivot.position.set(0, 0.41, -0.02);
    const benchBackPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.82), equipDarkMat);
    benchBackPad.position.set(0, 0, -0.40);
    benchBackPad.castShadow = true;
    benchBackPad.receiveShadow = true;
    benchBackPivot.add(benchBackPad);

    const benchLegFront = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.40, 0.06), equipMetalMat);
    benchLegFront.position.set(0, 0.20, 0.34);
    const benchLegBack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.40, 0.06), equipMetalMat);
    benchLegBack.position.set(0, 0.20, -0.64);
    benchGroup.add(benchSeatPad, benchBackPivot, benchLegFront, benchLegBack);
    benchGroup.visible = false;
    equipmentRoot.add(benchGroup);

    // 3. Parallel Dip Station (`dipBarsGroup`)
    const dipBarsGroup = new THREE.Group();
    [-0.27, 0.27].forEach((xSide) => {
      const upright = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.02, 16), equipDarkMat);
      upright.position.set(xSide, 0.51, -0.25);
      upright.castShadow = true;
      const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.56, 16), equipChromeMat);
      handleBar.rotation.x = Math.PI / 2;
      handleBar.position.set(xSide, 1.01, -0.02);
      handleBar.castShadow = true;
      const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.65), equipDarkMat);
      baseFoot.position.set(xSide, 0.012, -0.08);
      dipBarsGroup.add(upright, handleBar, baseFoot);
    });
    dipBarsGroup.visible = false;
    equipmentRoot.add(dipBarsGroup);

    // 4. Barbell (`barbellGroup`)
    const barbellGroup = new THREE.Group();
    const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.75, 16), equipChromeMat);
    barMesh.rotation.z = Math.PI / 2;
    barbellGroup.add(barMesh);
    [-0.64, -0.59, 0.59, 0.64].forEach((xOffset, idx) => {
      const r = idx === 0 || idx === 3 ? 0.16 : 0.20;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.032, 24), equipDarkMat);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = xOffset;
      plate.castShadow = true;
      barbellGroup.add(plate);
    });
    barbellGroup.visible = false;
    equipmentRoot.add(barbellGroup);

    // 5. Cable Handle / Lat Pulldown Bar (`cableBarGroup`)
    const cableBarGroup = new THREE.Group();
    const cableHandleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.96, 16), equipChromeMat);
    cableHandleMesh.rotation.z = Math.PI / 2;
    const cableWireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 8), equipMetalMat);
    cableWireMesh.position.set(0, 0.6, 0);
    cableBarGroup.add(cableHandleMesh, cableWireMesh);
    cableBarGroup.visible = false;
    equipmentRoot.add(cableBarGroup);

    // 6. Dumbbells (`dumbbellL`, `dumbbellR`)
    const makeDumbbell = () => {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 12), equipChromeMat);
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
      [-0.06, 0.06].forEach((x) => {
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 16), equipDarkMat);
        head.rotation.z = Math.PI / 2;
        head.position.x = x;
        g.add(head);
      });
      g.visible = false;
      equipmentRoot.add(g);
      return g;
    };
    const dumbbellL = makeDumbbell();
    const dumbbellR = makeDumbbell();

    // ============================================================================
    // MUSCLE HIGHLIGHT UPDATER (Blueprint Crimson Red & Coral)
    // ============================================================================
    const updateMuscleMaterials = () => {
      const { primaryMuscles: prim, secondaryMuscles: sec, showMaskDebug: debug } = stateRef.current;

      muscleIds.forEach((id) => {
        const mat = muscleMaterials[id];
        if (!mat) return;

        if (debug) {
          mat.color.setHex(debugColors[id]);
          mat.emissive.setHex(debugColors[id]);
          mat.emissiveIntensity = 0.28;
          mat.roughness = 0.35;
        } else if (prim.includes(id)) {
          mat.color.setHex(0xdc2626);
          mat.emissive.setHex(0x991b1b);
          mat.emissiveIntensity = 0.32;
          mat.roughness = 0.36;
          mat.metalness = 0.12;
        } else if (sec.includes(id)) {
          mat.color.setHex(0xea580c);
          mat.emissive.setHex(0x9a3412);
          mat.emissiveIntensity = 0.22;
          mat.roughness = 0.42;
          mat.metalness = 0.12;
        } else {
          mat.color.setHex(0x9aa6b8);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
          mat.roughness = 0.45;
          mat.metalness = 0.14;
        }
        mat.needsUpdate = true;
      });

      if (debug) {
        shortsGlutesMat.color.setHex(debugColors.glutes);
        shortsGlutesMat.emissive.setHex(debugColors.glutes);
        shortsGlutesMat.emissiveIntensity = 0.28;
      } else if (prim.includes('glutes')) {
        shortsGlutesMat.color.setHex(0xdc2626);
        shortsGlutesMat.emissive.setHex(0x991b1b);
        shortsGlutesMat.emissiveIntensity = 0.32;
      } else if (sec.includes('glutes')) {
        shortsGlutesMat.color.setHex(0xea580c);
        shortsGlutesMat.emissive.setHex(0x9a3412);
        shortsGlutesMat.emissiveIntensity = 0.22;
      } else {
        shortsGlutesMat.color.setHex(0x181c24);
        shortsGlutesMat.emissive.setHex(0x000000);
        shortsGlutesMat.emissiveIntensity = 0.0;
      }
      shortsGlutesMat.needsUpdate = true;
    };

    // ============================================================================
    // CAMERA PRESETS (Exercise-Aware Full-Body Framing with Zero Clipping)
    // ============================================================================
    const computeCameraView = (
      preset: CameraPreset,
      clip: AnimationClipName,
      exId: string
    ): { pos: THREE.Vector3; target: THREE.Vector3 } => {
      const id = exId.toLowerCase();
      const isGroundMat =
        clip === 'pushup' ||
        clip === 'diamond_pushup' ||
        clip === 'plank' ||
        clip === 'mountain_climber' ||
        clip === 'crunch' ||
        clip === 'glute_bridge' ||
        id === 'superman_pulls' ||
        id === 'reverse_snow_angels' ||
        id === 'plank_downward_dog' ||
        id === 'bodyweight_tricep_ext' ||
        id === 'crunches' ||
        id === 'leg_raises' ||
        id === 'russian_twists' ||
        id === 'glute_bridges';

      const isBenchOrSeated =
        id === 'bench_press' ||
        id === 'incline_dumbbell_press' ||
        id === 'chest_fly' ||
        id === 'skull_crushers' ||
        id === 'incline_curl' ||
        id === 'leg_press' ||
        id === 'leg_curl' ||
        id === 'seated_cable_row' ||
        id === 'chair_dips' ||
        id === 'bench_dips' ||
        id === 'dips' ||
        id === 'doorframe_rows';

      const isHangingOrOverhead =
        id === 'pull_ups' ||
        (clip === 'pullup' && id !== 'lat_pulldown') ||
        id === 'overhead_press' ||
        id === 'overhead_tricep_ext';

      if (isGroundMat) {
        const target = new THREE.Vector3(0, 0.34, -0.10);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 0.82, 2.05), target };
          case 'side':
            return { pos: new THREE.Vector3(2.30, 0.70, -0.10), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 0.86, -2.20), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 2.70, -0.10), target };
        }
      }

      if (isBenchOrSeated) {
        const target = new THREE.Vector3(0, 0.62, 0.0);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 0.96, 2.65), target };
          case 'side':
            return { pos: new THREE.Vector3(2.65, 0.88, 0.0), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 0.96, -2.65), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 2.95, 0.02), target };
        }
      }

      if (isHangingOrOverhead) {
        const target = new THREE.Vector3(0, 1.24, 0);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 1.28, 3.60), target };
          case 'side':
            return { pos: new THREE.Vector3(3.50, 1.28, 0), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 1.28, -3.60), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 3.85, 0.05), target };
        }
      }

      const target = new THREE.Vector3(0, 0.94, 0);
      switch (preset) {
        case 'front':
          return { pos: new THREE.Vector3(0, 1.02, 3.15), target };
        case 'side':
          return { pos: new THREE.Vector3(3.05, 0.98, 0), target };
        case 'back':
          return { pos: new THREE.Vector3(0, 1.02, -3.15), target };
        case 'top':
          return { pos: new THREE.Vector3(0.01, 3.25, 0.05), target };
      }
    };

    const applyCameraPreset = (preset: CameraPreset) => {
      const { pos, target } = computeCameraView(
        preset,
        stateRef.current.clipName,
        stateRef.current.exerciseId
      );
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
    };

    updateMuscleMaterials();
    applyCameraPreset(stateRef.current.cameraPreset);

    // ============================================================================
    // 52-EXERCISE BIOMECHANICAL IK & SKINNED DEFORMATION ENGINE (30 FPS / 60 Frames)
    // ============================================================================
    const applyProceduralPose = (
      clip: AnimationClipName,
      exId: string,
      variant: string,
      exName: string,
      frame: number
    ) => {
      const norm = ((frame % 60) + 60) % 60 / 60;
      const theta = norm * Math.PI * 2;
      const p = 0.5 - 0.5 * Math.cos(theta); // Smooth 0 -> 1 -> 0 cycle

      // Reset all equipment props each frame
      pullupRigGroup.visible = false;
      crossbar.position.set(0, 2.10, 0);
      gripL.position.set(-0.34, 2.10, 0);
      gripR.position.set(0.34, 2.10, 0);

      benchGroup.visible = false;
      benchGroup.position.set(0, 0, 0);
      benchGroup.rotation.set(0, 0, 0);
      benchBackPivot.rotation.set(0, 0, 0);

      dipBarsGroup.visible = false;
      barbellGroup.visible = false;
      barbellGroup.rotation.set(0, 0, 0);
      cableBarGroup.visible = false;
      cableBarGroup.rotation.set(0, 0, 0);

      dumbbellL.visible = false;
      dumbbellR.visible = false;
      dumbbellL.rotation.set(0, 0, 0);
      dumbbellR.rotation.set(0, 0, 0);

      // Default standing anatomical state
      const hipsPos = new THREE.Vector3(0, 0.94, 0);
      const shoulderCenter = new THREE.Vector3(0, 0.94 + TORSO_LEN, 0);
      const torsoAnterior = new THREE.Vector3(0, 0, 1);
      const headLookDir = new THREE.Vector3(0, 0, 1);
      let spineArchOffset = 0.012;
      let shoulderElevationOffset = 0.0; // For Shrugs

      const handL = new THREE.Vector3(-0.24, 0.76, 0.06);
      const handR = new THREE.Vector3(0.24, 0.76, 0.06);
      const elbowPoleL = new THREE.Vector3(-0.34, 1.10, -0.25);
      const elbowPoleR = new THREE.Vector3(0.34, 1.10, -0.25);
      let directElbowL: THREE.Vector3 | null = null;
      let directElbowR: THREE.Vector3 | null = null;

      const footL = new THREE.Vector3(-0.14, 0.075, 0);
      const footR = new THREE.Vector3(0.14, 0.075, 0);
      const kneePoleL = new THREE.Vector3(-0.16, 0.52, 0.50);
      const kneePoleR = new THREE.Vector3(0.16, 0.52, 0.50);
      let directKneeL: THREE.Vector3 | null = null;
      let directKneeR: THREE.Vector3 | null = null;

      let footModeL: 'flat' | 'toes' | 'free' = 'flat';
      let footModeR: 'flat' | 'toes' | 'free' = 'flat';
      let anklePitchOffsetL = 0;
      let anklePitchOffsetR = 0;

      const id = exId.toLowerCase();
      const nameLower = exName.toLowerCase();

      // =========================================================================
      // DEDICATED 52-EXERCISE BIOMECHANICAL SOLVER
      // Note on Supine (face-up) exercises:
      // To preserve right-handed basis `torsoRight = torsoUp × torsoAnterior = (+1, 0, 0)`,
      // whenever `torsoAnterior` points UP (`+Y`), `torsoUp` (hips -> shoulders) MUST point
      // toward `-Z` (`shoulderCenter.z < hipsPos.z`) and feet point toward `+Z` (`foot.z > hipsPos.z`).
      // =========================================================================

      if (id === 'bench_press' || nameLower === 'bench press') {
        // Flat Barbell Bench Press (Supine on flat bench, head at -Z, feet planted at +Z)
        benchGroup.visible = true;
        const press = 1 - p; // Frame 0 = lockout top, Frame 30 = bar at chest
        hipsPos.set(0, 0.47, 0.18);
        shoulderCenter.set(0, 0.47, -0.38);
        torsoAnterior.set(0, 1, 0);
        headLookDir.set(0, 1, 0);
        spineArchOffset = 0.018;

        const barY = 0.63 + 0.34 * press;
        const barZ = -0.34;
        barbellGroup.visible = true;
        barbellGroup.position.set(0, barY, barZ);

        handL.set(-0.33, barY, barZ);
        handR.set(0.33, barY, barZ);
        // Elbows tuck ~50 deg toward hips (+Z) and below bench
        elbowPoleL.set(-0.46, 0.22, -0.14);
        elbowPoleR.set(0.46, 0.22, -0.14);

        footL.set(-0.23, 0.075, 0.62);
        footR.set(0.23, 0.075, 0.62);
        kneePoleL.set(-0.24, 0.56, 0.52);
        kneePoleR.set(0.24, 0.56, 0.52);
      } else if (id === 'incline_dumbbell_press' || nameLower.includes('incline dumbbell')) {
        // 35° Incline Dumbbell Press
        benchGroup.visible = true;
        benchBackPivot.rotation.x = 0.60; // Raise backrest 35 degrees
        const press = 1 - p;
        const incAngle = 0.60; // ~35 deg from horizontal
        hipsPos.set(0, 0.45, 0.14);
        shoulderCenter.set(
          0,
          0.45 + Math.sin(incAngle) * TORSO_LEN,
          0.14 - Math.cos(incAngle) * TORSO_LEN
        );
        torsoAnterior.set(0, Math.cos(incAngle), Math.sin(incAngle)).normalize();
        headLookDir.set(0, 0.65, 0.76).normalize();

        dumbbellL.visible = true;
        dumbbellR.visible = true;
        const dbY = shoulderCenter.y + 0.08 + 0.34 * press;
        const dbZ = shoulderCenter.z + 0.04;
        const spreadX = 0.27 - 0.10 * press; // Converging arc at top
        handL.set(-spreadX, dbY, dbZ);
        handR.set(spreadX, dbY, dbZ);
        dumbbellL.position.copy(handL);
        dumbbellR.position.copy(handR);

        elbowPoleL.set(-0.48, shoulderCenter.y - 0.24, shoulderCenter.z + 0.18);
        elbowPoleR.set(0.48, shoulderCenter.y - 0.24, shoulderCenter.z + 0.18);

        footL.set(-0.22, 0.075, 0.62);
        footR.set(0.22, 0.075, 0.62);
        kneePoleL.set(-0.23, 0.54, 0.48);
        kneePoleR.set(0.23, 0.54, 0.48);
      } else if (id === 'chest_fly' || nameLower.includes('chest fly')) {
        // Supine Dumbbell Chest Fly on Flat Bench (Wide barrel-hug arc)
        benchGroup.visible = true;
        const open = p; // Frame 0 = dumbbells together over chest, Frame 30 = wide stretch
        hipsPos.set(0, 0.47, 0.18);
        shoulderCenter.set(0, 0.47, -0.38);
        torsoAnterior.set(0, 1, 0);
        headLookDir.set(0, 1, 0);

        dumbbellL.visible = true;
        dumbbellR.visible = true;
        const flyAngle = (12 + 68 * open) * (Math.PI / 180);
        const reach = 0.52;
        const sY = 0.47;
        const sZ = -0.36;
        handL.set(-0.19 - Math.sin(flyAngle) * reach, sY + Math.cos(flyAngle) * reach, sZ);
        handR.set(0.19 + Math.sin(flyAngle) * reach, sY + Math.cos(flyAngle) * reach, sZ);

        dumbbellL.position.copy(handL);
        dumbbellR.position.copy(handR);
        dumbbellL.rotation.set(0, Math.PI / 2, 0);
        dumbbellR.rotation.set(0, Math.PI / 2, 0);

        elbowPoleL.set(-0.56, sY - 0.15, sZ + 0.08);
        elbowPoleR.set(0.56, sY - 0.15, sZ + 0.08);

        footL.set(-0.22, 0.075, 0.62);
        footR.set(0.22, 0.075, 0.62);
        kneePoleL.set(-0.23, 0.56, 0.52);
        kneePoleR.set(0.23, 0.56, 0.52);
      } else if (id === 'dips' || nameLower === 'dips') {
        // Gym Parallel Bar Dips
        dipBarsGroup.visible = true;
        const dip = p; // Frame 0 = top lockout, Frame 30 = 90-deg bottom dip
        const hipY = 0.92 - 0.24 * dip;
        const lean = 0.22 + 0.10 * dip; // Forward chest lean
        hipsPos.set(0, hipY, -0.06);
        shoulderCenter.set(
          0,
          hipY + Math.cos(lean) * TORSO_LEN,
          -0.06 + Math.sin(lean) * TORSO_LEN
        );
        torsoAnterior.set(0, -Math.sin(lean), Math.cos(lean)).normalize();
        headLookDir.set(0, -0.15, 1).normalize();

        handL.set(-0.27, 1.02, 0.04);
        handR.set(0.27, 1.02, 0.04);
        elbowPoleL.set(-0.34, shoulderCenter.y + 0.05, -0.45);
        elbowPoleR.set(0.34, shoulderCenter.y + 0.05, -0.45);

        // Knees bent at 90 degrees with feet tucked behind in air
        directKneeL = new THREE.Vector3(-0.11, hipY - 0.40, -0.04);
        directKneeR = new THREE.Vector3(0.11, hipY - 0.40, -0.04);
        footL.set(-0.09, hipY - 0.36, -0.44);
        footR.set(0.09, hipY - 0.36, -0.44);
        kneePoleL.set(-0.11, hipY - 0.40, 0.35);
        kneePoleR.set(0.11, hipY - 0.40, 0.35);
        footModeL = 'free';
        footModeR = 'free';
      } else if (
        id === 'chair_dips' ||
        id === 'bench_dips' ||
        nameLower.includes('chair dip') ||
        nameLower.includes('bench dip')
      ) {
        // Chair / Bench Tricep Dips (Hands on bench behind back, heels extended in front)
        benchGroup.visible = true;
        benchGroup.rotation.y = Math.PI / 2;
        benchGroup.position.set(0.10, 0, -0.34);

        const dip = p;
        const hipY = 0.50 - 0.20 * dip;
        hipsPos.set(0, hipY, 0.02);
        shoulderCenter.set(0, hipY + TORSO_LEN, -0.02);
        torsoAnterior.set(0, 0.06, 1).normalize();
        headLookDir.set(0, 0, 1);

        handL.set(-0.22, 0.45, -0.16);
        handR.set(0.22, 0.45, -0.16);
        elbowPoleL.set(-0.26, 0.65, -0.58);
        elbowPoleR.set(0.26, 0.65, -0.58);

        footL.set(-0.12, 0.075, 0.68);
        footR.set(0.12, 0.075, 0.68);
        kneePoleL.set(-0.13, 0.38, 0.44);
        kneePoleR.set(0.13, 0.38, 0.44);
        footModeL = 'free';
        footModeR = 'free';
      } else if (
        id === 'tricep_pushdown' ||
        id === 'rope_pushdown' ||
        nameLower.includes('pushdown')
      ) {
        // Standing Cable Tricep Pushdown / Rope Pushdown
        const isRope = id === 'rope_pushdown' || nameLower.includes('rope');
        const ext = 1 - p; // Frame 0 = flexed 100 deg, Frame 30 = full downward tricep lockout
        hipsPos.set(0, 0.93, -0.04);
        shoulderCenter.set(0, 0.93 + TORSO_LEN, 0.02);
        torsoAnterior.set(0, -0.10, 1).normalize();
        headLookDir.set(0, -0.18, 1).normalize();

        // Elbows strictly pinned to the sides of the torso
        const eL = new THREE.Vector3(-0.21, 1.15, 0.05);
        const eR = new THREE.Vector3(0.21, 1.15, 0.05);
        directElbowL = eL;
        directElbowR = eR;
        elbowPoleL.set(-0.25, 1.15, -0.30);
        elbowPoleR.set(0.25, 1.15, -0.30);

        const flexAngle = 0.18 + (1 - ext) * 1.55; // 10 deg lockout up to 99 deg flexion
        const handY = eL.y - Math.cos(flexAngle) * FOREARM_LEN;
        const handZ = eL.z + Math.sin(flexAngle) * FOREARM_LEN;
        const spreadX = isRope ? 0.09 + 0.15 * ext : 0.18;

        handL.set(-spreadX, handY, handZ);
        handR.set(spreadX, handY, handZ);

        if (!isRope) {
          cableBarGroup.visible = true;
          cableHandleMesh.scale.set(1, 0.48, 1);
          cableBarGroup.position.set(0, handY, handZ);
        }
      } else if (id === 'overhead_tricep_ext' || nameLower.includes('overhead tricep')) {
        // Standing Overhead Dumbbell Tricep Extension
        hipsPos.set(0, 0.94, 0);
        shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
        torsoAnterior.set(0, 0, 1);
        headLookDir.set(0, 0.08, 1).normalize();

        const eL = new THREE.Vector3(-0.16, 1.72, 0.06);
        const eR = new THREE.Vector3(0.16, 1.72, 0.06);
        directElbowL = eL;
        directElbowR = eR;
        // Point of elbow faces forward/up (+Z/+Y), so anterior of forearm faces back
        elbowPoleL.set(-0.18, 1.85, 0.35);
        elbowPoleR.set(0.18, 1.85, 0.35);

        const ext = 1 - p; // Frame 0 = overhead lockout, Frame 30 = deep stretch behind head
        const angle = -0.65 + ext * 2.05;
        const handY = eL.y + Math.sin(angle) * FOREARM_LEN;
        const handZ = eL.z - Math.cos(angle) * FOREARM_LEN;
        handL.set(-0.07, handY, handZ);
        handR.set(0.07, handY, handZ);

        dumbbellL.visible = true;
        dumbbellL.position.set(0, handY, handZ);
        dumbbellL.rotation.set(0, 0, Math.PI / 2);
      } else if (id === 'skull_crushers' || nameLower.includes('skull crusher')) {
        // Supine Lying EZ-Bar Tricep Extension (Skull Crushers) on Flat Bench
        benchGroup.visible = true;
        hipsPos.set(0, 0.47, 0.18);
        shoulderCenter.set(0, 0.47, -0.38);
        torsoAnterior.set(0, 1, 0);
        headLookDir.set(0, 1, 0);

        // Upper arms locked at 10 deg back toward head (-Z)
        const eL = new THREE.Vector3(-0.19, 0.76, -0.41);
        const eR = new THREE.Vector3(0.19, 0.76, -0.41);
        directElbowL = eL;
        directElbowR = eR;
        elbowPoleL.set(-0.22, 0.90, -0.10);
        elbowPoleR.set(0.22, 0.90, -0.10);

        const ext = 1 - p; // Frame 0 = lockout, Frame 30 = bar lowered to forehead
        const angle = -0.25 + ext * 1.75;
        const barY = eL.y + Math.sin(angle) * FOREARM_LEN;
        const barZ = eL.z - Math.cos(angle) * FOREARM_LEN;

        barbellGroup.visible = true;
        barbellGroup.position.set(0, barY, barZ);
        handL.set(-0.19, barY, barZ);
        handR.set(0.19, barY, barZ);

        footL.set(-0.22, 0.075, 0.62);
        footR.set(0.22, 0.075, 0.62);
        kneePoleL.set(-0.23, 0.56, 0.52);
        kneePoleR.set(0.23, 0.56, 0.52);
      } else if (id === 'bodyweight_tricep_ext' || nameLower.includes('bodyweight tricep')) {
        // Bodyweight Plank Tricep Extensions (Forearm-to-Palm Plank Hinge)
        const lift = 1 - p; // Frame 0 = extended arms, Frame 30 = elbows on mat
        const footY = 0.095;
        const footZ = -0.84;
        const plankAngle = (10 + 10 * lift) * (Math.PI / 180);
        const legDist = 0.818;
        const hipY = footY + legDist * Math.sin(plankAngle);
        const hipZ = footZ + legDist * Math.cos(plankAngle);
        const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
        const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

        hipsPos.set(0, hipY, hipZ);
        shoulderCenter.set(0, chestY, chestZ);
        torsoAnterior.set(0, -1, 0.18).normalize();
        headLookDir.set(0, -0.55, 0.83).normalize();
        spineArchOffset = 0.004;

        handL.set(-0.18, 0.028, 0.56);
        handR.set(0.18, 0.028, 0.56);
        elbowPoleL.set(-0.20, 0.02, 0.10);
        elbowPoleR.set(0.20, 0.02, 0.10);

        footL.set(-0.11, footY, footZ);
        footR.set(0.11, footY, footZ);
        kneePoleL.set(-0.11, (hipY + footY) * 0.5 + 0.12, (hipZ + footZ) * 0.5);
        kneePoleR.set(0.11, (hipY + footY) * 0.5 + 0.12, (hipZ + footZ) * 0.5);
        footModeL = 'toes';
        footModeR = 'toes';
      } else if (
        id === 'pike_pushup' ||
        id === 'pike_press' ||
        nameLower.includes('pike')
      ) {
        // Inverted-V Pike Push-Up / Pike Shoulder Press
        const press = 1 - p; // Frame 0 = top pike, Frame 30 = crown of head near floor in front of hands
        const footY = 0.095;
        const footZ = -0.74;
        const hipY = 0.90 - 0.06 * p;
        const hipZ = -0.18 + 0.04 * p;
        hipsPos.set(0, hipY, hipZ);

        const chestY = 0.32 + 0.24 * press;
        const chestZ = 0.34 - 0.08 * press;
        shoulderCenter.set(0, chestY, chestZ);
        torsoAnterior.set(0, -0.68, -0.73).normalize();
        headLookDir.set(0, -0.82, 0.57).normalize();
        spineArchOffset = 0.0;

        handL.set(-0.25, 0.028, 0.44);
        handR.set(0.25, 0.028, 0.44);
        elbowPoleL.set(-0.42, chestY + 0.08, 0.18);
        elbowPoleR.set(0.42, chestY + 0.08, 0.18);

        footL.set(-0.13, footY, footZ);
        footR.set(0.13, footY, footZ);
        kneePoleL.set(-0.13, 0.52, -0.35);
        kneePoleR.set(0.13, 0.52, -0.35);
        footModeL = 'toes';
        footModeR = 'toes';
      } else if (id === 'plank_downward_dog' || nameLower.includes('downward-dog')) {
        // Dynamic Plank-to-Downward-Dog Mobility Flow
        const dog = p; // Frame 0 = High Plank, Frame 30 = Downward Dog Inverted-V
        const footY = 0.095 - 0.015 * dog;
        const footZ = -0.82 + 0.08 * dog;

        const hipY = 0.31 + 0.58 * dog;
        const hipZ = -0.28 + 0.10 * dog;
        const chestY = 0.49 + 0.02 * dog;
        const chestZ = 0.24 - 0.10 * dog;

        hipsPos.set(0, hipY, hipZ);
        shoulderCenter.set(0, chestY, chestZ);

        const tUp = new THREE.Vector3().subVectors(shoulderCenter, hipsPos).normalize();
        // Keep anterior pointing perpendicular to spine toward floor/legs
        torsoAnterior.set(0, -tUp.z, tUp.y).normalize();
        headLookDir.copy(torsoAnterior).lerp(new THREE.Vector3(0, -0.5, 0.86), 1 - dog).normalize();
        spineArchOffset = 0.0;

        handL.set(-0.23, 0.028, 0.48);
        handR.set(0.23, 0.028, 0.48);
        elbowPoleL.set(-0.36, chestY + 0.08, 0.20);
        elbowPoleR.set(0.36, chestY + 0.08, 0.20);

        footL.set(-0.13, footY, footZ);
        footR.set(0.13, footY, footZ);
        kneePoleL.set(-0.13, (hipY + footY) * 0.5 + 0.08, (hipZ + footZ) * 0.5 + 0.15);
        kneePoleR.set(0.13, (hipY + footY) * 0.5 + 0.08, (hipZ + footZ) * 0.5 + 0.15);
        footModeL = 'toes';
        footModeR = 'toes';
      } else if (id === 'lat_pulldown' || nameLower.includes('lat pulldown')) {
        // Seated Wide-Grip Cable Lat Pulldown
        benchGroup.visible = true;
        benchBackPivot.visible = false; // Seat only
        const pull = p; // Frame 0 = overhead stretch, Frame 30 = bar pulled to upper chest

        hipsPos.set(0, 0.46, 0.08);
        const leanBack = -0.24 * pull - 0.08;
        shoulderCenter.set(
          0,
          0.46 + Math.cos(leanBack) * TORSO_LEN,
          0.08 + Math.sin(leanBack) * TORSO_LEN
        );
        torsoAnterior.set(0, -Math.sin(leanBack), Math.cos(leanBack)).normalize();
        headLookDir.set(0, 0.16 * pull, 1).normalize();
        spineArchOffset = 0.018;

        const barY = 1.62 - 0.48 * pull;
        const barZ = 0.18;
        cableBarGroup.visible = true;
        cableHandleMesh.scale.set(1, 1, 1);
        cableBarGroup.position.set(0, barY, barZ);

        handL.set(-0.42, barY, barZ);
        handR.set(0.42, barY, barZ);
        elbowPoleL.set(-0.65, shoulderCenter.y - 0.18, -0.06);
        elbowPoleR.set(0.65, shoulderCenter.y - 0.18, -0.06);

        footL.set(-0.18, 0.075, 0.46);
        footR.set(0.18, 0.075, 0.46);
        kneePoleL.set(-0.19, 0.50, 0.58);
        kneePoleR.set(0.19, 0.50, 0.58);
      } else if (id === 'seated_cable_row' || nameLower.includes('seated cable row')) {
        // Seated Horizontal Cable Row
        const pull = p; // Frame 0 = forward reach stretch, Frame 30 = row handle at abdomen & scapula retracted
        hipsPos.set(0, 0.14, -0.20);
        const torsoLean = 0.18 * (1 - pull) - 0.06 * pull;
        shoulderCenter.set(
          0,
          0.14 + Math.cos(torsoLean) * TORSO_LEN,
          -0.20 + Math.sin(torsoLean) * TORSO_LEN
        );
        torsoAnterior.set(0, -Math.sin(torsoLean), Math.cos(torsoLean)).normalize();
        headLookDir.set(0, 0, 1);
        spineArchOffset = 0.016 * pull;

        const handleZ = 0.34 - 0.36 * pull;
        const handleY = 0.44;
        handL.set(-0.12, handleY, handleZ);
        handR.set(0.12, handleY, handleZ);
        elbowPoleL.set(-0.36, 0.42, -0.60);
        elbowPoleR.set(0.36, 0.42, -0.60);

        footL.set(-0.14, 0.12, 0.58);
        footR.set(0.14, 0.12, 0.58);
        kneePoleL.set(-0.15, 0.36, 0.22);
        kneePoleR.set(0.15, 0.36, 0.22);
        footModeL = 'free';
        footModeR = 'free';
      } else if (id === 'doorframe_rows' || nameLower.includes('doorframe') || nameLower.includes('table row')) {
        // Inverted Bodyweight / Table Row (Horizontal Pull Under Bar)
        pullupRigGroup.visible = true;
        crossbar.position.set(0, 1.08, 0.16);
        gripL.position.set(-0.28, 1.08, 0.16);
        gripR.position.set(0.28, 1.08, 0.16);

        const pull = p; // Frame 0 = hanging under bar, Frame 30 = chest pulled to bar
        const footZ = 0.72;
        const footY = 0.075;
        const bodyAngle = (24 + 18 * pull) * (Math.PI / 180);
        const legDist = 0.80;
        const hipY = footY + Math.sin(bodyAngle) * legDist;
        const hipZ = footZ - Math.cos(bodyAngle) * legDist;
        const chestY = hipY + Math.sin(bodyAngle) * TORSO_LEN;
        const chestZ = hipZ - Math.cos(bodyAngle) * TORSO_LEN;

        hipsPos.set(0, hipY, hipZ);
        shoulderCenter.set(0, chestY, chestZ);
        torsoAnterior.set(0, Math.cos(bodyAngle), Math.sin(bodyAngle)).normalize();
        headLookDir.copy(torsoAnterior);

        handL.set(-0.28, 1.07, 0.16);
        handR.set(0.28, 1.07, 0.16);
        elbowPoleL.set(-0.46, chestY - 0.22, chestZ - 0.18);
        elbowPoleR.set(0.46, chestY - 0.22, chestZ - 0.18);

        footL.set(-0.12, footY, footZ);
        footR.set(0.12, footY, footZ);
        kneePoleL.set(-0.12, (hipY + footY) * 0.5 + 0.15, (hipZ + footZ) * 0.5 + 0.15);
        kneePoleR.set(0.12, (hipY + footY) * 0.5 + 0.15, (hipZ + footZ) * 0.5 + 0.15);
        footModeL = 'free';
        footModeR = 'free';
      } else if (id === 'superman_pulls' || nameLower.includes('superman')) {
        // Prone Superman Hyperextension + W-Pulls on Mat
        const pull = p; // Frame 0 = prone overhead Y reach, Frame 30 = chest/legs lifted + elbows pulled into W
        hipsPos.set(0, 0.10, -0.12);
        shoulderCenter.set(0, 0.14 + 0.14 * pull, 0.42);
        torsoAnterior.set(0, -1, 0.24 * pull).normalize();
        headLookDir.set(0, -0.45 + 0.25 * pull, 0.90).normalize();
        spineArchOffset = -0.024 * pull;

        const reachZ = 0.88 - 0.48 * pull;
        const reachX = 0.22 + 0.14 * pull;
        const handY = 0.14 + 0.18 * pull;
        handL.set(-reachX, handY, reachZ);
        handR.set(reachX, handY, reachZ);
        elbowPoleL.set(-0.52, handY, 0.12);
        elbowPoleR.set(0.52, handY, 0.12);

        const footY = 0.09 + 0.14 * pull;
        footL.set(-0.14, footY, -0.94);
        footR.set(0.14, footY, -0.94);
        kneePoleL.set(-0.14, 0.02, -0.52);
        kneePoleR.set(0.14, 0.02, -0.52);
        footModeL = 'free';
        footModeR = 'free';
      } else if (id === 'reverse_snow_angels' || nameLower.includes('snow angel')) {
        // Prone Reverse Snow Angels (Wide Horizontal Arc from Overhead to Hips)
        const sweep = p; // Frame 0 = overhead, Frame 30 = swept back beside hips
        hipsPos.set(0, 0.10, -0.12);
        shoulderCenter.set(0, 0.22, 0.42);
        torsoAnterior.set(0, -1, 0.18).normalize();
        headLookDir.set(0, -0.55, 0.83).normalize();
        spineArchOffset = -0.018;

        const sweepAngle = (18 + 140 * sweep) * (Math.PI / 180); // 18 deg overhead -> 158 deg back by hips
        const reach = 0.54;
        const sZ = 0.36;
        const sY = 0.22;
        handL.set(-0.19 - Math.sin(sweepAngle) * reach, sY + 0.04 * sweep, sZ + Math.cos(sweepAngle) * reach);
        handR.set(0.19 + Math.sin(sweepAngle) * reach, sY + 0.04 * sweep, sZ + Math.cos(sweepAngle) * reach);
        elbowPoleL.set(-0.45, sY + 0.15, sZ - 0.25);
        elbowPoleR.set(0.45, sY + 0.15, sZ - 0.25);

        footL.set(-0.13, 0.14, -0.94);
        footR.set(0.13, 0.14, -0.94);
        kneePoleL.set(-0.13, 0.02, -0.52);
        kneePoleR.set(0.13, 0.02, -0.52);
        footModeL = 'free';
        footModeR = 'free';
      } else if (
        id === 'towel_bicep_curls' ||
        id === 'isometric_towel_curls' ||
        nameLower.includes('towel')
      ) {
        // Home Resistance Towel Bicep Curls (Curling against raised left leg resistance)
        const isIso = id === 'isometric_towel_curls' || nameLower.includes('isometric');
        const curlP = isIso ? 0.65 + 0.15 * p : p;

        hipsPos.set(0, 0.94, 0);
        shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
        torsoAnterior.set(0, 0, 1);
        headLookDir.set(0, -0.10, 1).normalize();

        const eL = new THREE.Vector3(-0.21, 1.15, 0.04);
        const eR = new THREE.Vector3(0.21, 1.15, 0.04);
        directElbowL = eL;
        directElbowR = eR;
        elbowPoleL.set(-0.24, 1.15, -0.30);
        elbowPoleR.set(0.24, 1.15, -0.30);

        const flexAngle = 0.45 + curlP * 1.45;
        const handY = eL.y - Math.cos(flexAngle) * FOREARM_LEN;
        const handZ = eL.z + Math.sin(flexAngle) * FOREARM_LEN;
        handL.set(-0.15, handY, handZ);
        handR.set(0.15, handY, handZ);

        // Left leg raised to provide towel resistance; Right leg planted
        footL.set(-0.12, 0.26 + 0.14 * curlP, 0.24);
        kneePoleL.set(-0.12, 0.72 + 0.12 * curlP, 0.56);
        footModeL = 'free';
        footR.set(0.14, 0.075, 0);
        kneePoleR.set(0.15, 0.52, 0.45);
      } else if (id === 'incline_curl' || nameLower.includes('incline curl')) {
        // 45° Incline Dumbbell Bicep Curl
        benchGroup.visible = true;
        benchBackPivot.visible = true;
        benchBackPivot.rotation.x = 0.75; // 43 deg incline backrest

        const incAngle = 0.75;
        hipsPos.set(0, 0.45, 0.14);
        shoulderCenter.set(
          0,
          0.45 + Math.cos(incAngle) * TORSO_LEN,
          0.14 - Math.sin(incAngle) * TORSO_LEN
        );
        torsoAnterior.set(0, Math.sin(incAngle), Math.cos(incAngle)).normalize();
        headLookDir.set(0, 0.15, 1).normalize();

        // Upper arms hang vertically behind torso line to stretch bicep long head
        const eL = new THREE.Vector3(-0.23, shoulderCenter.y - 0.34, shoulderCenter.z - 0.02);
        const eR = new THREE.Vector3(0.23, shoulderCenter.y - 0.34, shoulderCenter.z - 0.02);
        directElbowL = eL;
        directElbowR = eR;
        elbowPoleL.set(-0.26, eL.y, eL.z - 0.30);
        elbowPoleR.set(0.26, eR.y, eR.z - 0.30);

        const flexAngle = 0.18 + p * 2.05;
        const handY = eL.y - Math.cos(flexAngle) * FOREARM_LEN;
        const handZ = eL.z + Math.sin(flexAngle) * FOREARM_LEN;
        handL.set(-0.24, handY, handZ);
        handR.set(0.24, handY, handZ);

        dumbbellL.visible = true;
        dumbbellR.visible = true;
        dumbbellL.position.copy(handL);
        dumbbellR.position.copy(handR);

        footL.set(-0.22, 0.075, 0.62);
        footR.set(0.22, 0.075, 0.62);
        kneePoleL.set(-0.23, 0.54, 0.48);
        kneePoleR.set(0.23, 0.54, 0.48);
      } else if (id === 'leg_press' || nameLower.includes('leg press')) {
        // Seated 45° Angled Sled Leg Press
        benchGroup.visible = true;
        benchBackPivot.visible = true;
        benchBackPivot.rotation.x = 0.72;

        const press = 1 - p; // Frame 0 = extended legs, Frame 30 = deep 90-deg knee bend toward chest
        const incAngle = 0.72;
        hipsPos.set(0, 0.44, 0.12);
        shoulderCenter.set(
          0,
          0.44 + Math.cos(incAngle) * TORSO_LEN,
          0.12 - Math.sin(incAngle) * TORSO_LEN
        );
        torsoAnterior.set(0, Math.sin(incAngle), Math.cos(incAngle)).normalize();
        headLookDir.set(0, 0.35, 0.94).normalize();

        // Hands grip side seat handles
        handL.set(-0.24, 0.44, 0.16);
        handR.set(0.24, 0.44, 0.16);
        elbowPoleL.set(-0.36, 0.58, -0.12);
        elbowPoleR.set(0.36, 0.58, -0.12);

        // Feet travel along a 42-degree upward sled track
        const sledDist = 0.42 + 0.36 * press;
        const sledAngle = 0.62;
        const fY = 0.48 + Math.sin(sledAngle) * sledDist;
        const fZ = 0.16 + Math.cos(sledAngle) * sledDist;
        footL.set(-0.15, fY, fZ);
        footR.set(0.15, fY, fZ);
        kneePoleL.set(-0.18, 0.96, 0.10);
        kneePoleR.set(0.18, 0.96, 0.10);
        footModeL = 'free';
        footModeR = 'free';
      } else if (id === 'romanian_deadlift' || nameLower.includes('deadlift')) {
        // Barbell Romanian Deadlift (Pure Hip Hinge + Flat Spine + Barbell Gliding Along Shins)
        const hinge = p; // Frame 0 = standing lockout, Frame 30 = deep hamstring stretch at mid-shin
        const hipY = 0.93 - 0.07 * hinge;
        const hipZ = -0.24 * hinge;
        hipsPos.set(0, hipY, hipZ);

        const torsoAngle = 1.22 * hinge; // Up to ~70 deg hip hinge
        shoulderCenter.set(
          0,
          hipY + Math.cos(torsoAngle) * TORSO_LEN,
          hipZ + Math.sin(torsoAngle) * TORSO_LEN
        );
        torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
        headLookDir.set(0, -0.45 * hinge, 1).normalize();
        spineArchOffset = 0.016;

        // Barbell hangs straight down from shoulders, shaving the thighs/shins
        const barY = 0.82 - 0.44 * hinge;
        const barZ = 0.12;
        barbellGroup.visible = true;
        barbellGroup.position.set(0, barY, barZ);
        handL.set(-0.26, barY, barZ);
        handR.set(0.26, barY, barZ);
        elbowPoleL.set(-0.34, barY + 0.28, -0.18);
        elbowPoleR.set(0.34, barY + 0.28, -0.18);

        footL.set(-0.15, 0.075, 0);
        footR.set(0.15, 0.075, 0);
        kneePoleL.set(-0.16, 0.50, 0.34);
        kneePoleR.set(0.16, 0.50, 0.34);
      } else if (id === 'bulgarian_split_squats' || nameLower.includes('bulgarian')) {
        // Rear-Foot Elevated Bulgarian Split Squat
        benchGroup.visible = true;
        benchBackPivot.visible = false;
        benchGroup.position.set(0, 0, -0.70);

        const depth = p; // Frame 0 = standing split, Frame 30 = rear knee drops near floor
        const hipY = 0.88 - 0.26 * depth;
        hipsPos.set(0, hipY, -0.02);
        const lean = 0.16 * depth;
        shoulderCenter.set(
          0,
          hipY + Math.cos(lean) * TORSO_LEN,
          -0.02 + Math.sin(lean) * TORSO_LEN
        );
        torsoAnterior.set(0, -Math.sin(lean), Math.cos(lean)).normalize();
        headLookDir.set(0, 0, 1);

        // Front leg (Left) planted forward; Rear foot (Right) elevated on bench pad
        footL.set(-0.14, 0.075, 0.36);
        footR.set(0.14, 0.45, -0.48);
        kneePoleL.set(-0.16, 0.48, 0.88);
        kneePoleR.set(0.16, 0.10, 0.18);
        footModeL = 'flat';
        footModeR = 'toes';

        dumbbellL.visible = true;
        dumbbellR.visible = true;
        handL.set(-0.23, hipY - 0.08, 0.02);
        handR.set(0.23, hipY - 0.08, 0.02);
        dumbbellL.position.copy(handL);
        dumbbellR.position.copy(handR);
        dumbbellL.rotation.set(0, Math.PI / 2, 0);
        dumbbellR.rotation.set(0, Math.PI / 2, 0);
        elbowPoleL.set(-0.32, hipY + 0.18, -0.22);
        elbowPoleR.set(0.32, hipY + 0.18, -0.22);
      } else if (id === 'leg_curl' || nameLower.includes('leg curl')) {
        // Lying Prone Hamstring Leg Curl on Bench
        benchGroup.visible = true;
        benchBackPivot.visible = true;
        benchBackPivot.rotation.x = 0;
        benchGroup.position.set(0, 0, 0.18);

        const curl = p; // Frame 0 = legs extended, Frame 30 = heels curled 105 deg toward glutes
        hipsPos.set(0, 0.48, -0.04);
        shoulderCenter.set(0, 0.51, 0.52);
        torsoAnterior.set(0, -1, 0.08).normalize();
        headLookDir.set(0, -0.55, 0.83).normalize();

        handL.set(-0.21, 0.38, 0.62);
        handR.set(0.21, 0.38, 0.62);
        elbowPoleL.set(-0.30, 0.35, 0.28);
        elbowPoleR.set(0.30, 0.35, 0.28);

        // Knees rest just behind bench pad at z = -0.46
        const kL = new THREE.Vector3(-0.12, 0.46, -0.46);
        const kR = new THREE.Vector3(0.12, 0.46, -0.46);
        directKneeL = kL;
        directKneeR = kR;
        kneePoleL.set(-0.12, 0.10, -0.46);
        kneePoleR.set(0.12, 0.10, -0.46);

        const curlAngle = 0.12 + curl * 1.75; // 7 deg to 107 deg hamstring curl
        const fY = kL.y + Math.sin(curlAngle) * CALF_LEN;
        const fZ = kL.z - Math.cos(curlAngle) * CALF_LEN;
        footL.set(-0.12, fY, fZ);
        footR.set(0.12, fY, fZ);
        footModeL = 'free';
        footModeR = 'free';
      } else if (id === 'calf_raises' || nameLower.includes('calf raise')) {
        // Standing Dumbbell Calf Raises (Ankle Plantarflexion onto Balls of Feet)
        const rise = p; // Frame 0 = heels flat, Frame 30 = high tiptoe gastrocnemius peak
        const liftY = 0.085 * rise;
        hipsPos.set(0, 0.94 + liftY, 0.02 * rise);
        shoulderCenter.set(0, 0.94 + TORSO_LEN + liftY, 0.02 * rise);
        torsoAnterior.set(0, 0, 1);
        headLookDir.set(0, 0, 1);

        dumbbellL.visible = true;
        dumbbellR.visible = true;
        handL.set(-0.23, 0.78 + liftY, 0.02);
        handR.set(0.23, 0.78 + liftY, 0.02);
        dumbbellL.position.copy(handL);
        dumbbellR.position.copy(handR);
        dumbbellL.rotation.set(0, Math.PI / 2, 0);
        dumbbellR.rotation.set(0, Math.PI / 2, 0);
        elbowPoleL.set(-0.32, 1.15 + liftY, -0.20);
        elbowPoleR.set(0.32, 1.15 + liftY, -0.20);

        footL.set(-0.14, 0.075 + liftY, 0.01 * rise);
        footR.set(0.14, 0.075 + liftY, 0.01 * rise);
        kneePoleL.set(-0.15, 0.52 + liftY, 0.45);
        kneePoleR.set(0.15, 0.52 + liftY, 0.45);
        anklePitchOffsetL = 0.48 * rise;
        anklePitchOffsetR = 0.48 * rise;
      } else if (id === 'rear_delt_fly' || nameLower.includes('rear delt')) {
        // Bent-Over Dumbbell Rear Delt Reverse Fly
        const fly = p; // Frame 0 = dumbbells hanging under chest, Frame 30 = wide horizontal abduction
        const hipY = 0.85;
        const hipZ = -0.18;
        hipsPos.set(0, hipY, hipZ);

        const torsoAngle = 1.08; // ~62 deg forward hip hinge
        shoulderCenter.set(
          0,
          hipY + Math.cos(torsoAngle) * TORSO_LEN,
          hipZ + Math.sin(torsoAngle) * TORSO_LEN
        );
        torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
        headLookDir.set(0, -0.55, 0.83).normalize();

        dumbbellL.visible = true;
        dumbbellR.visible = true;
        const flyAngle = (14 + 72 * fly) * (Math.PI / 180);
        const reach = 0.52;
        const sY = shoulderCenter.y - 0.04;
        const sZ = shoulderCenter.z;
        handL.set(-0.19 - Math.sin(flyAngle) * reach, sY - Math.cos(flyAngle) * reach, sZ);
        handR.set(0.19 + Math.sin(flyAngle) * reach, sY - Math.cos(flyAngle) * reach, sZ);
        dumbbellL.position.copy(handL);
        dumbbellR.position.copy(handR);
        dumbbellL.rotation.set(0, Math.PI / 2, 0);
        dumbbellR.rotation.set(0, Math.PI / 2, 0);

        elbowPoleL.set(-0.45, sY + 0.22, sZ - 0.15);
        elbowPoleR.set(0.45, sY + 0.22, sZ - 0.15);

        footL.set(-0.16, 0.075, 0);
        footR.set(0.16, 0.075, 0);
        kneePoleL.set(-0.17, 0.50, 0.36);
        kneePoleR.set(0.17, 0.50, 0.36);
      } else if (id === 'shrugs' || nameLower.includes('shrug')) {
        // Standing Dumbbell Trap Shrugs (Clavicle & Shoulder Girdle Elevation)
        const shrug = p; // Frame 0 = relaxed shoulders, Frame 30 = max upper trapezius elevation
        shoulderElevationOffset = 0.075 * shrug;
        hipsPos.set(0, 0.94, 0);
        shoulderCenter.set(0, 0.94 + TORSO_LEN + 0.025 * shrug, 0);
        torsoAnterior.set(0, 0, 1);
        headLookDir.set(0, 0, 1);

        dumbbellL.visible = true;
        dumbbellR.visible = true;
        handL.set(-0.23, 0.80 + 0.08 * shrug, 0.03);
        handR.set(0.23, 0.80 + 0.08 * shrug, 0.03);
        dumbbellL.position.copy(handL);
        dumbbellR.position.copy(handR);
        dumbbellL.rotation.set(0, Math.PI / 2, 0);
        dumbbellR.rotation.set(0, Math.PI / 2, 0);
        elbowPoleL.set(-0.34, 1.18 + 0.08 * shrug, -0.22);
        elbowPoleR.set(0.34, 1.18 + 0.08 * shrug, -0.22);
      } else if (id === 'crunches' || nameLower.includes('crunch')) {
        // Supine Abdominal Crunches (Head toward -Z, Knees bent toward +Z)
        const crunch = p; // Frame 0 = shoulders on mat, Frame 30 = upper torso curled up
        hipsPos.set(0, 0.11, 0.10);
        const curlAngle = 0.44 * crunch;
        shoulderCenter.set(
          0,
          0.12 + Math.sin(curlAngle) * TORSO_LEN,
          0.10 - Math.cos(curlAngle) * TORSO_LEN
        );
        torsoAnterior.set(0, Math.cos(curlAngle), Math.sin(curlAngle)).normalize();
        headLookDir.set(0, Math.cos(curlAngle + 0.35), Math.sin(curlAngle + 0.35)).normalize();
        spineArchOffset = -0.045 * crunch;

        // Fingertips at temples, elbows flared
        handL.set(-0.14, shoulderCenter.y + 0.12, shoulderCenter.z - 0.10);
        handR.set(0.14, shoulderCenter.y + 0.12, shoulderCenter.z - 0.10);
        elbowPoleL.set(-0.46, shoulderCenter.y + 0.10, shoulderCenter.z + 0.08);
        elbowPoleR.set(0.46, shoulderCenter.y + 0.10, shoulderCenter.z + 0.08);

        footL.set(-0.15, 0.075, 0.64);
        footR.set(0.15, 0.075, 0.64);
        kneePoleL.set(-0.16, 0.62, 0.36);
        kneePoleR.set(0.16, 0.62, 0.36);
      } else if (id === 'leg_raises' || nameLower.includes('leg raise')) {
        // Supine Lying Straight-Leg Raises (Head at -Z, Straight Legs Raising to 90° Vertical)
        const raise = p; // Frame 0 = legs hovering 6° above floor, Frame 30 = 88° vertical pike
        hipsPos.set(0, 0.11, 0.06);
        shoulderCenter.set(0, 0.12, 0.06 - TORSO_LEN);
        torsoAnterior.set(0, 1, 0);
        headLookDir.set(0, 0.92, 0.38).normalize();
        spineArchOffset = -0.015 * raise;

        // Hands pressed flat on floor beside hips for stability
        handL.set(-0.26, 0.03, 0.08);
        handR.set(0.26, 0.03, 0.08);
        elbowPoleL.set(-0.34, 0.04, -0.22);
        elbowPoleR.set(0.34, 0.04, -0.22);

        const legAngle = (7 + 80 * raise) * (Math.PI / 180);
        const legReach = 0.81;
        const fY = 0.11 + Math.sin(legAngle) * legReach;
        const fZ = 0.06 + Math.cos(legAngle) * legReach;
        footL.set(-0.11, fY, fZ);
        footR.set(0.11, fY, fZ);
        // Knee pole points perpendicular to the leg toward the ceiling/head so knees stay straight
        kneePoleL.set(-0.11, fY + Math.cos(legAngle) * 0.4, fZ - Math.sin(legAngle) * 0.4);
        kneePoleR.set(0.11, fY + Math.cos(legAngle) * 0.4, fZ - Math.sin(legAngle) * 0.4);
        footModeL = 'free';
        footModeR = 'free';
      } else if (id === 'russian_twists' || nameLower.includes('russian twist')) {
        // Seated V-Sit Oblique Russian Twists (Left-to-Right Torso & Arm Rotation)
        const twist = Math.sin(theta); // -1 (Left) -> 0 (Center) -> +1 (Right)
        hipsPos.set(0, 0.12, -0.02);
        shoulderCenter.set(0, 0.50, -0.40);

        const rotAngle = twist * 0.65; // ±37 degrees oblique rotation
        torsoAnterior.set(Math.sin(rotAngle), 0.58, Math.cos(rotAngle) * 0.81).normalize();
        headLookDir.copy(torsoAnterior);
        spineArchOffset = -0.015;

        const claspX = Math.sin(rotAngle) * 0.32;
        const claspZ = -0.08 - Math.abs(twist) * 0.06;
        const claspY = 0.36;
        handL.set(claspX - 0.04, claspY, claspZ);
        handR.set(claspX + 0.04, claspY, claspZ);
        elbowPoleL.set(claspX - 0.36, 0.32, -0.35);
        elbowPoleR.set(claspX + 0.36, 0.32, -0.35);

        // Knees bent with feet hovering in V-sit balance
        footL.set(-0.11 - twist * 0.04, 0.22, 0.50);
        footR.set(0.11 - twist * 0.04, 0.22, 0.50);
        kneePoleL.set(-0.13, 0.58, 0.22);
        kneePoleR.set(0.13, 0.58, 0.22);
        footModeL = 'free';
        footModeR = 'free';
      } else if (id === 'glute_bridges' || clip === 'glute_bridge') {
        // Supine Glute Bridge (Shoulders anchored at -Z, Feet planted at +Z, Hips driving up)
        const bridge = p; // Frame 0 = hips on mat, Frame 30 = full hip extension bridge
        shoulderCenter.set(0, 0.13, -0.44);
        const hipY = 0.12 + 0.28 * bridge;
        const hipZ = 0.10;
        hipsPos.set(0, hipY, hipZ);

        const tUp = new THREE.Vector3().subVectors(shoulderCenter, hipsPos).normalize();
        // Since tUp points toward -Z, anterior (+Y/+Z) gives torsoRight = (+1, 0, 0)
        torsoAnterior.set(0, -tUp.z, tUp.y).normalize();
        headLookDir.set(0, 0.95, 0.30).normalize();
        spineArchOffset = 0.015 * bridge;

        handL.set(-0.26, 0.035, -0.02);
        handR.set(0.26, 0.035, -0.02);
        elbowPoleL.set(-0.34, 0.04, -0.26);
        elbowPoleR.set(0.34, 0.04, -0.26);

        footL.set(-0.15, 0.075, 0.52);
        footR.set(0.15, 0.075, 0.52);
        kneePoleL.set(-0.16, 0.68, 0.36);
        kneePoleR.set(0.16, 0.68, 0.36);
      } else if (id === 'plank' || (clip === 'plank' && id !== 'mountain_climbers')) {
        // True Forearm Plank Hold (Elbows planted under shoulders, forearms flat on mat)
        const breath = 0.008 * p;
        const footY = 0.095;
        const footZ = -0.84;
        const hipY = 0.25 + breath;
        const hipZ = -0.28;
        const chestY = 0.33 + breath;
        const chestZ = 0.27;

        hipsPos.set(0, hipY, hipZ);
        shoulderCenter.set(0, chestY, chestZ);
        torsoAnterior.set(0, -1, 0.14).normalize();
        headLookDir.set(0, -0.65, 0.76).normalize();
        spineArchOffset = 0.004;

        directElbowL = new THREE.Vector3(-0.20, 0.042, 0.28);
        directElbowR = new THREE.Vector3(0.20, 0.042, 0.28);
        handL.set(-0.16, 0.028, 0.54);
        handR.set(0.16, 0.028, 0.54);
        elbowPoleL.set(-0.26, 0.02, 0.05);
        elbowPoleR.set(0.26, 0.02, 0.05);

        footL.set(-0.12, footY, footZ);
        footR.set(0.12, footY, footZ);
        kneePoleL.set(-0.12, (hipY + footY) * 0.5 + 0.12, (hipZ + footZ) * 0.5);
        kneePoleR.set(0.12, (hipY + footY) * 0.5 + 0.12, (hipZ + footZ) * 0.5);
        footModeL = 'toes';
        footModeR = 'toes';
      } else if (id === 'mountain_climbers' || clip === 'mountain_climber') {
        // High-Plank Alternating Mountain Climbers
        const driveL = Math.max(0, Math.sin(theta));
        const driveR = Math.max(0, -Math.sin(theta));
        const bounce = 0.015 * Math.abs(Math.sin(theta));

        const footY = 0.095;
        const footZ = -0.84;
        const hipY = 0.36 + bounce;
        const hipZ = -0.28;
        const chestY = 0.52 + bounce * 0.5;
        const chestZ = 0.25;

        hipsPos.set(0, hipY, hipZ);
        shoulderCenter.set(0, chestY, chestZ);
        torsoAnterior.set(0, -1, 0.22).normalize();
        headLookDir.set(0, -0.52, 0.85).normalize();

        handL.set(-0.22, 0.028, 0.48);
        handR.set(0.22, 0.028, 0.48);
        elbowPoleL.set(-0.34, chestY + 0.10, 0.22);
        elbowPoleR.set(0.34, chestY + 0.10, 0.22);

        footL.set(-0.12, footY + 0.12 * driveL, footZ + 0.44 * driveL);
        footR.set(0.12, footY + 0.12 * driveR, footZ + 0.44 * driveR);
        // When knee drives forward toward chest, knee pole drops toward floor/front
        kneePoleL.set(-0.12, 0.22 - 0.10 * driveL, -0.45 + 0.65 * driveL);
        kneePoleR.set(0.12, 0.22 - 0.10 * driveR, -0.45 + 0.65 * driveR);
        footModeL = 'toes';
        footModeR = 'toes';
      } else if (id === 'burpees' || clip === 'burpee') {
        // Multi-Phase Athletic Burpee (Squat -> Plank Thrust -> Squat Snap -> Vertical Jump & Overhead Clap)
        // Smooth blend between Plank Phase (around Frame 30, p=1) and Jump Phase (around Frame 0/60, p=0)
        const plankW = Math.pow(p, 1.2); // 0 = vertical jump peak, 1 = plank bottom
        const jumpHeight = Math.max(0, (1 - p * 2.2)) * 0.18;

        const hipY = (0.96 + jumpHeight) * (1 - plankW) + 0.26 * plankW;
        const hipZ = 0.0 * (1 - plankW) + -0.30 * plankW;
        const chestY = (1.52 + jumpHeight) * (1 - plankW) + 0.36 * plankW;
        const chestZ = 0.0 * (1 - plankW) + 0.24 * plankW;

        hipsPos.set(0, hipY, hipZ);
        shoulderCenter.set(0, chestY, chestZ);

        const tUp = new THREE.Vector3().subVectors(shoulderCenter, hipsPos).normalize();
        torsoAnterior.set(0, -tUp.z, tUp.y).normalize();
        headLookDir.set(0, 0.15 * (1 - plankW) - 0.45 * plankW, 1).normalize();

        // Hands transition smoothly from overhead jump reach (y=2.04) to floor plank plant (y=0.028, z=0.48)
        handL.set(
          -0.18 - 0.05 * plankW,
          (1.98 + jumpHeight) * (1 - plankW) + 0.028 * plankW,
          0.06 * (1 - plankW) + 0.48 * plankW
        );
        handR.set(
          0.18 + 0.05 * plankW,
          (1.98 + jumpHeight) * (1 - plankW) + 0.028 * plankW,
          0.06 * (1 - plankW) + 0.48 * plankW
        );
        elbowPoleL.set(-0.42, chestY + 0.12, -0.15 * (1 - plankW) + 0.18 * plankW);
        elbowPoleR.set(0.42, chestY + 0.12, -0.15 * (1 - plankW) + 0.18 * plankW);

        footL.set(
          -0.14,
          (0.075 + jumpHeight) * (1 - plankW) + 0.095 * plankW,
          0.0 * (1 - plankW) + -0.84 * plankW
        );
        footR.set(
          0.14,
          (0.075 + jumpHeight) * (1 - plankW) + 0.095 * plankW,
          0.0 * (1 - plankW) + -0.84 * plankW
        );
        kneePoleL.set(-0.15, (hipY + footL.y) * 0.5 + 0.15 * plankW, (hipZ + footL.z) * 0.5 + 0.45 * (1 - plankW));
        kneePoleR.set(0.15, (hipY + footR.y) * 0.5 + 0.15 * plankW, (hipZ + footR.z) * 0.5 + 0.45 * (1 - plankW));
        footModeL = plankW > 0.5 ? 'toes' : 'flat';
        footModeR = plankW > 0.5 ? 'toes' : 'flat';
      } else if (id === 'running_cardio' || id === 'brisk_walk' || clip === 'jog') {
        // Contralateral Running & Brisk Walking Gait Cycle
        const isWalk = id === 'brisk_walk' || nameLower.includes('walk');
        const strideAmp = isWalk ? 0.25 : 0.36;
        const liftAmp = isWalk ? 0.06 : 0.20;
        const bounceAmp = isWalk ? 0.022 : 0.055;
        const lean = isWalk ? 0.04 : 0.14;

        const strideL = Math.sin(theta);
        const strideR = -Math.sin(theta);
        const liftL = Math.max(0, Math.cos(theta));
        const liftR = Math.max(0, -Math.cos(theta));
        const bounce = Math.abs(Math.sin(theta)) * bounceAmp;

        const hipY = (isWalk ? 0.93 : 0.90) + bounce;
        hipsPos.set(0, hipY, 0);
        shoulderCenter.set(
          0,
          hipY + Math.cos(lean) * TORSO_LEN,
          Math.sin(lean) * TORSO_LEN
        );
        const twist = 0.14 * strideL;
        torsoAnterior.set(Math.sin(twist), -Math.sin(lean), Math.cos(lean) * Math.cos(twist)).normalize();
        headLookDir.set(0, 0, 1);

        // Contralateral Arm Swing (Right arm swings forward with Left leg, Left arm swings with Right leg)
        // Forward swing brings hand up toward chest; backward swing drops hand past hip with elbow driving back
        const swingL = strideR; // +1 = forward, -1 = backward
        const swingR = strideL;

        if (isWalk) {
          handL.set(-0.23, 0.80 + bounce + 0.06 * swingL, 0.04 + 0.22 * swingL);
          handR.set(0.23, 0.80 + bounce + 0.06 * swingR, 0.04 + 0.22 * swingR);
          elbowPoleL.set(-0.32, 1.10 + bounce, -0.24 + 0.08 * swingL);
          elbowPoleR.set(0.32, 1.10 + bounce, -0.24 + 0.08 * swingR);
        } else {
          handL.set(
            -0.22 + 0.04 * Math.max(0, swingL),
            0.94 + bounce + 0.14 * swingL,
            0.08 + 0.22 * swingL
          );
          handR.set(
            0.22 - 0.04 * Math.max(0, swingR),
            0.94 + bounce + 0.14 * swingR,
            0.08 + 0.22 * swingR
          );
          elbowPoleL.set(-0.34, 1.02 + bounce - 0.06 * swingL, -0.32 + 0.10 * swingL);
          elbowPoleR.set(0.34, 1.02 + bounce - 0.06 * swingR, -0.32 + 0.10 * swingR);
        }

        const footLiftL = isWalk
          ? liftL * 0.06
          : Math.max(0, strideL) * 0.14 + Math.max(0, -strideL) * 0.18 + liftL * 0.08;
        const footLiftR = isWalk
          ? liftR * 0.06
          : Math.max(0, strideR) * 0.14 + Math.max(0, -strideR) * 0.18 + liftR * 0.08;

        footL.set(-0.13, 0.075 + footLiftL, strideL * strideAmp);
        footR.set(0.13, 0.075 + footLiftR, strideR * strideAmp);
        kneePoleL.set(-0.14, 0.52 + Math.max(0, strideL) * 0.18, 0.52 + strideL * 0.28);
        kneePoleR.set(0.14, 0.52 + Math.max(0, strideR) * 0.18, 0.52 + strideR * 0.28);
        anklePitchOffsetL = -strideL * 0.35;
        anklePitchOffsetR = -strideR * 0.35;
      } else if (id === 'stretching_flow' || nameLower.includes('stretching')) {
        // Full-Body Overhead Reach to Deep Hamstring Forward Fold Stretch
        const fold = p; // Frame 0 = tall overhead stretch, Frame 30 = deep hamstring forward fold
        const hipY = 0.93 - 0.05 * fold;
        const hipZ = -0.16 * fold;
        hipsPos.set(0, hipY, hipZ);

        const torsoAngle = -0.12 * (1 - fold) + 1.45 * fold;
        shoulderCenter.set(
          0,
          hipY + Math.cos(torsoAngle) * TORSO_LEN,
          hipZ + Math.sin(torsoAngle) * TORSO_LEN
        );
        torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
        headLookDir.set(0, Math.cos(torsoAngle) * 0.2 - Math.sin(torsoAngle) * 0.8, Math.cos(torsoAngle)).normalize();
        spineArchOffset = 0.02 * (1 - fold) - 0.025 * fold;

        handL.set(
          -0.20,
          1.96 * (1 - fold) + 0.22 * fold,
          -0.04 * (1 - fold) + 0.18 * fold
        );
        handR.set(
          0.20,
          1.96 * (1 - fold) + 0.22 * fold,
          -0.04 * (1 - fold) + 0.18 * fold
        );
        elbowPoleL.set(-0.38, shoulderCenter.y, shoulderCenter.z - 0.25);
        elbowPoleR.set(0.38, shoulderCenter.y, shoulderCenter.z - 0.25);

        footL.set(-0.15, 0.075, 0);
        footR.set(0.15, 0.075, 0);
        kneePoleL.set(-0.16, 0.50, 0.40);
        kneePoleR.set(0.16, 0.50, 0.40);
      } else if (id === 'mobility_work' || nameLower.includes('mobility')) {
        // Deep Squat Thoracic Windmill Mobility Rotation
        const rot = Math.sin(theta); // Alternating left/right thoracic windmill in deep squat
        const depth = 0.35 + 0.65 * p;
        const hipY = 0.92 - 0.34 * depth;
        const hipZ = -0.18 * depth;
        hipsPos.set(0, hipY, hipZ);

        const lean = 0.38 * depth;
        shoulderCenter.set(
          0,
          hipY + Math.cos(lean) * TORSO_LEN,
          hipZ + Math.sin(lean) * TORSO_LEN
        );
        torsoAnterior.set(rot * 0.45, -Math.sin(lean), Math.cos(lean)).normalize();
        headLookDir.set(rot * 0.55, 0.15 * Math.abs(rot), 1).normalize();

        const liftL = Math.max(0, -rot);
        const liftR = Math.max(0, rot);
        handL.set(-0.16 - 0.24 * liftL, 0.28 + 1.25 * liftL, 0.22 - 0.12 * liftL);
        handR.set(0.16 + 0.24 * liftR, 0.28 + 1.25 * liftR, 0.22 - 0.12 * liftR);
        elbowPoleL.set(-0.36, shoulderCenter.y - 0.10, -0.18);
        elbowPoleR.set(0.36, shoulderCenter.y - 0.10, -0.18);

        footL.set(-0.20, 0.075, 0.02);
        footR.set(0.20, 0.075, 0.02);
        kneePoleL.set(-0.26, 0.48, 0.58);
        kneePoleR.set(0.26, 0.48, 0.58);
      } else {
        // Core Blueprint & Remaining Standard Clips (`pushup`, `diamond_pushup`, `squat`, `pullup`, `lunge`, `stretch_flow`, `idle`)
        switch (clip) {
          case 'pushup':
          case 'diamond_pushup': {
            const lift = 1 - p;
            const isDiamond =
              clip === 'diamond_pushup' ||
              variant === 'narrow_press' ||
              nameLower.includes('diamond') ||
              nameLower.includes('close-grip');
            const isDecline = id === 'decline_pushup' || nameLower.includes('decline');

            const handSpread = isDiamond
              ? nameLower.includes('close-grip')
                ? 0.16
                : 0.09
              : 0.25;
            const footY = isDecline ? 0.44 : 0.095;
            const footZ = -0.84;

            if (isDecline) {
              benchGroup.visible = true;
              benchBackPivot.visible = false;
              benchGroup.position.set(0, 0, -1.06);
            }

            const plankAngle = (5.2 + 16.3 * lift) * (Math.PI / 180);
            const legDist = 0.818;
            const hipY = footY + legDist * Math.sin(plankAngle);
            const hipZ = footZ + legDist * Math.cos(plankAngle);
            const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
            const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

            hipsPos.set(0, hipY, hipZ);
            shoulderCenter.set(0, chestY, chestZ);
            torsoAnterior.set(0, -1, 0.18).normalize();
            headLookDir.set(0, -0.52, 0.85).normalize();
            spineArchOffset = 0.004;

            handL.set(-handSpread, 0.028, 0.50);
            handR.set(handSpread, 0.028, 0.50);

            const elbowSpread = isDiamond ? 0.23 : 0.44;
            elbowPoleL.set(-elbowSpread, shoulderCenter.y + 0.18, 0.16);
            elbowPoleR.set(elbowSpread, shoulderCenter.y + 0.18, 0.16);

            footL.set(-0.11, footY, footZ);
            footR.set(0.11, footY, footZ);
            kneePoleL.set(-0.11, (hipsPos.y + footY) * 0.5 + 0.15, (hipsPos.z + footZ) * 0.5);
            kneePoleR.set(0.11, (hipsPos.y + footY) * 0.5 + 0.15, (hipsPos.z + footZ) * 0.5);
            footModeL = 'toes';
            footModeR = 'toes';
            break;
          }

          case 'squat': {
            const depth = p;
            const hipY = 0.94 - 0.37 * depth;
            const hipZ = -0.22 * depth;
            hipsPos.set(0, hipY, hipZ);

            const leanAngle = 0.42 * depth;
            shoulderCenter.set(
              0,
              hipY + Math.cos(leanAngle) * TORSO_LEN,
              hipZ + Math.sin(leanAngle) * TORSO_LEN
            );
            torsoAnterior.set(0, -Math.sin(leanAngle), Math.cos(leanAngle)).normalize();
            headLookDir.set(0, 0.04, 1).normalize();

            footL.set(-0.17, 0.075, 0.02);
            footR.set(0.17, 0.075, 0.02);
            kneePoleL.set(-0.23, 0.48, 0.58);
            kneePoleR.set(0.23, 0.48, 0.58);

            // Blueprint Counterbalance Arms:
            // Extend straight forward and parallel in the sagittal plane (x = ±0.195) as hips descend
            const armSwingAngle = depth * (Math.PI * 0.49);
            const reach = 0.555;
            const sL = new THREE.Vector3(-0.195, shoulderCenter.y - 0.05, shoulderCenter.z);
            const sR = new THREE.Vector3(0.195, shoulderCenter.y - 0.05, shoulderCenter.z);

            handL.set(
              sL.x,
              sL.y - Math.cos(armSwingAngle) * reach,
              sL.z + Math.sin(armSwingAngle) * reach + 0.03 * (1 - depth)
            );
            handR.set(
              sR.x,
              sR.y - Math.cos(armSwingAngle) * reach,
              sR.z + Math.sin(armSwingAngle) * reach + 0.03 * (1 - depth)
            );

            elbowPoleL.set(
              sL.x - 0.02 * (1 - depth),
              sL.y - Math.cos(armSwingAngle) * 0.28 - 0.22 * depth,
              sL.z + Math.sin(armSwingAngle) * 0.24 - 0.22 * (1 - depth)
            );
            elbowPoleR.set(
              sR.x + 0.02 * (1 - depth),
              sR.y - Math.cos(armSwingAngle) * 0.28 - 0.22 * depth,
              sR.z + Math.sin(armSwingAngle) * 0.24 - 0.22 * (1 - depth)
            );
            break;
          }

          case 'pullup': {
            pullupRigGroup.visible = true;
            const pull = p;

            const hipY = 0.94 + 0.36 * pull;
            const hipZ = -0.05 - 0.06 * pull;
            hipsPos.set(0, hipY, hipZ);

            const archAngle = -0.16 * pull;
            shoulderCenter.set(
              0,
              hipY + Math.cos(archAngle) * TORSO_LEN,
              hipZ + Math.sin(archAngle) * TORSO_LEN
            );
            torsoAnterior.set(0, -Math.sin(archAngle), Math.cos(archAngle)).normalize();
            headLookDir.set(0, 0.16 * pull, 1).normalize();
            spineArchOffset = 0.016 * pull;

            handL.set(-0.34, 2.09, 0.0);
            handR.set(0.34, 2.09, 0.0);
            elbowPoleL.set(-0.64, shoulderCenter.y - 0.14, -0.14);
            elbowPoleR.set(0.64, shoulderCenter.y - 0.14, -0.14);

            footL.set(-0.10, hipY - 0.78, hipZ - 0.06 - 0.04 * pull);
            footR.set(0.10, hipY - 0.78, hipZ - 0.06 - 0.04 * pull);
            kneePoleL.set(-0.12, hipY - 0.38, hipZ + 0.24);
            kneePoleR.set(0.12, hipY - 0.38, hipZ + 0.24);
            footModeL = 'free';
            footModeR = 'free';
            break;
          }

          case 'lunge': {
            // Walking Lunges (Stepping into deep 90/90 lunge with dumbbells)
            const depth = p;
            const hipY = 0.90 - 0.26 * depth;
            hipsPos.set(0, hipY, 0);
            shoulderCenter.set(0, hipY + TORSO_LEN, 0.03 * depth);
            torsoAnterior.set(0, -0.05 * depth, 1).normalize();
            headLookDir.set(0, 0, 1);

            footL.set(-0.14, 0.075, 0.18 + 0.22 * depth);
            footR.set(0.14, 0.085, -0.22 - 0.22 * depth);
            kneePoleL.set(-0.16, 0.48, 0.85);
            kneePoleR.set(0.16, 0.12, 0.25);
            footModeL = 'flat';
            footModeR = 'toes';

            dumbbellL.visible = true;
            dumbbellR.visible = true;
            handL.set(-0.23, hipY - 0.06, 0.02);
            handR.set(0.23, hipY - 0.06, 0.02);
            dumbbellL.position.copy(handL);
            dumbbellR.position.copy(handR);
            dumbbellL.rotation.set(0, Math.PI / 2, 0);
            dumbbellR.rotation.set(0, Math.PI / 2, 0);
            elbowPoleL.set(-0.34, hipY + 0.24, -0.20);
            elbowPoleR.set(0.34, hipY + 0.24, -0.20);
            break;
          }

          case 'stretch_flow': {
            if (variant === 'curl') {
              // Standing Barbell Curl / EZ Bar Curl / Hammer Curl
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0, 1);

              const isBarbellCurl =
                id === 'barbell_curl' ||
                id === 'ez_bar_curl' ||
                nameLower.includes('barbell') ||
                nameLower.includes('ez bar');
              const flexAngle = 0.20 + p * 2.05;
              const eL = new THREE.Vector3(-0.22, 1.15, 0.02);
              const eR = new THREE.Vector3(0.22, 1.15, 0.02);
              directElbowL = eL;
              directElbowR = eR;
              elbowPoleL.set(-0.25, 1.15, -0.30);
              elbowPoleR.set(0.25, 1.15, -0.30);

              const handY = eL.y - Math.cos(flexAngle) * FOREARM_LEN;
              const handZ = eL.z + Math.sin(flexAngle) * FOREARM_LEN;
              handL.set(-0.23, handY, handZ);
              handR.set(0.23, handY, handZ);

              if (isBarbellCurl) {
                barbellGroup.visible = true;
                barbellGroup.position.set(0, handY, handZ);
              } else {
                dumbbellL.visible = true;
                dumbbellR.visible = true;
                dumbbellL.position.copy(handL);
                dumbbellR.position.copy(handR);
                if (id === 'hammer_curl' || nameLower.includes('hammer')) {
                  dumbbellL.rotation.set(0, Math.PI / 2, 0);
                  dumbbellR.rotation.set(0, Math.PI / 2, 0);
                }
              }
            } else if (variant === 'overhead_push') {
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0.06, 1).normalize();

              const sL = new THREE.Vector3(-0.195, 1.445, 0);
              const sR = new THREE.Vector3(0.195, 1.445, 0);

              if (id === 'lateral_raises' || nameLower.includes('lateral')) {
                dumbbellL.visible = true;
                dumbbellR.visible = true;
                const abdAngle = (12 + 76 * p) * (Math.PI / 180);
                const reach = 0.53;
                handL.set(
                  sL.x - Math.sin(abdAngle) * reach,
                  sL.y - Math.cos(abdAngle) * reach,
                  0.10 * Math.sin(abdAngle)
                );
                handR.set(
                  sR.x + Math.sin(abdAngle) * reach,
                  sR.y - Math.cos(abdAngle) * reach,
                  0.10 * Math.sin(abdAngle)
                );
                elbowPoleL.set(
                  sL.x - Math.sin(abdAngle) * 0.27,
                  sL.y - Math.cos(abdAngle) * 0.27 + 0.22,
                  -0.18
                );
                elbowPoleR.set(
                  sR.x + Math.sin(abdAngle) * 0.27,
                  sR.y - Math.cos(abdAngle) * 0.27 + 0.22,
                  -0.18
                );
                dumbbellL.position.copy(handL);
                dumbbellR.position.copy(handR);
                dumbbellL.rotation.set(0, Math.PI / 2, 0);
                dumbbellR.rotation.set(0, Math.PI / 2, 0);
              } else if (id === 'front_raises' || nameLower.includes('front')) {
                dumbbellL.visible = true;
                dumbbellR.visible = true;
                const flxAngle = (10 + 80 * p) * (Math.PI / 180);
                const reach = 0.53;
                handL.set(sL.x, sL.y - Math.cos(flxAngle) * reach, Math.sin(flxAngle) * reach + 0.04);
                handR.set(sR.x, sR.y - Math.cos(flxAngle) * reach, Math.sin(flxAngle) * reach + 0.04);
                elbowPoleL.set(-0.22, sL.y - Math.cos(flxAngle) * 0.26 - 0.18, Math.sin(flxAngle) * 0.24 - 0.18);
                elbowPoleR.set(0.22, sR.y - Math.cos(flxAngle) * 0.26 - 0.18, Math.sin(flxAngle) * 0.24 - 0.18);
                dumbbellL.position.copy(handL);
                dumbbellR.position.copy(handR);
              } else {
                // Overhead Barbell Military Press
                const barY = 1.46 + 0.50 * p;
                const barZ = 0.14 - 0.11 * p;
                barbellGroup.visible = true;
                barbellGroup.position.set(0, barY, barZ);
                handL.set(-0.30, barY, barZ);
                handR.set(0.30, barY, barZ);
                elbowPoleL.set(-0.44, 1.18, 0.22);
                elbowPoleR.set(0.44, 1.18, 0.22);
              }
            } else if (variant === 'row_pull') {
              // Bent-Over Barbell Row
              const hipY = 0.85;
              const hipZ = -0.16;
              hipsPos.set(0, hipY, hipZ);
              const torsoAngle = 0.72;
              shoulderCenter.set(
                0,
                hipY + Math.cos(torsoAngle) * TORSO_LEN,
                hipZ + Math.sin(torsoAngle) * TORSO_LEN
              );
              torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
              headLookDir.set(0, -0.32, 0.94).normalize();

              const barY = 0.54 + 0.30 * p;
              const barZ = 0.24 - 0.16 * p;
              barbellGroup.visible = true;
              barbellGroup.position.set(0, barY, barZ);
              handL.set(-0.28, barY, barZ);
              handR.set(0.28, barY, barZ);
              elbowPoleL.set(-0.42, shoulderCenter.y + 0.18, hipZ - 0.28);
              elbowPoleR.set(0.42, shoulderCenter.y + 0.18, hipZ - 0.28);
            }
            break;
          }

          case 'idle':
          default: {
            const breath = 0.014 * p;
            hipsPos.set(0, 0.94 + breath * 0.5, 0);
            shoulderCenter.set(0, 0.94 + TORSO_LEN + breath, 0);
            torsoAnterior.set(0, 0, 1);
            headLookDir.set(0, 0, 1);

            handL.set(-0.23, 0.78 + breath, 0.06);
            handR.set(0.23, 0.78 + breath, 0.06);
            elbowPoleL.set(-0.34, 1.15, -0.22);
            elbowPoleR.set(0.34, 1.15, -0.22);

            footL.set(-0.15, 0.075, 0);
            footR.set(0.15, 0.075, 0);
            kneePoleL.set(-0.16, 0.52, 0.45);
            kneePoleR.set(0.16, 0.52, 0.45);
            break;
          }
        }
      }

      // ============================================================================
      // REAL-TIME CONTINUOUS SKINNED MESH DEFORMATION
      // ============================================================================
      const torsoUp = new THREE.Vector3().subVectors(shoulderCenter, hipsPos).normalize();
      const torsoRight = new THREE.Vector3().crossVectors(torsoUp, torsoAnterior).normalize();

      const headTop = shoulderCenter
        .clone()
        .addScaledVector(torsoUp, HEAD_NECK_LEN * 0.92)
        .addScaledVector(headLookDir, HEAD_NECK_LEN * 0.16);

      const pelvisBottom = hipsPos.clone().addScaledVector(torsoUp, -PELVIS_DROP);

      // 1. Deform Unified Axial Body (Shorts Saddle s=0 -> Neck s=0.70 -> Head Crown s=1.0)
      axialBody.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        if (s <= 0.70) {
          const u = s / 0.70;
          outCenter.lerpVectors(pelvisBottom, shoulderCenter, u);
          const archU = Math.max(0, (u - 0.12) / 0.88);
          const arch = Math.sin(archU * Math.PI) * spineArchOffset;
          outCenter.addScaledVector(torsoAnterior, arch);
          computeOrthonormalFrame(torsoUp, torsoAnterior, outX, outY, outZ);
        } else {
          const u = (s - 0.70) / 0.30;
          outCenter.lerpVectors(shoulderCenter, headTop, u);
          const neckBlend = Math.min(1, u * 2.2);
          const ant = new THREE.Vector3().lerpVectors(torsoAnterior, headLookDir, neckBlend).normalize();
          const headUp = new THREE.Vector3().subVectors(headTop, shoulderCenter).normalize();
          const tang = new THREE.Vector3().lerpVectors(torsoUp, headUp, neckBlend).normalize();
          computeOrthonormalFrame(tang, ant, outX, outY, outZ);
        }
      });

      // 2. Shoulder & Hip Joint Sockets
      const shoulderL = shoulderCenter
        .clone()
        .addScaledVector(torsoRight, -0.192)
        .addScaledVector(torsoUp, -0.055 + shoulderElevationOffset);
      const shoulderR = shoulderCenter
        .clone()
        .addScaledVector(torsoRight, 0.192)
        .addScaledVector(torsoUp, -0.055 + shoulderElevationOffset);

      const hipL = hipsPos
        .clone()
        .addScaledVector(torsoRight, -0.10)
        .addScaledVector(torsoUp, 0.03);
      const hipR = hipsPos
        .clone()
        .addScaledVector(torsoRight, 0.10)
        .addScaledVector(torsoUp, 0.03);

      // 3. Solve Arm IK & Deform Continuous Skinned Left/Right Arms (Shoulder s=0 -> Elbow s=0.48 -> Hand s=1.0)
      const elbowL =
        directElbowL || solveTwoBoneIK(shoulderL, handL, UPPER_ARM_LEN, FOREARM_LEN, elbowPoleL);
      const elbowR =
        directElbowR || solveTwoBoneIK(shoulderR, handR, UPPER_ARM_LEN, FOREARM_LEN, elbowPoleR);

      const forearmDirL = new THREE.Vector3().subVectors(handL, elbowL).normalize();
      const forearmDirR = new THREE.Vector3().subVectors(handR, elbowR).normalize();

      const isGroundPalm =
        handL.y < 0.08 &&
        handR.y < 0.08 &&
        (clip === 'pushup' ||
          clip === 'diamond_pushup' ||
          clip === 'plank' ||
          clip === 'mountain_climber' ||
          clip === 'burpee' ||
          id === 'bodyweight_tricep_ext' ||
          id === 'plank_downward_dog');

      const handTipL = isGroundPalm
        ? handL.clone().add(new THREE.Vector3(0, 0.005, 0.075))
        : handL.clone().addScaledVector(forearmDirL, HAND_LEN);
      const handTipR = isGroundPalm
        ? handR.clone().add(new THREE.Vector3(0, 0.005, 0.075))
        : handR.clone().addScaledVector(forearmDirR, HAND_LEN);

      // Gimbal-free arm anterior vector derived from opposite of elbow pole (`invertPole = true`)
      const armAntL = computeLimbAnteriorFromPole(shoulderL, handTipL, elbowPoleL, true);
      const armAntR = computeLimbAnteriorFromPole(shoulderR, handTipR, elbowPoleR, true);

      armL.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          0.48,
          0.08,
          shoulderL,
          elbowL,
          handTipL,
          armAntL,
          armAntL,
          -0.008,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      armR.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          0.48,
          0.08,
          shoulderR,
          elbowR,
          handTipR,
          armAntR,
          armAntR,
          -0.008,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      // 4. Solve Leg IK & Deform Continuous Skinned Left/Right Legs (Hip s=0 -> Knee s=0.51 -> Ankle s=1.0)
      const kneeL =
        directKneeL || solveTwoBoneIK(hipL, footL, THIGH_LEN, CALF_LEN, kneePoleL);
      const kneeR =
        directKneeR || solveTwoBoneIK(hipR, footR, THIGH_LEN, CALF_LEN, kneePoleR);

      // Gimbal-free leg anterior vector derived from knee pole (`invertPole = false`)
      const legAntL = computeLimbAnteriorFromPole(hipL, footL, kneePoleL, false);
      const legAntR = computeLimbAnteriorFromPole(hipR, footR, kneePoleR, false);

      legL.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          0.51,
          0.09,
          hipL,
          kneeL,
          footL,
          legAntL,
          legAntL,
          0.012,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      legR.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          0.51,
          0.09,
          hipR,
          kneeR,
          footR,
          legAntR,
          legAntR,
          0.012,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      // 5. Position & Biomechanically Orient Shoes at Ankles (`footL`, `footR`)
      shoeL.position.copy(footL);
      shoeR.position.copy(footR);

      const orientShoe = (
        shoe: THREE.Group,
        mode: 'flat' | 'toes' | 'free',
        knee: THREE.Vector3,
        foot: THREE.Vector3,
        legAnt: THREE.Vector3,
        pitchOffset: number
      ) => {
        if (mode === 'toes') {
          shoe.rotation.set(Math.PI / 3.2, 0, 0);
        } else if (mode === 'flat') {
          shoe.rotation.set(pitchOffset, 0, 0);
        } else {
          // Align shoe perpendicular to shin (`calfDir`) pointing along `legAnt`
          const calfDown = new THREE.Vector3().subVectors(foot, knee).normalize();
          const sX = new THREE.Vector3();
          const sY = new THREE.Vector3();
          const sZ = new THREE.Vector3();
          computeOrthonormalFrame(calfDown.clone().negate(), legAnt, sX, sY, sZ);
          const m = new THREE.Matrix4().makeBasis(sX, sY, sZ);
          shoe.quaternion.setFromRotationMatrix(m);
        }
      };

      orientShoe(shoeL, footModeL, kneeL, footL, legAntL, anklePitchOffsetL);
      orientShoe(shoeR, footModeR, kneeR, footR, legAntR, anklePitchOffsetR);
    };

    sceneRef.current = {
      camera,
      controls,
      updateMuscleMaterials,
      applyCameraPreset,
    };

    if (stateRef.current.onReady) {
      stateRef.current.onReady();
    }

    // ============================================================================
    // RENDER LOOP (Single View & 4-Angle Blueprint Split View)
    // ============================================================================
    let rafId = 0;
    let lastTime = performance.now();
    let accumSec = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const st = stateRef.current;
      let frameFloat = 0;

      if (st.activeKeyframe !== null && st.activeKeyframe !== undefined) {
        frameFloat = st.activeKeyframe;
      } else {
        if (st.isPlaying) {
          accumSec += dt * st.tempoScale;
        }
        frameFloat = (accumSec * 30) % 60;
      }

      const currentFrameInt = Math.round(frameFloat) % 60;
      if (frameBadgeRef.current) {
        frameBadgeRef.current.textContent = `FRAME ${String(currentFrameInt).padStart(2, '0')} / 60 · 30 FPS`;
      }

      applyProceduralPose(
        st.clipName,
        st.exerciseId,
        st.biomechanicalVariant,
        st.exerciseName,
        frameFloat
      );
      controls.update();

      const w = container.clientWidth || 800;
      const h = container.clientHeight || 520;

      if (!st.quadView) {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      } else {
        renderer.setScissorTest(true);
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        auxCamera.aspect = halfW / Math.max(1, halfH);
        auxCamera.updateProjectionMatrix();

        const views: Array<{
          preset: CameraPreset;
          x: number;
          y: number;
        }> = [
          { preset: 'front', x: 0, y: halfH },
          { preset: 'side', x: halfW, y: halfH },
          { preset: 'back', x: 0, y: 0 },
          { preset: 'top', x: halfW, y: 0 },
        ];

        views.forEach((v) => {
          const { pos, target } = computeCameraView(v.preset, st.clipName, st.exerciseId);
          auxCamera.position.copy(pos);
          auxCamera.lookAt(target);
          renderer.setViewport(v.x, v.y, halfW, halfH);
          renderer.setScissor(v.x, v.y, halfW, halfH);
          renderer.render(scene, auxCamera);
        });
      }
    };

    rafId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  if (!webGLSupported) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#060B16] text-white p-6 text-center">
        <p className="text-sm font-bold text-red-400 mb-1">WebGL Tidak Tersedia</p>
        <p className="text-xs text-neutral-400 max-w-md">
          Perangkat atau peramban Anda tidak mendukung akselerasi 3D WebGL. Gunakan panduan langkah latihan dan peta otot 2D di sebelah kanan.
        </p>
      </div>
    );
  }

  const bpSpec =
    clipName === 'pushup' || clipName === 'diamond_pushup'
      ? BLUEPRINT_EXERCISES[0]
      : clipName === 'squat'
      ? BLUEPRINT_EXERCISES[1]
      : clipName === 'pullup'
      ? BLUEPRINT_EXERCISES[2]
      : null;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#060B16]">
      <div
        ref={containerRef}
        data-testid="trainer-studio-3d-canvas"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Minimal Top-Left Frame Telemetry Pill */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-lg bg-[#0B1324]/90 border border-sky-500/25 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span
            ref={frameBadgeRef}
            className="text-[10px] font-mono font-bold text-sky-300 tracking-wider"
          >
            FRAME 00 / 60 · 30 FPS
          </span>
        </div>
        {bpSpec && (
          <div className="hidden sm:flex px-2.5 py-1 rounded-lg bg-[#0B1324]/90 border border-white/10 items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-300">
              180 cm · 70 kg · IK Rig
            </span>
          </div>
        )}
      </div>

      {/* Minimal Top-Right Muscle Status Pill */}
      <div className="pointer-events-none absolute top-3 right-3 hidden sm:flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-lg bg-[#0B1324]/90 border border-red-500/30 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
          <span className="text-[10px] font-bold text-slate-200">
            Anatomical Human IK
          </span>
        </div>
      </div>

      {/* 4-Angle Blueprint Quadrant Labels when quadView is active */}
      {quadView && (
        <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2">
          <div className="border-r border-b border-sky-500/30 relative">
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#060B16]/90 border border-sky-500/30 text-[10px] font-bold text-sky-200 tracking-wide">
              Front
            </span>
          </div>
          <div className="border-b border-sky-500/30 relative">
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#060B16]/90 border border-sky-500/30 text-[10px] font-bold text-sky-200 tracking-wide">
              Side
            </span>
          </div>
          <div className="border-r border-sky-500/30 relative">
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#060B16]/90 border border-sky-500/30 text-[10px] font-bold text-sky-200 tracking-wide">
              Back
            </span>
          </div>
          <div className="relative">
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded bg-[#060B16]/90 border border-sky-500/30 text-[10px] font-bold text-sky-200 tracking-wide">
              Top
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
