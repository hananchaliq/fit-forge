'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AnimationClipName, MuscleGroup } from '@/data/exerciseClipMap';
import { BLUEPRINT_EXERCISES } from '@/data/blueprintPack';
import { createProceduralPBRTextures, disposeSceneResources } from '@/lib/pbrTextures';
import {
  BODY_METRICS,
  JOINT_LIMITS_DEG,
  computeAnatomicalFootBasis,
  computeAnatomicalHandBasis,
  computeOrthonormalFrame,
  computeTwoBoneAnatomicalFrames,
  solveConstrainedTwoBoneIK,
  type HandPoseMode,
} from '@/lib/workout3d/biomechanics';
import {
  evaluateExercisePose,
  resolveExerciseId,
  type CameraGroup,
} from '@/lib/workout3d/exercisePoses';

export type CameraPreset = 'front' | 'side' | 'back' | 'top';
export type MannequinDisplayMode = 'muscle' | 'xray' | 'skeleton';

export interface TrainerStudio3DProps {
  exerciseId?: string;
  clip: AnimationClipName;
  biomechanicalVariant?: string;
  exerciseName?: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  timeScale: number;
  isPaused: boolean;
  cameraPreset: CameraPreset;
  displayMode?: MannequinDisplayMode;
  debugMuscleMask?: boolean;
  lockedFrame?: number | null; // 0, 15, 30, 45, 60 or null for continuous loop
  quadView?: boolean; // 4-angle Blueprint Split View (Front, Side, Back, Top)
  onReady?: () => void;
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
 * with zero joint breaks, zero gaps, and smooth seam normals.
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

      const x = nx * sec.rx + (sec.cx || 0);
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

