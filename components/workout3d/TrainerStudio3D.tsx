'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AnimationClipName, MuscleGroup } from '@/data/exerciseClipMap';

export type CameraPreset = 'front' | 'side' | 'back';

interface TrainerStudio3DProps {
  clip: AnimationClipName;
  biomechanicalVariant?: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  timeScale: number;
  isPaused: boolean;
  cameraPreset: CameraPreset;
  debugMuscleMask?: boolean;
}

const MUSCLE_ORDER: MuscleGroup[] = [
  'chest',
  'back_lats',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'forearms',
];

const DEBUG_COLORS: Record<MuscleGroup, number> = {
  chest: 0xef4444,
  back_lats: 0x22c55e,
  shoulders: 0x3b82f6,
  biceps: 0xa855f7,
  triceps: 0xec4899,
  abs: 0xf59e0b,
  glutes: 0x14b8a6,
  quads: 0xf97316,
  hamstrings: 0x06b6d4,
  calves: 0x84cc16,
  forearms: 0x6366f1,
};

/**
 * Generates a 1024x1024 High-Definition Anatomical Muscle Striation Albedo & Bump/Roughness Map
 * so every muscle belly renders with crisp myofibril fiber detail at any zoom angle.
 */
function create1024MuscleTextureSet(maxAnisotropy: number) {
  const size = 1024;

  // 1. 1024x1024 Albedo Fiber Striation Canvas
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d');

  // 2. 1024x1024 Bump / Micro-Roughness Striation Canvas
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  if (aCtx && bCtx) {
    // Base neutral studio tone for albedo (multiplied by material.color)
    const baseGrad = aCtx.createLinearGradient(0, 0, 0, size);
    baseGrad.addColorStop(0, '#d8e0ea');
    baseGrad.addColorStop(0.12, '#f8fafc');
    baseGrad.addColorStop(0.5, '#ffffff');
    baseGrad.addColorStop(0.88, '#f8fafc');
    baseGrad.addColorStop(1, '#cbd5e1');
    aCtx.fillStyle = baseGrad;
    aCtx.fillRect(0, 0, size, size);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    // Draw 512 high-resolution longitudinal muscle fiber striations across 1024px width
    for (let i = 0; i < 512; i++) {
      const x = (i / 512) * size;
      const wave = Math.sin(i * 0.45) * 4;
      const intensity = 0.08 + ((i * 17) % 10) * 0.012;

      aCtx.strokeStyle =
        i % 2 === 0
          ? `rgba(255, 255, 255, ${intensity})`
          : `rgba(30, 41, 59, ${intensity * 1.15})`;
      aCtx.lineWidth = i % 6 === 0 ? 2.2 : 1.1;
      aCtx.beginPath();
      aCtx.moveTo(x, 0);
      aCtx.bezierCurveTo(
        x + wave,
        size * 0.33,
        x - wave,
        size * 0.66,
        x,
        size
      );
      aCtx.stroke();

      // Bump height ridges
      bCtx.strokeStyle =
        i % 2 === 0 ? 'rgba(235, 235, 235, 0.35)' : 'rgba(25, 25, 25, 0.35)';
      bCtx.lineWidth = i % 4 === 0 ? 2.4 : 1.2;
      bCtx.beginPath();
      bCtx.moveTo(x, 0);
      bCtx.bezierCurveTo(
        x + wave,
        size * 0.33,
        x - wave,
        size * 0.66,
        x,
        size
      );
      bCtx.stroke();
    }

    // Subtle anatomical fascicle cross-bands & tendon insertion shading at top/bottom
    const tendonTop = aCtx.createLinearGradient(0, 0, 0, 96);
    tendonTop.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    tendonTop.addColorStop(1, 'rgba(15, 23, 42, 0)');
    aCtx.fillStyle = tendonTop;
    aCtx.fillRect(0, 0, size, 96);

    const tendonBot = aCtx.createLinearGradient(0, size - 96, 0, size);
    tendonBot.addColorStop(0, 'rgba(15, 23, 42, 0)');
    tendonBot.addColorStop(1, 'rgba(15, 23, 42, 0.28)');
    aCtx.fillStyle = tendonBot;
    aCtx.fillRect(0, size - 96, size, 96);
  }

  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.colorSpace = THREE.SRGBColorSpace;
  albedoTex.wrapS = THREE.RepeatWrapping;
  albedoTex.wrapT = THREE.ClampToEdgeWrapping;
  albedoTex.repeat.set(2, 1);
  albedoTex.anisotropy = maxAnisotropy;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;
  bumpTex.repeat.set(2, 1);
  bumpTex.anisotropy = maxAnisotropy;

  return { albedoTex, bumpTex };
}

/**
 * Generates a 1024x1024 High-Definition Biomechanical Floor Calibration Dial Texture
 */
