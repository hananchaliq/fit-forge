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
 * Creates a MeshStandardMaterial extended via `onBeforeCompile` per PROJECT_SPEC.md Section 5.4 & 10.5:
 * - Primary active muscle: emissive #EF4444 -> #F97316 pulsing with sin(uTime * 3.0), intensity 1.0
 * - Secondary active muscle: emissive #F59E0B, intensity 0.4
 * - Inactive muscle: slate #475569, roughness 0.8
 */
function createMuscleShaderMaterial(muscleGroup: MuscleGroup) {
  const uniforms = {
    uTime: { value: 0 },
    uPrimaryWeight: { value: 0 },
    uSecondaryWeight: { value: 0 },
    uDebugMode: { value: 0 },
    uDebugColor: { value: new THREE.Color(DEBUG_COLORS[muscleGroup]) },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x475569),
    roughness: 0.78,
    metalness: 0.22,
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
      if (uDebugMode > 0.5) {
        diffuseColor.rgb = uDebugColor;
        totalEmissiveRadiance += uDebugColor * 0.35;
      } else {
        float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
        vec3 primaryCol = mix(vec3(0.937, 0.267, 0.267), vec3(0.976, 0.451, 0.086), pulse);
        vec3 secondaryCol = vec3(0.961, 0.620, 0.043);
        if (uPrimaryWeight > 0.01) {
          diffuseColor.rgb = mix(diffuseColor.rgb, primaryCol, uPrimaryWeight * 0.65);
          totalEmissiveRadiance += primaryCol * (0.75 + 0.35 * pulse) * uPrimaryWeight;
        } else if (uSecondaryWeight > 0.01) {
          diffuseColor.rgb = mix(diffuseColor.rgb, secondaryCol, uSecondaryWeight * 0.45);
          totalEmissiveRadiance += secondaryCol * 0.42 * uSecondaryWeight;
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
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0c0e);
    scene.fog = new THREE.FogExp2(0x0c0c0e, 0.08);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    camera.position.set(1.65, 1.48, 2.85);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.78, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.8;
    controls.maxDistance = 6.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.update();

    let manualOrbitActive = false;
    let lastPresetWatched: CameraPreset = propsRef.current.cameraPreset;
    controls.addEventListener('start', () => {
      manualOrbitActive = true;
    });

    // Studio Lighting Rig: Warm Directional Key + Cool Hemisphere Fill + Amber Rim Light
    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x0e0e0e, 0.7);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.3);
    keyLight.position.set(2.5, 4.5, 3.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      const d = 2.2;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.SpotLight(0xf59e0b, 4.0, 12, Math.PI / 4, 0.5, 1.5);
    rimLight.position.set(-2.2, 3.2, -2.5);
    scene.add(rimLight);

    // Obsidian Studio Floor + Soft Radial Contact Shadow + Measurement Ring
    const floorGeo = new THREE.CircleGeometry(6, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x121215,
      roughness: 0.75,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    // Procedural radial contact shadow canvas texture
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
      grad.addColorStop(0, 'rgba(0,0,0,0.65)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contactShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.015;
    scene.add(contactShadowMesh);

    // Studio Arena Ring
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.18, 64),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    scene.add(ringMesh);

    // Create per-muscle shader materials
    const muscleMaterials: Record<MuscleGroup, THREE.MeshStandardMaterial> = {} as Record<
      MuscleGroup,
      THREE.MeshStandardMaterial
    >;
    MUSCLE_ORDER.forEach((m) => {
      muscleMaterials[m] = createMuscleShaderMaterial(m);
    });

    const jointMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.75,
    });

    // === COMPOSITE 12-PART ARTICULATED BIOMECHANICAL MANNEQUIN ===
    const rootPivot = new THREE.Group();
    scene.add(rootPivot);

    const hipsPivot = new THREE.Group();
    hipsPivot.position.set(0, 0.98, 0);
    rootPivot.add(hipsPivot);

    // Pelvis / Glutes
    const glutesMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.22),
      muscleMaterials.glutes
    );
    hipsPivot.add(glutesMesh);

    // Spine / Torso
    const spinePivot = new THREE.Group();
    spinePivot.position.set(0, 0.08, 0);
    hipsPivot.add(spinePivot);

    // Abs (Anterior Core)
    const absMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.29, 0.26, 0.16),
      muscleMaterials.abs
    );
    absMesh.position.set(0, 0.15, 0.03);
    spinePivot.add(absMesh);

    // Back Lats (Posterior Torso)
    const backLatsMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.46, 14),
      muscleMaterials.back_lats
    );
    backLatsMesh.position.set(0, 0.27, -0.04);
    spinePivot.add(backLatsMesh);

    // Chest (Pectorals)
    const chestMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.21, 0.18),
      muscleMaterials.chest
    );
    chestMesh.position.set(0, 0.38, 0.05);
    spinePivot.add(chestMesh);

    // Head & Neck
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 12), jointMat);
    neckMesh.position.set(0, 0.54, 0);
    spinePivot.add(neckMesh);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 20), jointMat);
    headMesh.scale.set(0.9, 1.12, 0.95);
    headMesh.position.set(0, 0.66, 0.01);
    spinePivot.add(headMesh);

    // Left & Right Arms (Shoulders + Biceps + Triceps + Elbow + Forearms)
    function buildArm(side: -1 | 1) {
      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(side * 0.24, 0.44, 0);
      spinePivot.add(shoulderPivot);

      const deltoid = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 16, 16),
        muscleMaterials.shoulders
      );
      shoulderPivot.add(deltoid);

      // Anterior upper arm = Biceps
      const bicep = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.048, 0.18, 8, 12),
        muscleMaterials.biceps
      );
      bicep.position.set(0, -0.14, 0.022);
      shoulderPivot.add(bicep);

      // Posterior upper arm = Triceps
      const tricep = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.048, 0.18, 8, 12),
        muscleMaterials.triceps
      );
      tricep.position.set(0, -0.14, -0.022);
      shoulderPivot.add(tricep);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -0.27, 0);
      shoulderPivot.add(elbowPivot);

      const forearm = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.044, 0.21, 8, 12),
        muscleMaterials.forearms
      );
      forearm.position.set(0, -0.13, 0);
      elbowPivot.add(forearm);

      return { shoulderPivot, elbowPivot };
    }

    const leftArm = buildArm(-1);
    const rightArm = buildArm(1);

    // Left & Right Legs (Hip + Quads + Hamstrings + Knee + Calves + Foot)
    function buildLeg(side: -1 | 1) {
      const hipLegPivot = new THREE.Group();
      hipLegPivot.position.set(side * 0.11, -0.04, 0);
      hipsPivot.add(hipLegPivot);

      // Anterior thigh = Quads
      const quad = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.068, 0.28, 8, 12),
        muscleMaterials.quads
      );
      quad.position.set(0, -0.21, 0.025);
      hipLegPivot.add(quad);

      // Posterior thigh = Hamstrings
      const hamstring = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.064, 0.28, 8, 12),
        muscleMaterials.hamstrings
      );
      hamstring.position.set(0, -0.21, -0.025);
      hipLegPivot.add(hamstring);

      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -0.44, 0);
      hipLegPivot.add(kneePivot);

      const calf = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.056, 0.28, 8, 12),
        muscleMaterials.calves
      );
      calf.position.set(0, -0.21, -0.01);
      kneePivot.add(calf);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.21), jointMat);
      foot.position.set(0, -0.43, 0.05);
      kneePivot.add(foot);

      return { hipLegPivot, kneePivot };
    }

    const leftLeg = buildLeg(-1);
    const rightLeg = buildLeg(1);

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
            // Keep procedural 12-part biomechanical mannequin active
          }
        );
      })
      .catch(() => {});

    const presetCameraTargets: Record<CameraPreset, THREE.Vector3> = {
      front: new THREE.Vector3(1.55, 1.45, 2.75),
      side: new THREE.Vector3(3.15, 1.18, 0.35),
      back: new THREE.Vector3(-1.35, 1.45, -2.85),
    };

    const clock = new THREE.Clock();
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
          // Romanian deadlift / hip hinge
          hipsPivot.position.set(0, 0.92 - squatDepth * 0.08, -squatDepth * 0.14);
          spinePivot.rotation.x = squatDepth * 1.15;
          leftLeg.hipLegPivot.rotation.x = -squatDepth * 0.25;
          rightLeg.hipLegPivot.rotation.x = -squatDepth * 0.25;
          leftLeg.kneePivot.rotation.x = squatDepth * 0.35;
          rightLeg.kneePivot.rotation.x = squatDepth * 0.35;
          leftArm.shoulderPivot.rotation.x = -squatDepth * 0.95;
          rightArm.shoulderPivot.rotation.x = -squatDepth * 0.95;
        } else {
          // Standard full squat
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
        leftArm.shoulderPivot.rotation.x = 0.35;
        rightArm.shoulderPivot.rotation.x = -0.35;
        leftArm.elbowPivot.rotation.x = -0.8;
        rightArm.elbowPivot.rotation.x = -0.8;
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
          // Plank phase
          hipsPivot.position.set(0, 0.38, -0.15);
          hipsPivot.rotation.x = Math.PI / 2 - 0.15;
          leftArm.shoulderPivot.rotation.set(-1.35, 0, 0.25);
          rightArm.shoulderPivot.rotation.set(-1.35, 0, -0.25);
        } else {
          // Explosive vertical jump phase
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
          // Bicep / Hammer / EZ Curl kinematics
          leftArm.elbowPivot.rotation.x = -0.2 - halfPhase * 1.95;
          rightArm.elbowPivot.rotation.x = -0.2 - halfPhase * 1.95;
        } else if (variant === 'tricep_ext') {
          // Tricep pushdown / extension kinematics
          leftArm.shoulderPivot.rotation.x = -0.15;
          rightArm.shoulderPivot.rotation.x = -0.15;
          leftArm.elbowPivot.rotation.x = -1.65 * (1 - halfPhase);
          rightArm.elbowPivot.rotation.x = -1.65 * (1 - halfPhase);
        } else if (variant === 'overhead_push') {
          // Overhead press / lateral raise kinematics
          leftArm.shoulderPivot.rotation.set(-halfPhase * 2.5, 0, 0.45 + halfPhase * 0.5);
          rightArm.shoulderPivot.rotation.set(-halfPhase * 2.5, 0, -0.45 - halfPhase * 0.5);
          leftArm.elbowPivot.rotation.x = -1.1 * (1 - halfPhase);
          rightArm.elbowPivot.rotation.x = -1.1 * (1 - halfPhase);
        } else if (variant === 'row_pull') {
          // Pull-up / Lat pulldown / Row kinematics
          spinePivot.rotation.x = 0.25;
          leftArm.shoulderPivot.rotation.set(-1.35 + halfPhase * 1.45, 0, 0.35);
          rightArm.shoulderPivot.rotation.set(-1.35 + halfPhase * 1.45, 0, -0.35);
          leftArm.elbowPivot.rotation.x = -halfPhase * 1.55;
          rightArm.elbowPivot.rotation.x = -halfPhase * 1.55;
        } else {
          // Dynamic mobility flow
          spinePivot.rotation.z = phase * 0.22;
          leftArm.shoulderPivot.rotation.z = 0.4 + halfPhase * 1.4;
          rightArm.shoulderPivot.rotation.z = -0.4 - halfPhase * 1.4;
        }
      } else {
        // Idle / Calf raises
        const lift = halfPhase;
        hipsPivot.position.y = 0.94 + lift * 0.06;
        leftArm.shoulderPivot.rotation.z = 0.14 + Math.sin(t * 1.5) * 0.03;
        rightArm.shoulderPivot.rotation.z = -0.14 - Math.sin(t * 1.5) * 0.03;
      }
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const currentProps = propsRef.current;

      // PerformanceMonitor guard (< 40 FPS)
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

      // Smoothly transition camera preset if user clicked Depan / Samping / Belakang
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

      // Update muscle highlight shader uniforms (0.25s lerp per Section 10.5, immediate on frame 0)
      const lerpAlpha = dt <= 0.001 ? 1.0 : 1 - Math.exp(-8 * dt);
      const pulse = 0.5 + 0.5 * Math.sin(simTime * 3.0);
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

        // Also update PBR emissive & diffuse color directly so SwiftShader / fallback drivers always show vivid muscle glow
        if (currentProps.debugMuscleMask) {
          mat.color.setHex(DEBUG_COLORS[m]);
          mat.emissive.setHex(DEBUG_COLORS[m]);
          mat.emissiveIntensity = 0.45;
        } else if (u.uPrimaryWeight.value > 0.05) {
          mat.color.setHex(0xef4444).lerp(new THREE.Color(0xf97316), pulse);
          mat.emissive.setHex(0xef4444).lerp(new THREE.Color(0xf97316), pulse);
          mat.emissiveIntensity = (0.75 + 0.35 * pulse) * u.uPrimaryWeight.value;
        } else if (u.uSecondaryWeight.value > 0.05) {
          mat.color.setHex(0xf59e0b);
          mat.emissive.setHex(0xf59e0b);
          mat.emissiveIntensity = 0.45 * u.uSecondaryWeight.value;
        } else {
          mat.color.setHex(0x475569);
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
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[480px] bg-[#0C0C0E] rounded-2xl overflow-hidden border border-[#262626]">
      {/* Dedicated empty canvas mount ref outside React HUD overlays */}
      <div
        ref={mountRef}
        data-testid="workout-3d-canvas"
        className="w-full h-full min-h-[480px]"
        aria-label="Viewport Studio Latihan 3D FitForge"
      />

      {/* Subtle Model Source & Performance Badge (Top-Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
        <span className="px-2.5 py-1 rounded-lg bg-[#161616]/90 border border-[#262626] text-[11px] font-medium text-neutral-300">
          {modelSource === 'glb' ? 'Model: Mixamo GLB' : 'Rig Biomekanik 12-Part PBR'}
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
