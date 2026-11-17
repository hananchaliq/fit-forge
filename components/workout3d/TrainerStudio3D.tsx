'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AnimationClipName, MuscleGroup } from '@/data/exerciseClipMap';
import { BLUEPRINT_EXERCISES } from '@/data/blueprintPack';

export type CameraPreset = 'front' | 'side' | 'back' | 'top';

export interface TrainerStudio3DProps {
  clip: AnimationClipName;
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
function solveTwoBoneIK(
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
 * Computes a right-handed orthonormal basis where:
 * - `yAxis` points along `tangentDir`
 * - `zAxis` faces `anteriorDir` (front of body/limb)
 * - `xAxis` points to the character's left (`+X` in world space when facing `+Z`)
 */
function computeOrthonormalFrame(
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
      // Exact seam welding between c=0 and c=radialSegs
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

  // Seamless normal averaging across seam column (c=0 and c=radialSegs) and pole caps
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

  // Save rest-pose normals so real-time deformation transforms both position and normals cleanly
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
    // Quadratic Bezier curve across the joint zone [sStart, sEnd]
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

    // Tangent of Quadratic Bezier: 2*(1-t)*(midPos - p0) + 2*t*(p2 - midPos)
    const d0 = new THREE.Vector3().subVectors(midPos, p0);
    const d1 = new THREE.Vector3().subVectors(p2, midPos);
    tangent.set(0, 0, 0).addScaledVector(d0, omt).addScaledVector(d1, t);
  }

  // `tangent` points in the direction of increasing `s` (dC/ds: rootPos -> endPos).
  // Using `tangent` directly as `outY` guarantees (outX, outY=dC/ds, outZ) is right-handed (det = +1)!
  const ant = new THREE.Vector3().lerpVectors(anteriorRoot, anteriorEnd, s).normalize();
  computeOrthonormalFrame(tangent, ant, outX, outY, outZ);

  // Subtle patella / olecranon volume preservation when joint is flexed
  if (s > sStart && s < sEnd && jointBulgeForward !== 0) {
    const n1 = seg1Dir.clone().normalize();
    const n2 = seg2Dir.clone().normalize();
    const bendFactor = Math.max(0, 0.5 * (1 - n1.dot(n2))); // 0 when straight, >0 when flexed
    const bell = Math.sin(((s - sStart) / (2 * blendHalfWidth)) * Math.PI);
    outCenter.addScaledVector(outZ, jointBulgeForward * bendFactor * bell);
  }
}

export function TrainerStudio3D({
  clip: clipName,
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
  });