function create1024FloorDialTexture(maxAnisotropy: number) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    // Soft radial dark studio base + contact shadow core
    const bgGrad = ctx.createRadialGradient(cx, cy, 24, cx, cy, cx);
    bgGrad.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
    bgGrad.addColorStop(0.28, 'rgba(12, 12, 16, 0.55)');
    bgGrad.addColorStop(0.75, 'rgba(18, 18, 24, 0.2)');
    bgGrad.addColorStop(1, 'rgba(18, 18, 24, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Concentric precision rings
    const radii = [140, 240, 340, 430, 470];
    radii.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle =
        idx === 3
          ? 'rgba(249, 115, 22, 0.55)'
          : idx === 4
            ? 'rgba(245, 158, 11, 0.35)'
            : 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = idx === 3 ? 3.5 : 1.5;
      ctx.stroke();
    });

    // 360-degree radial calibration ticks
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const isMid = deg % 15 === 0;
      const rInner = isMajor ? 408 : isMid ? 416 : 422;
      const rOuter = 430;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
      ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
      ctx.strokeStyle = isMajor
        ? 'rgba(245, 158, 11, 0.75)'
        : 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = isMajor ? 2.5 : 1.2;
      ctx.stroke();
    }

    // Crosshair biomechanical alignment axes
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 460, cy);
    ctx.lineTo(cx + 460, cy);
    ctx.moveTo(cx, cy - 460);
    ctx.lineTo(cx, cy + 460);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Creates a 1024-Bit HD MeshPhysicalMaterial extended via `onBeforeCompile`
 * with striated fiber texture, bump detail, clearcoat sheen, and Fresnel rim glow.
 */
function createMuscleShaderMaterial(
  muscleGroup: MuscleGroup,
  albedoTex: THREE.CanvasTexture,
  bumpTex: THREE.CanvasTexture
) {
  const uniforms = {
    uTime: { value: 0 },
    uPrimaryWeight: { value: 0 },
    uSecondaryWeight: { value: 0 },
    uDebugMode: { value: 0 },
    uDebugColor: { value: new THREE.Color(DEBUG_COLORS[muscleGroup]) },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x52637a),
    map: albedoTex,
    bumpMap: bumpTex,
    bumpScale: 0.018,
    roughnessMap: bumpTex,
    roughness: 0.42,
    metalness: 0.24,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uPrimaryWeight = uniforms.uPrimaryWeight;
    shader.uniforms.uSecondaryWeight = uniforms.uSecondaryWeight;
    shader.uniforms.uDebugMode = uniforms.uDebugMode;
    shader.uniforms.uDebugColor = uniforms.uDebugColor;

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform float uPrimaryWeight;
      uniform float uSecondaryWeight;
      uniform float uDebugMode;
      uniform vec3 uDebugColor;
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `
      #include <emissivemap_fragment>
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.4);

      if (uDebugMode > 0.5) {
        diffuseColor.rgb = uDebugColor;
        totalEmissiveRadiance += uDebugColor * (0.35 + fresnel * 0.45);
      } else {
        float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
        vec3 primaryCol = mix(vec3(0.937, 0.267, 0.267), vec3(0.976, 0.451, 0.086), pulse);
        vec3 secondaryCol = vec3(0.961, 0.620, 0.043);
        if (uPrimaryWeight > 0.01) {
          diffuseColor.rgb = mix(diffuseColor.rgb, primaryCol, uPrimaryWeight * 0.72);
          totalEmissiveRadiance += primaryCol * (0.68 + 0.38 * pulse + fresnel * 0.55) * uPrimaryWeight;
        } else if (uSecondaryWeight > 0.01) {
          diffuseColor.rgb = mix(diffuseColor.rgb, secondaryCol, uSecondaryWeight * 0.52);
          totalEmissiveRadiance += secondaryCol * (0.38 + fresnel * 0.35) * uSecondaryWeight;
        } else {
          totalEmissiveRadiance += vec3(0.22, 0.32, 0.48) * fresnel * 0.18;
        }
      }
      `
    );
  };

  mat.userData.muscleUniforms = uniforms;
  return mat;
}

