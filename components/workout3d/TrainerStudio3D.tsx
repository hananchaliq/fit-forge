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
 * between `rootPos` (shoulder/hip) and `endPos` (hand/ankle), oriented toward `polePos`.
 */
function solveTwoBoneIK(
  rootPos: THREE.Vector3,
  endPos: THREE.Vector3,
  len1: number,
  len2: number,
  polePos: THREE.Vector3
): THREE.Vector3 {
  const diff = new THREE.Vector3().subVectors(endPos, rootPos);
  const distSq = diff.lengthSq();
  const minDist = Math.abs(len1 - len2) + 0.004;
  const maxDist = len1 + len2 - 0.002;
  const rawDist = Math.sqrt(distSq);
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
 * Orthonormal basis alignment for a bone mesh whose local +Y runs from `originPos` (s=0)
 * to `targetEndPos` (s=1) and whose local +Z faces `anteriorDir`.
 */
function alignBoneUpForward(
  obj: THREE.Object3D,
  originPos: THREE.Vector3,
  targetEndPos: THREE.Vector3,
  anteriorDir: THREE.Vector3
) {
  obj.position.copy(originPos);
  const yAxis = new THREE.Vector3().subVectors(targetEndPos, originPos);
  if (yAxis.lengthSq() < 1e-6) {
    yAxis.set(0, 1, 0);
  } else {
    yAxis.normalize();
  }

  const xAxis = new THREE.Vector3().crossVectors(yAxis, anteriorDir);
  if (xAxis.lengthSq() < 1e-6) {
    const fallback =
      Math.abs(yAxis.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    xAxis.crossVectors(yAxis, fallback);
  }
  xAxis.normalize();

  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  const rotMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  obj.quaternion.setFromRotationMatrix(rotMat);
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
    rx: Math.max(0.002, catmullRom(s0.rx, s1.rx, s2.rx, s3.rx, localT)),
    rzAnt: Math.max(0.002, catmullRom(s0.rzAnt, s1.rzAnt, s2.rzAnt, s3.rzAnt, localT)),
    rzPost: Math.max(0.002, catmullRom(s0.rzPost, s1.rzPost, s2.rzPost, s3.rzPost, localT)),
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

function createSculptedLoftGeometry(
  length: number,
  sections: LoftSection[],
  radialSegs: number,
  heightSegs: number,
  sculptFn: (
    s: number,
    theta: number,
    nx: number,
    nz: number,
    pos: { x: number; y: number; z: number }
  ) => void,
  groupFn: (s: number, nx: number, nz: number) => number,
  vertexShadeFn?: (s: number, nx: number, nz: number, matGroup: number) => [number, number, number]
): THREE.BufferGeometry {
  const numCols = radialSegs + 1;
  const numRows = heightSegs + 1;
  const positions = new Float32Array(numRows * numCols * 3);
  const colors = new Float32Array(numRows * numCols * 3);
  const uvs = new Float32Array(numRows * numCols * 2);

  for (let r = 0; r < numRows; r++) {
    const s = r / heightSegs;
    const sec = sampleSections(sections, s);
    const y = s * length;

    for (let c = 0; c < numCols; c++) {
      const u = c / radialSegs;
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

      const vIdx = (r * numCols + c) * 3;
      positions[vIdx] = pt.x;
      positions[vIdx + 1] = pt.y;
      positions[vIdx + 2] = pt.z;

      const matG = groupFn(s, nx, nz);
      const [cr, cg, cb] = vertexShadeFn ? vertexShadeFn(s, nx, nz, matG) : [1, 1, 1];
      colors[vIdx] = cr;
      colors[vIdx + 1] = cg;
      colors[vIdx + 2] = cb;

      const uvIdx = (r * numCols + c) * 2;
      uvs[uvIdx] = u;
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
      list.push(a, b, d, b, e, d);
    }
  }

  const allIndices: number[] = [];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
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
  normAttr.needsUpdate = true;

  return geo;
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

    // Studio Blueprint Lighting — sculpted dramatic contrast matching reference_blueprint.png
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.42);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x090d16, 0.45);
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

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(0, 3.2, -3.2);
    scene.add(rimLight);

    // Blueprint Floor & Architectural Grid
    const floorGeo = new THREE.CircleGeometry(6.5, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x091122,
      roughness: 0.86,
      metalness: 0.14,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(6.0, 24, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0.002;
    scene.add(gridHelper);

    const ringGeo = new THREE.RingGeometry(0.95, 0.975, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xea580c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    scene.add(ring);

    // Base Materials (vertexColors enabled for anatomical muscle definition & grooves)
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x9aa6b8,
      roughness: 0.46,
      metalness: 0.14,
      vertexColors: true,
    });

    const shortsMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.78,
      metalness: 0.06,
      vertexColors: true,
    });

    const trimWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.42,
      metalness: 0.1,
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
        roughness: 0.46,
        metalness: 0.14,
        vertexColors: true,
      });
    });

    // Shorts-aware glute material: stays black shorts when glutes are inactive, glows Crimson when active
    const shortsGlutesMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.78,
      metalness: 0.06,
      vertexColors: true,
    });

    // ============================================================================
    // ANATOMICAL LOFTS (180cm / 70kg Athletic Male Proportions)
    // ============================================================================
    const TORSO_LEN = 0.56;
    const HEAD_NECK_LEN = 0.25;
    const UPPER_ARM_LEN = 0.30;
    const FOREARM_LEN = 0.27;
    const THIGH_LEN = 0.43;
    const CALF_LEN = 0.41;

    // 1. CONTINUOUS SCULPTED TORSO (Pelvis + Shorts + 6-Pack Abs + Pectorals + Lats + Traps)
    function buildTorsoMesh(): THREE.Mesh {
      const sections: LoftSection[] = [
        { s: 0.0, rx: 0.142, rzAnt: 0.095, rzPost: 0.105, pinchCenterZ: 0.015 },
        { s: 0.08, rx: 0.162, rzAnt: 0.106, rzPost: 0.128, pinchCenterZ: 0.024 },
        { s: 0.19, rx: 0.152, rzAnt: 0.102, rzPost: 0.112, pinchCenterZ: 0.012 },
        { s: 0.30, rx: 0.138, rzAnt: 0.098, rzPost: 0.098, pinchCenterZ: 0.010 },
        { s: 0.45, rx: 0.150, rzAnt: 0.106, rzPost: 0.106, pinchCenterZ: 0.012 },
        { s: 0.62, rx: 0.176, rzAnt: 0.124, rzPost: 0.118, pinchCenterZ: 0.018 },
        { s: 0.76, rx: 0.196, rzAnt: 0.132, rzPost: 0.122, pinchCenterZ: 0.022 },
        { s: 0.87, rx: 0.205, rzAnt: 0.112, rzPost: 0.108, pinchCenterZ: 0.008 },
        { s: 0.95, rx: 0.112, rzAnt: 0.080, rzPost: 0.082, pinchCenterZ: 0.002 },
        { s: 1.0, rx: 0.062, rzAnt: 0.060, rzPost: 0.062, pinchCenterZ: 0.0 },
      ];

      // Groups: 0: skin, 1: shorts, 2: trimWhite, 3: chest, 4: abs, 5: back_lats, 6: shoulders, 7: glutes(shorts)
      const groupFn = (s: number, nx: number, nz: number): number => {
        const absX = Math.abs(nx);
        const isAnt = nz >= 0;

        if (s < 0.22) {
          if (s >= 0.20 && s < 0.22) return 2;
          if (absX > 0.93) return 2;
          if (!isAnt && s < 0.19 && absX > 0.14 && absX < 0.90) return 7;
          return 1;
        }

        if (s >= 0.76 && s <= 0.93 && absX > 0.72) {
          return 6; // shoulders
        }
        if (isAnt && s >= 0.56 && s <= 0.86 && absX >= 0.05 && absX <= 0.82 && nz > 0.20) {
          return 3; // chest
        }
        if (isAnt && s >= 0.23 && s < 0.56 && absX <= 0.68 && nz > 0.26) {
          return 4; // abs
        }
        if (!isAnt && s >= 0.30 && s <= 0.88 && absX >= 0.06 && nz < -0.15) {
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

        if (nz > 0.15 && s > 0.55 && s < 0.87 && absX > 0.05 && absX < 0.84) {
          const pecS = Math.sin(((s - 0.55) / 0.32) * Math.PI);
          const pecX = Math.sin(((absX - 0.05) / 0.79) * Math.PI);
          const lowerShelf = s < 0.65 ? Math.sin(((s - 0.55) / 0.10) * (Math.PI * 0.5)) : 1.0;
          pos.z += 0.022 * pecS * pecX * lowerShelf * nz;
        }

        if (nz > 0.32 && s > 0.24 && s < 0.55 && absX > 0.05 && absX < 0.45) {
          const rowPhase = ((s - 0.24) / 0.31) * 3 * Math.PI;
          const abRow = Math.pow(Math.max(0, Math.sin(rowPhase)), 0.75);
          const abCol = Math.sin(((absX - 0.05) / 0.40) * Math.PI);
          pos.z += 0.012 * abRow * abCol * nz;
        }

        if (nz > -0.1 && nz < 0.65 && s > 0.32 && s < 0.62 && absX > 0.55 && absX < 0.92) {
          const ribWave = Math.max(0, Math.sin(((s - 0.32) / 0.30) * 4 * Math.PI));
          pos.x += (nx > 0 ? 1 : -1) * 0.005 * ribWave;
        }

        if (nz < -0.15 && s > 0.32 && s < 0.86) {
          if (absX > 0.12 && absX < 0.88) {
            const latS = Math.sin(((s - 0.32) / 0.54) * Math.PI);
            const latX = Math.sin(((absX - 0.12) / 0.76) * Math.PI);
            pos.z -= 0.018 * latS * latX * -nz;
            pos.x += (nx > 0 ? 1 : -1) * 0.010 * latS * latX;
          }
        }

        if (nz < -0.2 && s > 0.02 && s < 0.19 && absX > 0.12 && absX < 0.86) {
          const gluteS = Math.sin(((s - 0.02) / 0.17) * Math.PI);
          const gluteX = Math.sin(((absX - 0.12) / 0.74) * Math.PI);
          pos.z -= 0.020 * gluteS * gluteX * -nz;
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number,
        matGroup: number
      ): [number, number, number] => {
        const absX = Math.abs(nx);
        let shade = 0.92;

        if (nz > 0.25 && absX < 0.09 && s > 0.24 && s < 0.86) {
          shade -= 0.28 * (1 - absX / 0.09);
        }
        if (nz > 0.25 && s > 0.54 && s < 0.60 && absX > 0.08 && absX < 0.80) {
          const groove = 1 - Math.abs(s - 0.57) / 0.03;
          shade -= 0.30 * Math.max(0, groove);
        }
        if (nz > 0.15 && s > 0.65 && s < 0.88 && absX > 0.70 && absX < 0.80) {
          shade -= 0.22;
        }
        if (nz > 0.30 && s > 0.24 && s < 0.55 && absX < 0.44) {
          for (const gS of [0.33, 0.43, 0.52]) {
            const dist = Math.abs(s - gS);
            if (dist < 0.022) {
              shade -= 0.26 * (1 - dist / 0.022);
            }
          }
          if (absX > 0.38 && absX < 0.46) {
            shade -= 0.24 * (1 - Math.abs(absX - 0.42) / 0.04);
          }
        }
        if (nz > 0.0 && nz < 0.70 && s > 0.36 && s < 0.60 && absX > 0.46 && absX < 0.85) {
          const ribGroove = Math.abs(Math.sin(((s - 0.36) / 0.24) * 3 * Math.PI));
          if (ribGroove < 0.25) shade -= 0.18;
        }
        if (nz < -0.25 && s > 0.25 && s < 0.88) {
          if (absX < 0.10) {
            shade -= 0.26 * (1 - absX / 0.10);
          }
          if (s > 0.60 && s < 0.84 && absX > 0.42 && absX < 0.54) {
            shade -= 0.18;
          }
        }
        if (matGroup === 1 || matGroup === 7) {
          shade = 0.90 + 0.08 * Math.sin(nx * 6);
          if (nz < -0.2 && absX < 0.12) shade -= 0.25;
        }

        const clamped = Math.max(0.48, Math.min(1.06, shade));
        return [clamped, clamped, clamped];
      };

      const geo = createSculptedLoftGeometry(
        TORSO_LEN,
        sections,
        64,
        80,
        sculptFn,
        groupFn,
        vertexShadeFn
      );

      const materials = [
        skinMat,
        shortsMat,
        trimWhiteMat,
        muscleMaterials.chest,
        muscleMaterials.abs,
        muscleMaterials.back_lats,
        muscleMaterials.shoulders,
        shortsGlutesMat,
      ];

      const mesh = new THREE.Mesh(geo, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    // 2. CONTINUOUS SCULPTED HEAD & NECK (Complete 360° Athletic Hair + Facial Features)
    function buildHeadNeckMesh(): THREE.Mesh {
      const sections: LoftSection[] = [
        { s: 0.0, rx: 0.060, rzAnt: 0.058, rzPost: 0.060 },
        { s: 0.18, rx: 0.055, rzAnt: 0.055, rzPost: 0.056 },
        { s: 0.30, rx: 0.058, rzAnt: 0.064, rzPost: 0.060 },
        { s: 0.38, rx: 0.066, rzAnt: 0.092, rzPost: 0.072 },
        { s: 0.52, rx: 0.076, rzAnt: 0.095, rzPost: 0.086 },
        { s: 0.66, rx: 0.079, rzAnt: 0.092, rzPost: 0.092 },
        { s: 0.82, rx: 0.076, rzAnt: 0.086, rzPost: 0.088 },
        { s: 0.94, rx: 0.054, rzAnt: 0.058, rzPost: 0.060 },
        { s: 1.0, rx: 0.002, rzAnt: 0.002, rzPost: 0.002 },
      ];

      const groupFn = (s: number, nx: number, nz: number): number => {
        const absX = Math.abs(nx);
        if (s >= 0.75) return 1;
        if (s >= 0.62 && (nz < 0.38 || absX > 0.72)) return 1;
        if (s >= 0.42 && nz < -0.18) return 1;
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
        if (nz > 0.68 && s > 0.48 && s < 0.66 && absX < 0.22) {
          const noseS = Math.sin(((s - 0.48) / 0.18) * Math.PI);
          const noseX = Math.cos((absX / 0.22) * (Math.PI * 0.5));
          pos.z += 0.017 * noseS * noseX;
        }
        if (nz > 0.55 && s > 0.63 && s < 0.71 && absX < 0.62) {
          pos.z += 0.007 * Math.sin(((s - 0.63) / 0.08) * Math.PI);
        }
        if (nz > 0.55 && s > 0.57 && s < 0.64 && absX > 0.18 && absX < 0.54) {
          pos.z -= 0.006;
        }
        if (nz > 0.35 && s > 0.35 && s < 0.46 && absX < 0.58) {
          pos.z += 0.008 * Math.sin(((s - 0.35) / 0.11) * Math.PI);
        }
        if (absX > 0.90 && Math.abs(nz) < 0.32 && s > 0.50 && s < 0.65) {
          pos.x += (nx > 0 ? 1 : -1) * 0.009 * Math.sin(((s - 0.50) / 0.15) * Math.PI);
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number,
        matGroup: number
      ): [number, number, number] => {
        if (matGroup === 1) {
          return [0.92, 0.94, 0.98];
        }
        const absX = Math.abs(nx);
        let shade = 0.94;
        if (nz > 0.55 && s > 0.58 && s < 0.65 && absX > 0.18 && absX < 0.52) {
          shade -= 0.28;
        }
        if (nz > 0.1 && s > 0.26 && s < 0.36) {
          shade -= 0.22;
        }
        if (nz > 0.65 && s > 0.43 && s < 0.47 && absX < 0.28) {
          shade -= 0.18;
        }
        if (nz > 0.2 && s < 0.26 && absX > 0.25 && absX < 0.45) {
          shade -= 0.14;
        }
        const c = Math.max(0.52, Math.min(1.04, shade));
        return [c, c, c];
      };

      const geo = createSculptedLoftGeometry(
        HEAD_NECK_LEN,
        sections,
        40,
        52,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
      const mesh = new THREE.Mesh(geo, [skinMat, hairMat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    // 3. CONTINUOUS SCULPTED UPPER ARM (Elbow s=0 to Rounded Shoulder Deltoid Cap s=1)
    function buildUpperArmMesh(): THREE.Mesh {
      const sections: LoftSection[] = [
        { s: 0.0, rx: 0.044, rzAnt: 0.044, rzPost: 0.045 },
        { s: 0.18, rx: 0.050, rzAnt: 0.054, rzPost: 0.054 },
        { s: 0.44, rx: 0.058, rzAnt: 0.068, rzPost: 0.064 },
        { s: 0.68, rx: 0.064, rzAnt: 0.068, rzPost: 0.066 },
        { s: 0.85, rx: 0.074, rzAnt: 0.074, rzPost: 0.072 },
        { s: 0.96, rx: 0.056, rzAnt: 0.056, rzPost: 0.056 },
        { s: 1.0, rx: 0.015, rzAnt: 0.015, rzPost: 0.015 },
      ];

      // Groups: 0: skin, 1: biceps, 2: triceps, 3: shoulders
      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s >= 0.68) return 3; // shoulders
        if (s >= 0.14 && s < 0.68) {
          if (nz >= 0.08) return 1; // biceps
          if (nz <= -0.08) return 2; // triceps
        }
        return 0;
      };

      const sculptFn = (
        s: number,
        _theta: number,
        _nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        if (nz > 0.2 && s > 0.20 && s < 0.66) {
          pos.z += 0.010 * Math.sin(((s - 0.20) / 0.46) * Math.PI) * nz;
        }
        if (nz < -0.2 && s > 0.24 && s < 0.68) {
          pos.z -= 0.011 * Math.sin(((s - 0.24) / 0.44) * Math.PI) * -nz;
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number
      ): [number, number, number] => {
        let shade = 0.93;
        if (Math.abs(nz) < 0.16 && s > 0.15 && s < 0.68) {
          shade -= 0.22 * (1 - Math.abs(nz) / 0.16);
        }
        if (s > 0.65 && s < 0.72 && Math.abs(nx) > 0.3) {
          shade -= 0.18;
        }
        const c = Math.max(0.52, Math.min(1.04, shade));
        return [c, c, c];
      };

      const geo = createSculptedLoftGeometry(
        UPPER_ARM_LEN + 0.025,
        sections,
        32,
        44,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
      const mesh = new THREE.Mesh(geo, [
        skinMat,
        muscleMaterials.biceps,
        muscleMaterials.triceps,
        muscleMaterials.shoulders,
      ]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    // 4. CONTINUOUS SCULPTED FOREARM & HAND (Wrist s=0 to Rounded Elbow Cap s=1)
    function buildForearmMesh(isLeft: boolean): THREE.Group {
      const group = new THREE.Group();
      const sections: LoftSection[] = [
        { s: 0.0, rx: 0.030, rzAnt: 0.024, rzPost: 0.024 },
        { s: 0.22, rx: 0.034, rzAnt: 0.030, rzPost: 0.030 },
        { s: 0.62, rx: 0.045, rzAnt: 0.043, rzPost: 0.043 },
        { s: 0.88, rx: 0.045, rzAnt: 0.044, rzPost: 0.045 },
        { s: 1.0, rx: 0.020, rzAnt: 0.020, rzPost: 0.024 },
      ];

      const groupFn = (s: number): number => (s >= 0.16 && s <= 0.88 ? 1 : 0);

      const sculptFn = (
        s: number,
        _theta: number,
        nx: number,
        _nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        if (s > 0.38 && s < 0.86) {
          pos.x += nx * 0.005 * Math.sin(((s - 0.38) / 0.48) * Math.PI);
        }
      };

      const geo = createSculptedLoftGeometry(FOREARM_LEN + 0.015, sections, 28, 36, sculptFn, groupFn);
      const mesh = new THREE.Mesh(geo, [skinMat, muscleMaterials.forearms]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const handGroup = new THREE.Group();
      handGroup.name = 'wrist_hand';
      const palmGeo = new THREE.BoxGeometry(0.072, 0.078, 0.026);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.position.set(0, -0.036, 0);
      palm.castShadow = true;
      handGroup.add(palm);

      for (let f = 0; f < 4; f++) {
        const fGeo = new THREE.CapsuleGeometry(0.0072, 0.040, 8, 8);
        const finger = new THREE.Mesh(fGeo, skinMat);
        finger.position.set(-0.024 + f * 0.016, -0.084, 0.003);
        handGroup.add(finger);
      }
      const thumbGeo = new THREE.CapsuleGeometry(0.0085, 0.032, 8, 8);
      const thumb = new THREE.Mesh(thumbGeo, skinMat);
      const sideSign = isLeft ? -1 : 1;
      thumb.position.set(sideSign * 0.040, -0.042, 0.012);
      thumb.rotation.z = sideSign * 0.48;
      handGroup.add(thumb);

      group.add(handGroup);
      return group;
    }

    // 5. CONTINUOUS SCULPTED THIGH (Knee s=0 to Hip Socket s=1)
    function buildThighMesh(): THREE.Mesh {
      const sections: LoftSection[] = [
        { s: 0.0, rx: 0.058, rzAnt: 0.058, rzPost: 0.058 },
        { s: 0.16, rx: 0.070, rzAnt: 0.072, rzPost: 0.068 },
        { s: 0.45, rx: 0.088, rzAnt: 0.092, rzPost: 0.088 },
        { s: 0.72, rx: 0.098, rzAnt: 0.098, rzPost: 0.098 },
        { s: 0.92, rx: 0.102, rzAnt: 0.096, rzPost: 0.102 },
        { s: 1.0, rx: 0.065, rzAnt: 0.065, rzPost: 0.065 },
      ];

      // Groups: 0: skin, 1: shorts, 2: trimWhite, 3: quads, 4: hamstrings
      const groupFn = (s: number, nx: number, nz: number): number => {
        const absX = Math.abs(nx);
        if (s >= 0.56) {
          if (s < 0.585) return 2;
          if (absX > 0.93) return 2;
          return 1;
        }
        if (s >= 0.10 && s < 0.56) {
          if (nz >= 0.06) return 3; // quads
          if (nz <= -0.06) return 4; // hamstrings
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
        if (nz > 0.15 && s > 0.12 && s < 0.78) {
          const quadProfile = Math.sin(((s - 0.12) / 0.66) * Math.PI);
          pos.z += 0.015 * quadProfile * nz;
          pos.x += nx * 0.008 * quadProfile;
        }
        if (nz < -0.15 && s > 0.18 && s < 0.78) {
          pos.z -= 0.013 * Math.sin(((s - 0.18) / 0.60) * Math.PI) * -nz;
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number,
        matGroup: number
      ): [number, number, number] => {
        if (matGroup === 1) return [0.92, 0.92, 0.94];
        const absX = Math.abs(nx);
        let shade = 0.94;
        if (nz > 0.35 && s > 0.14 && s < 0.55) {
          if (absX > 0.32 && absX < 0.44) {
            shade -= 0.22 * (1 - Math.abs(absX - 0.38) / 0.06);
          }
        }
        if (Math.abs(nz) < 0.16 && s > 0.12 && s < 0.55) {
          shade -= 0.20;
        }
        const c = Math.max(0.52, Math.min(1.04, shade));
        return [c, c, c];
      };

      const geo = createSculptedLoftGeometry(
        THIGH_LEN + 0.02,
        sections,
        36,
        48,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
      const mesh = new THREE.Mesh(geo, [
        skinMat,
        shortsMat,
        trimWhiteMat,
        muscleMaterials.quads,
        muscleMaterials.hamstrings,
      ]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    // 6. CONTINUOUS SCULPTED CALF & SHOE (Ankle s=0 to Patella Knee Cap s=1)
    function buildCalfMesh(): THREE.Group {
      const group = new THREE.Group();
      const sections: LoftSection[] = [
        { s: 0.0, rx: 0.036, rzAnt: 0.038, rzPost: 0.040 },
        { s: 0.24, rx: 0.042, rzAnt: 0.044, rzPost: 0.046 },
        { s: 0.62, rx: 0.060, rzAnt: 0.054, rzPost: 0.072 },
        { s: 0.88, rx: 0.058, rzAnt: 0.058, rzPost: 0.058 },
        { s: 1.0, rx: 0.032, rzAnt: 0.036, rzPost: 0.030 },
      ];

      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s >= 0.34 && s <= 0.84 && nz < 0.12) return 1; // calves
        return 0;
      };

      const sculptFn = (
        s: number,
        _theta: number,
        _nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        if (nz < -0.15 && s > 0.36 && s < 0.84) {
          pos.z -= 0.015 * Math.sin(((s - 0.36) / 0.48) * Math.PI) * -nz;
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number
      ): [number, number, number] => {
        let shade = 0.94;
        if (nz < -0.4 && s > 0.45 && s < 0.80 && Math.abs(nx) < 0.12) {
          shade -= 0.20;
        }
        const c = Math.max(0.55, Math.min(1.04, shade));
        return [c, c, c];
      };

      const geo = createSculptedLoftGeometry(
        CALF_LEN + 0.018,
        sections,
        32,
        44,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
      const mesh = new THREE.Mesh(geo, [skinMat, muscleMaterials.calves]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const shoeGroup = new THREE.Group();
      shoeGroup.name = 'ankle_shoe';

      const sockGeo = new THREE.CylinderGeometry(0.039, 0.041, 0.045, 20);
      const sock = new THREE.Mesh(sockGeo, trimWhiteMat);
      sock.position.set(0, 0.015, 0);
      shoeGroup.add(sock);

      const upperShoeGeo = new THREE.CapsuleGeometry(0.046, 0.125, 12, 16);
      const upperShoe = new THREE.Mesh(upperShoeGeo, shoeDarkMat);
      upperShoe.rotation.x = Math.PI / 2;
      upperShoe.scale.set(1.02, 1.0, 0.78);
      upperShoe.position.set(0, -0.042, 0.048);
      upperShoe.castShadow = true;
      shoeGroup.add(upperShoe);

      const soleGeo = new THREE.CapsuleGeometry(0.049, 0.138, 10, 16);
      const sole = new THREE.Mesh(soleGeo, trimWhiteMat);
      sole.rotation.x = Math.PI / 2;
      sole.scale.set(1.06, 1.0, 0.36);
      sole.position.set(0, -0.074, 0.050);
      sole.castShadow = true;
      shoeGroup.add(sole);

      group.add(shoeGroup);
      return group;
    }

    // Assemble Character Root
    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    const torsoMesh = buildTorsoMesh();
    const headNeckMesh = buildHeadNeckMesh();
    const upperArmL = buildUpperArmMesh();
    const upperArmR = buildUpperArmMesh();
    const forearmL = buildForearmMesh(true);
    const forearmR = buildForearmMesh(false);
    const thighL = buildThighMesh();
    const thighR = buildThighMesh();
    const calfL = buildCalfMesh();
    const calfR = buildCalfMesh();

    characterRoot.add(
      torsoMesh,
      headNeckMesh,
      upperArmL,
      upperArmR,
      forearmL,
      forearmR,
      thighL,
      thighR,
      calfL,
      calfR
    );

    // ============================================================================
    // GYM EQUIPMENT PROPS (Pull-Up Bar `bar_ref`, Bench, Barbell, Dumbbells)
    // ============================================================================
    const equipmentRoot = new THREE.Group();
    scene.add(equipmentRoot);

    // 1. Fixed Overhead Pull-Up Bar Rig (`bar_ref` at Y = 2.10m)
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

    // 2. Weight Bench
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

    // 3. Barbell
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

    // 4. Dumbbells
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
          // Primary Active Muscle -> Rich Blueprint Crimson Red (#DC2626)
          mat.color.setHex(0xdc2626);
          mat.emissive.setHex(0x991b1b);
          mat.emissiveIntensity = 0.32;
          mat.roughness = 0.36;
          mat.metalness = 0.12;
        } else if (sec.includes(id)) {
          // Secondary Active Muscle -> Blueprint Coral Red (#EA580C)
          mat.color.setHex(0xea580c);
          mat.emissive.setHex(0x9a3412);
          mat.emissiveIntensity = 0.22;
          mat.roughness = 0.42;
          mat.metalness = 0.12;
        } else {
          // Inactive -> Athletic Slate Skin (#9AA6B8)
          mat.color.setHex(0x9aa6b8);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
          mat.roughness = 0.46;
          mat.metalness = 0.14;
        }
        mat.needsUpdate = true;
      });

      // Update shortsGlutesMat so glutes stay black shorts when inactive, and glow Crimson when active
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
        const target = new THREE.Vector3(0, 0.34, -0.12);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 0.80, 1.95), target };
          case 'side':
            return { pos: new THREE.Vector3(2.25, 0.68, -0.12), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 0.85, -2.15), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 2.65, -0.12), target };
        }
      }

      if (isHanging) {
        const target = new THREE.Vector3(0, 1.34, 0);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 1.38, 3.35), target };
          case 'side':
            return { pos: new THREE.Vector3(3.25, 1.38, 0), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 1.38, -3.35), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 3.65, 0.05), target };
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
    // BIOMECHANICAL IK POSE ENGINE (Blueprint 30 FPS / 60 Frames)
    // ============================================================================
    const applyProceduralPose = (
      clip: AnimationClipName,
      variant: string,
      exName: string,
      frame: number
    ) => {
      // Smooth cosine interpolation:
      // Frame 0 = Start (p=0), Frame 15 = Mid (p=0.5), Frame 30 = Peak/Bottom (p=1.0), Frame 45 = Mid (p=0.5), Frame 60 = Return (p=0)
      const norm = (frame % 60) / 60;
      const p = 0.5 - 0.5 * Math.cos(norm * Math.PI * 2);

      pullupRigGroup.visible = false;
      benchGroup.visible = false;
      barbellGroup.visible = false;
      dumbbellL.visible = false;
      dumbbellR.visible = false;

      const hipsPos = new THREE.Vector3(0, 0.95, 0);
      const shoulderCenter = new THREE.Vector3(0, 1.48, 0);
      const torsoAnterior = new THREE.Vector3(0, 0, 1);
      const headLookDir = new THREE.Vector3(0, 0, 1);

      const handL = new THREE.Vector3(-0.24, 0.78, 0.08);
      const handR = new THREE.Vector3(0.24, 0.78, 0.08);
      const elbowPoleL = new THREE.Vector3(-0.34, 1.10, -0.25);
      const elbowPoleR = new THREE.Vector3(0.34, 1.10, -0.25);

      const footL = new THREE.Vector3(-0.14, 0.08, 0);
      const footR = new THREE.Vector3(0.14, 0.08, 0);
      const kneePoleL = new THREE.Vector3(-0.16, 0.52, 0.45);
      const kneePoleR = new THREE.Vector3(0.16, 0.52, 0.45);

      const nameLower = exName.toLowerCase();

      // Special gym bench press check when exercise is Bench Press or Incline Dumbbell Press
      if (nameLower.includes('bench press') || nameLower.includes('incline dumbbell')) {
        benchGroup.visible = true;
        benchGroup.position.set(0, 0, -0.10);
        const press = 1 - p;
        hipsPos.set(0, 0.48, -0.35);
        shoulderCenter.set(0, 0.48, 0.20);
        torsoAnterior.set(0, 1, 0);
        headLookDir.set(0, 1, 0);

        const barY = 0.62 + 0.26 * press;
        const barZ = 0.18;
        if (nameLower.includes('dumbbell')) {
          dumbbellL.visible = true;
          dumbbellR.visible = true;
          handL.set(-0.24, barY, barZ);
          handR.set(0.24, barY, barZ);
          dumbbellL.position.copy(handL);
          dumbbellR.position.copy(handR);
        } else {
          barbellGroup.visible = true;
          barbellGroup.position.set(0, barY, barZ);
          handL.set(-0.32, barY, barZ);
          handR.set(0.32, barY, barZ);
        }

        elbowPoleL.set(-0.46, 0.30, 0.10);
        elbowPoleR.set(0.46, 0.30, 0.10);
        footL.set(-0.22, 0.08, -0.76);
        footR.set(0.22, 0.08, -0.76);
        kneePoleL.set(-0.24, 0.50, -0.68);
        kneePoleR.set(0.24, 0.50, -0.68);
      } else {
        switch (clip) {
          case 'pushup':
          case 'diamond_pushup': {
            // 01_push_up.json:
            // Rigid straight plank pivoting around planted toes (z = -0.84, y = 0.10)
            // Frame 0 (p=0): High Plank (lift=1, plank angle = 21.5 deg)
            // Frame 30 (p=1): Bottom Position (lift=0, plank angle = 5.2 deg, elbows bent ~90 deg)
            const lift = 1 - p;
            const isDiamond =
              clip === 'diamond_pushup' ||
              variant === 'narrow_press' ||
              nameLower.includes('diamond') ||
              nameLower.includes('close-grip');
            const isDecline = nameLower.includes('decline');
            const isPike = variant === 'overhead_push' || nameLower.includes('pike');

            const handSpread = isDiamond ? 0.10 : 0.25;
            const footY = isDecline ? 0.40 : 0.10;
            const footZ = -0.84;

            if (isDecline) {
              benchGroup.visible = true;
              benchGroup.position.set(0, 0, -0.95);
            }

            if (isPike) {
              hipsPos.set(0, 0.78 - 0.10 * p, -0.18);
              shoulderCenter.set(0, 0.44 - 0.20 * p, 0.34);
            } else {
              const plankAngle = (5.2 + 16.3 * lift) * (Math.PI / 180);
              const legDist = 0.815;
              const hipY = footY + legDist * Math.sin(plankAngle);
              const hipZ = footZ + legDist * Math.cos(plankAngle);
              const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
              const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

              hipsPos.set(0, hipY, hipZ);
              shoulderCenter.set(0, chestY, chestZ);
            }

            torsoAnterior.set(0, -1, 0.18).normalize();
            headLookDir.set(0, -0.55, 0.83).normalize();

            handL.set(-handSpread, 0.03, 0.50);
            handR.set(handSpread, 0.03, 0.50);

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
            // 02_squat.json:
            // Frame 0 (p=0): Neutral Standing (arms by sides)
            // Frame 30 (p=1): Parallel Squat Bottom (hips descend & back, arms extended horizontally forward)
            const isDeadlift = variant === 'hinge' || nameLower.includes('deadlift');
            const depth = p;

            if (isDeadlift) {
              const hipY = 0.92 - 0.16 * depth;
              const hipZ = -0.20 * depth;
              hipsPos.set(0, hipY, hipZ);
              const torsoAngle = 0.88 * depth;
              shoulderCenter.set(
                0,
                hipY + Math.cos(torsoAngle) * TORSO_LEN,
                hipZ + Math.sin(torsoAngle) * TORSO_LEN
              );
              torsoAnterior.set(0, -Math.sin(torsoAngle), Math.cos(torsoAngle)).normalize();
              headLookDir.set(0, -0.25 * depth, 1).normalize();

              const barY = 0.78 - 0.42 * depth;
              barbellGroup.visible = true;
              barbellGroup.position.set(0, barY, 0.14);
              handL.set(-0.26, barY, 0.14);
              handR.set(0.26, barY, 0.14);
              elbowPoleL.set(-0.36, barY + 0.25, -0.10);
              elbowPoleR.set(0.36, barY + 0.25, -0.10);

              footL.set(-0.15, 0.08, 0);
              footR.set(0.15, 0.08, 0);
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

              footL.set(-0.17, 0.08, 0.02);
              footR.set(0.17, 0.08, 0.02);
              kneePoleL.set(-0.23, 0.48, 0.58);
              kneePoleR.set(0.23, 0.48, 0.58);

              // Blueprint Counterbalance Arms:
              // Frame 0: Arms straight down by sides of thighs
              // Frame 30: Arms extended straight forward horizontally in front of shoulders
              const armRaise = Math.pow(depth, 0.85);
              const handY = 0.76 * (1 - armRaise) + (shoulderCenter.y - 0.02) * armRaise;
              const handZ = 0.04 * (1 - armRaise) + (shoulderCenter.z + 0.50) * armRaise;
              handL.set(-0.22 + 0.04 * armRaise, handY, handZ);
              handR.set(0.22 - 0.04 * armRaise, handY, handZ);

              elbowPoleL.set(
                -0.28,
                1.05 * (1 - armRaise) + (shoulderCenter.y - 0.22) * armRaise,
                -0.18 * (1 - armRaise) + (shoulderCenter.z + 0.24) * armRaise
              );
              elbowPoleR.set(
                0.28,
                1.05 * (1 - armRaise) + (shoulderCenter.y - 0.22) * armRaise,
                -0.18 * (1 - armRaise) + (shoulderCenter.z + 0.24) * armRaise
              );
            }
            break;
          }

          case 'pullup': {
            // 03_pull_up.json:
            // Overhead bar `bar_ref` fixed at Y = 2.10m
            // Frame 0 (p=0): Dead Hang (arms extended overhead, feet off floor)
            // Frame 30 (p=1): Top Pull-Up (chin clears bar_ref, elbows driven down & out)
            pullupRigGroup.visible = true;
            const pull = p;

            const hipY = 1.00 + 0.44 * pull;
            const hipZ = -0.02 + 0.04 * pull;
            hipsPos.set(0, hipY, hipZ);

            const archAngle = -0.14 * pull;
            shoulderCenter.set(
              0,
              hipY + Math.cos(archAngle) * TORSO_LEN,
              hipZ + Math.sin(archAngle) * TORSO_LEN
            );
            torsoAnterior.set(0, -Math.sin(archAngle), Math.cos(archAngle)).normalize();
            headLookDir.set(0, 0.18 * pull, 1).normalize();

            handL.set(-0.34, 2.09, 0.0);
            handR.set(0.34, 2.09, 0.0);
            elbowPoleL.set(-0.62, shoulderCenter.y - 0.12, -0.18);
            elbowPoleR.set(0.62, shoulderCenter.y - 0.12, -0.18);

            footL.set(-0.10, hipY - 0.78, -0.08 - 0.06 * pull);
            footR.set(0.10, hipY - 0.78, -0.08 - 0.06 * pull);
            kneePoleL.set(-0.12, hipY - 0.38, 0.24);
            kneePoleR.set(0.12, hipY - 0.38, 0.24);
            break;
          }

          case 'lunge': {
            const depth = p;
            const hipY = 0.92 - 0.26 * depth;
            hipsPos.set(0, hipY, 0);
            shoulderCenter.set(0, hipY + TORSO_LEN, 0.03 * depth);
            torsoAnterior.set(0, -0.05 * depth, 1).normalize();
            headLookDir.set(0, 0, 1);

            footL.set(-0.14, 0.08, 0.36);
            footR.set(0.14, 0.08 + 0.04 * depth, -0.42);
            kneePoleL.set(-0.16, 0.48, 0.78);
            kneePoleR.set(0.16, 0.22, -0.10);

            handL.set(-0.22, hipY + 0.08, 0.06);
            handR.set(0.22, hipY + 0.08, 0.06);
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

              handL.set(-0.22, isBridge ? 0.04 : shoulderCenter.y + 0.10, isBridge ? 0.0 : shoulderCenter.z + 0.06);
              handR.set(0.22, isBridge ? 0.04 : shoulderCenter.y + 0.10, isBridge ? 0.0 : shoulderCenter.z + 0.06);
              elbowPoleL.set(-0.42, shoulderCenter.y + 0.05, shoulderCenter.z - 0.10);
              elbowPoleR.set(0.42, shoulderCenter.y + 0.05, shoulderCenter.z - 0.10);

              footL.set(-0.14, 0.08, -0.68);
              footR.set(0.14, 0.08, -0.68);
              kneePoleL.set(-0.16, 0.52, -0.38);
              kneePoleR.set(0.16, 0.52, -0.38);
            } else {
              const isClimber = clip === 'mountain_climber';
              const plankAngle = 16 * (Math.PI / 180);
              const footY = 0.10;
              const footZ = -0.84;
              const legDist = 0.815;
              const hipY = footY + legDist * Math.sin(plankAngle);
              const hipZ = footZ + legDist * Math.cos(plankAngle);
              const chestY = hipY + TORSO_LEN * Math.sin(plankAngle);
              const chestZ = hipZ + TORSO_LEN * Math.cos(plankAngle);

              hipsPos.set(0, hipY, hipZ);
              shoulderCenter.set(0, chestY, chestZ);
              torsoAnterior.set(0, -1, 0.18).normalize();
              headLookDir.set(0, -0.55, 0.83).normalize();

              handL.set(-0.22, 0.03, 0.50);
              handR.set(0.22, 0.03, 0.50);
              elbowPoleL.set(-0.34, chestY + 0.10, 0.25);
              elbowPoleR.set(0.34, chestY + 0.10, 0.25);

              footL.set(-0.12, footY + (isClimber ? 0.12 * p : 0), footZ + (isClimber ? 0.38 * p : 0));
              footR.set(0.12, footY + (isClimber ? 0.12 * (1 - p) : 0), footZ + (isClimber ? 0.38 * (1 - p) : 0));
              kneePoleL.set(-0.12, hipY + 0.10, (hipZ + footL.z) * 0.5);
              kneePoleR.set(0.12, hipY + 0.10, (hipZ + footR.z) * 0.5);
            }
            break;
          }

          case 'stretch_flow': {
            if (variant === 'curl') {
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0, 1);
              dumbbellL.visible = true;
              dumbbellR.visible = true;

              const angle = 0.22 + p * 2.15;
              const elbowY = 1.18;
              const handY = elbowY - Math.cos(angle) * FOREARM_LEN;
              const handZ = 0.04 + Math.sin(angle) * FOREARM_LEN;
              handL.set(-0.23, handY, handZ);
              handR.set(0.23, handY, handZ);
              dumbbellL.position.copy(handL);
              dumbbellR.position.copy(handR);

              elbowPoleL.set(-0.26, 1.15, -0.18);
              elbowPoleR.set(0.26, 1.15, -0.18);
            } else if (variant === 'tricep_ext') {
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0, 1);
              dumbbellL.visible = true;
              dumbbellR.visible = true;

              const handY = 1.32 - 0.42 * p;
              const handZ = 0.18 + 0.08 * p;
              handL.set(-0.20, handY, handZ);
              handR.set(0.20, handY, handZ);
              dumbbellL.position.copy(handL);
              dumbbellR.position.copy(handR);
              elbowPoleL.set(-0.24, 1.18, -0.12);
              elbowPoleR.set(0.24, 1.18, -0.12);
            } else if (variant === 'overhead_push') {
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0.08, 1).normalize();

              if (nameLower.includes('lateral') || nameLower.includes('front')) {
                dumbbellL.visible = true;
                dumbbellR.visible = true;
                const liftY = 0.82 + 0.64 * p;
                const spread = nameLower.includes('front') ? 0.20 : 0.22 + 0.36 * p;
                const fwd = nameLower.includes('front') ? 0.10 + 0.38 * p : 0.08;
                handL.set(-spread, liftY, fwd);
                handR.set(spread, liftY, fwd);
                dumbbellL.position.copy(handL);
                dumbbellR.position.copy(handR);
              } else {
                const barY = 1.50 + 0.44 * p;
                const barZ = 0.14 - 0.08 * p;
                barbellGroup.visible = true;
                barbellGroup.position.set(0, barY, barZ);
                handL.set(-0.30, barY, barZ);
                handR.set(0.30, barY, barZ);
              }
              elbowPoleL.set(-0.46, 1.22, 0.14);
              elbowPoleR.set(0.46, 1.22, 0.14);
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

              const barY = 0.58 + 0.28 * p;
              const barZ = 0.24 - 0.12 * p;
              barbellGroup.visible = true;
              barbellGroup.position.set(0, barY, barZ);
              handL.set(-0.28, barY, barZ);
              handR.set(0.28, barY, barZ);
              elbowPoleL.set(-0.42, shoulderCenter.y + 0.12, hipZ - 0.24);
              elbowPoleR.set(0.42, shoulderCenter.y + 0.12, hipZ - 0.24);
            } else {
              hipsPos.set(0, 0.94, 0);
              shoulderCenter.set(0, 0.94 + TORSO_LEN, 0);
              torsoAnterior.set(0, 0, 1);
              headLookDir.set(0, 0, 1);
              handL.set(-0.24 - 0.25 * p, 0.90 + 0.55 * p, 0.14);
              handR.set(0.24 + 0.25 * p, 0.90 + 0.55 * p, 0.14);
              elbowPoleL.set(-0.40, 1.15, -0.18);
              elbowPoleR.set(0.40, 1.15, -0.18);
            }

            footL.set(-0.15, 0.08, 0);
            footR.set(0.15, 0.08, 0);
            kneePoleL.set(-0.16, 0.52, 0.40);
            kneePoleR.set(0.16, 0.52, 0.40);
            break;
          }

          case 'burpee':
          case 'jog':
          case 'idle':
          default: {
            const bounce = clip === 'jog' || clip === 'burpee' ? 0.07 * p : 0.015 * p;
            hipsPos.set(0, 0.94 + bounce, 0);
            shoulderCenter.set(0, 0.94 + TORSO_LEN + bounce, 0);
            torsoAnterior.set(0, 0, 1);
            headLookDir.set(0, 0, 1);

            const armSwing = clip === 'jog' ? 0.32 * (p - 0.5) : 0.08 * p;
            handL.set(-0.24, 0.84 + bounce + 0.18 * p, 0.12 + armSwing);
            handR.set(0.24, 0.84 + bounce + 0.18 * p, 0.12 - armSwing);
            elbowPoleL.set(-0.34, 1.15, -0.20);
            elbowPoleR.set(0.34, 1.15, -0.20);

            footL.set(-0.15, 0.08 + (clip === 'jog' ? 0.10 * p : 0), 0);
            footR.set(0.15, 0.08 + (clip === 'jog' ? 0.10 * (1 - p) : 0), 0);
            kneePoleL.set(-0.16, 0.52, 0.40);
            kneePoleR.set(0.16, 0.52, 0.40);
            break;
          }
        }
      }

      // 1. Align Torso (hipsPos at s=0 -> shoulderCenter at s=1)
      alignBoneUpForward(torsoMesh, hipsPos, shoulderCenter, torsoAnterior);

      const torsoUp = new THREE.Vector3().subVectors(shoulderCenter, hipsPos).normalize();
      const torsoRight = new THREE.Vector3().crossVectors(torsoUp, torsoAnterior).normalize();

      // 2. Align Head & Neck (shoulderCenter at s=0 -> headTop at s=1)
      const headTop = shoulderCenter
        .clone()
        .addScaledVector(torsoUp, HEAD_NECK_LEN * 0.92)
        .addScaledVector(headLookDir, HEAD_NECK_LEN * 0.16);
      alignBoneUpForward(headNeckMesh, shoulderCenter, headTop, headLookDir);

      // 3. Shoulder & Hip Joint Sockets in World Space
      const shoulderL = shoulderCenter
        .clone()
        .addScaledVector(torsoRight, -0.195)
        .addScaledVector(torsoUp, -0.055);
      const shoulderR = shoulderCenter
        .clone()
        .addScaledVector(torsoRight, 0.195)
        .addScaledVector(torsoUp, -0.055);

      const hipL = hipsPos
        .clone()
        .addScaledVector(torsoRight, -0.10)
        .addScaledVector(torsoUp, 0.03);
      const hipR = hipsPos
        .clone()
        .addScaledVector(torsoRight, 0.10)
        .addScaledVector(torsoUp, 0.03);

      // 4. Solve Two-Bone IK for Arms (`hand_ik_l`, `hand_ik_r`, `elbow_pole_l`, `elbow_pole_r`)
      const elbowL = solveTwoBoneIK(shoulderL, handL, UPPER_ARM_LEN, FOREARM_LEN, elbowPoleL);
      const elbowR = solveTwoBoneIK(shoulderR, handR, UPPER_ARM_LEN, FOREARM_LEN, elbowPoleR);

      alignBoneUpForward(upperArmL, elbowL, shoulderL, torsoAnterior);
      alignBoneUpForward(upperArmR, elbowR, shoulderR, torsoAnterior);
      alignBoneUpForward(forearmL, handL, elbowL, torsoAnterior);
      alignBoneUpForward(forearmR, handR, elbowR, torsoAnterior);

      // Orient Hands at Wrist
      const wristHandL = forearmL.getObjectByName('wrist_hand');
      const wristHandR = forearmR.getObjectByName('wrist_hand');
      if (wristHandL && wristHandR) {
        if (clip === 'pushup' || clip === 'diamond_pushup' || clip === 'plank' || clip === 'mountain_climber') {
          wristHandL.rotation.set(-Math.PI / 2.2, 0, 0);
          wristHandR.rotation.set(-Math.PI / 2.2, 0, 0);
        } else {
          wristHandL.rotation.set(0, 0, 0);
          wristHandR.rotation.set(0, 0, 0);
        }
      }

      // 5. Solve Two-Bone IK for Legs (`foot_ik_l`, `foot_ik_r`)
      const kneeL = solveTwoBoneIK(hipL, footL, THIGH_LEN, CALF_LEN, kneePoleL);
      const kneeR = solveTwoBoneIK(hipR, footR, THIGH_LEN, CALF_LEN, kneePoleR);

      const legAntL = new THREE.Vector3().subVectors(kneePoleL, hipL).normalize();
      const legAntR = new THREE.Vector3().subVectors(kneePoleR, hipR).normalize();

      alignBoneUpForward(thighL, kneeL, hipL, legAntL);
      alignBoneUpForward(thighR, kneeR, hipR, legAntR);
      alignBoneUpForward(calfL, footL, kneeL, legAntL);
      alignBoneUpForward(calfR, footR, kneeR, legAntR);

      // Keep Shoes planted flat on the floor or hanging naturally
      const shoeL = calfL.getObjectByName('ankle_shoe');
      const shoeR = calfR.getObjectByName('ankle_shoe');
      if (shoeL && shoeR) {
        if (clip === 'pushup' || clip === 'diamond_pushup' || clip === 'plank' || clip === 'mountain_climber') {
          shoeL.rotation.set(Math.PI / 3.2, 0, 0);
          shoeR.rotation.set(Math.PI / 3.2, 0, 0);
        } else {
          shoeL.rotation.set(0, 0, 0);
          shoeR.rotation.set(0, 0, 0);
        }
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