  useEffect(() => {
    stateRef.current = {
      clipName,
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
    };
  }, [
    clipName,
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
  }, [primaryMuscles, secondaryMuscles, showMaskDebug, clipName]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.applyCameraPreset(cameraPreset);
    }
  }, [cameraPreset, clipName]);

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
      setWebGLSupported(false);
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

    // Clean Blueprint Floor & Grid (Removed cluttering orange circle so Top view matches Blueprint)
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
    // Because Pelvis Saddle, Torso, Neck, and Head are ONE continuous mesh deformed along the spine curve,
    // the pelvis-to-thigh shorts saddle is 100% seamless, the neck NEVER separates, and the crown has zero seam holes!
    const buildUnifiedAxialBody = (): SkinnedLoftMeshData => {
      // s ∈ [0.00, 0.70] = Shorts Crotch Saddle (-0.075m below hips) to Base of Neck (0.635m)
      // s ∈ [0.70, 1.00] = Neck Base to Top of Skull Crown (0.25m)
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.045, rzAnt: 0.052, rzPost: 0.058, pinchCenterZ: 0.006 }, // Closed shorts crotch saddle base
        { s: 0.04, rx: 0.178, rzAnt: 0.106, rzPost: 0.122, pinchCenterZ: 0.022 }, // Lower pelvis enveloping upper thighs
        { s: 0.09, rx: 0.168, rzAnt: 0.108, rzPost: 0.132, pinchCenterZ: 0.026 }, // Full gluteal & hip contour
        { s: 0.16, rx: 0.152, rzAnt: 0.102, rzPost: 0.112, pinchCenterZ: 0.012 }, // Athletic shorts waistband
        { s: 0.24, rx: 0.138, rzAnt: 0.098, rzPost: 0.098, pinchCenterZ: 0.010 }, // Narrow athletic waist
        { s: 0.34, rx: 0.150, rzAnt: 0.108, rzPost: 0.106, pinchCenterZ: 0.014 }, // Mid ribcage & 6-pack abs
        { s: 0.45, rx: 0.178, rzAnt: 0.126, rzPost: 0.118, pinchCenterZ: 0.020 }, // Lower pectoral shelf & lats flare
        { s: 0.55, rx: 0.198, rzAnt: 0.134, rzPost: 0.124, pinchCenterZ: 0.022 }, // Full chest & wide V-taper lats
        { s: 0.63, rx: 0.206, rzAnt: 0.112, rzPost: 0.108, pinchCenterZ: 0.008 }, // Clavicle / shoulder shelf
        { s: 0.68, rx: 0.108, rzAnt: 0.076, rzPost: 0.078, pinchCenterZ: 0.002 }, // Trapezius slope
        { s: 0.71, rx: 0.058, rzAnt: 0.056, rzPost: 0.058, pinchCenterZ: 0.000 }, // Base of neck
        { s: 0.76, rx: 0.055, rzAnt: 0.055, rzPost: 0.056, pinchCenterZ: 0.000 }, // Mid neck
        { s: 0.80, rx: 0.058, rzAnt: 0.068, rzPost: 0.060, pinchCenterZ: 0.000 }, // Sub-jaw
        { s: 0.83, rx: 0.068, rzAnt: 0.094, rzPost: 0.074, pinchCenterZ: 0.000 }, // Jawline & chin
        { s: 0.87, rx: 0.076, rzAnt: 0.096, rzPost: 0.088, pinchCenterZ: 0.000 }, // Cheekbones & ears
        { s: 0.91, rx: 0.079, rzAnt: 0.092, rzPost: 0.092, pinchCenterZ: 0.000 }, // Brow ridge & cranium
        { s: 0.95, rx: 0.074, rzAnt: 0.084, rzPost: 0.086, pinchCenterZ: 0.000 }, // Upper forehead
        { s: 0.98, rx: 0.048, rzAnt: 0.052, rzPost: 0.054, pinchCenterZ: 0.000 }, // Crown dome
        { s: 1.00, rx: 0.001, rzAnt: 0.001, rzPost: 0.001, pinchCenterZ: 0.000 }, // Closed top pole
      ];

      // Groups: 0: skin, 1: shorts, 2: shortsTrim, 3: chest, 4: abs, 5: back_lats, 6: shoulders, 7: glutes(shorts), 8: hair
      const groupFn = (s: number, nx: number, nz: number): number => {
        const absX = Math.abs(nx);
        const isAnt = nz >= 0;

        // Head & Hair region (s >= 0.78)
        if (s >= 0.78) {
          if (s >= 0.93) return 8; // Full crown hair
          if (s >= 0.89 && (nz < 0.36 || absX > 0.70)) return 8; // Hairline & temples
          if (s >= 0.83 && nz < -0.15) return 8; // Back of head hair
          return 0; // Face & neck skin
        }

        // Athletic shorts cover pelvis saddle from s=0.00 up to s=0.18
        if (s < 0.18) {
          if (s >= 0.162 && s < 0.18) return 2; // Subtle dark charcoal waistband trim
          if (!isAnt && s >= 0.02 && s < 0.155 && absX > 0.12 && absX < 0.90) return 7; // Glutes
          return 1; // Shorts
        }

        // Shoulder / Clavicle deltoid attachment
        if (s >= 0.54 && s <= 0.67 && absX > 0.72) {
          return 6; // shoulders
        }
        // Pectorals (Chest)
        if (isAnt && s >= 0.40 && s <= 0.62 && absX >= 0.05 && absX <= 0.82 && nz > 0.20) {
          return 3; // chest
        }
        // 6-Pack Abs & Obliques
        if (isAnt && s >= 0.165 && s < 0.40 && absX <= 0.68 && nz > 0.26) {
          return 4; // abs
        }
        // Latissimus Dorsi & Back
        if (!isAnt && s >= 0.22 && s <= 0.65 && absX >= 0.06 && nz < -0.15) {
          return 5; // back_lats
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
          // Pectoralis Major plates
          if (nz > 0.15 && ts > 0.55 && ts < 0.87 && absX > 0.05 && absX < 0.84) {
            const pecS = Math.sin(((ts - 0.55) / 0.32) * Math.PI);
            const pecX = Math.sin(((absX - 0.05) / 0.79) * Math.PI);
            const lowerShelf = ts < 0.65 ? Math.sin(((ts - 0.55) / 0.10) * (Math.PI * 0.5)) : 1.0;
            pos.z += 0.022 * pecS * pecX * lowerShelf * nz;
          }
          // 6-Pack Rectus Abdominis
          if (nz > 0.32 && ts > 0.24 && ts < 0.55 && absX > 0.05 && absX < 0.45) {
            const rowPhase = ((ts - 0.24) / 0.31) * 3 * Math.PI;
            const abRow = Math.pow(Math.max(0, Math.sin(rowPhase)), 0.75);
            const abCol = Math.sin(((absX - 0.05) / 0.40) * Math.PI);
            pos.z += 0.012 * abRow * abCol * nz;
          }
          // Serratus ribs
          if (nz > -0.1 && nz < 0.65 && ts > 0.32 && ts < 0.62 && absX > 0.55 && absX < 0.92) {
            const ribWave = Math.max(0, Math.sin(((ts - 0.32) / 0.30) * 4 * Math.PI));
            pos.x += (nx > 0 ? 1 : -1) * 0.005 * ribWave;
          }
          // Latissimus Dorsi V-taper
          if (nz < -0.15 && ts > 0.32 && ts < 0.86 && absX > 0.12 && absX < 0.88) {
            const latS = Math.sin(((ts - 0.32) / 0.54) * Math.PI);
            const latX = Math.sin(((absX - 0.12) / 0.76) * Math.PI);
            pos.z -= 0.018 * latS * latX * -nz;
            pos.x += (nx > 0 ? 1 : -1) * 0.010 * latS * latX;
          }
          // Gluteal contour
          if (nz < -0.2 && ts > 0.02 && ts < 0.19 && absX > 0.12 && absX < 0.86) {
            const gluteS = Math.sin(((ts - 0.02) / 0.17) * Math.PI);
            const gluteX = Math.sin(((absX - 0.12) / 0.74) * Math.PI);
            pos.z -= 0.020 * gluteS * gluteX * -nz;
          }
        } else {
          // Head & Facial Features (hs ∈ [0, 1])
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
    // One continuous mesh per arm! The elbow and wrist bend via Quadratic Bezier skinning with ZERO break or gap!
    const buildSkinnedArm = (): SkinnedLoftMeshData => {
      const totalArmLen = UPPER_ARM_LEN + FOREARM_LEN + HAND_LEN; // 0.65m
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.012, rzAnt: 0.012, rzPost: 0.012 }, // Closed shoulder socket dome
        { s: 0.04, rx: 0.062, rzAnt: 0.062, rzPost: 0.060 }, // Deltoid upper cap
        { s: 0.11, rx: 0.072, rzAnt: 0.072, rzPost: 0.070 }, // Full deltoid lateral sweep
        { s: 0.20, rx: 0.062, rzAnt: 0.066, rzPost: 0.064 }, // Deltoid insertion
        { s: 0.30, rx: 0.056, rzAnt: 0.068, rzPost: 0.064 }, // Bicep peak & tricep horseshoe
        { s: 0.42, rx: 0.048, rzAnt: 0.052, rzPost: 0.052 }, // Lower humerus
        { s: 0.48, rx: 0.045, rzAnt: 0.044, rzPost: 0.046 }, // Elbow joint center
        { s: 0.56, rx: 0.047, rzAnt: 0.045, rzPost: 0.045 }, // Upper forearm brachioradialis
        { s: 0.72, rx: 0.036, rzAnt: 0.032, rzPost: 0.032 }, // Mid forearm
        { s: 0.86, rx: 0.029, rzAnt: 0.023, rzPost: 0.023 }, // Wrist joint
        { s: 0.92, rx: 0.038, rzAnt: 0.016, rzPost: 0.018 }, // Palm of hand
        { s: 0.98, rx: 0.032, rzAnt: 0.012, rzPost: 0.012 }, // Fingers
        { s: 1.00, rx: 0.004, rzAnt: 0.004, rzPost: 0.004 }, // Closed fingertips
      ];

      // Groups: 0: skin, 1: shoulders, 2: biceps, 3: triceps, 4: forearms
      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s < 0.21) return 1; // shoulders (deltoids)
        if (s >= 0.21 && s < 0.45) {
          if (nz >= 0.08) return 2; // biceps
          if (nz <= -0.08) return 3; // triceps
        }
        if (s >= 0.50 && s < 0.84) return 4; // forearms
        return 0; // wrist & hand skin
      };

      const sculptFn = (
        s: number,
        _theta: number,
        nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        // Bicep peak
        if (nz > 0.2 && s > 0.20 && s < 0.44) {
          pos.z += 0.010 * Math.sin(((s - 0.20) / 0.24) * Math.PI) * nz;
        }
        // Tricep sweep
        if (nz < -0.2 && s > 0.18 && s < 0.44) {
          pos.z -= 0.010 * Math.sin(((s - 0.18) / 0.26) * Math.PI) * -nz;
        }
        // Forearm muscle contour
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
        // Lateral brachial groove separating biceps and triceps
        if (Math.abs(nz) < 0.16 && s > 0.18 && s < 0.46) {
          shade -= 0.22 * (1 - Math.abs(nz) / 0.16);
        }
        // Deltoid insertion groove
        if (s > 0.19 && s < 0.23 && Math.abs(nx) > 0.3) {
          shade -= 0.18;
        }
        // Finger grooves on hand
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
    // One continuous mesh per leg! Shorts, Quadriceps, Hamstrings, Patella Knee, and Gastrocnemius Calf bend seamlessly!
    const buildSkinnedLeg = (): SkinnedLoftMeshData => {
      const totalLegLen = THIGH_LEN + CALF_LEN; // 0.84m
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.052, rzAnt: 0.052, rzPost: 0.052 }, // Closed hip socket inside pelvis shorts
        { s: 0.05, rx: 0.095, rzAnt: 0.094, rzPost: 0.102 }, // Upper thigh nested smoothly inside pelvis saddle
        { s: 0.20, rx: 0.102, rzAnt: 0.098, rzPost: 0.100 }, // Shorts leg hem
        { s: 0.30, rx: 0.088, rzAnt: 0.094, rzPost: 0.088 }, // Mid quadriceps & hamstrings sweep
        { s: 0.43, rx: 0.070, rzAnt: 0.072, rzPost: 0.068 }, // Vastus medialis teardrop above knee
        { s: 0.51, rx: 0.058, rzAnt: 0.060, rzPost: 0.056 }, // Patella knee joint center
        { s: 0.64, rx: 0.062, rzAnt: 0.054, rzPost: 0.074 }, // Gastrocnemius calf diamond peak
        { s: 0.82, rx: 0.042, rzAnt: 0.044, rzPost: 0.046 }, // Achilles tendon taper
        { s: 0.94, rx: 0.038, rzAnt: 0.040, rzPost: 0.040 }, // Athletic ankle sock
        { s: 1.00, rx: 0.035, rzAnt: 0.038, rzPost: 0.038 }, // Ankle base into shoe
      ];

      // Groups: 0: skin, 1: shorts, 2: shortsTrim, 3: quads, 4: hamstrings, 5: calves, 6: trimWhite(sock)
      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s <= 0.22) {
          if (s >= 0.205) return 2; // Subtle dark charcoal shorts hem trim
          return 1; // Black athletic shorts
        }
        if (s > 0.22 && s < 0.47) {
          if (nz >= 0.06) return 3; // quads
          if (nz <= -0.06) return 4; // hamstrings
        }
        if (s >= 0.56 && s < 0.85 && nz < 0.12) {
          return 5; // calves
        }
        if (s >= 0.91) {
          return 6; // White athletic crew sock at ankle
        }
        return 0; // Knee skin
      };

      const sculptFn = (
        s: number,
        _theta: number,
        nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        // Quadriceps sweep
        if (nz > 0.15 && s > 0.14 && s < 0.46) {
          const quadProfile = Math.sin(((s - 0.14) / 0.32) * Math.PI);
          pos.z += 0.015 * quadProfile * nz;
          pos.x += nx * 0.008 * quadProfile;
        }
        // Hamstrings belly
        if (nz < -0.15 && s > 0.16 && s < 0.46) {
          pos.z -= 0.013 * Math.sin(((s - 0.16) / 0.30) * Math.PI) * -nz;
        }
        // Gastrocnemius calf peak
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
        // Quadriceps rectus femoris / vastus separation grooves
        if (nz > 0.35 && s > 0.22 && s < 0.46 && absX > 0.32 && absX < 0.44) {
          shade -= 0.22 * (1 - Math.abs(absX - 0.38) / 0.06);
        }
        // IT band lateral groove
        if (Math.abs(nz) < 0.16 && s > 0.22 && s < 0.46) {
          shade -= 0.20;
        }
        // Gastrocnemius medial/lateral head split
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
    // GYM EQUIPMENT PROPS (Pull-Up Bar `bar_ref`, Bench, Barbell, Dumbbells)
    // ============================================================================
    const equipmentRoot = new THREE.Group();
    scene.add(equipmentRoot);

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

    const benchGroup = new THREE.Group();
    const benchPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 1.24), equipDarkMat);
    benchPad.position.set(0, 0.42, -0.10);
    benchPad.castShadow = true;
    benchPad.receiveShadow = true;
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.40, 0.06), equipMetalMat);
    leg1.position.set(0, 0.20, 0.40);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.40, 0.06), equipMetalMat);
    leg2.position.set(0, 0.20, -0.58);
    benchGroup.add(benchPad, leg1, leg2);
    benchGroup.visible = false;
    equipmentRoot.add(benchGroup);

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
    // CAMERA PRESETS (Full-body framing from shoes to overhead bar with zero clipping)
    // ============================================================================
    const computeCameraView = (
      preset: CameraPreset,
      clip: AnimationClipName
    ): { pos: THREE.Vector3; target: THREE.Vector3 } => {
      const isGround =
        clip === 'pushup' ||
        clip === 'diamond_pushup' ||
        clip === 'plank' ||
        clip === 'mountain_climber' ||
        clip === 'crunch' ||
        clip === 'glute_bridge';
      const isHanging = clip === 'pullup';

      if (isGround) {
        const target = new THREE.Vector3(0, 0.34, -0.14);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 0.80, 1.95), target };
          case 'side':
            return { pos: new THREE.Vector3(2.25, 0.68, -0.14), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 0.85, -2.15), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 2.65, -0.14), target };
        }
      }

      if (isHanging) {
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
      const { pos, target } = computeCameraView(preset, stateRef.current.clipName);
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
    };

    updateMuscleMaterials();
    applyCameraPreset(stateRef.current.cameraPreset);

    // ============================================================================
    // BIOMECHANICAL IK & SKINNED DEFORMATION ENGINE (30 FPS / 60 Frames)
    // ============================================================================
    const applyProceduralPose = (
      clip: AnimationClipName,
      variant: string,
      exName: string,
      frame: number
    ) => {
      const norm = (frame % 60) / 60;
      const p = 0.5 - 0.5 * Math.cos(norm * Math.PI * 2);

      pullupRigGroup.visible = false;
      benchGroup.visible = false;
      barbellGroup.visible = false;
      dumbbellL.visible = false;
      dumbbellR.visible = false;
      dumbbellL.rotation.set(0, 0, 0);
      dumbbellR.rotation.set(0, 0, 0);

      const hipsPos = new THREE.Vector3(0, 0.94, 0);
      const shoulderCenter = new THREE.Vector3(0, 1.48, 0);
      const torsoAnterior = new THREE.Vector3(0, 0, 1);
      const headLookDir = new THREE.Vector3(0, 0, 1);
      let spineArchOffset = 0.012; // Natural slight thoracic/lumbar curve

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

      const nameLower = exName.toLowerCase();

      // Special Gym Exercises Check by Name
      if (nameLower.includes('bench press') || nameLower.includes('incline dumbbell')) {
        benchGroup.visible = true;
        benchGroup.position.set(0, 0, -0.10);
        const press = 1 - p;
        hipsPos.set(0, 0.48, -0.35);
        shoulderCenter.set(0, 0.48, 0.20);
        torsoAnterior.set(0, 1, 0);
        headLookDir.set(0, 1, 0);

        const barY = 0.62 + 0.28 * press;
        const barZ = 0.18;
        if (nameLower.includes('dumbbell')) {
          dumbbellL.visible = true;
          dumbbellR.visible = true;
          handL.set(-0.25, barY, barZ);
          handR.set(0.25, barY, barZ);
          dumbbellL.position.copy(handL);
          dumbbellR.position.copy(handR);
        } else {
          barbellGroup.visible = true;
          barbellGroup.position.set(0, barY, barZ);
          handL.set(-0.32, barY, barZ);
          handR.set(0.32, barY, barZ);
        }

        elbowPoleL.set(-0.48, 0.28, 0.08);
        elbowPoleR.set(0.48, 0.28, 0.08);
        footL.set(-0.22, 0.075, -0.76);
        footR.set(0.22, 0.075, -0.76);
        kneePoleL.set(-0.24, 0.52, -0.68);
        kneePoleR.set(0.24, 0.52, -0.68);
      } else if (nameLower.includes('dip')) {
        // Chair Dips / Bench Dips / Gym Dips
        benchGroup.visible = true;
        benchGroup.position.set(0, 0, -0.36);
        const dip = p;
        const hipY = 0.54 - 0.18 * dip;
        hipsPos.set(0, hipY, 0.02);
        shoulderCenter.set(0, hipY + TORSO_LEN, -0.02);
        torsoAnterior.set(0, 0.06, 1).normalize();
        headLookDir.set(0, 0, 1);

        handL.set(-0.23, 0.45, -0.14);
        handR.set(0.23, 0.45, -0.14);
        elbowPoleL.set(-0.28, 0.68, -0.52);
        elbowPoleR.set(0.28, 0.68, -0.52);

        footL.set(-0.13, 0.075, 0.66);
        footR.set(0.13, 0.075, 0.66);
        kneePoleL.set(-0.14, 0.42, 0.48);
        kneePoleR.set(0.14, 0.42, 0.48);
      } else {
        switch (clip) {
          case 'pushup':
          case 'diamond_pushup': {
            const lift = 1 - p;
            const isDiamond =
              clip === 'diamond_pushup' ||
              variant === 'narrow_press' ||
              nameLower.includes('diamond') ||
              nameLower.includes('close-grip');
            const isDecline = nameLower.includes('decline');
            const isPike = variant === 'overhead_push' || nameLower.includes('pike');

            const handSpread = isDiamond ? 0.10 : 0.25;
            const footY = isDecline ? 0.40 : 0.095;
            const footZ = -0.84;

            if (isDecline) {
              benchGroup.visible = true;
              benchGroup.position.set(0, 0, -0.95);
            }

            if (isPike) {
              hipsPos.set(0, 0.84 - 0.08 * p, -0.16);
              shoulderCenter.set(0, 0.46 - 0.18 * p, 0.34);
              torsoAnterior.set(0, -0.65, -0.75).normalize();
              headLookDir.set(0, -0.85, 0.52).normalize();
            } else {
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
            }

            handL.set(-handSpread, 0.028, 0.50);
            handR.set(handSpread, 0.028, 0.50);

            const elbowSpread = isDiamond ? 0.24 : 0.44;
            elbowPoleL.set(-elbowSpread, shoulderCenter.y + 0.18, 0.16);
            elbowPoleR.set(elbowSpread, shoulderCenter.y + 0.18, 0.16);

            footL.set(-0.11, footY, footZ);
            footR.set(0.11, footY, footZ);
            kneePoleL.set(-0.11, (hipsPos.y + footY) * 0.5 + 0.15, (hipsPos.z + footZ) * 0.5);
            kneePoleR.set(0.11, (hipsPos.y + footY) * 0.5 + 0.15, (hipsPos.z + footZ) * 0.5);
            break;
          }

          case 'squat': {
            const isDeadlift = variant === 'hinge' || nameLower.includes('deadlift');
            const depth = p;

            if (isDeadlift) {
              const hipY = 0.92 - 0.15 * depth;
              const hipZ = -0.22 * depth;
              hipsPos.set(0, hipY, hipZ);
              const torsoAngle = 0.88 * depth;
              shoulderCenter.set(
                0,
                hipY + Math.cos(torsoAngle) * TORSO_LEN,
                hipZ + Math.sin(torsoAngle) * TORSO_LEN
              );
              torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
              headLookDir.set(0, -0.25 * depth, 1).normalize();

              const barY = shoulderCenter.y - 0.52;
              const barZ = 0.14;
              barbellGroup.visible = true;
              barbellGroup.position.set(0, barY, barZ);
              handL.set(-0.26, barY, barZ);
              handR.set(0.26, barY, barZ);
              elbowPoleL.set(-0.36, barY + 0.26, -0.12);
              elbowPoleR.set(0.36, barY + 0.26, -0.12);

              footL.set(-0.15, 0.075, 0);
              footR.set(0.15, 0.075, 0);
              kneePoleL.set(-0.16, 0.50, 0.36);
              kneePoleR.set(0.16, 0.50, 0.36);
            } else {
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
              const armSwingAngle = depth * (Math.PI * 0.49); // 0 rad (down at sides) to ~88 deg (parallel forward horizontal)
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

              // Keep elbow pole strictly in the sagittal plane below/behind the arm so elbows never flare outward
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
            }
            break;
          }

          case 'pullup': {
            pullupRigGroup.visible = true;
            const pull = p;

            // Body hangs beneath bar (y=2.10, z=0) and pulls up with slight thoracic arch behind bar
            // so the chin clears the bar cleanly without the head intersecting the crossbar
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
            break;
          }

          case 'lunge': {
            const depth = p;
            const hipY = 0.90 - 0.25 * depth;
            hipsPos.set(0, hipY, 0);
            shoulderCenter.set(0, hipY + TORSO_LEN, 0.03 * depth);
            torsoAnterior.set(0, -0.05 * depth, 1).normalize();
            headLookDir.set(0, 0, 1);

            footL.set(-0.14, 0.075, 0.38);
            footR.set(0.14, 0.085, -0.44);
            // Both knee poles point distinctly forward (+Z) so rear knee bends anatomically forward/down
            kneePoleL.set(-0.16, 0.48, 0.85);
            kneePoleR.set(0.16, 0.12, 0.25);

            handL.set(-0.23, hipY + 0.06, 0.05);
            handR.set(0.23, hipY + 0.06, 0.05);
            elbowPoleL.set(-0.34, hipY + 0.28, -0.20);
            elbowPoleR.set(0.34, hipY + 0.28, -0.20);
            break;
          }

          case 'plank':
          case 'mountain_climber':
          case 'crunch':
          case 'glute_bridge': {
            if (clip === 'crunch' || clip === 'glute_bridge') {
              const lift = p;
              const isBridge = clip === 'glute_bridge';
              hipsPos.set(0, isBridge ? 0.14 + 0.22 * lift : 0.12, -0.10);
              shoulderCenter.set(
                0,
                isBridge ? 0.14 : 0.14 + 0.20 * lift,
                isBridge ? 0.44 : 0.38 - 0.08 * lift
              );
              torsoAnterior.set(0, 1, isBridge ? 0.2 * lift : -0.35 * lift).normalize();
              headLookDir.set(0, 0.85, -0.5).normalize();

              handL.set(
                -0.22,
                isBridge ? 0.04 : shoulderCenter.y + 0.10,
                isBridge ? 0.0 : shoulderCenter.z + 0.06
              );
              handR.set(
                0.22,
                isBridge ? 0.04 : shoulderCenter.y + 0.10,
                isBridge ? 0.0 : shoulderCenter.z + 0.06
              );
              elbowPoleL.set(-0.42, shoulderCenter.y + 0.05, shoulderCenter.z - 0.10);
              elbowPoleR.set(0.42, shoulderCenter.y + 0.05, shoulderCenter.z - 0.10);

              footL.set(-0.14, 0.075, -0.68);
              footR.set(0.14, 0.075, -0.68);
              kneePoleL.set(-0.16, 0.52, -0.38);
              kneePoleR.set(0.16, 0.52, -0.38);
            } else {
              const isClimber = clip === 'mountain_climber';
              const plankAngle = 16 * (Math.PI / 180);
              const footY = 0.095;
              const footZ = -0.84;
              const legDist = 0.818;
              const hipY = footY + legDist * Math.sin(plankAngle);
              const hipZ = footZ + legDist * Math.cos(plankAngle);
              const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
              const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

              hipsPos.set(0, hipY, hipZ);
              shoulderCenter.set(0, chestY, chestZ);
              torsoAnterior.set(0, -1, 0.18).normalize();
              headLookDir.set(0, -0.52, 0.85).normalize();

              handL.set(-0.22, 0.028, 0.50);
              handR.set(0.22, 0.028, 0.50);
              elbowPoleL.set(-0.34, chestY + 0.10, 0.25);
              elbowPoleR.set(0.34, chestY + 0.10, 0.25);

              footL.set(
                -0.12,
                footY + (isClimber ? 0.12 * p : 0),
                footZ + (isClimber ? 0.36 * p : 0)
              );
              footR.set(
                0.12,
                footY + (isClimber ? 0.12 * (1 - p) : 0),
                footZ + (isClimber ? 0.36 * (1 - p) : 0)
              );
              kneePoleL.set(-0.12, hipY + 0.12, (hipZ + footL.z) * 0.5);
              kneePoleR.set(0.12, hipY + 0.12, (hipZ + footR.z) * 0.5);
            }
            break;
          }

          case 'stretch_flow': {
            if (variant === 'curl') {
              // Bicep Curls: Upper arms stay pinned vertically at the sides of the ribcage!
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0, 1);

              const isBarbellCurl = nameLower.includes('barbell') || nameLower.includes('ez bar');
              const flexAngle = 0.20 + p * 2.05; // 11 deg to 129 deg flexion
              const eL = new THREE.Vector3(-0.22, 1.15, 0.02);
              const eR = new THREE.Vector3(0.22, 1.15, 0.02);
              directElbowL = eL;
              directElbowR = eR;

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
                if (nameLower.includes('hammer')) {
                  dumbbellL.rotation.set(0, Math.PI / 2, 0);
                  dumbbellR.rotation.set(0, Math.PI / 2, 0);
                }
              }
            } else if (variant === 'tricep_ext') {
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0, 1);
              dumbbellL.visible = true;
              dumbbellR.visible = true;

              if (nameLower.includes('overhead') || nameLower.includes('skull')) {
                // Overhead Tricep Extension: elbows high, forearms extend overhead
                const eL = new THREE.Vector3(-0.18, 1.72, 0.06);
                const eR = new THREE.Vector3(0.18, 1.72, 0.06);
                directElbowL = eL;
                directElbowR = eR;
                const extAngle = -0.75 + p * 2.15;
                const handY = eL.y + Math.sin(extAngle) * FOREARM_LEN;
                const handZ = eL.z - Math.cos(extAngle) * FOREARM_LEN;
                handL.set(-0.16, handY, handZ);
                handR.set(0.16, handY, handZ);
              } else {
                // Tricep Pushdown / Rope Pushdown: elbows pinned at sides, forearms extend down
                const eL = new THREE.Vector3(-0.22, 1.15, 0.03);
                const eR = new THREE.Vector3(0.22, 1.15, 0.03);
                directElbowL = eL;
                directElbowR = eR;
                const extAngle = 1.65 - p * 1.45; // 95 deg flexion down to 11 deg lockout
                const handY = eL.y - Math.cos(extAngle) * FOREARM_LEN;
                const handZ = eL.z + Math.sin(extAngle) * FOREARM_LEN;
                handL.set(-0.22, handY, handZ);
                handR.set(0.22, handY, handZ);
              }
              dumbbellL.position.copy(handL);
              dumbbellR.position.copy(handR);
            } else if (variant === 'overhead_push') {
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0.06, 1).normalize();

              const sL = new THREE.Vector3(-0.195, 1.445, 0);
              const sR = new THREE.Vector3(0.195, 1.445, 0);

              if (nameLower.includes('lateral')) {
                // Lateral Raises: Long, graceful 0.53m reach abducting in scapular plane with elbows leading on top!
                dumbbellL.visible = true;
                dumbbellR.visible = true;
                const abdAngle = (12 + 76 * p) * (Math.PI / 180); // 12 deg at thigh to 88 deg at shoulder height
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
                // Elbow pole ABOVE and slightly behind the arm so elbows lead naturally and never fold inward!
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
                // Orient dumbbell handle along Z (front-to-back in hand) during lateral abduction
                dumbbellL.rotation.set(0, Math.PI / 2, 0);
                dumbbellR.rotation.set(0, Math.PI / 2, 0);
              } else if (nameLower.includes('front')) {
                // Front Raises: Long 0.53m reach raising forward in sagittal plane
                dumbbellL.visible = true;
                dumbbellR.visible = true;
                const flxAngle = (10 + 80 * p) * (Math.PI / 180);
                const reach = 0.53;
                handL.set(sL.x, sL.y - Math.cos(flxAngle) * reach, Math.sin(flxAngle) * reach + 0.04);
                handR.set(sR.x, sR.y - Math.cos(flxAngle) * reach, Math.sin(flxAngle) * reach + 0.04);
                elbowPoleL.set(-0.34, sL.y - Math.cos(flxAngle) * 0.26, Math.sin(flxAngle) * 0.26 - 0.16);
                elbowPoleR.set(0.34, sR.y - Math.cos(flxAngle) * 0.26, Math.sin(flxAngle) * 0.26 - 0.16);
                dumbbellL.position.copy(handL);
                dumbbellR.position.copy(handR);
              } else {
                // Overhead Barbell Press
                const barY = 1.48 + 0.48 * p;
                const barZ = 0.14 - 0.10 * p;
                barbellGroup.visible = true;
                barbellGroup.position.set(0, barY, barZ);
                handL.set(-0.30, barY, barZ);
                handR.set(0.30, barY, barZ);
                elbowPoleL.set(-0.46, 1.18, 0.20);
                elbowPoleR.set(0.46, 1.18, 0.20);
              }
            } else if (variant === 'row_pull') {
              const hipY = 0.86;
              const hipZ = -0.14;
              hipsPos.set(0, hipY, hipZ);
              const torsoAngle = 0.62;
              shoulderCenter.set(
                0,
                hipY + Math.cos(torsoAngle) * TORSO_LEN,
                hipZ + Math.sin(torsoAngle) * TORSO_LEN
              );
              torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
              headLookDir.set(0, -0.22, 0.97).normalize();

              const barY = 0.60 + 0.26 * p;
              const barZ = 0.24 - 0.12 * p;
              barbellGroup.visible = true;
              barbellGroup.position.set(0, barY, barZ);
              handL.set(-0.28, barY, barZ);
              handR.set(0.28, barY, barZ);
              elbowPoleL.set(-0.42, shoulderCenter.y + 0.15, hipZ - 0.28);
              elbowPoleR.set(0.42, shoulderCenter.y + 0.15, hipZ - 0.28);
            } else {
              // Full-Body Stretching / Chest Fly
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0, 1);
              const sL = new THREE.Vector3(-0.195, 1.445, 0);
              const sR = new THREE.Vector3(0.195, 1.445, 0);
              const abdAngle = (25 + 65 * p) * (Math.PI / 180);
              const reach = 0.53;
              handL.set(sL.x - Math.sin(abdAngle) * reach, sL.y - Math.cos(abdAngle) * reach, 0.14);
              handR.set(sR.x + Math.sin(abdAngle) * reach, sR.y - Math.cos(abdAngle) * reach, 0.14);
              elbowPoleL.set(-0.40, 1.15, -0.18);
              elbowPoleR.set(0.40, 1.15, -0.18);
            }

            footL.set(-0.15, 0.075, 0);
            footR.set(0.15, 0.075, 0);
            kneePoleL.set(-0.16, 0.52, 0.45);
            kneePoleR.set(0.16, 0.52, 0.45);
            break;
          }

          case 'burpee':
          case 'jog':
          case 'idle':
          default: {
            const bounce = clip === 'jog' || clip === 'burpee' ? 0.06 * p : 0.015 * p;
            hipsPos.set(0, 0.94 + bounce, 0);
            shoulderCenter.set(0, 0.94 + TORSO_LEN + bounce, 0);
            torsoAnterior.set(0, 0, 1);
            headLookDir.set(0, 0, 1);

            const armSwing = clip === 'jog' ? 0.28 * (p - 0.5) : 0.04 * p;
            handL.set(-0.23, 0.78 + bounce + 0.12 * p, 0.08 + armSwing);
            handR.set(0.23, 0.78 + bounce + 0.12 * p, 0.08 - armSwing);
            elbowPoleL.set(-0.34, 1.15, -0.22);
            elbowPoleR.set(0.34, 1.15, -0.22);

            footL.set(-0.15, 0.075 + (clip === 'jog' ? 0.10 * p : 0), 0);
            footR.set(0.15, 0.075 + (clip === 'jog' ? 0.10 * (1 - p) : 0), 0);
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
          // Subtle anatomical lumbar/thoracic curve above the hips
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
        .addScaledVector(torsoUp, -0.055);
      const shoulderR = shoulderCenter
        .clone()
        .addScaledVector(torsoRight, 0.192)
        .addScaledVector(torsoUp, -0.055);

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
        clip === 'pushup' ||
        clip === 'diamond_pushup' ||
        clip === 'plank' ||
        clip === 'mountain_climber';

      const handTipL = isGroundPalm
        ? handL.clone().add(new THREE.Vector3(0, 0.005, 0.075))
        : handL.clone().addScaledVector(forearmDirL, HAND_LEN);
      const handTipR = isGroundPalm
        ? handR.clone().add(new THREE.Vector3(0, 0.005, 0.075))
        : handR.clone().addScaledVector(forearmDirR, HAND_LEN);

      armL.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          0.48,
          0.08,
          shoulderL,
          elbowL,
          handTipL,
          torsoAnterior,
          torsoAnterior,
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
          torsoAnterior,
          torsoAnterior,
          -0.008,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      // 4. Solve Leg IK & Deform Continuous Skinned Left/Right Legs (Hip s=0 -> Knee s=0.51 -> Ankle s=1.0)
      const kneeL = solveTwoBoneIK(hipL, footL, THIGH_LEN, CALF_LEN, kneePoleL);
      const kneeR = solveTwoBoneIK(hipR, footR, THIGH_LEN, CALF_LEN, kneePoleR);

      const legAntL = new THREE.Vector3().subVectors(kneePoleL, hipL).normalize();
      const legAntR = new THREE.Vector3().subVectors(kneePoleR, hipR).normalize();

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

      // 5. Position & Orient Shoes at Ankles (`footL`, `footR`)
      shoeL.position.copy(footL);
      shoeR.position.copy(footR);
      if (isGroundPalm) {
        shoeL.rotation.set(Math.PI / 3.2, 0, 0);
        shoeR.rotation.set(Math.PI / 3.2, 0, 0);
      } else {
        shoeL.rotation.set(0, 0, 0);
        shoeR.rotation.set(0, 0, 0);
      }
    };

    sceneRef.current = {
      camera,
      controls,
      updateMuscleMaterials,
      applyCameraPreset,
    };

    if (onReady) {
      onReady();
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

      applyProceduralPose(st.clipName, st.biomechanicalVariant, st.exerciseName, frameFloat);
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
          const { pos, target } = computeCameraView(v.preset, st.clipName);
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
        <div className="px-2.5 py-1 rounded-lg bg-[#0B1324]/85 backdrop-blur-md border border-sky-500/25 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          <span
            ref={frameBadgeRef}
            className="text-[10px] font-mono font-bold text-sky-300 tracking-wider"
          >
            FRAME 00 / 60 · 30 FPS
          </span>
        </div>
        {bpSpec && (
          <div className="hidden sm:flex px-2.5 py-1 rounded-lg bg-[#0B1324]/85 backdrop-blur-md border border-white/10 items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-300">
              180 cm · 70 kg · IK Rig
            </span>
          </div>
        )}
      </div>

      {/* Minimal Top-Right Muscle Status Pill */}
      <div className="pointer-events-none absolute top-3 right-3 hidden sm:flex items-center gap-2">
        <div className="px-2.5 py-1 rounded-lg bg-[#0B1324]/85 backdrop-blur-md border border-red-500/30 flex items-center gap-1.5">
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

export default TrainerStudio3D;