export function TrainerStudio3D({
  clip,
  biomechanicalVariant = 'standard',
  primaryMuscles,
  secondaryMuscles,
  timeScale,
  isPaused,
  cameraPreset,
  debugMuscleMask = false,
}: TrainerStudio3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [modelSource, setModelSource] = useState<'procedural' | 'glb'>('procedural');
  const [fpsWarning, setFpsWarning] = useState(false);

  // Store latest props in ref so WebGL canvas never tears down on UI state changes
  const propsRef = useRef({
    clip,
    biomechanicalVariant,
    primaryMuscles,
    secondaryMuscles,
    timeScale,
    isPaused,
    cameraPreset,
    debugMuscleMask,
  });

  useEffect(() => {
    propsRef.current = {
      clip,
      biomechanicalVariant,
      primaryMuscles,
      secondaryMuscles,
      timeScale,
      isPaused,
      cameraPreset,
      debugMuscleMask,
    };
  }, [
    clip,
    biomechanicalVariant,
    primaryMuscles,
    secondaryMuscles,
    timeScale,
    isPaused,
    cameraPreset,
    debugMuscleMask,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let frameId = 0;
    let disposed = false;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 600;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2.0));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c10);
    scene.fog = new THREE.FogExp2(0x0b0c10, 0.065);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.035).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    camera.position.set(1.58, 1.44, 2.72);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.82, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.45;
    controls.maxDistance = 6.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.update();

    let manualOrbitActive = false;
    let lastPresetWatched: CameraPreset = propsRef.current.cameraPreset;
    controls.addEventListener('start', () => {
      manualOrbitActive = true;
    });

    // Studio 3-Point + Rim Lighting Rig for High-Contrast Anatomical Striation Clarity
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0e0e12, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.6);
    keyLight.position.set(2.6, 4.8, 3.4);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      const d = 2.1;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.95);
    fillLight.position.set(-2.8, 2.2, 1.8);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0xf59e0b, 4.8, 14, Math.PI / 3.5, 0.45, 1.4);
    rimLight.position.set(-2.0, 3.4, -2.6);
    scene.add(rimLight);

    // Obsidian Studio Floor + 1024x1024 Biomechanical Calibration Dial
    const floorGeo = new THREE.CircleGeometry(6.5, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x101217,
      roughness: 0.72,
      metalness: 0.25,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    const floorDialTex = create1024FloorDialTexture(maxAnisotropy);
    const floorDialMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({
        map: floorDialTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
    floorDialMesh.rotation.x = -Math.PI / 2;
    floorDialMesh.position.y = 0.012;
    scene.add(floorDialMesh);

    // 1024x1024 Muscle Striation Texture Set & Per-Muscle Physical Materials
    const { albedoTex, bumpTex } = create1024MuscleTextureSet(maxAnisotropy);
    const muscleMaterials: Record<MuscleGroup, THREE.MeshPhysicalMaterial> = {} as Record<
      MuscleGroup,
      THREE.MeshPhysicalMaterial
    >;
    MUSCLE_ORDER.forEach((m) => {
      muscleMaterials[m] = createMuscleShaderMaterial(m, albedoTex, bumpTex);
    });

    // Track mesh groups per muscle so we can apply real-time isometric/isotonic contraction bulge
    const muscleMeshesMap: Record<MuscleGroup, THREE.Mesh[]> = {
      chest: [],
      back_lats: [],
      shoulders: [],
      biceps: [],
      triceps: [],
      abs: [],
      glutes: [],
      quads: [],
      hamstrings: [],
      calves: [],
      forearms: [],
    };

    function addMuscleMesh(
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      group: MuscleGroup,
      pos: [number, number, number],
      scale: [number, number, number] = [1, 1, 1],
      rot: [number, number, number] = [0, 0, 0]
    ) {
      const mesh = new THREE.Mesh(geo, muscleMaterials[group]);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.scale.set(scale[0], scale[1], scale[2]);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      mesh.userData.baseScale = new THREE.Vector3(scale[0], scale[1], scale[2]);
      parent.add(mesh);
      muscleMeshesMap[group].push(mesh);
      return mesh;
    }

    const jointMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.28,
      metalness: 0.82,
      clearcoat: 0.6,
    });

    const boneTendonMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.4,
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.9,
    });

    const chromePropMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.94,
      clearcoat: 0.8,
    });

    const platePropMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.42,
      metalness: 0.55,
    });

    // === 1024-BIT HIGH-DEFINITION SCULPTED ANATOMICAL MANNEQUIN (28 SUBMESHES) ===
    const rootPivot = new THREE.Group();
    scene.add(rootPivot);

    const hipsPivot = new THREE.Group();
    hipsPivot.position.set(0, 0.96, 0);
    rootPivot.add(hipsPivot);

    // Pelvis Core & Left/Right Sculpted Gluteus Maximus
    const pelvisCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.125, 0.14, 28),
      boneTendonMat
    );
    hipsPivot.add(pelvisCore);

    const gluteGeo = new THREE.SphereGeometry(0.105, 32, 24);
    addMuscleMesh(hipsPivot, gluteGeo, 'glutes', [-0.082, -0.015, -0.058], [0.95, 1.08, 0.92]);
    addMuscleMesh(hipsPivot, gluteGeo, 'glutes', [0.082, -0.015, -0.058], [0.95, 1.08, 0.92]);

    // Spine / Torso Pivot
    const spinePivot = new THREE.Group();
    spinePivot.position.set(0, 0.07, 0);
    hipsPivot.add(spinePivot);

    // Inner Ribcage & Thoracic Core
    const ribcageCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.135, 0.44, 32),
      boneTendonMat
    );
    ribcageCore.position.set(0, 0.25, 0);
    ribcageCore.scale.set(1.08, 1.0, 0.78);
    spinePivot.add(ribcageCore);

    // Sculpted 6-Pack Rectus Abdominis (3 pairs) + Left/Right External Obliques
    const abSegGeo = new THREE.SphereGeometry(0.044, 24, 20);
    const abHeights = [0.24, 0.165, 0.09];
    abHeights.forEach((yPos, rowIdx) => {
      const widthScale = rowIdx === 0 ? 1.15 : rowIdx === 1 ? 1.08 : 0.98;
      addMuscleMesh(
        spinePivot,
        abSegGeo,
        'abs',
        [-0.042, yPos, 0.098],
        [widthScale, 0.85, 0.62]
      );
      addMuscleMesh(
        spinePivot,
        abSegGeo,
        'abs',
        [0.042, yPos, 0.098],
        [widthScale, 0.85, 0.62]
      );
    });

    // External Obliques (Flanks)
    const obliqueGeo = new THREE.CapsuleGeometry(0.042, 0.16, 12, 24);
    addMuscleMesh(spinePivot, obliqueGeo, 'abs', [-0.125, 0.16, 0.035], [0.75, 1, 0.85], [0, 0, -0.18]);
    addMuscleMesh(spinePivot, obliqueGeo, 'abs', [0.125, 0.16, 0.035], [0.75, 1, 0.85], [0, 0, 0.18]);

    // Sculpted Pectoralis Major (Left & Right Chest Plates + Upper Clavicular Head)
    const pecGeo = new THREE.SphereGeometry(0.108, 36, 28);
    addMuscleMesh(
      spinePivot,
      pecGeo,
      'chest',
      [-0.088, 0.375, 0.082],
      [1.08, 0.84, 0.68],
      [0.08, 0.15, -0.08]
    );
    addMuscleMesh(
      spinePivot,
      pecGeo,
      'chest',
      [0.088, 0.375, 0.082],
      [1.08, 0.84, 0.68],
      [0.08, -0.15, 0.08]
    );

    // Sculpted V-Taper Latissimus Dorsi + Trapezius + Erector Spinae
    const latGeo = new THREE.CapsuleGeometry(0.088, 0.24, 16, 28);
    addMuscleMesh(
      spinePivot,
      latGeo,
      'back_lats',
      [-0.105, 0.29, -0.055],
      [1.05, 1.0, 0.72],
      [0.06, 0, 0.28]
    );
    addMuscleMesh(
      spinePivot,
      latGeo,
      'back_lats',
      [0.105, 0.29, -0.055],
      [1.05, 1.0, 0.72],
      [0.06, 0, -0.28]
    );

    // Upper Trapezius Yoke
    const trapGeo = new THREE.SphereGeometry(0.095, 28, 22);
    addMuscleMesh(
      spinePivot,
      trapGeo,
      'back_lats',
      [0, 0.455, -0.045],
      [1.65, 0.62, 0.78]
    );

    // Clavicles (Collarbones)
    const clavicleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.38, 16);
    const clavicleMesh = new THREE.Mesh(clavicleGeo, jointMat);
    clavicleMesh.rotation.z = Math.PI / 2;
    clavicleMesh.position.set(0, 0.465, 0.045);
    spinePivot.add(clavicleMesh);

    // Sculpted Anatomical Neck & High-Definition Head with Athletic Visor
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.068, 0.11, 24),
      boneTendonMat
    );
    neckMesh.position.set(0, 0.54, 0);
    spinePivot.add(neckMesh);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.665, 0.01);
    spinePivot.add(headGroup);

    const craniumMesh = new THREE.Mesh(new THREE.SphereGeometry(0.108, 36, 32), jointMat);
    craniumMesh.scale.set(0.92, 1.12, 0.98);
    headGroup.add(craniumMesh);

    const jawMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.052, 0.09, 24),
      jointMat
    );
    jawMesh.position.set(0, -0.045, 0.022);
    headGroup.add(jawMesh);

    const visorMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.088, 0.014, 16, 32, Math.PI * 0.85),
      visorMat
    );
    visorMesh.rotation.x = Math.PI / 2;
    visorMesh.rotation.z = -Math.PI * 0.425;
    visorMesh.position.set(0, 0.015, 0.022);
    headGroup.add(visorMesh);

    // Left & Right Sculpted Arms (3-Head Deltoid + Biceps + Horseshoe Triceps + Tapered Forearms + Dumbbell Prop)
    function buildSculptedArm(side: -1 | 1) {
      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(side * 0.235, 0.44, 0);
      spinePivot.add(shoulderPivot);

      // 3-Head Deltoid Cap
      const deltGeo = new THREE.SphereGeometry(0.086, 32, 24);
      addMuscleMesh(
        shoulderPivot,
        deltGeo,
        'shoulders',
        [side * 0.015, -0.01, 0],
        [0.98, 1.15, 0.96]
      );

      // Humerus Bone Core
      const humerusCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.024, 0.24, 16),
        boneTendonMat
      );
      humerusCore.position.set(0, -0.14, 0);
      shoulderPivot.add(humerusCore);

      // Anterior Upper Arm = Dual-Head Biceps Brachii
      const bicepGeo = new THREE.CapsuleGeometry(0.046, 0.145, 16, 28);
      addMuscleMesh(
        shoulderPivot,
        bicepGeo,
        'biceps',
        [0, -0.14, 0.026],
        [0.96, 1.0, 0.92]
      );

      // Posterior Upper Arm = Horseshoe Triceps Brachii
      const tricepGeo = new THREE.CapsuleGeometry(0.048, 0.15, 16, 28);
      addMuscleMesh(
        shoulderPivot,
        tricepGeo,
        'triceps',
        [0, -0.135, -0.026],
        [1.02, 1.0, 0.94]
      );

      // Elbow Joint Sphere + Pivot
      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -0.275, 0);
      shoulderPivot.add(elbowPivot);

      const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 20), jointMat);
      elbowPivot.add(elbowCap);

      // Tapered Brachioradialis & Flexor Forearm
      const forearmGeo = new THREE.CapsuleGeometry(0.044, 0.175, 16, 28);
      addMuscleMesh(
        elbowPivot,
        forearmGeo,
        'forearms',
        [0, -0.125, 0.006],
        [0.95, 1.0, 0.88]
      );

      // Sculpted Hand / Fist
      const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.044, 20, 20), jointMat);
      handMesh.scale.set(0.85, 1.1, 0.75);
      handMesh.position.set(0, -0.255, 0.01);
      elbowPivot.add(handMesh);

      // Contextual 3D Dumbbell Prop in Hand
      const dumbbellGroup = new THREE.Group();
      dumbbellGroup.position.set(0, -0.26, 0.015);
      elbowPivot.add(dumbbellGroup);

      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.22, 16),
        chromePropMat
      );
      handle.rotation.z = Math.PI / 2;
      dumbbellGroup.add(handle);

      [-0.085, 0.085].forEach((xOff) => {
        const plateOuter = new THREE.Mesh(
          new THREE.CylinderGeometry(0.058, 0.058, 0.026, 24),
          platePropMat
        );
        plateOuter.rotation.z = Math.PI / 2;
        plateOuter.position.x = xOff;
        dumbbellGroup.add(plateOuter);

        const plateInner = new THREE.Mesh(
          new THREE.CylinderGeometry(0.046, 0.046, 0.018, 24),
          platePropMat
        );
        plateInner.rotation.z = Math.PI / 2;
        plateInner.position.x = xOff * 0.72;
        dumbbellGroup.add(plateInner);
      });

      return { shoulderPivot, elbowPivot, dumbbellGroup };
    }

    const leftArm = buildSculptedArm(-1);
    const rightArm = buildSculptedArm(1);

    // Left & Right Sculpted Legs (3-Head Quads + Hamstrings + Patella Knee + Gastrocnemius Calves + Athletic Footwear)
    function buildSculptedLeg(side: -1 | 1) {
      const hipLegPivot = new THREE.Group();
      hipLegPivot.position.set(side * 0.115, -0.04, 0);
      hipsPivot.add(hipLegPivot);

      // Femur Core
      const femurCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.036, 0.38, 16),
        boneTendonMat
      );
      femurCore.position.set(0, -0.21, 0);
      hipLegPivot.add(femurCore);

      // Anterior Thigh = Rectus Femoris + Vastus Lateralis + Vastus Medialis (Teardrop)
      const quadMainGeo = new THREE.CapsuleGeometry(0.068, 0.24, 16, 32);
      addMuscleMesh(
        hipLegPivot,
        quadMainGeo,
        'quads',
        [0, -0.205, 0.03],
        [1.04, 1.0, 0.95]
      );

      // Vastus Medialis Teardrop above knee
      const vmoGeo = new THREE.SphereGeometry(0.048, 24, 20);
      addMuscleMesh(
        hipLegPivot,
        vmoGeo,
        'quads',
        [-side * 0.032, -0.34, 0.042],
        [0.88, 1.25, 0.85]
      );

      // Posterior Thigh = Biceps Femoris & Semitendinosus Hamstrings
      const hamstringGeo = new THREE.CapsuleGeometry(0.064, 0.24, 16, 28);
      addMuscleMesh(
        hipLegPivot,
        hamstringGeo,
        'hamstrings',
        [0, -0.21, -0.028],
        [0.98, 1.0, 0.92]
      );

      // Knee Joint + Patella Cap
      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -0.44, 0);
      hipLegPivot.add(kneePivot);

      const patellaMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 24), jointMat);
      patellaMesh.scale.set(0.95, 0.9, 0.88);
      kneePivot.add(patellaMesh);

      // Tibia Bone Core
      const tibiaCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034, 0.026, 0.36, 16),
        boneTendonMat
      );
      tibiaCore.position.set(0, -0.21, 0.01);
      kneePivot.add(tibiaCore);

      // Sculpted Gastrocnemius Dual-Head Diamond Calf + Soleus
      const calfUpperGeo = new THREE.SphereGeometry(0.058, 28, 24);
      addMuscleMesh(
        kneePivot,
        calfUpperGeo,
        'calves',
        [0, -0.145, -0.026],
        [0.96, 1.45, 0.92]
      );

      const calfLowerGeo = new THREE.CapsuleGeometry(0.044, 0.18, 16, 24);
      addMuscleMesh(
        kneePivot,
        calfLowerGeo,
        'calves',
        [0, -0.23, -0.015],
        [0.88, 1.0, 0.85]
      );

      // Sculpted Athletic Shoe & Sole
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -0.43, 0.045);
      kneePivot.add(shoeGroup);

      const shoeUpper = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.044, 0.11, 12, 20),
        jointMat
      );
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.scale.set(1.05, 1.0, 0.72);
      shoeGroup.add(shoeUpper);

      const shoeSole = new THREE.Mesh(
        new THREE.BoxGeometry(0.096, 0.024, 0.22),
        visorMat
      );
      shoeSole.position.set(0, -0.026, 0);
      shoeGroup.add(shoeSole);

      return { hipLegPivot, kneePivot };
    }

    const leftLeg = buildSculptedLeg(-1);
    const rightLeg = buildSculptedLeg(1);

    if (!isSoftwareGl) {
      rootPivot.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      renderer.compile(scene, camera);
    }

    // Optional GLB inspection: check manifest & probe /models/trainer.glb
    let glbMixer: THREE.AnimationMixer | null = null;
    fetch('/models/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest) => {
        if (!manifest?.model || !manifest?.glbPlaced || disposed) return;
        const loader = new GLTFLoader();
        loader.load(
          manifest.model,
          (gltf) => {
            if (disposed) return;
            rootPivot.visible = false;
            scene.add(gltf.scene);
            glbMixer = new THREE.AnimationMixer(gltf.scene);
            if (gltf.animations.length > 0) {
              glbMixer.clipAction(gltf.animations[0]).play();
            }
            setModelSource('glb');
          },
          undefined,
          () => {
            // Keep procedural 1024-Bit HD anatomical mannequin active
          }
        );
      })
      .catch(() => {});

    const presetCameraTargets: Record<CameraPreset, THREE.Vector3> = {
      front: new THREE.Vector3(1.52, 1.42, 2.68),
      side: new THREE.Vector3(3.05, 1.16, 0.35),
      back: new THREE.Vector3(-1.32, 1.42, -2.75),
    };

    let lastFrameTime = performance.now();
    let simTime = 0.55;
    let lowFpsFrames = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function applyProceduralKinematics(
      activeClip: AnimationClipName,
      variant: string,
      t: number
    ) {
      // Reset base transforms
      hipsPivot.position.set(0, 0.94, 0);
      hipsPivot.rotation.set(0, 0, 0);
      spinePivot.rotation.set(0, 0, 0);
      leftArm.shoulderPivot.rotation.set(0, 0, 0.12);
      rightArm.shoulderPivot.rotation.set(0, 0, -0.12);
      leftArm.elbowPivot.rotation.set(0, 0, 0);
      rightArm.elbowPivot.rotation.set(0, 0, 0);
      leftLeg.hipLegPivot.rotation.set(0, 0, 0);
      rightLeg.hipLegPivot.rotation.set(0, 0, 0);
      leftLeg.kneePivot.rotation.set(0, 0, 0);
      rightLeg.kneePivot.rotation.set(0, 0, 0);

      // Show dumbbells only for weighted upper/lower variants
      const showDumbbells =
        variant === 'curl' ||
        variant === 'tricep_ext' ||
        variant === 'overhead_push' ||
        variant === 'row_pull' ||
        variant === 'hinge' ||
        activeClip === 'lunge';
      leftArm.dumbbellGroup.visible = showDumbbells;
      rightArm.dumbbellGroup.visible = showDumbbells;

      const phase = Math.sin(t * 3.2);
      const halfPhase = 0.5 + 0.5 * Math.sin(t * 3.2); // 0..1

      if (activeClip === 'pushup' || activeClip === 'diamond_pushup') {
        const isNarrow = activeClip === 'diamond_pushup' || variant === 'narrow_press';
        const depth = halfPhase;
        hipsPivot.position.set(0, 0.32 + depth * 0.22, -0.15);
        hipsPivot.rotation.x = Math.PI / 2 - 0.18 - depth * 0.12;
        const flare = isNarrow ? 0.25 : 0.65;
        leftArm.shoulderPivot.rotation.set(-1.35 + depth * 0.35, 0, flare);
        rightArm.shoulderPivot.rotation.set(-1.35 + depth * 0.35, 0, -flare);
        leftArm.elbowPivot.rotation.x = -1.45 * (1 - depth);
        rightArm.elbowPivot.rotation.x = -1.45 * (1 - depth);
      } else if (activeClip === 'squat') {
        const squatDepth = halfPhase;
        if (variant === 'hinge') {
          hipsPivot.position.set(0, 0.92 - squatDepth * 0.08, -squatDepth * 0.14);
          spinePivot.rotation.x = squatDepth * 1.15;
          leftLeg.hipLegPivot.rotation.x = -squatDepth * 0.25;
          rightLeg.hipLegPivot.rotation.x = -squatDepth * 0.25;
          leftLeg.kneePivot.rotation.x = squatDepth * 0.35;
          rightLeg.kneePivot.rotation.x = squatDepth * 0.35;
          leftArm.shoulderPivot.rotation.x = -squatDepth * 0.95;
          rightArm.shoulderPivot.rotation.x = -squatDepth * 0.95;
        } else {
          hipsPivot.position.set(0, 0.94 - squatDepth * 0.38, -squatDepth * 0.1);
          spinePivot.rotation.x = squatDepth * 0.32;
          leftLeg.hipLegPivot.rotation.x = -squatDepth * 1.35;
          rightLeg.hipLegPivot.rotation.x = -squatDepth * 1.35;
          leftLeg.kneePivot.rotation.x = squatDepth * 1.65;
          rightLeg.kneePivot.rotation.x = squatDepth * 1.65;
          leftArm.shoulderPivot.rotation.x = -squatDepth * 1.25;
          rightArm.shoulderPivot.rotation.x = -squatDepth * 1.25;
        }
      } else if (activeClip === 'lunge') {
        const lungeDepth = halfPhase;
        hipsPivot.position.set(0, 0.92 - lungeDepth * 0.28, 0);
        leftLeg.hipLegPivot.rotation.x = -0.55 - lungeDepth * 0.55;
        leftLeg.kneePivot.rotation.x = 0.65 + lungeDepth * 0.75;
        rightLeg.hipLegPivot.rotation.x = 0.45 + lungeDepth * 0.35;
        rightLeg.kneePivot.rotation.x = 0.55 + lungeDepth * 0.65;
        leftArm.shoulderPivot.rotation.x = 0.15;
        rightArm.shoulderPivot.rotation.x = 0.15;
        leftArm.elbowPivot.rotation.x = -0.25;
        rightArm.elbowPivot.rotation.x = -0.25;
      } else if (activeClip === 'plank') {
        hipsPivot.position.set(0, 0.36 + Math.sin(t * 2) * 0.015, -0.15);
        hipsPivot.rotation.x = Math.PI / 2 - 0.14;
        leftArm.shoulderPivot.rotation.set(-1.35, 0, 0.2);
        rightArm.shoulderPivot.rotation.set(-1.35, 0, -0.2);
        leftArm.elbowPivot.rotation.x = -1.35;
        rightArm.elbowPivot.rotation.x = -1.35;
      } else if (activeClip === 'mountain_climber') {
        hipsPivot.position.set(0, 0.44, -0.15);
        hipsPivot.rotation.x = Math.PI / 2 - 0.22;
        leftArm.shoulderPivot.rotation.set(-1.38, 0, 0.18);
        rightArm.shoulderPivot.rotation.set(-1.38, 0, -0.18);
        const legDrive = Math.sin(t * 6.0);
        leftLeg.hipLegPivot.rotation.x = legDrive > 0 ? -legDrive * 1.35 : 0;
        leftLeg.kneePivot.rotation.x = legDrive > 0 ? legDrive * 1.55 : 0.1;
        rightLeg.hipLegPivot.rotation.x = legDrive < 0 ? legDrive * 1.35 : 0;
        rightLeg.kneePivot.rotation.x = legDrive < 0 ? -legDrive * 1.55 : 0.1;
      } else if (activeClip === 'crunch') {
        hipsPivot.position.set(0, 0.22, 0);
        hipsPivot.rotation.x = -Math.PI / 2 + 0.15;
        spinePivot.rotation.x = halfPhase * 0.65;
        leftLeg.hipLegPivot.rotation.x = -0.85;
        rightLeg.hipLegPivot.rotation.x = -0.85;
        leftLeg.kneePivot.rotation.x = 1.45;
        rightLeg.kneePivot.rotation.x = 1.45;
        leftArm.shoulderPivot.rotation.set(-0.9, 0, 0.5);
        rightArm.shoulderPivot.rotation.set(-0.9, 0, -0.5);
        leftArm.elbowPivot.rotation.x = -1.5;
        rightArm.elbowPivot.rotation.x = -1.5;
      } else if (activeClip === 'glute_bridge') {
        const lift = halfPhase;
        hipsPivot.position.set(0, 0.24 + lift * 0.26, 0);
        hipsPivot.rotation.x = -Math.PI / 2 + lift * 0.35;
        spinePivot.rotation.x = -lift * 0.25;
        leftLeg.hipLegPivot.rotation.x = -0.65 + lift * 0.45;
        rightLeg.hipLegPivot.rotation.x = -0.65 + lift * 0.45;
        leftLeg.kneePivot.rotation.x = 1.65;
        rightLeg.kneePivot.rotation.x = 1.65;
      } else if (activeClip === 'burpee') {
        const cycle = (t * 0.7) % 1;
        if (cycle < 0.45) {
          hipsPivot.position.set(0, 0.38, -0.15);
          hipsPivot.rotation.x = Math.PI / 2 - 0.15;
          leftArm.shoulderPivot.rotation.set(-1.35, 0, 0.25);
          rightArm.shoulderPivot.rotation.set(-1.35, 0, -0.25);
        } else {
          const jump = Math.sin(((cycle - 0.45) / 0.55) * Math.PI);
          hipsPivot.position.set(0, 0.94 + jump * 0.32, 0);
          leftArm.shoulderPivot.rotation.set(-2.6 * jump, 0, 0.2);
          rightArm.shoulderPivot.rotation.set(-2.6 * jump, 0, -0.2);
        }
      } else if (activeClip === 'jog') {
        const runStride = Math.sin(t * 5.2);
        hipsPivot.position.y = 0.94 + Math.abs(runStride) * 0.05;
        spinePivot.rotation.x = 0.12;
        leftArm.shoulderPivot.rotation.x = runStride * 0.65;
        rightArm.shoulderPivot.rotation.x = -runStride * 0.65;
        leftArm.elbowPivot.rotation.x = -1.1;
        rightArm.elbowPivot.rotation.x = -1.1;
        leftLeg.hipLegPivot.rotation.x = -runStride * 0.65;
        rightLeg.hipLegPivot.rotation.x = runStride * 0.65;
        leftLeg.kneePivot.rotation.x = runStride < 0 ? -runStride * 1.1 : 0.2;
        rightLeg.kneePivot.rotation.x = runStride > 0 ? runStride * 1.1 : 0.2;
      } else if (activeClip === 'stretch_flow') {
        if (variant === 'curl') {
          leftArm.elbowPivot.rotation.x = -0.2 - halfPhase * 1.95;
          rightArm.elbowPivot.rotation.x = -0.2 - halfPhase * 1.95;
        } else if (variant === 'tricep_ext') {
          leftArm.shoulderPivot.rotation.x = -0.15;
          rightArm.shoulderPivot.rotation.x = -0.15;
          leftArm.elbowPivot.rotation.x = -1.65 * (1 - halfPhase);
          rightArm.elbowPivot.rotation.x = -1.65 * (1 - halfPhase);
        } else if (variant === 'overhead_push') {
          leftArm.shoulderPivot.rotation.set(-halfPhase * 2.5, 0, 0.45 + halfPhase * 0.5);
          rightArm.shoulderPivot.rotation.set(-halfPhase * 2.5, 0, -0.45 - halfPhase * 0.5);
          leftArm.elbowPivot.rotation.x = -1.1 * (1 - halfPhase);
          rightArm.elbowPivot.rotation.x = -1.1 * (1 - halfPhase);
        } else if (variant === 'row_pull') {
          spinePivot.rotation.x = 0.25;
          leftArm.shoulderPivot.rotation.set(-1.35 + halfPhase * 1.45, 0, 0.35);
          rightArm.shoulderPivot.rotation.set(-1.35 + halfPhase * 1.45, 0, -0.35);
          leftArm.elbowPivot.rotation.x = -halfPhase * 1.55;
          rightArm.elbowPivot.rotation.x = -halfPhase * 1.55;
        } else {
          spinePivot.rotation.z = phase * 0.22;
          leftArm.shoulderPivot.rotation.z = 0.4 + halfPhase * 1.4;
          rightArm.shoulderPivot.rotation.z = -0.4 - halfPhase * 1.4;
        }
      } else {
        const lift = halfPhase;
        hipsPivot.position.y = 0.94 + lift * 0.06;
        leftArm.shoulderPivot.rotation.z = 0.14 + Math.sin(t * 1.5) * 0.03;
        rightArm.shoulderPivot.rotation.z = -0.14 - Math.sin(t * 1.5) * 0.03;
      }
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;
      const currentProps = propsRef.current;

      if (!isSoftwareGl && dt > 0.03) {
        lowFpsFrames += 1;
        if (lowFpsFrames > 45 && renderer.shadowMap.enabled) {
          renderer.shadowMap.enabled = false;
          setFpsWarning(true);
        }
      } else {
        lowFpsFrames = Math.max(0, lowFpsFrames - 1);
      }

      if (!currentProps.isPaused) {
        simTime += dt * currentProps.timeScale;
      }

      if (currentProps.cameraPreset !== lastPresetWatched) {
        lastPresetWatched = currentProps.cameraPreset;
        manualOrbitActive = false;
      }
      if (!manualOrbitActive) {
        const targetCam = presetCameraTargets[currentProps.cameraPreset];
        const dampFactor = 1 - Math.exp(-6 * dt);
        camera.position.lerp(targetCam, dampFactor);
        if (camera.position.distanceTo(targetCam) < 0.03) {
          manualOrbitActive = true;
        }
      }

      controls.update();

      // Update muscle highlight shader uniforms + dynamic isotonic muscle contraction bulge
      const lerpAlpha = dt <= 0.001 ? 1.0 : 1 - Math.exp(-8 * dt);
      const pulse = 0.5 + 0.5 * Math.sin(simTime * 3.2);
      MUSCLE_ORDER.forEach((m) => {
        const mat = muscleMaterials[m];
        const u = mat.userData.muscleUniforms;
        if (!u) return;
        const isPrimary = currentProps.primaryMuscles.includes(m) ? 1.0 : 0.0;
        const isSecondary = currentProps.secondaryMuscles.includes(m) ? 1.0 : 0.0;
        u.uTime.value = simTime;
        u.uPrimaryWeight.value += (isPrimary - u.uPrimaryWeight.value) * lerpAlpha;
        u.uSecondaryWeight.value += (isSecondary - u.uSecondaryWeight.value) * lerpAlpha;
        u.uDebugMode.value = currentProps.debugMuscleMask ? 1.0 : 0.0;

        // Dynamic anatomical contraction bulge (+10% peak volume on primary muscles, +4% on secondary)
        const bulgeFactor =
          1.0 +
          u.uPrimaryWeight.value * (0.04 + 0.075 * pulse) +
          u.uSecondaryWeight.value * (0.02 + 0.03 * pulse);
        muscleMeshesMap[m].forEach((mesh) => {
          const base = mesh.userData.baseScale as THREE.Vector3 | undefined;
          if (base) {
            mesh.scale.set(
              base.x * bulgeFactor,
              base.y * (1 + (bulgeFactor - 1) * 0.4),
              base.z * bulgeFactor
            );
          }
        });

        // Update PBR emissive & diffuse color directly so all GPUs show vivid striated muscle glow
        if (currentProps.debugMuscleMask) {
          mat.color.setHex(DEBUG_COLORS[m]);
          mat.emissive.setHex(DEBUG_COLORS[m]);
          mat.emissiveIntensity = 0.45;
        } else if (u.uPrimaryWeight.value > 0.05) {
          mat.color.setHex(0xef4444).lerp(new THREE.Color(0xf97316), pulse);
          mat.emissive.setHex(0xef4444).lerp(new THREE.Color(0xf97316), pulse);
          mat.emissiveIntensity = (0.72 + 0.36 * pulse) * u.uPrimaryWeight.value;
        } else if (u.uSecondaryWeight.value > 0.05) {
          mat.color.setHex(0xf59e0b);
          mat.emissive.setHex(0xf59e0b);
          mat.emissiveIntensity = 0.45 * u.uSecondaryWeight.value;
        } else {
          mat.color.setHex(0x52637a);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      });

      if (glbMixer && !currentProps.isPaused) {
        glbMixer.update(dt * currentProps.timeScale);
      } else {
        applyProceduralKinematics(
          currentProps.clip,
          currentProps.biomechanicalVariant || 'standard',
          simTime
        );
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      albedoTex.dispose();
      bumpTex.dispose();
      floorDialTex.dispose();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#0B0C10] rounded-2xl overflow-hidden border border-[#262626]">
      {/* Dedicated empty canvas mount ref outside React HUD overlays */}
      <div
        ref={mountRef}
        data-testid="workout-3d-canvas"
        className="w-full h-full min-h-[480px]"
        aria-label="Viewport Studio Latihan 3D 1024-Bit HD FitForge"
      />

      {/* Subtle Model Source & 1024-Bit HD Texture Badge (Top-Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
        <span className="px-2.5 py-1 rounded-lg bg-[#161616]/90 border border-[#F59E0B]/40 text-[11px] font-bold text-[#F59E0B]">
          {modelSource === 'glb'
            ? 'Model: Mixamo GLB 1024-Bit'
            : '1024-Bit HD Anatomical Striated Rig (28-Submesh PBR)'}
        </span>
        {fpsWarning && (
          <span className="px-2 py-1 rounded-lg bg-[#FEF3C7] text-[#B45309] text-[10px] font-semibold">
            Mode Hemat GPU Aktif
          </span>
        )}
      </div>
    </div>
  );
}