      const xx = ringX.x;
      const xy = ringX.y;
      const xz = ringX.z;
      const yx = ringY.x;
      const yy = ringY.y;
      const yz = ringY.z;
      const zx = ringZ.x;
      const zy = ringZ.y;
      const zz = ringZ.z;

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

const _ringSeg1 = new THREE.Vector3();
const _ringSeg2 = new THREE.Vector3();
const _ringTang = new THREE.Vector3();
const _ringP0 = new THREE.Vector3();
const _ringP2 = new THREE.Vector3();
const _ringD0 = new THREE.Vector3();
const _ringD1 = new THREE.Vector3();
const _ringAnt = new THREE.Vector3();
const _ringN1 = new THREE.Vector3();
const _ringN2 = new THREE.Vector3();

/**
 * Evaluates a smooth 2-bone limb centerline and orthonormal frame with a Quadratic Bezier
 * skinning blend zone (`[jointS - blendHalfWidth, jointS + blendHalfWidth]`) across elbow/knee.
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

  _ringSeg1.subVectors(midPos, rootPos);
  _ringSeg2.subVectors(endPos, midPos);

  if (s <= sStart) {
    const u = Math.max(0, s / jointS);
    outCenter.lerpVectors(rootPos, midPos, u);
    _ringTang.copy(_ringSeg1);
  } else if (s >= sEnd) {
    const u = Math.min(1, (s - jointS) / (1 - jointS));
    outCenter.lerpVectors(midPos, endPos, u);
    _ringTang.copy(_ringSeg2);
  } else {
    const t = (s - sStart) / (2 * blendHalfWidth);
    const u0 = sStart / jointS;
    const u1 = (sEnd - jointS) / (1 - jointS);

    _ringP0.lerpVectors(rootPos, midPos, u0);
    _ringP2.lerpVectors(midPos, endPos, u1);

    const omt = 1 - t;
    outCenter
      .set(0, 0, 0)
      .addScaledVector(_ringP0, omt * omt)
      .addScaledVector(midPos, 2 * omt * t)
      .addScaledVector(_ringP2, t * t);

    _ringD0.subVectors(midPos, _ringP0);
    _ringD1.subVectors(_ringP2, midPos);
    _ringTang.set(0, 0, 0).addScaledVector(_ringD0, omt).addScaledVector(_ringD1, t);
  }

  _ringAnt.lerpVectors(anteriorRoot, anteriorEnd, s);
  if (_ringAnt.lengthSq() < 1e-6) {
    _ringAnt.copy(anteriorRoot);
  } else {
    _ringAnt.normalize();
  }
  computeOrthonormalFrame(_ringTang, _ringAnt, outX, outY, outZ);

  if (s > sStart && s < sEnd && jointBulgeForward !== 0) {
    _ringN1.copy(_ringSeg1).normalize();
    _ringN2.copy(_ringSeg2).normalize();
    const bendFactor = Math.max(0, 0.5 * (1 - _ringN1.dot(_ringN2)));
    const bell = Math.sin(((s - sStart) / (2 * blendHalfWidth)) * Math.PI);
    outCenter.addScaledVector(outZ, jointBulgeForward * bendFactor * bell);
  }
}

export function TrainerStudio3D({
  exerciseId,
  clip: clipName,
  biomechanicalVariant = 'standard',
  exerciseName = '',
  primaryMuscles,
  secondaryMuscles,
  timeScale: tempoScale,
  isPaused,
  cameraPreset,
  displayMode = 'muscle',
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
    exerciseId,
    clipName,
    biomechanicalVariant,
    exerciseName,
    primaryMuscles,
    secondaryMuscles,
    tempoScale,
    isPlaying,
    cameraPreset,
    displayMode,
    showMaskDebug,
    activeKeyframe,
    quadView,
    onReady,
  });

  useEffect(() => {
    stateRef.current = {
      exerciseId,
      clipName,
      biomechanicalVariant,
      exerciseName,
      primaryMuscles,
      secondaryMuscles,
      tempoScale,
      isPlaying,
      cameraPreset,
      displayMode,
      showMaskDebug,
      activeKeyframe,
      quadView,
      onReady,
    };
  }, [
    exerciseId,
    clipName,
    biomechanicalVariant,
    exerciseName,
    primaryMuscles,
    secondaryMuscles,
    tempoScale,
    isPlaying,
    cameraPreset,
    displayMode,
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
  }, [primaryMuscles, secondaryMuscles, showMaskDebug, clipName, exerciseId, displayMode]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.applyCameraPreset(cameraPreset);
    }
  }, [cameraPreset, clipName, exerciseId, exerciseName]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    let disposed = false;
    let isVisible = true;
    let isTabVisible =
      typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    let isContextLost = false;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setWebGLSupported(false));
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pbr = createProceduralPBRTextures(renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b16);
    scene.fog = new THREE.FogExp2(0x060b16, 0.044);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.48;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    const auxCamera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.015;
    controls.minDistance = 1.35;
    controls.maxDistance = 6.5;

    // 4-Point Neutral Sculptural Studio Lighting (Balanced for Matte-Satin Anatomical PBR)
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 0.36);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x0b1120, 0.56);
    hemiLight.position.set(0, 4.4, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.65);
    keyLight.position.set(2.3, 4.4, 3.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    const shadowExtent = 2.5;
    keyLight.shadow.camera.left = -shadowExtent;
    keyLight.shadow.camera.right = shadowExtent;
    keyLight.shadow.camera.top = shadowExtent;
    keyLight.shadow.camera.bottom = -shadowExtent;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb8d4f5, 0.74);
    fillLight.position.set(-2.8, 2.6, 1.8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfde6c4, 0.94);
    rimLight.position.set(0, 3.5, -3.2);
    scene.add(rimLight);

    // Studio Rubber Floor + Clean Slate Grid + Grounded Contact Shadow
    const floorGeo = new THREE.CircleGeometry(6.8, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pbr.floorAlbedoMap,
      roughnessMap: pbr.floorRoughnessMap,
      roughness: 0.9,
      metalness: 0.06,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(6.0, 24, 0x334155, 0x161d2b);
    gridHelper.position.y = 0.002;
    scene.add(gridHelper);

    const contactShadowGeo = new THREE.PlaneGeometry(1.48, 1.48);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: pbr.contactShadowMap,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.004;
    scene.add(contactShadow);

    // ============================================================================
    // SYMMETRICAL MATTE-SATIN ANATOMICAL CLAY PBR MATERIALS (Zero Asymmetric Arms)
    // ============================================================================
    const MANNEQUIN_BASE_HEX = 0xdfc5a4; // Natural warm matte-satin anatomical alabaster-clay
    const CHARCOAL_FABRIC_HEX = 0x252a34; // Matte charcoal athletic shorts

    const skinMat = new THREE.MeshPhysicalMaterial({
      color: MANNEQUIN_BASE_HEX,
      roughness: 0.64,
      metalness: 0.02,
      clearcoat: 0.04,
      clearcoatRoughness: 0.68,
      sheen: 0.28,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(0xf7e8d6),
      normalMap: pbr.skinNormalMap,
      normalScale: new THREE.Vector2(0.42, 0.42),
      bumpMap: pbr.skinBumpMap,
      bumpScale: 0.0035,
      roughnessMap: pbr.skinRoughnessMap,
      vertexColors: true,
    });

    // Identical matte-satin skin WITHOUT vertexColors for sculpted composite hands & feet
    const skinMatNoVC = new THREE.MeshPhysicalMaterial({
      color: MANNEQUIN_BASE_HEX,
      roughness: 0.64,
      metalness: 0.02,
      clearcoat: 0.04,
      clearcoatRoughness: 0.68,
      sheen: 0.28,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(0xf7e8d6),
      normalMap: pbr.skinNormalMap,
      normalScale: new THREE.Vector2(0.42, 0.42),
      bumpMap: pbr.skinBumpMap,
      bumpScale: 0.0035,
      roughnessMap: pbr.skinRoughnessMap,
    });

    const shortsMat = new THREE.MeshPhysicalMaterial({
      color: CHARCOAL_FABRIC_HEX,
      roughness: 0.84,
      metalness: 0.03,
      sheen: 0.22,
      sheenRoughness: 0.76,
      sheenColor: new THREE.Color(0x475569),
      normalMap: pbr.fabricNormalMap,
      normalScale: new THREE.Vector2(0.58, 0.58),
      bumpMap: pbr.fabricBumpMap,
      bumpScale: 0.005,
      roughnessMap: pbr.fabricRoughnessMap,
      vertexColors: true,
    });

    const shortsTrimMat = new THREE.MeshStandardMaterial({
      color: 0x343b48,
      roughness: 0.72,
      metalness: 0.06,
      normalMap: pbr.fabricNormalMap,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughnessMap: pbr.fabricRoughnessMap,
      vertexColors: true,
    });

    const equipMetalMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.28,
      metalness: 0.84,
    });

    const equipChromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.16,
      metalness: 0.94,
    });

    const equipDarkMat = new THREE.MeshStandardMaterial({
      color: 0x121826,
      roughness: 0.68,
      metalness: 0.22,
    });

    const matSurfaceMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.88,
      metalness: 0.04,
      normalMap: pbr.fabricNormalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
    });

    const matBorderMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.82,
      metalness: 0.05,
    });

    const pillowMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      roughness: 0.86,
      metalness: 0.02,
      sheen: 0.35,
      sheenRoughness: 0.78,
      sheenColor: new THREE.Color(0x64748b),
    });

    const towelMat = new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.02,
      sheen: 0.28,
      sheenColor: new THREE.Color(0x94a3b8),
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

    const muscleMaterials: Record<MuscleGroup, THREE.MeshPhysicalMaterial> = {} as Record<
      MuscleGroup,
      THREE.MeshPhysicalMaterial
    >;

    muscleIds.forEach((id) => {
      muscleMaterials[id] = new THREE.MeshPhysicalMaterial({
        color: MANNEQUIN_BASE_HEX,
        roughness: 0.64,
        metalness: 0.02,
        clearcoat: 0.04,
        clearcoatRoughness: 0.68,
        sheen: 0.28,
        sheenRoughness: 0.72,
        sheenColor: new THREE.Color(0xf7e8d6),
        normalMap: pbr.skinNormalMap,
        normalScale: new THREE.Vector2(0.5, 0.5),
        bumpMap: pbr.skinBumpMap,
        bumpScale: 0.004,
        roughnessMap: pbr.skinRoughnessMap,
        vertexColors: true,
      });
    });

    const shortsGlutesMat = new THREE.MeshPhysicalMaterial({
      color: CHARCOAL_FABRIC_HEX,
      roughness: 0.84,
      metalness: 0.03,
      clearcoat: 0.02,
      normalMap: pbr.fabricNormalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      bumpMap: pbr.fabricBumpMap,
      bumpScale: 0.004,
      roughnessMap: pbr.fabricRoughnessMap,
      vertexColors: true,
    });

    const boneMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4ecda,
      roughness: 0.44,
      metalness: 0.06,
      clearcoat: 0.12,
      clearcoatRoughness: 0.48,
      emissive: new THREE.Color(0x3a2e1a),
      emissiveIntensity: 0.16,
      normalMap: pbr.boneNormalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: pbr.boneRoughnessMap,
    });

    const jointBeaconMat = new THREE.MeshPhysicalMaterial({
      color: 0xf97316,
      emissive: new THREE.Color(0xea580c),
      emissiveIntensity: 0.62,
      roughness: 0.25,
      metalness: 0.32,
      clearcoat: 0.4,
    });

    // ============================================================================
    // 180 CM CALIBRATED CONTINUOUS SKINNED ANATOMICAL LOFTS
    // ============================================================================
    const {
      PELVIS_DROP,
      TORSO_LEN,
      HEAD_NECK_LEN,
      UPPER_ARM_LEN,
      FOREARM_LEN,
      HAND_LEN,
      THIGH_LEN,
      CALF_LEN,
      SHOULDER_HALF_WIDTH,
      SHOULDER_DROP_FROM_TOP,
      HIP_HALF_WIDTH,
      HIP_OFFSET_UP,
      BAR_Y,
      DIP_BAR_Y,
      DIP_BAR_HALF_X,
    } = BODY_METRICS;

    // 1. UNIFIED AXIAL BODY MESH (Shorts Crotch Saddle -> Pelvis -> Torso -> Neck -> Bald Faceless Head)
    const buildUnifiedAxialBody = (): SkinnedLoftMeshData => {
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.044, rzAnt: 0.050, rzPost: 0.056, pinchCenterZ: 0.005 },
        { s: 0.04, rx: 0.174, rzAnt: 0.104, rzPost: 0.122, pinchCenterZ: 0.020 },
        { s: 0.09, rx: 0.166, rzAnt: 0.106, rzPost: 0.130, pinchCenterZ: 0.024 },
        { s: 0.16, rx: 0.150, rzAnt: 0.100, rzPost: 0.110, pinchCenterZ: 0.011 },
        { s: 0.24, rx: 0.136, rzAnt: 0.096, rzPost: 0.098, pinchCenterZ: 0.012 },
        { s: 0.34, rx: 0.152, rzAnt: 0.108, rzPost: 0.108, pinchCenterZ: 0.015 },
        { s: 0.45, rx: 0.178, rzAnt: 0.125, rzPost: 0.118, pinchCenterZ: 0.020 },
        { s: 0.55, rx: 0.200, rzAnt: 0.136, rzPost: 0.124, pinchCenterZ: 0.022 },
        { s: 0.63, rx: 0.198, rzAnt: 0.114, rzPost: 0.110, pinchCenterZ: 0.010 },
        { s: 0.68, rx: 0.104, rzAnt: 0.074, rzPost: 0.076, pinchCenterZ: 0.002 },
        { s: 0.71, rx: 0.056, rzAnt: 0.055, rzPost: 0.056, pinchCenterZ: 0.000 },
        { s: 0.76, rx: 0.052, rzAnt: 0.053, rzPost: 0.054, pinchCenterZ: 0.000 },
        { s: 0.79, rx: 0.055, rzAnt: 0.062, rzPost: 0.058, pinchCenterZ: 0.000 },
        { s: 0.83, rx: 0.066, rzAnt: 0.080, rzPost: 0.076, pinchCenterZ: 0.000 },
        { s: 0.87, rx: 0.073, rzAnt: 0.085, rzPost: 0.085, pinchCenterZ: 0.000 },
        { s: 0.91, rx: 0.075, rzAnt: 0.083, rzPost: 0.087, pinchCenterZ: 0.000 },
        { s: 0.95, rx: 0.070, rzAnt: 0.076, rzPost: 0.081, pinchCenterZ: 0.000 },
        { s: 0.98, rx: 0.045, rzAnt: 0.047, rzPost: 0.051, pinchCenterZ: 0.000 },
        { s: 1.00, rx: 0.001, rzAnt: 0.001, rzPost: 0.001, pinchCenterZ: 0.000 },
      ];

      // Groups: 0: skin, 1: shorts, 2: shortsTrim, 3: chest, 4: abs, 5: back_lats, 6: shoulders, 7: glutes(shorts)
      const groupFn = (s: number, nx: number, nz: number): number => {
        const absX = Math.abs(nx);
        const isAnt = nz >= 0;

        if (s >= 0.75) return 0; // Neck & Bald Faceless Head

        if (s < 0.175) {
          if (s >= 0.158) return 2; // Clean athletic shorts waistband trim
          if (!isAnt && s >= 0.02 && s < 0.158 && absX > 0.10 && absX < 0.90) return 7; // Glutes
          return 1; // Matte charcoal shorts
        }

        // Upper trapezius / shoulder bridge highlights symmetrically with shoulders/back
        if (s > 0.63 && s < 0.71 && absX > 0.22) {
          return 6; // shoulders / upper traps
        }
        if (isAnt && s >= 0.40 && s <= 0.64 && absX >= 0.04 && absX <= 0.84 && nz > 0.22) {
          return 3; // chest
        }
        if (isAnt && s >= 0.175 && s < 0.40 && absX <= 0.68 && nz > 0.26) {
          return 4; // abs
        }
        if (s >= 0.22 && s <= 0.65 && (nz < -0.10 || (absX > 0.66 && nz < 0.28))) {
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
          if (nz > 0.15 && ts > 0.55 && ts < 0.88 && absX > 0.03 && absX < 0.84) {
            const pecS = Math.sin(((ts - 0.55) / 0.33) * Math.PI);
            const pecX = Math.sin(((absX - 0.03) / 0.81) * Math.PI);
            const lowerShelf =
              ts < 0.66 ? Math.sin(((ts - 0.55) / 0.11) * (Math.PI * 0.5)) : 1.0;
            pos.z += 0.025 * pecS * pecX * lowerShelf * nz;
          }
          if (nz > 0.35 && ts > 0.85 && ts < 0.93 && absX > 0.10 && absX < 0.76) {
            const clavBell = Math.sin(((ts - 0.85) / 0.08) * Math.PI);
            pos.z += 0.008 * clavBell * nz;
          }
          if (nz > 0.30 && ts > 0.25 && ts < 0.55 && absX > 0.03 && absX < 0.46) {
            const rowPhase = ((ts - 0.25) / 0.30) * 3 * Math.PI;
            const abRow = Math.pow(Math.max(0, Math.sin(rowPhase)), 0.65);
            const abCol = Math.sin(((absX - 0.03) / 0.43) * Math.PI);
            pos.z += 0.015 * abRow * abCol * nz;
          }
          if (nz > -0.1 && nz < 0.65 && ts > 0.22 && ts < 0.38 && absX > 0.48 && absX < 0.92) {
            const obBell = Math.sin(((ts - 0.22) / 0.16) * Math.PI);
            pos.x += (nx > 0 ? 1 : -1) * 0.008 * obBell;
          }
          if (nz > -0.1 && nz < 0.65 && ts > 0.34 && ts < 0.62 && absX > 0.54 && absX < 0.92) {
            const ribWave = Math.max(0, Math.sin(((ts - 0.34) / 0.28) * 4 * Math.PI));
            pos.x += (nx > 0 ? 1 : -1) * 0.006 * ribWave;
          }
          if (nz < 0.25 && ts > 0.32 && ts < 0.87 && absX > 0.12 && absX < 0.96) {
            const latS = Math.sin(((ts - 0.32) / 0.55) * Math.PI);
            const latX = Math.sin(((absX - 0.12) / 0.84) * Math.PI);
            if (nz < -0.12) {
              pos.z -= 0.020 * latS * latX * -nz;
            }
            pos.x += (nx > 0 ? 1 : -1) * 0.014 * latS * latX;
          }
          if (nz < -0.25 && ts > 0.66 && ts < 0.96 && absX > 0.06 && absX < 0.52) {
            const trapBell = Math.sin(((ts - 0.66) / 0.30) * Math.PI);
            pos.z -= 0.012 * trapBell * -nz;
          }
          if (nz < -0.2 && ts > 0.03 && ts < 0.22 && absX > 0.12 && absX < 0.86) {
            const gluteS = Math.sin(((ts - 0.03) / 0.19) * Math.PI);
            const gluteX = Math.sin(((absX - 0.12) / 0.74) * Math.PI);
            pos.z -= 0.022 * gluteS * gluteX * -nz;
          }
        } else {
          const hs = (s - 0.70) / 0.30;
          if (nz > 0.2 && hs > 0.02 && hs < 0.26 && absX > 0.18 && absX < 0.58) {
            pos.z += 0.004 * Math.sin(((hs - 0.02) / 0.24) * Math.PI);
          }
          if (nz > 0.30 && hs > 0.28 && hs < 0.42 && absX < 0.52) {
            pos.z += 0.005 * Math.sin(((hs - 0.28) / 0.14) * Math.PI);
          }
          if (nz > 0.65 && hs > 0.50 && hs < 0.68 && absX < 0.52) {
            pos.z += 0.003 * Math.sin(((hs - 0.50) / 0.18) * Math.PI);
          }
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number,
        matGroup: number
      ): [number, number, number] => {
        const absX = Math.abs(nx);
        let shade = 0.98;

        if (s < 0.70) {
          const ts = s / 0.70;
          if (nz > 0.25 && absX < 0.085 && ts > 0.24 && ts < 0.87) {
            shade -= 0.34 * (1 - absX / 0.085);
          }
          if (nz > 0.22 && ts > 0.53 && ts < 0.60 && absX > 0.06 && absX < 0.82) {
            const groove = 1 - Math.abs(ts - 0.565) / 0.035;
            shade -= 0.36 * Math.max(0, groove);
          }
          if (nz > 0.15 && ts > 0.65 && ts < 0.88 && absX > 0.68 && absX < 0.78) {
            shade -= 0.24;
          }
          if (nz > 0.28 && ts > 0.24 && ts < 0.55 && absX < 0.48) {
            for (const gS of [0.33, 0.43, 0.52]) {
              const dist = Math.abs(ts - gS);
              if (dist < 0.024) {
                shade -= 0.30 * (1 - dist / 0.024);
              }
            }
            if (absX > 0.37 && absX < 0.46) {
              shade -= 0.26 * (1 - Math.abs(absX - 0.415) / 0.045);
            }
          }
          if (nz > -0.05 && nz < 0.70 && ts > 0.35 && ts < 0.60 && absX > 0.46 && absX < 0.88) {
            const ribGroove = Math.abs(Math.sin(((ts - 0.35) / 0.25) * 3 * Math.PI));
            if (ribGroove < 0.28) shade -= 0.20;
          }
          if (nz < -0.22 && ts > 0.24 && ts < 0.88) {
            if (absX < 0.095) shade -= 0.34 * (1 - absX / 0.095);
            if (ts > 0.58 && ts < 0.85 && absX > 0.40 && absX < 0.52) shade -= 0.22;
          }
          if (matGroup === 1 || matGroup === 2 || matGroup === 7) {
            shade = 0.94 + 0.06 * Math.sin(nx * 6);
            if (nz < -0.2 && absX < 0.12) shade -= 0.26;
          }
        } else {
          const hs = (s - 0.70) / 0.30;
          if (nz > 0.12 && hs > 0.21 && hs < 0.30) {
            shade -= 0.18 * Math.sin(((hs - 0.21) / 0.09) * Math.PI);
          }
        }

        const c = Math.max(0.45, Math.min(1.06, shade));
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
      ];

      return createContinuousSkinnedLoft(
        PELVIS_DROP + TORSO_LEN + HEAD_NECK_LEN,
        sections,
        48,
        72,
        materials,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
    };

    // 2. 100% SYMMETRICAL CONTINUOUS SKINNED ARM MESH (Deltoid Cap -> Bicep/Tricep -> Elbow -> Forearm -> Wrist Cuff)
    // Terminates cleanly at wrist (`s = 1.0`) where the sculpted 3D anatomical hand attaches seamlessly.
    const buildSkinnedArm = (): SkinnedLoftMeshData => {
      const totalArmLen = UPPER_ARM_LEN + FOREARM_LEN; // 0.565m (shoulder -> wrist)
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.054, rzAnt: 0.054, rzPost: 0.054 }, // Tucked inside shoulder glenohumeral socket
        { s: 0.05, rx: 0.072, rzAnt: 0.072, rzPost: 0.070 }, // Full deltoid cap overlap
        { s: 0.13, rx: 0.078, rzAnt: 0.076, rzPost: 0.074 }, // Lateral deltoid peak
        { s: 0.24, rx: 0.064, rzAnt: 0.067, rzPost: 0.065 }, // Deltoid insertion
        { s: 0.36, rx: 0.058, rzAnt: 0.070, rzPost: 0.066 }, // Bicep/Tricep belly
        { s: 0.48, rx: 0.048, rzAnt: 0.052, rzPost: 0.052 }, // Lower humerus
        { s: 0.53, rx: 0.046, rzAnt: 0.045, rzPost: 0.047 }, // Elbow hinge
        { s: 0.62, rx: 0.050, rzAnt: 0.048, rzPost: 0.048 }, // Brachioradialis flare
        { s: 0.78, rx: 0.039, rzAnt: 0.035, rzPost: 0.035 }, // Mid forearm
        { s: 0.92, rx: 0.031, rzAnt: 0.025, rzPost: 0.025 }, // Distal forearm
        { s: 1.00, rx: 0.029, rzAnt: 0.023, rzPost: 0.023 }, // Wrist cuff (seamless hand join)
      ];

      // Groups: 0: skin, 1: shoulders, 2: biceps, 3: triceps, 4: forearms (100% symmetrical L/R!)
      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s < 0.24) return 1; // shoulders (deltoids)
        if (s >= 0.24 && s < 0.50) {
          if (nz >= 0.06) return 2; // biceps
          if (nz <= -0.06) return 3; // triceps
        }
        if (s >= 0.56 && s < 0.94) return 4; // forearms
        return 0; // elbow crease & wrist skin
      };

      const sculptFn = (
        s: number,
        _theta: number,
        nx: number,
        nz: number,
        pos: { x: number; y: number; z: number }
      ) => {
        if (nz > 0.2 && s > 0.23 && s < 0.49) {
          pos.z += 0.012 * Math.sin(((s - 0.23) / 0.26) * Math.PI) * nz;
        }
        if (nz < -0.2 && s > 0.21 && s < 0.49) {
          pos.z -= 0.012 * Math.sin(((s - 0.21) / 0.28) * Math.PI) * -nz;
        }
        if (s > 0.56 && s < 0.88) {
          pos.x += nx * 0.005 * Math.sin(((s - 0.56) / 0.32) * Math.PI);
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number
      ): [number, number, number] => {
        let shade = 0.96;
        if (Math.abs(nz) < 0.16 && s > 0.22 && s < 0.50) {
          shade -= 0.20 * (1 - Math.abs(nz) / 0.16);
        }
        if (s > 0.06 && s < 0.22 && Math.abs(Math.abs(nz) - 0.55) < 0.08) {
          shade -= 0.12;
        }
        if (s > 0.22 && s < 0.26 && Math.abs(nx) > 0.3) {
          shade -= 0.16;
        }
        const c = Math.max(0.58, Math.min(1.04, shade));
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
        28,
        44,
        materials,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
    };

    // 2B. SCULPTED 3D ANATOMICAL HAND (Seamless Wrist + Metacarpal Palm + Opposable Thumb + 4 Articulated Fingers)
    // Local +Y = wrist -> fingertips, +Z = palmar face, +X = radial/ulnar axis
    const buildAnatomicalHandGroup = (side: 'left' | 'right') => {
      const thumbSign = side === 'left' ? 1 : -1;
      const root = new THREE.Group();

      // Seamless wrist joint collar bridging forearm cuff cleanly
      const wristCap = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), skinMatNoVC);
      wristCap.scale.set(1.16, 0.86, 0.88);
      wristCap.position.set(0, 0.002, 0);
      wristCap.castShadow = true;
      root.add(wristCap);

      // Sculpted Metacarpal Palm Body
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.064, 0.022), skinMatNoVC);
      palm.position.set(0, 0.036, 0.001);
      palm.castShadow = true;
      root.add(palm);

      // Rounded palm borders (thenar & hypothenar pads)
      const thenar = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.036, 8, 12), skinMatNoVC);
      thenar.position.set(thumbSign * 0.024, 0.032, 0.005);
      thenar.rotation.z = -thumbSign * 0.14;
      thenar.castShadow = true;
      root.add(thenar);

      const hypothenar = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.011, 0.042, 8, 12),
        skinMatNoVC
      );
      hypothenar.position.set(-thumbSign * 0.026, 0.038, 0.002);
      hypothenar.castShadow = true;
      root.add(hypothenar);

      // Knuckle ridge (MCP joints)
      const knuckles = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.048, 8, 12), skinMatNoVC);
      knuckles.rotation.z = Math.PI / 2;
      knuckles.position.set(0, 0.068, 0.0);
      knuckles.castShadow = true;
      root.add(knuckles);

      // Opposable Anatomical Thumb
      const thumbPivot = new THREE.Group();
      thumbPivot.position.set(thumbSign * 0.031, 0.028, 0.007);
      const thumbProx = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0085, 0.022, 8, 10),
        skinMatNoVC
      );
      thumbProx.position.set(0, 0.014, 0);
      thumbProx.castShadow = true;
      const thumbDist = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0075, 0.018, 8, 10),
        skinMatNoVC
      );
      thumbDist.position.set(-thumbSign * 0.003, 0.036, 0.005);
      thumbDist.rotation.x = 0.24;
      thumbDist.castShadow = true;
      thumbPivot.add(thumbProx, thumbDist);
      root.add(thumbPivot);

      // Articulated 4-Finger Cluster (Index -> Middle -> Ring -> Pinky)
      const fingersPivot = new THREE.Group();
      fingersPivot.position.set(0, 0.068, 0.001);

      const fingerSpecs = [
        { x: thumbSign * 0.023, len: 0.048, r: 0.0072, splay: -thumbSign * 0.04 },
        { x: thumbSign * 0.008, len: 0.054, r: 0.0075, splay: 0 },
        { x: -thumbSign * 0.008, len: 0.049, r: 0.0072, splay: thumbSign * 0.03 },
        { x: -thumbSign * 0.023, len: 0.039, r: 0.0064, splay: thumbSign * 0.06 },
      ];

      const distalPivot = new THREE.Group();
      distalPivot.position.set(0, 0.026, 0);

      fingerSpecs.forEach((f) => {
        const proxLen = f.len * 0.52;
        const distLen = f.len * 0.48;

        const prox = new THREE.Mesh(new THREE.CapsuleGeometry(f.r, proxLen, 8, 10), skinMatNoVC);
        prox.position.set(f.x, proxLen * 0.5, 0);
        prox.rotation.z = f.splay;
        prox.castShadow = true;
        fingersPivot.add(prox);

        const dist = new THREE.Mesh(
          new THREE.CapsuleGeometry(f.r * 0.9, distLen, 8, 10),
          skinMatNoVC
        );
        dist.position.set(f.x - Math.sin(f.splay) * 0.015, distLen * 0.5 + 0.004, 0);
        dist.rotation.z = f.splay * 0.5;
        dist.castShadow = true;
        distalPivot.add(dist);
      });

      fingersPivot.add(distalPivot);
      root.add(fingersPivot);

      const setHandPose = (mode: HandPoseMode) => {
        if (mode === 'grip') {
          fingersPivot.rotation.x = 1.05;
          distalPivot.rotation.x = 0.85;
          thumbPivot.rotation.set(0.75, -thumbSign * 0.45, -thumbSign * 0.42);
        } else if (mode === 'flat') {
          fingersPivot.rotation.x = -0.02;
          distalPivot.rotation.x = 0.0;
          thumbPivot.rotation.set(0.08, 0, -thumbSign * 0.48);
        } else if (mode === 'temple' || mode === 'clasp') {
          fingersPivot.rotation.x = 0.52;
          distalPivot.rotation.x = 0.42;
          thumbPivot.rotation.set(0.32, -thumbSign * 0.25, -thumbSign * 0.35);
        } else {
          // 'relaxed' natural anatomical curve
          fingersPivot.rotation.x = 0.26;
          distalPivot.rotation.x = 0.22;
          thumbPivot.rotation.set(0.22, -thumbSign * 0.18, -thumbSign * 0.38);
        }
      };

      setHandPose('relaxed');
      return { group: root, setHandPose };
    };

    // 3. CONTINUOUS SKINNED LEG MESH (Charcoal Shorts + Sculpted Quads/Hamstrings/Calves + Seamless Ankle)
    const buildSkinnedLeg = (): SkinnedLoftMeshData => {
      const totalLegLen = THIGH_LEN + CALF_LEN; // 0.84m
      const sections: LoftSection[] = [
        { s: 0.00, rx: 0.056, rzAnt: 0.056, rzPost: 0.056 },
        { s: 0.05, rx: 0.095, rzAnt: 0.094, rzPost: 0.102 },
        { s: 0.20, rx: 0.101, rzAnt: 0.098, rzPost: 0.100 },
        { s: 0.30, rx: 0.089, rzAnt: 0.095, rzPost: 0.089 },
        { s: 0.43, rx: 0.071, rzAnt: 0.073, rzPost: 0.068 },
        { s: 0.51, rx: 0.057, rzAnt: 0.060, rzPost: 0.055 },
        { s: 0.64, rx: 0.063, rzAnt: 0.054, rzPost: 0.075 },
        { s: 0.82, rx: 0.041, rzAnt: 0.042, rzPost: 0.045 },
        { s: 0.94, rx: 0.036, rzAnt: 0.038, rzPost: 0.038 },
        { s: 1.00, rx: 0.034, rzAnt: 0.037, rzPost: 0.037 },
      ];

      // Groups: 0: skin, 1: shorts, 2: shortsTrim, 3: quads, 4: hamstrings, 5: calves
      const groupFn = (s: number, _nx: number, nz: number): number => {
        if (s <= 0.22) {
          if (s >= 0.205) return 2;
          return 1;
        }
        if (s > 0.22 && s < 0.47) {
          if (nz >= 0.06) return 3; // quads
          if (nz <= -0.06) return 4; // hamstrings
        }
        if (s >= 0.56 && s < 0.85 && nz < 0.12) {
          return 5; // calves
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
          pos.z += 0.016 * quadProfile * nz;
          pos.x += nx * 0.009 * quadProfile;
        }
        if (nz > 0.55 && s > 0.48 && s < 0.54) {
          pos.z += 0.006 * Math.sin(((s - 0.48) / 0.06) * Math.PI);
        }
        if (nz < -0.15 && s > 0.16 && s < 0.46) {
          pos.z -= 0.014 * Math.sin(((s - 0.16) / 0.30) * Math.PI) * -nz;
        }
        if (nz < -0.15 && s > 0.56 && s < 0.82) {
          pos.z -= 0.016 * Math.sin(((s - 0.56) / 0.26) * Math.PI) * -nz;
        }
      };

      const vertexShadeFn = (
        s: number,
        nx: number,
        nz: number,
        matGroup: number
      ): [number, number, number] => {
        if (matGroup === 1 || matGroup === 2) return [0.94, 0.94, 0.96];
        const absX = Math.abs(nx);
        let shade = 0.96;
        if (nz > 0.35 && s > 0.22 && s < 0.46 && absX > 0.32 && absX < 0.44) {
          shade -= 0.20 * (1 - Math.abs(absX - 0.38) / 0.06);
        }
        if (Math.abs(nz) < 0.16 && s > 0.22 && s < 0.46) {
          shade -= 0.16;
        }
        if (nz < -0.4 && s > 0.58 && s < 0.80 && absX < 0.12) {
          shade -= 0.18;
        }
        const c = Math.max(0.56, Math.min(1.04, shade));
        return [c, c, c];
      };

      const materials = [
        skinMat,
        shortsMat,
        shortsTrimMat,
        muscleMaterials.quads,
        muscleMaterials.hamstrings,
        muscleMaterials.calves,
      ];

      return createContinuousSkinnedLoft(
        totalLegLen,
        sections,
        28,
        48,
        materials,
        sculptFn,
        groupFn,
        vertexShadeFn
      );
    };

    // 3B. SCULPTED ANATOMICAL BAREFOOT FOOT (Seamless Ankle Cuff + Heel + Arched Instep + Medial Toe-Box)
    // Origin `(0, 0, 0)` = ankle joint center; sole bottom sits precisely at `y = -BODY_METRICS.ANKLE_HEIGHT (-0.072)`.
    const buildBarefootGroup = (side: 'left' | 'right'): THREE.Group => {
      const medialSign = side === 'left' ? 1 : -1;
      const footGroup = new THREE.Group();

      // Seamless talocrural ankle joint collar (eliminates any ankle gap during plantar/dorsiflexion)
      const ankleCuff = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 14), skinMatNoVC);
      ankleCuff.scale.set(0.98, 1.12, 1.04);
      ankleCuff.position.set(0, -0.008, -0.002);
      ankleCuff.castShadow = true;
      footGroup.add(ankleCuff);

      // Calcaneus Heel (bottom sits at y = -0.072)
      const heel = new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 14), skinMatNoVC);
      heel.scale.set(0.95, 0.88, 1.08);
      heel.position.set(0, -0.043, -0.018);
      heel.castShadow = true;
      footGroup.add(heel);

      // Midfoot & Arched Instep
      const instep = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.105, 12, 16), skinMatNoVC);
      instep.rotation.x = Math.PI / 2;
      instep.scale.set(1.04, 1.0, 0.72);
      instep.position.set(0, -0.046, 0.044);
      instep.castShadow = true;
      footGroup.add(instep);

      // Forefoot Ball & Metatarsal Platform
      const forefoot = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 14), skinMatNoVC);
      forefoot.scale.set(1.12, 0.50, 1.10);
      forefoot.position.set(medialSign * 0.004, -0.053, 0.102);
      forefoot.castShadow = true;
      footGroup.add(forefoot);

      // Anatomically Tapered Toes (Hallux / Big Toe medial -> Pinky lateral)
      const toes = [
        { x: medialSign * 0.024, z: 0.145, r: 0.0115, l: 0.022 },
        { x: medialSign * 0.008, z: 0.148, r: 0.009, l: 0.021 },
        { x: -medialSign * 0.006, z: 0.143, r: 0.0082, l: 0.019 },
        { x: -medialSign * 0.019, z: 0.136, r: 0.0075, l: 0.016 },
        { x: -medialSign * 0.030, z: 0.127, r: 0.0068, l: 0.013 },
      ];
      toes.forEach((t) => {
        const toeMesh = new THREE.Mesh(new THREE.CapsuleGeometry(t.r, t.l, 6, 8), skinMatNoVC);
        toeMesh.rotation.x = Math.PI / 2;
        toeMesh.scale.set(1.0, 1.0, 0.78);
        toeMesh.position.set(t.x, -0.062, t.z);
        toeMesh.castShadow = true;
        footGroup.add(toeMesh);
      });

      return footGroup;
    };

    // ============================================================================
    // ARTICULATED 3D ANATOMICAL SKELETON (Mode Tulang & X-Ray — Driven by Live IK)
    // ============================================================================
    const buildAnatomicalSkeleton = () => {
      const group = new THREE.Group();
      group.visible = false;

      const makeJointSphere = (radius: number) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 14), jointBeaconMat);
        mesh.castShadow = false;
        group.add(mesh);
        return mesh;
      };

      const makeLongBone = (radiusTop: number, radiusBottom: number) => {
        const boneGeo = new THREE.CylinderGeometry(radiusTop, radiusBottom, 1, 12, 1);
        const mesh = new THREE.Mesh(boneGeo, boneMat);
        mesh.castShadow = false;
        group.add(mesh);
        return mesh;
      };

      const skullGroup = new THREE.Group();
      const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 18), boneMat);
      cranium.scale.set(0.94, 1.06, 1.08);
      cranium.position.set(0, 0.165, -0.003);
      skullGroup.add(cranium);

      const mandible = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.052, 14), boneMat);
      mandible.scale.set(1.0, 1.0, 1.12);
      mandible.position.set(0, 0.108, 0.016);
      skullGroup.add(mandible);

      const orbitMat = new THREE.MeshStandardMaterial({ color: 0x16120c, roughness: 0.95 });
      const orbitGeo = new THREE.SphereGeometry(0.015, 10, 10);
      const orbitL = new THREE.Mesh(orbitGeo, orbitMat);
      orbitL.position.set(-0.023, 0.156, 0.058);
      orbitL.scale.set(1.1, 0.85, 0.45);
      const orbitR = new THREE.Mesh(orbitGeo, orbitMat);
      orbitR.position.set(0.023, 0.156, 0.058);
      orbitR.scale.set(1.1, 0.85, 0.45);
      skullGroup.add(orbitL, orbitR);
      group.add(skullGroup);

      const vertebrae: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) {
        const vGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.038, 12);
        const v = new THREE.Mesh(vGeo, boneMat);
        group.add(v);
        vertebrae.push(v);
      }

      const ribcageGroup = new THREE.Group();
      const ribRadii = [
        { rx: 0.118, rz: 0.082, y: 0.09 },
        { rx: 0.136, rz: 0.095, y: 0.045 },
        { rx: 0.142, rz: 0.098, y: 0.0 },
        { rx: 0.134, rz: 0.092, y: -0.045 },
        { rx: 0.118, rz: 0.080, y: -0.088 },
      ];
      ribRadii.forEach((r) => {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.075, 10, 28), boneMat);
        rib.rotation.x = Math.PI / 2;
        rib.scale.set(r.rx, r.rz, 0.12);
        rib.position.set(0, r.y, 0.004);
        ribcageGroup.add(rib);
      });
      const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.165, 0.016), boneMat);
      sternum.position.set(0, 0.01, 0.094);
      ribcageGroup.add(sternum);
      group.add(ribcageGroup);

      const pelvisGroup = new THREE.Group();
      const iliumL = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.015, 10, 20), boneMat);
      iliumL.position.set(-0.072, 0.01, 0);
      iliumL.rotation.y = Math.PI * 0.25;
      iliumL.scale.set(0.95, 1.15, 0.7);
      const iliumR = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.015, 10, 20), boneMat);
      iliumR.position.set(0.072, 0.01, 0);
      iliumR.rotation.y = -Math.PI * 0.25;
      iliumR.scale.set(0.95, 1.15, 0.7);
      const sacrum = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.095, 10), boneMat);
      sacrum.rotation.x = Math.PI;
      sacrum.position.set(0, -0.01, -0.025);
      pelvisGroup.add(iliumL, iliumR, sacrum);
      group.add(pelvisGroup);

      const clavicleL = makeLongBone(0.011, 0.010);
      const clavicleR = makeLongBone(0.011, 0.010);
      const humerusL = makeLongBone(0.018, 0.014);
      const humerusR = makeLongBone(0.018, 0.014);
      const radiusL = makeLongBone(0.011, 0.009);
      const ulnaL = makeLongBone(0.010, 0.008);
      const radiusR = makeLongBone(0.011, 0.009);
      const ulnaR = makeLongBone(0.010, 0.008);
      const handBoneL = makeLongBone(0.012, 0.008);
      const handBoneR = makeLongBone(0.012, 0.008);
      const femurL = makeLongBone(0.022, 0.018);
      const femurR = makeLongBone(0.022, 0.018);
      const tibiaL = makeLongBone(0.017, 0.013);
      const fibulaL = makeLongBone(0.008, 0.007);
      const tibiaR = makeLongBone(0.017, 0.013);
      const fibulaR = makeLongBone(0.008, 0.007);

      const jNeck = makeJointSphere(0.022);
      const jLumbar = makeJointSphere(0.024);
      const jShoulderL = makeJointSphere(0.025);
      const jShoulderR = makeJointSphere(0.025);
      const jElbowL = makeJointSphere(0.020);
      const jElbowR = makeJointSphere(0.020);
      const jWristL = makeJointSphere(0.015);
      const jWristR = makeJointSphere(0.015);
      const jHipL = makeJointSphere(0.027);
      const jHipR = makeJointSphere(0.027);
      const jKneeL = makeJointSphere(0.023);
      const jKneeR = makeJointSphere(0.023);
      const jAnkleL = makeJointSphere(0.018);
      const jAnkleR = makeJointSphere(0.018);

      const upVec = new THREE.Vector3(0, 1, 0);
      const tmpDir = new THREE.Vector3();
      const tmpMid = new THREE.Vector3();
      const tmpSide = new THREE.Vector3();
      const tmpA = new THREE.Vector3();
      const tmpB = new THREE.Vector3();

      const alignBone = (mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3) => {
        tmpDir.subVectors(end, start);
        const len = Math.max(0.001, tmpDir.length());
        tmpMid.addVectors(start, end).multiplyScalar(0.5);
        mesh.position.copy(tmpMid);
        mesh.scale.set(1, len, 1);
        mesh.quaternion.setFromUnitVectors(upVec, tmpDir.divideScalar(len));
      };

      const alignParallelPair = (
        m1: THREE.Mesh,
        m2: THREE.Mesh,
        start: THREE.Vector3,
        end: THREE.Vector3,
        offsetDir: THREE.Vector3,
        offsetAmt: number
      ) => {
        tmpSide.copy(offsetDir).normalize().multiplyScalar(offsetAmt);
        tmpA.copy(start).add(tmpSide);
        tmpB.copy(end).add(tmpSide);
        alignBone(m1, tmpA, tmpB);

        tmpA.copy(start).sub(tmpSide);
        tmpB.copy(end).sub(tmpSide);
        alignBone(m2, tmpA, tmpB);
      };

      const torsoBasisMat = new THREE.Matrix4();
      const spineCenterTmp = new THREE.Vector3();

      const updatePose = (params: {
        pelvisBottom: THREE.Vector3;
        hipsPos: THREE.Vector3;
        shoulderCenter: THREE.Vector3;
        torsoRight: THREE.Vector3;
        torsoUp: THREE.Vector3;
        torsoAnterior: THREE.Vector3;
        headBasisMat: THREE.Matrix4;
        spineArchOffset: number;
        breathScale: number;
        shoulderL: THREE.Vector3;
        shoulderR: THREE.Vector3;
        elbowL: THREE.Vector3;
        elbowR: THREE.Vector3;
        handL: THREE.Vector3;
        handR: THREE.Vector3;
        handTipL: THREE.Vector3;
        handTipR: THREE.Vector3;
        hipL: THREE.Vector3;
        hipR: THREE.Vector3;
        kneeL: THREE.Vector3;
        kneeR: THREE.Vector3;
        footL: THREE.Vector3;
        footR: THREE.Vector3;
      }) => {
        if (!group.visible) return;

        torsoBasisMat.makeBasis(params.torsoRight, params.torsoUp, params.torsoAnterior);

        skullGroup.position.copy(params.shoulderCenter);
        skullGroup.quaternion.setFromRotationMatrix(params.headBasisMat);

        for (let i = 0; i < vertebrae.length; i++) {
          const u = (i + 0.5) / vertebrae.length;
          spineCenterTmp.lerpVectors(params.pelvisBottom, params.shoulderCenter, u);
          const arch = Math.sin(u * Math.PI) * params.spineArchOffset;
          spineCenterTmp.addScaledVector(params.torsoAnterior, arch - 0.025);
          vertebrae[i].position.copy(spineCenterTmp);
          vertebrae[i].quaternion.setFromRotationMatrix(torsoBasisMat);
        }

        ribcageGroup.position.lerpVectors(params.hipsPos, params.shoulderCenter, 0.68);
        ribcageGroup.position.addScaledVector(params.torsoAnterior, params.spineArchOffset * 0.65);
        ribcageGroup.quaternion.setFromRotationMatrix(torsoBasisMat);
        ribcageGroup.scale.set(params.breathScale, 1.0, params.breathScale);

        pelvisGroup.position.copy(params.hipsPos);
        pelvisGroup.quaternion.setFromRotationMatrix(torsoBasisMat);

        const collarBase = params.shoulderCenter.clone().addScaledVector(params.torsoUp, -0.025);
        alignBone(clavicleL, collarBase, params.shoulderL);
        alignBone(clavicleR, collarBase, params.shoulderR);

        alignBone(humerusL, params.shoulderL, params.elbowL);
        alignBone(humerusR, params.shoulderR, params.elbowR);
        alignParallelPair(radiusL, ulnaL, params.elbowL, params.handL, params.torsoRight, 0.011);
        alignParallelPair(radiusR, ulnaR, params.elbowR, params.handR, params.torsoRight, 0.011);
        alignBone(handBoneL, params.handL, params.handTipL);
        alignBone(handBoneR, params.handR, params.handTipR);

        alignBone(femurL, params.hipL, params.kneeL);
        alignBone(femurR, params.hipR, params.kneeR);
        alignParallelPair(tibiaL, fibulaL, params.kneeL, params.footL, params.torsoRight, 0.012);
        alignParallelPair(tibiaR, fibulaR, params.kneeR, params.footR, params.torsoRight, 0.012);

        jNeck.position.copy(params.shoulderCenter);
        jLumbar.position.lerpVectors(params.hipsPos, params.shoulderCenter, 0.32);
        jShoulderL.position.copy(params.shoulderL);
        jShoulderR.position.copy(params.shoulderR);
        jElbowL.position.copy(params.elbowL);
        jElbowR.position.copy(params.elbowR);
        jWristL.position.copy(params.handL);
        jWristR.position.copy(params.handR);
        jHipL.position.copy(params.hipL);
        jHipR.position.copy(params.hipR);
        jKneeL.position.copy(params.kneeL);
        jKneeR.position.copy(params.kneeR);
        jAnkleL.position.copy(params.footL);
        jAnkleR.position.copy(params.footR);
      };

      return { group, updatePose };
    };

    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    const axialBody = buildUnifiedAxialBody();
    const armL = buildSkinnedArm();
    const armR = buildSkinnedArm();
    const handRigL = buildAnatomicalHandGroup('left');
    const handRigR = buildAnatomicalHandGroup('right');
    const legL = buildSkinnedLeg();
    const legR = buildSkinnedLeg();
    const footMeshL = buildBarefootGroup('left');
    const footMeshR = buildBarefootGroup('right');
    const skeletonRig = buildAnatomicalSkeleton();

    characterRoot.add(
      axialBody.mesh,
      armL.mesh,
      armR.mesh,
      handRigL.group,
      handRigR.group,
      legL.mesh,
      legR.mesh,
      footMeshL,
      footMeshR,
      skeletonRig.group
    );

    // ============================================================================
    // COMPLETE GYM & STUDIO EQUIPMENT SUITE (Exact Collision & Anchor Alignment)
    // ============================================================================
    const equipmentRoot = new THREE.Group();
    scene.add(equipmentRoot);

    // 1. Exercise Mat (top at y = BODY_METRICS.MAT_TOP_Y = 0.018) + Recovery Pillow
    const matGroup = new THREE.Group();
    const matBody = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.018, 1.98), matSurfaceMat);
    matBody.position.set(0, 0.009, -0.05);
    matBody.receiveShadow = true;
    const matTrim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.014, 2.00), matBorderMat);
    matTrim.position.set(0, 0.007, -0.05);
    matTrim.receiveShadow = true;
    matGroup.add(matTrim, matBody);
    matGroup.visible = false;
    equipmentRoot.add(matGroup);

    const pillowMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.34, 12, 16), pillowMat);
    pillowMesh.rotation.z = Math.PI / 2;
    pillowMesh.scale.set(1.0, 1.0, 1.45);
    pillowMesh.position.set(0, 0.056, -0.78);
    pillowMesh.castShadow = true;
    pillowMesh.receiveShadow = true;
    pillowMesh.visible = false;
    equipmentRoot.add(pillowMesh);

    // 2. Pull-Up Rig (Crossbar at y = BODY_METRICS.BAR_Y = 2.12)
    const pullupRigGroup = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.032, 0.032, BAR_Y + 0.12, 20);
    const postL = new THREE.Mesh(postGeo, equipDarkMat);
    postL.position.set(-0.68, (BAR_Y + 0.12) * 0.5, 0);
    postL.castShadow = true;
    const postR = new THREE.Mesh(postGeo, equipDarkMat);
    postR.position.set(0.68, (BAR_Y + 0.12) * 0.5, 0);
    postR.castShadow = true;

    const basePlateGeo = new THREE.BoxGeometry(0.24, 0.03, 0.58);
    const baseL = new THREE.Mesh(basePlateGeo, equipDarkMat);
    baseL.position.set(-0.68, 0.015, 0);
    const baseR = new THREE.Mesh(basePlateGeo, equipDarkMat);
    baseR.position.set(0.68, 0.015, 0);

    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.48, 24),
      equipChromeMat
    );
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, BAR_Y, 0);
    crossbar.castShadow = true;

    const gripGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 16);
    const gripL = new THREE.Mesh(gripGeo, equipDarkMat);
    gripL.rotation.z = Math.PI / 2;
    gripL.position.set(-0.34, BAR_Y, 0);
    const gripR = new THREE.Mesh(gripGeo, equipDarkMat);
    gripR.rotation.z = Math.PI / 2;
    gripR.position.set(0.34, BAR_Y, 0);

    pullupRigGroup.add(postL, postR, baseL, baseR, crossbar, gripL, gripR);
    pullupRigGroup.visible = false;
    equipmentRoot.add(pullupRigGroup);

    // 3. Parallel Dip Bars Station (x = ±0.27, y = BODY_METRICS.DIP_BAR_Y = 1.16)
    const dipBarsGroup = new THREE.Group();
    [-DIP_BAR_HALF_X, DIP_BAR_HALF_X].forEach((x) => {
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.020, 0.020, 0.86, 18),
        equipChromeMat
      );
      handle.rotation.x = Math.PI / 2;
      handle.position.set(x, DIP_BAR_Y, 0);
      handle.castShadow = true;

      const uprightF = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.026, DIP_BAR_Y, 14),
        equipDarkMat
      );
      uprightF.position.set(x, DIP_BAR_Y * 0.5, 0.38);
      uprightF.castShadow = true;

      const uprightB = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.026, DIP_BAR_Y, 14),
        equipDarkMat
      );
      uprightB.position.set(x, DIP_BAR_Y * 0.5, -0.38);
      uprightB.castShadow = true;

      const baseBar = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.036, 0.92), equipMetalMat);
      baseBar.position.set(x, 0.018, 0);

      dipBarsGroup.add(handle, uprightF, uprightB, baseBar);
    });
    const dipCrossBase = new THREE.Mesh(
      new THREE.BoxGeometry(DIP_BAR_HALF_X * 2 + 0.10, 0.032, 0.07),
      equipMetalMat
    );
    dipCrossBase.position.set(0, 0.016, -0.38);
    dipBarsGroup.add(dipCrossBase);
    dipBarsGroup.visible = false;
    equipmentRoot.add(dipBarsGroup);

    // 4. Flat Utility Bench (Pad centered at local z = 0, top surface at y = 0.455, length = 1.24 => front edge = benchPos.z + 0.62)
    const benchGroup = new THREE.Group();
    const benchPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 1.24), equipDarkMat);
    benchPad.position.set(0, 0.42, 0);
    benchPad.castShadow = true;
    benchPad.receiveShadow = true;
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.40, 0.06), equipMetalMat);
    leg1.position.set(0, 0.20, 0.48);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.40, 0.06), equipMetalMat);
    leg2.position.set(0, 0.20, -0.48);
    const footBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.06), equipMetalMat);
    footBar1.position.set(0, 0.018, 0.48);
    const footBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.06), equipMetalMat);
    footBar2.position.set(0, 0.018, -0.48);
    benchGroup.add(benchPad, leg1, leg2, footBar1, footBar2);
    benchGroup.visible = false;
    equipmentRoot.add(benchGroup);

    // 5. Adjustable Incline Bench (Used by Incline Dumbbell Press, Incline Curl, Leg Press)
    const inclineBenchGroup = new THREE.Group();
    const incSeat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.36), equipDarkMat);
    incSeat.position.set(0, 0.42, 0.16);
    incSeat.castShadow = true;
    incSeat.receiveShadow = true;

    const incBackPivot = new THREE.Group();
    incBackPivot.position.set(0, 0.42, -0.02);
    const incBackPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.84), equipDarkMat);
    incBackPad.position.set(0, 0, -0.42);
    incBackPad.castShadow = true;
    incBackPad.receiveShadow = true;
    incBackPivot.add(incBackPad);

    const incFrameRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.04), equipMetalMat);
    incFrameRail.position.set(0, 0.18, -0.18);
    const incLegF = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), equipMetalMat);
    incLegF.position.set(0, 0.19, 0.26);
    const incLegB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), equipMetalMat);
    incLegB.position.set(0, 0.19, -0.62);
    const incStrut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.05), equipMetalMat);
    incStrut.position.set(0, 0.42, -0.34);
    inclineBenchGroup.add(incSeat, incBackPivot, incFrameRail, incLegF, incLegB, incStrut);
    inclineBenchGroup.visible = false;
    equipmentRoot.add(inclineBenchGroup);

    // 6. Olympic Barbell
    const barbellGroup = new THREE.Group();
    const barMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1.78, 16),
      equipChromeMat
    );
    barMesh.rotation.z = Math.PI / 2;
    barbellGroup.add(barMesh);
    [-0.66, -0.60, 0.60, 0.66].forEach((xOffset, idx) => {
      const r = idx === 0 || idx === 3 ? 0.16 : 0.20;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.032, 24), equipDarkMat);
      plate.rotation.z = Math.PI / 2;
      plate.position.x = xOffset;
      plate.castShadow = true;
      barbellGroup.add(plate);
    });
    barbellGroup.visible = false;
    equipmentRoot.add(barbellGroup);

    // 7. Pair of Dumbbells
    const makeDumbbell = () => {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.14, 12),
        equipChromeMat
      );
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
      [-0.062, 0.062].forEach((x) => {
        const head = new THREE.Mesh(
          new THREE.CylinderGeometry(0.056, 0.056, 0.036, 16),
          equipDarkMat
        );
        head.rotation.z = Math.PI / 2;
        head.position.x = x;
        head.castShadow = true;
        g.add(head);
      });
      g.visible = false;
      equipmentRoot.add(g);
      return g;
    };
    const dumbbellL = makeDumbbell();
    const dumbbellR = makeDumbbell();

    // 8. Cable Attachment Bar + Dynamic Taut Cable Line (Lat Pulldown, Seated Cable Row, Pushdowns)
    const cableBarGroup = new THREE.Group();
    const cableHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.88, 16),
      equipChromeMat
    );
    cableHandle.rotation.z = Math.PI / 2;
    cableHandle.castShadow = true;
    const cableLineMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 1, 8),
      equipMetalMat
    );
    const cablePulley = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), equipDarkMat);
    cablePulley.rotation.z = Math.PI / 2;
    cableBarGroup.add(cableHandle, cableLineMesh, cablePulley);
    cableBarGroup.visible = false;
    equipmentRoot.add(cableBarGroup);

    // 9. Inverted Row / Table Row Bar
    const rowBarGroup = new THREE.Group();
    const rowCross = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.24, 18),
      equipChromeMat
    );
    rowCross.rotation.z = Math.PI / 2;
    rowCross.castShadow = true;
    const rowPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 1.0, 14), equipDarkMat);
    const rowPostR = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 1.0, 14), equipDarkMat);
    rowBarGroup.add(rowCross, rowPostL, rowPostR);
    rowBarGroup.visible = false;
    equipmentRoot.add(rowBarGroup);

    // 10. Resistance Towel Strap (Towel Bicep Curls / Isometric Towel Curls)
    const towelGroup = new THREE.Group();
    const towelSegL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 10), towelMat);
    const towelSegR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 10), towelMat);
    const towelLoop = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 8, 16), towelMat);
    towelLoop.rotation.x = Math.PI / 2;
    towelGroup.add(towelSegL, towelSegR, towelLoop);
    towelGroup.visible = false;
    equipmentRoot.add(towelGroup);

    const _segUp = new THREE.Vector3(0, 1, 0);
    const _segDir = new THREE.Vector3();
    const _segMid = new THREE.Vector3();
    const alignCylinderBetween = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      _segDir.subVectors(b, a);
      const len = Math.max(0.005, _segDir.length());
      _segMid.addVectors(a, b).multiplyScalar(0.5);
      mesh.position.copy(_segMid);
      mesh.scale.set(1, len, 1);
      mesh.quaternion.setFromUnitVectors(_segUp, _segDir.divideScalar(len));
    };

    // ============================================================================
    // SMOOTH MUSCLE HIGHLIGHT INTERPOLATION (Symmetrical Red-Orange Anatomical Glow)
    // ============================================================================
    interface MaterialTargetState {
      color: THREE.Color;
      emissive: THREE.Color;
      emissiveIntensity: number;
      roughness: number;
    }

    const muscleTargets: Record<MuscleGroup, MaterialTargetState> = {} as Record<
      MuscleGroup,
      MaterialTargetState
    >;
    muscleIds.forEach((id) => {
      muscleTargets[id] = {
        color: new THREE.Color(MANNEQUIN_BASE_HEX),
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
        roughness: 0.64,
      };
    });

    const shortsGlutesTarget: MaterialTargetState = {
      color: new THREE.Color(CHARCOAL_FABRIC_HEX),
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      roughness: 0.84,
    };

    const applyDisplayModeVisuals = (mode: MannequinDisplayMode) => {
      const isXray = mode === 'xray';
      const isSkeletonOnly = mode === 'skeleton';
      const skinOpacity = isSkeletonOnly ? 0.09 : isXray ? 0.30 : 1.0;
      const shortsOpacity = isSkeletonOnly ? 0.07 : isXray ? 0.24 : 1.0;
      const isTranslucent = isXray || isSkeletonOnly;

      skeletonRig.group.visible = isTranslucent;

      const setMatAlpha = (mat: THREE.Material, opacity: number) => {
        const m = mat as THREE.MeshPhysicalMaterial;
        m.transparent = isTranslucent;
        m.opacity = opacity;
        m.depthWrite = !isTranslucent;
        m.needsUpdate = true;
      };

      setMatAlpha(skinMat, skinOpacity);
      setMatAlpha(skinMatNoVC, skinOpacity);
      setMatAlpha(shortsMat, shortsOpacity);
      setMatAlpha(shortsTrimMat, shortsOpacity);
      setMatAlpha(shortsGlutesMat, shortsOpacity);
      muscleIds.forEach((id) => {
        setMatAlpha(muscleMaterials[id], skinOpacity);
      });
    };

    const applyMuscleTargetImmediate = () => {
      muscleIds.forEach((id) => {
        const mat = muscleMaterials[id];
        const tgt = muscleTargets[id];
        if (!mat || !tgt) return;
        mat.color.copy(tgt.color);
        mat.emissive.copy(tgt.emissive);
        mat.emissiveIntensity = tgt.emissiveIntensity;
        mat.roughness = tgt.roughness;
      });
      shortsGlutesMat.color.copy(shortsGlutesTarget.color);
      shortsGlutesMat.emissive.copy(shortsGlutesTarget.emissive);
      shortsGlutesMat.emissiveIntensity = shortsGlutesTarget.emissiveIntensity;
    };

    const stepMuscleTransitions = (dt: number) => {
      const alpha = dt <= 0 ? 1 : 1 - Math.exp(-9.0 * dt);
      muscleIds.forEach((id) => {
        const mat = muscleMaterials[id];
        const tgt = muscleTargets[id];
        if (!mat || !tgt) return;
        mat.color.lerp(tgt.color, alpha);
        mat.emissive.lerp(tgt.emissive, alpha);
        mat.emissiveIntensity += (tgt.emissiveIntensity - mat.emissiveIntensity) * alpha;
        mat.roughness += (tgt.roughness - mat.roughness) * alpha;
      });
      shortsGlutesMat.color.lerp(shortsGlutesTarget.color, alpha);
      shortsGlutesMat.emissive.lerp(shortsGlutesTarget.emissive, alpha);
      shortsGlutesMat.emissiveIntensity +=
        (shortsGlutesTarget.emissiveIntensity - shortsGlutesMat.emissiveIntensity) * alpha;
    };

    const updateMuscleMaterials = (immediate = false) => {
      const {
        primaryMuscles: prim,
        secondaryMuscles: sec,
        showMaskDebug: debug,
        displayMode: mode,
      } = stateRef.current;

      applyDisplayModeVisuals(mode);

      muscleIds.forEach((id) => {
        const tgt = muscleTargets[id];
        if (!tgt) return;

        if (debug) {
          tgt.color.setHex(debugColors[id]);
          tgt.emissive.setHex(debugColors[id]);
          tgt.emissiveIntensity = 0.28;
          tgt.roughness = 0.52;
        } else if (prim.includes(id)) {
          tgt.color.setHex(0xe53935);
          tgt.emissive.setHex(0xb71c1c);
          tgt.emissiveIntensity = 0.36;
          tgt.roughness = 0.52;
        } else if (sec.includes(id)) {
          tgt.color.setHex(0xf57c00);
          tgt.emissive.setHex(0xc2410c);
          tgt.emissiveIntensity = 0.22;
          tgt.roughness = 0.56;
        } else {
          tgt.color.setHex(MANNEQUIN_BASE_HEX);
          tgt.emissive.setHex(0x000000);
          tgt.emissiveIntensity = 0.0;
          tgt.roughness = 0.64;
        }
      });

      if (debug) {
        shortsGlutesTarget.color.setHex(debugColors.glutes);
        shortsGlutesTarget.emissive.setHex(debugColors.glutes);
        shortsGlutesTarget.emissiveIntensity = 0.28;
      } else if (prim.includes('glutes')) {
        shortsGlutesTarget.color.setHex(0xe53935);
        shortsGlutesTarget.emissive.setHex(0xb71c1c);
        shortsGlutesTarget.emissiveIntensity = 0.34;
      } else if (sec.includes('glutes')) {
        shortsGlutesTarget.color.setHex(0xf57c00);
        shortsGlutesTarget.emissive.setHex(0xc2410c);
        shortsGlutesTarget.emissiveIntensity = 0.22;
      } else {
        shortsGlutesTarget.color.setHex(CHARCOAL_FABRIC_HEX);
        shortsGlutesTarget.emissive.setHex(0x000000);
        shortsGlutesTarget.emissiveIntensity = 0.0;
      }

      if (immediate) {
        applyMuscleTargetImmediate();
      }
    };

    // ============================================================================
    // CAMERA PRESETS (Per-Exercise Framing across Floor, Sleep, Bench, Hanging, Standing)
    // ============================================================================
    const getCameraGroup = (): CameraGroup => {
      const st = stateRef.current;
      const resolved = resolveExerciseId(st.exerciseId, st.exerciseName, st.clipName);
      return evaluateExercisePose(resolved, st.clipName, st.exerciseName, 0).cameraGroup;
    };

    const computeCameraView = (
      preset: CameraPreset,
      group: CameraGroup
    ): { pos: THREE.Vector3; target: THREE.Vector3 } => {
      if (group === 'sleep') {
        const target = new THREE.Vector3(0, 0.18, -0.05);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 0.95, 2.25), target };
          case 'side':
            return { pos: new THREE.Vector3(2.35, 0.92, -0.05), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 0.95, -2.35), target };
          case 'top':
            return { pos: new THREE.Vector3(0.02, 2.65, -0.05), target };
        }
      }

      if (group === 'floor') {
        const target = new THREE.Vector3(0, 0.42, -0.06);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 0.92, 2.45), target };
          case 'side':
            return { pos: new THREE.Vector3(2.58, 0.82, 0.42), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 0.92, -2.55), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 2.85, -0.06), target };
        }
      }

      if (group === 'bench') {
        const target = new THREE.Vector3(0, 0.64, -0.06);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 0.98, 2.65), target };
          case 'side':
            return { pos: new THREE.Vector3(2.62, 0.88, 0.48), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 1.02, -2.75), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 3.10, -0.06), target };
        }
      }

      if (group === 'hanging') {
        const target = new THREE.Vector3(0, 1.24, 0);
        switch (preset) {
          case 'front':
            return { pos: new THREE.Vector3(0, 1.26, 3.65), target };
          case 'side':
            // 3/4 athletic side view prevents vertical rig post from occluding body
            return { pos: new THREE.Vector3(3.15, 1.24, 1.25), target };
          case 'back':
            return { pos: new THREE.Vector3(0, 1.26, -3.65), target };
          case 'top':
            return { pos: new THREE.Vector3(0.01, 3.90, 0.05), target };
        }
      }

      const target = new THREE.Vector3(0, 0.94, 0);
      switch (preset) {
        case 'front':
          return { pos: new THREE.Vector3(0, 1.04, 3.35), target };
        case 'side':
          return { pos: new THREE.Vector3(2.95, 1.00, 0.85), target };
        case 'back':
          return { pos: new THREE.Vector3(0, 1.04, -3.35), target };
        case 'top':
          return { pos: new THREE.Vector3(0.01, 3.35, 0.05), target };
      }
    };

    let cameraTransition: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
    const onControlsStart = () => {
      cameraTransition = null;
    };
    controls.addEventListener('start', onControlsStart);

    const applyCameraPreset = (preset: CameraPreset, immediate = false) => {
      const { pos, target } = computeCameraView(preset, getCameraGroup());
      if (immediate || prefersReducedMotion) {
        cameraTransition = null;
        camera.position.copy(pos);
        controls.target.copy(target);
        controls.update();
      } else {
        cameraTransition = { pos, target };
      }
    };

    updateMuscleMaterials(true);
    applyCameraPreset(stateRef.current.cameraPreset, true);

    // Reusable scratch vectors/matrices for 60 FPS zero-GC updates
    const torsoRight = new THREE.Vector3();
    const torsoUp = new THREE.Vector3();
    const torsoAnterior = new THREE.Vector3();
    const headFrameX = new THREE.Vector3();
    const headFrameY = new THREE.Vector3();
    const headFrameZ = new THREE.Vector3();
    const headBasisMat = new THREE.Matrix4();
    const armAntRootL = new THREE.Vector3();
    const armAntEndL = new THREE.Vector3();
    const armAntRootR = new THREE.Vector3();
    const armAntEndR = new THREE.Vector3();
    const legAntRootL = new THREE.Vector3();
    const legAntEndL = new THREE.Vector3();
    const legAntRootR = new THREE.Vector3();
    const legAntEndR = new THREE.Vector3();
    const handMatL = new THREE.Matrix4();
    const handMatR = new THREE.Matrix4();
    const footMatL = new THREE.Matrix4();
    const footMatR = new THREE.Matrix4();
    const footWorldPosL = new THREE.Vector3();
    const footWorldPosR = new THREE.Vector3();
    const forearmDirL = new THREE.Vector3();
    const forearmDirR = new THREE.Vector3();
    const handTipL = new THREE.Vector3();
    const handTipR = new THREE.Vector3();

    const armElbowJointS = UPPER_ARM_LEN / (UPPER_ARM_LEN + FOREARM_LEN);
    const legKneeJointS = THIGH_LEN / (THIGH_LEN + CALF_LEN);

    // ============================================================================
    // BIOMECHANICAL IK & SKINNED DEFORMATION ENGINE (All 56 Exercises)
    // ============================================================================
    const applyProceduralPose = (
      exId: string | undefined,
      clip: AnimationClipName,
      exName: string,
      frame: number
    ): CameraGroup => {
      const pose = evaluateExercisePose(exId, clip, exName, frame);
      const norm = (((frame % 60) + 60) % 60) / 60;
      const breathWave = Math.sin(norm * Math.PI * 2);

      // 1. Orthonormal Torso & Spine Curve
      const rawTorsoVec = new THREE.Vector3().subVectors(pose.shoulderCenter, pose.hipsPos);
      computeOrthonormalFrame(rawTorsoVec, pose.torsoAnterior, torsoRight, torsoUp, torsoAnterior);

      const pelvisBottom = pose.hipsPos.clone().addScaledVector(torsoUp, -PELVIS_DROP);
      const headUpDir = torsoUp
        .clone()
        .addScaledVector(pose.headLookDir, 0.08)
        .normalize();
      const headTop = pose.shoulderCenter.clone().addScaledVector(headUpDir, HEAD_NECK_LEN);
      const dynamicSpineArch = pose.spineArchOffset + breathWave * pose.breathAmplitude;

      const totalAxialLen = PELVIS_DROP + TORSO_LEN + HEAD_NECK_LEN;
      const sPelvisEnd = PELVIS_DROP / totalAxialLen;
      const sTorsoEnd = (PELVIS_DROP + TORSO_LEN) / totalAxialLen;

      axialBody.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        if (s <= sPelvisEnd) {
          const u = s / sPelvisEnd;
          outCenter.lerpVectors(pelvisBottom, pose.hipsPos, u);
          outX.copy(torsoRight);
          outY.copy(torsoUp);
          outZ.copy(torsoAnterior);
        } else if (s <= sTorsoEnd) {
          const u = (s - sPelvisEnd) / (sTorsoEnd - sPelvisEnd);
          outCenter.lerpVectors(pose.hipsPos, pose.shoulderCenter, u);
          const archCurve = Math.sin(u * Math.PI);
          outCenter.addScaledVector(torsoAnterior, archCurve * dynamicSpineArch);
          const archDeriv = (Math.cos(u * Math.PI) * Math.PI * dynamicSpineArch) / TORSO_LEN;
          const localTang = torsoUp.clone().addScaledVector(torsoAnterior, archDeriv).normalize();
          computeOrthonormalFrame(localTang, torsoAnterior, outX, outY, outZ);
        } else {
          const u = (s - sTorsoEnd) / (1 - sTorsoEnd);
          outCenter.lerpVectors(pose.shoulderCenter, headTop, u);
          const neckBlend = Math.min(1, u * 2.0);
          const ant = new THREE.Vector3()
            .lerpVectors(torsoAnterior, pose.headLookDir, neckBlend)
            .normalize();
          const tang = new THREE.Vector3().lerpVectors(torsoUp, headUpDir, neckBlend).normalize();
          computeOrthonormalFrame(tang, ant, outX, outY, outZ);
        }
      });

      computeOrthonormalFrame(headUpDir, pose.headLookDir, headFrameX, headFrameY, headFrameZ);
      headBasisMat.makeBasis(headFrameX, headFrameY, headFrameZ);

      // 2. Shoulder & Hip Sockets (With real Shrug elevation!)
      const shoulderDrop = -SHOULDER_DROP_FROM_TOP + pose.shoulderShrugY;
      const shoulderL = pose.shoulderCenter
        .clone()
        .addScaledVector(torsoRight, -SHOULDER_HALF_WIDTH)
        .addScaledVector(torsoUp, shoulderDrop);
      const shoulderR = pose.shoulderCenter
        .clone()
        .addScaledVector(torsoRight, SHOULDER_HALF_WIDTH)
        .addScaledVector(torsoUp, shoulderDrop);

      const hipL = pose.hipsPos
        .clone()
        .addScaledVector(torsoRight, -HIP_HALF_WIDTH)
        .addScaledVector(torsoUp, HIP_OFFSET_UP);
      const hipR = pose.hipsPos
        .clone()
        .addScaledVector(torsoRight, HIP_HALF_WIDTH)
        .addScaledVector(torsoUp, HIP_OFFSET_UP);

      // 3. Constrained Arm IK (Elbow strictly 0°..150°, zero dislocation) + Sculpted 3D Hands
      const armIkL = solveConstrainedTwoBoneIK(
        shoulderL,
        pose.handL,
        UPPER_ARM_LEN,
        FOREARM_LEN,
        pose.elbowPoleL,
        JOINT_LIMITS_DEG.ELBOW_MAX
      );
      const armIkR = solveConstrainedTwoBoneIK(
        shoulderR,
        pose.handR,
        UPPER_ARM_LEN,
        FOREARM_LEN,
        pose.elbowPoleR,
        JOINT_LIMITS_DEG.ELBOW_MAX
      );

      const elbowL = armIkL.midPos;
      const elbowR = armIkR.midPos;
      const wristL = armIkL.clampedEndPos;
      const wristR = armIkR.clampedEndPos;

      computeTwoBoneAnatomicalFrames(
        shoulderL,
        elbowL,
        wristL,
        pose.elbowPoleL,
        true,
        torsoAnterior,
        armAntRootL,
        armAntEndL
      );
      computeTwoBoneAnatomicalFrames(
        shoulderR,
        elbowR,
        wristR,
        pose.elbowPoleR,
        true,
        torsoAnterior,
        armAntRootR,
        armAntEndR
      );

      armL.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          armElbowJointS,
          0.09,
          shoulderL,
          elbowL,
          wristL,
          armAntRootL,
          armAntEndL,
          -0.006,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      armR.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          armElbowJointS,
          0.09,
          shoulderR,
          elbowR,
          wristR,
          armAntRootR,
          armAntEndR,
          -0.006,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      // Orient & Pose Sculpted 3D Anatomical Hands
      computeAnatomicalHandBasis(
        elbowL,
        wristL,
        armAntEndL,
        pose.handMode,
        pose.palmNormalHint,
        handMatL
      );
      computeAnatomicalHandBasis(
        elbowR,
        wristR,
        armAntEndR,
        pose.handMode,
        pose.palmNormalHint,
        handMatR
      );

      handRigL.group.position.copy(wristL);
      handRigL.group.quaternion.setFromRotationMatrix(handMatL);
      handRigL.setHandPose(pose.handMode);

      handRigR.group.position.copy(wristR);
      handRigR.group.quaternion.setFromRotationMatrix(handMatR);
      handRigR.setHandPose(pose.handMode);

      forearmDirL.subVectors(wristL, elbowL).normalize();
      forearmDirR.subVectors(wristR, elbowR).normalize();
      handTipL.copy(wristL).addScaledVector(forearmDirL, HAND_LEN);
      handTipR.copy(wristR).addScaledVector(forearmDirR, HAND_LEN);

      // 4. Constrained Leg IK (Knee strictly 0°..145°, zero backward bend) + Tibia-Aligned Feet
      const legIkL = solveConstrainedTwoBoneIK(
        hipL,
        pose.footL,
        THIGH_LEN,
        CALF_LEN,
        pose.kneePoleL,
        JOINT_LIMITS_DEG.KNEE_MAX
      );
      const legIkR = solveConstrainedTwoBoneIK(
        hipR,
        pose.footR,
        THIGH_LEN,
        CALF_LEN,
        pose.kneePoleR,
        JOINT_LIMITS_DEG.KNEE_MAX
      );

      const kneeL = legIkL.midPos;
      const kneeR = legIkR.midPos;
      const ankleL = legIkL.clampedEndPos;
      const ankleR = legIkR.clampedEndPos;

      computeTwoBoneAnatomicalFrames(
        hipL,
        kneeL,
        ankleL,
        pose.kneePoleL,
        false,
        torsoAnterior,
        legAntRootL,
        legAntEndL
      );
      computeTwoBoneAnatomicalFrames(
        hipR,
        kneeR,
        ankleR,
        pose.kneePoleR,
        false,
        torsoAnterior,
        legAntRootR,
        legAntEndR
      );

      legL.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          legKneeJointS,
          0.09,
          hipL,
          kneeL,
          ankleL,
          legAntRootL,
          legAntEndL,
          0.011,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      legR.deformBySpineCurve((s, outCenter, outX, outY, outZ) => {
        evaluateTwoBoneSkinnedRing(
          s,
          legKneeJointS,
          0.09,
          hipR,
          kneeR,
          ankleR,
          legAntRootR,
          legAntEndR,
          0.011,
          outCenter,
          outX,
          outY,
          outZ
        );
      });

      // 5. Orient Sculpted Anatomical Feet from Live Tibia & Anterior Shin Basis (ZERO reversed feet!)
      computeAnatomicalFootBasis(
        kneeL,
        ankleL,
        legAntEndL,
        pose.footModeL,
        pose.footPitchL,
        'left',
        pose.groundY,
        footWorldPosL,
        footMatL
      );
      computeAnatomicalFootBasis(
        kneeR,
        ankleR,
        legAntEndR,
        pose.footModeR,
        pose.footPitchR,
        'right',
        pose.groundY,
        footWorldPosR,
        footMatR
      );

      footMeshL.position.copy(footWorldPosL);
      footMeshL.quaternion.setFromRotationMatrix(footMatL);
      footMeshR.position.copy(footWorldPosR);
      footMeshR.quaternion.setFromRotationMatrix(footMatR);

      // 6. Position & Synchronize Gym/Studio Equipment Props directly with Clamped Hands
      const eq = pose.equipment;
      matGroup.visible = eq.showMat;
      pillowMesh.visible = eq.showPillow;
      pullupRigGroup.visible = eq.showPullupRig;
      dipBarsGroup.visible = eq.showDipBars;

      benchGroup.visible = eq.showFlatBench;
      if (eq.showFlatBench) {
        benchGroup.position.copy(eq.benchPos);
      }

      inclineBenchGroup.visible = eq.showInclineBench;
      if (eq.showInclineBench) {
        inclineBenchGroup.position.copy(eq.benchPos);
        incBackPivot.rotation.x = eq.inclineAngleRad;
      }

      barbellGroup.visible = eq.showBarbell;
      if (eq.showBarbell) {
        // Center barbell precisely across clamped wrist grip midpoint so hands never detach from bar
        const gripMid = new THREE.Vector3().addVectors(wristL, wristR).multiplyScalar(0.5);
        barbellGroup.position.copy(gripMid);
        barbellGroup.position.y = Math.max(0.20, gripMid.y);
      }

      dumbbellL.visible = eq.showDumbbells;
      dumbbellR.visible = eq.showDumbbells;
      if (eq.showDumbbells) {
        const palmOffsetL = forearmDirL.clone().multiplyScalar(0.045);
        const palmOffsetR = forearmDirR.clone().multiplyScalar(0.045);
        dumbbellL.position.copy(wristL).add(palmOffsetL);
        dumbbellL.rotation.copy(eq.dumbbellLRot);
        dumbbellR.position.copy(wristR).add(palmOffsetR);
        dumbbellR.rotation.copy(eq.dumbbellRRot);
      }

      cableBarGroup.visible = eq.showCableBar;
      if (eq.showCableBar) {
        const handleCenter = new THREE.Vector3().addVectors(wristL, wristR).multiplyScalar(0.5);
        cableHandle.position.copy(handleCenter);
        cablePulley.position.copy(eq.cableAnchorTop);
        alignCylinderBetween(cableLineMesh, handleCenter, eq.cableAnchorTop);
      }

      rowBarGroup.visible = eq.showRowBar;
      if (eq.showRowBar) {
        rowCross.position.set(0, eq.rowBarY, eq.rowBarZ);
        rowPostL.position.set(-0.56, eq.rowBarY * 0.5, eq.rowBarZ);
        rowPostL.scale.set(1, eq.rowBarY, 1);
        rowPostR.position.set(0.56, eq.rowBarY * 0.5, eq.rowBarZ);
        rowPostR.scale.set(1, eq.rowBarY, 1);
      }

      towelGroup.visible = eq.showTowel;
      if (eq.showTowel) {
        towelLoop.position.copy(eq.towelFootPos);
        alignCylinderBetween(towelSegL, wristL, eq.towelFootPos);
        alignCylinderBetween(towelSegR, wristR, eq.towelFootPos);
      }

      // 7. Sync Live 22-Bone Articulated Anatomical Skeleton (Mode Tulang & X-Ray)
      skeletonRig.updatePose({
        pelvisBottom,
        hipsPos: pose.hipsPos,
        shoulderCenter: pose.shoulderCenter,
        torsoRight,
        torsoUp,
        torsoAnterior,
        headBasisMat,
        spineArchOffset: dynamicSpineArch,
        breathScale: 1 + breathWave * 0.025,
        shoulderL,
        shoulderR,
        elbowL,
        elbowR,
        handL: wristL,
        handR: wristR,
        handTipL,
        handTipR,
        hipL,
        hipR,
        kneeL,
        kneeR,
        footL: ankleL,
        footR: ankleR,
      });

      return pose.cameraGroup;
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
    // RENDER LOOP (Single View, 4-Angle Blueprint, Software-GL Pacing & Visibility Pause)
    // ============================================================================
    let rafId = 0;
    let lastTime: number | null = null;
    let accumSec = 0;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        rafId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed || isContextLost) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          rafId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          rafId = window.setTimeout(cb, 80);
        }
      };
      rafId = window.setTimeout(poll, 5);
    }

    const scheduleNext = () => {
      cancelAnimationFrame(rafId);
      clearTimeout(rafId);
      if (disposed || isContextLost || !isVisible || !isTabVisible) return;
      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    const tick = (now: number) => {
      if (disposed || isContextLost || !isVisible || !isTabVisible) return;

      const dt = lastTime === null ? 0 : Math.max(0, Math.min((now - lastTime) / 1000, 0.1));
      lastTime = now;

      const st = stateRef.current;
      let frameFloat = 0;

      if (st.activeKeyframe !== null && st.activeKeyframe !== undefined) {
        frameFloat = st.activeKeyframe;
      } else {
        if (st.isPlaying && !prefersReducedMotion) {
          accumSec += dt * st.tempoScale;
        }
        frameFloat = (((accumSec * 30) % 60) + 60) % 60;
      }

      const currentFrameInt = ((Math.round(frameFloat) % 60) + 60) % 60;
      if (frameBadgeRef.current) {
        frameBadgeRef.current.textContent = `FRAME ${String(currentFrameInt).padStart(2, '0')} / 60 · 30 FPS`;
      }

      stepMuscleTransitions(dt);

      if (cameraTransition) {
        const camAlpha = dt <= 0 ? 1 : 1 - Math.exp(-8.5 * dt);
        camera.position.lerp(cameraTransition.pos, camAlpha);
        controls.target.lerp(cameraTransition.target, camAlpha);
        if (
          camera.position.distanceTo(cameraTransition.pos) < 0.01 &&
          controls.target.distanceTo(cameraTransition.target) < 0.01
        ) {
          camera.position.copy(cameraTransition.pos);
          controls.target.copy(cameraTransition.target);
          cameraTransition = null;
        }
      }

      const activeCamGroup = applyProceduralPose(
        st.exerciseId,
        st.clipName,
        st.exerciseName,
        frameFloat
      );

      const isHorizontal = activeCamGroup === 'floor' || activeCamGroup === 'sleep';
      contactShadow.scale.set(isHorizontal ? 1.15 : 0.86, isHorizontal ? 1.55 : 0.86, 1);
      contactShadow.position.z = isHorizontal ? -0.10 : 0;

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
          const { pos, target } = computeCameraView(v.preset, activeCamGroup);
          auxCamera.position.copy(pos);
          auxCamera.lookAt(target);
          renderer.setViewport(v.x, v.y, halfW, halfH);
          renderer.setScissor(v.x, v.y, halfW, halfH);
          renderer.render(scene, auxCamera);
        });
      }

      scheduleNext();
    };

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              const nextVis = Boolean(entry?.isIntersecting);
              if (nextVis !== isVisible) {
                isVisible = nextVis;
                if (isVisible && isTabVisible && !disposed && !isContextLost) {
                  lastTime = performance.now();
                  scheduleNext();
                }
              }
            },
            { threshold: 0.05 }
          )
        : null;
    observer?.observe(container);

    const onVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
      if (isTabVisible && isVisible && !disposed && !isContextLost) {
        lastTime = performance.now();
        scheduleNext();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      cancelAnimationFrame(rafId);
      clearTimeout(rafId);
    };
    const onContextRestored = () => {
      isContextLost = false;
      if (!disposed) {
        lastTime = performance.now();
        scheduleNext();
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    tick(performance.now());

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(rafId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlsStart);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      disposeSceneResources(scene);
      pbr.dispose();
      envTexture.dispose();
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

      {/* Minimal Top-Left Frame Telemetry */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-3 text-[10px] font-mono font-bold text-amber-200/90 bg-[#0B1120]/80 px-2.5 py-1 rounded-lg border border-white/10">
        <span ref={frameBadgeRef} className="tracking-wider">
          FRAME 00 / 60 · 30 FPS
        </span>
        {bpSpec && (
          <span className="hidden sm:inline text-slate-300 font-sans font-semibold">
            · 180 cm · 22-Bone IK
          </span>
        )}
      </div>

      {/* Minimal Top-Right Active Mode Label */}
      <div className="pointer-events-none absolute top-3 right-3 hidden sm:flex items-center text-[10px] font-semibold text-slate-200 bg-[#0B1120]/80 px-2.5 py-1 rounded-lg border border-white/10">
        {displayMode === 'skeleton'
          ? 'Mode Tulang · Kerangka 3D'
          : displayMode === 'xray'
          ? 'Mode X-Ray · Otot + Tulang'
          : 'Mannequin PBR · Otot Aktif'}
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
