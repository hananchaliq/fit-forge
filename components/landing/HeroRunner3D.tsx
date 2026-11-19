'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createProceduralPBRTextures, disposeSceneResources } from '@/lib/pbrTextures';
import type { MannequinDisplayMode } from '@/components/workout3d/TrainerStudio3D';

export interface HeroRunner3DProps {
  displayMode?: MannequinDisplayMode;
}

interface LoftProfile {
  s: number;
  rx: number;
  rzAnt: number;
  rzPost: number;
  cz?: number;
  pinchCenter?: number;
}

function lerpNum(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function sampleProfile(sections: LoftProfile[], s: number): LoftProfile {
  if (s <= sections[0].s) return sections[0];
  const last = sections[sections.length - 1];
  if (s >= last.s) return last;
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i];
    const b = sections[i + 1];
    if (s >= a.s && s <= b.s) {
      const t = smoothstep(0, 1, (s - a.s) / Math.max(1e-5, b.s - a.s));
      return {
        s,
        rx: lerpNum(a.rx, b.rx, t),
        rzAnt: lerpNum(a.rzAnt, b.rzAnt, t),
        rzPost: lerpNum(a.rzPost, b.rzPost, t),
        cz: lerpNum(a.cz || 0, b.cz || 0, t),
        pinchCenter: lerpNum(a.pinchCenter || 0, b.pinchCenter || 0, t),
      };
    }
  }
  return last;
}

/**
 * Builds a seamless organic anatomical loft mesh (matching TrainerStudio3D quality)
 * with smooth vertex normals, multi-material group support (skin / charcoal shorts / sleeve / active),
 * and organic muscle-surface sculpting (pecs, 6-pack abs, serratus, quads, deltoids, bald faceless head).
 */
function buildOrganicLoftMesh(
  sections: LoftProfile[],
  length: number,
  heightSegs: number,
  radialSegs: number,
  materials: THREE.Material[],
  sculptFn: (
    s: number,
    nx: number,
    nz: number,
    pt: { x: number; y: number; z: number }
  ) => void,
  groupFn: (s: number, nx: number, nz: number) => number,
  originAtTop = false
): THREE.Mesh {
  const numCols = radialSegs + 1;
  const numRows = heightSegs + 1;
  const totalVerts = numRows * numCols;
  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);

  for (let r = 0; r < numRows; r++) {
    const s = r / heightSegs;
    const sec = sampleProfile(sections, s);
    const y = originAtTop ? -s * length : s * length;

    for (let c = 0; c < numCols; c++) {
      const u = c === radialSegs ? 0 : c / radialSegs;
      const theta = u * Math.PI * 2;
      const nx = Math.cos(theta);
      const nz = Math.sin(theta);

      const x = nx * sec.rx;
      const rz = nz >= 0 ? sec.rzAnt : sec.rzPost;
      let z = nz * rz + (sec.cz || 0);

      if (sec.pinchCenter) {
        const centerBand = Math.exp(-nx * nx * 14);
        if (nz >= 0) z -= sec.pinchCenter * centerBand * nz;
        else z += sec.pinchCenter * 0.85 * centerBand * -nz;
      }

      const pt = { x, y, z };
      sculptFn(s, nx, nz, pt);

      const idx = r * numCols + c;
      positions[idx * 3] = pt.x;
      positions[idx * 3 + 1] = pt.y;
      positions[idx * 3 + 2] = pt.z;
      uvs[idx * 2] = c / radialSegs;
      uvs[idx * 2 + 1] = s;
    }
  }

  const buckets = new Map<number, number[]>();
  for (let r = 0; r < heightSegs; r++) {
    const sMid = (r + 0.5) / heightSegs;
    for (let c = 0; c < radialSegs; c++) {
      const thetaMid = ((c + 0.5) / radialSegs) * Math.PI * 2;
      const g = groupFn(sMid, Math.cos(thetaMid), Math.sin(thetaMid));
      let list = buckets.get(g);
      if (!list) {
        list = [];
        buckets.set(g, list);
      }
      const a = r * numCols + c;
      const b = r * numCols + c + 1;
      const d = (r + 1) * numCols + c;
      const e = (r + 1) * numCols + c + 1;

      if (originAtTop) {
        list.push(a, b, d, b, e, d);
      } else {
        list.push(a, d, b, b, d, e);
      }
    }
  }

  const indices: number[] = [];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  for (const g of Array.from(buckets.keys()).sort((a, b) => a - b)) {
    const list = buckets.get(g)!;
    const start = indices.length;
    for (let i = 0; i < list.length; i++) indices.push(list[i]);
    geo.addGroup(start, list.length, g);
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Seamless seam-normal averaging
  const norm = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let r = 0; r < numRows; r++) {
    const i0 = r * numCols;
    const i1 = r * numCols + radialSegs;
    const x = (norm.getX(i0) + norm.getX(i1)) * 0.5;
    const y = (norm.getY(i0) + norm.getY(i1)) * 0.5;
    const z = (norm.getZ(i0) + norm.getZ(i1)) * 0.5;
    const len = Math.hypot(x, y, z) || 1;
    norm.setXYZ(i0, x / len, y / len, z / len);
    norm.setXYZ(i1, x / len, y / len, z / len);
  }

  return new THREE.Mesh(geo, materials);
}

export function HeroRunner3D({ displayMode = 'muscle' }: HeroRunner3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webGLOk, setWebGLOk] = useState(true);
  const modeRef = useRef<MannequinDisplayMode>(displayMode);
  const applyModeFnRef = useRef<((mode: MannequinDisplayMode) => void) | null>(null);

  useEffect(() => {
    modeRef.current = displayMode;
    applyModeFnRef.current?.(displayMode);
  }, [displayMode]);

  useEffect(() => {
    const container = mountRef.current;
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
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setWebGLOk(false));
      return;
    }

    const width = container.clientWidth || 440;
    const height = container.clientHeight || 420;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pbr = createProceduralPBRTextures(renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.55;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 40);
    camera.position.set(1.75, 1.24, 2.85);
    camera.lookAt(0, 0.94, 0.05);

    // 4-Point Studio Lighting (Identical signature to Studio 3D)
    scene.add(new THREE.AmbientLight(0xfff4de, 0.34));
    scene.add(new THREE.HemisphereLight(0xfff8eb, 0x0b0f18, 0.56));

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.72);
    keyLight.position.set(2.5, 4.4, 3.2);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb8d4f5, 0.74);
    fillLight.position.set(-2.8, 2.4, 1.8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfde6c4, 1.05);
    rimLight.position.set(-1.6, 2.8, -3.0);
    scene.add(rimLight);

    // Symmetrical Matte-Satin Anatomical Clay PBR Materials (Exact Match with Studio 3D)
    const skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xdfc5a4,
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

    const activeAccentMat = new THREE.MeshPhysicalMaterial({
      color: 0xe53935,
      emissive: new THREE.Color(0xb71c1c),
      emissiveIntensity: 0.28,
      roughness: 0.52,
      metalness: 0.03,
      clearcoat: 0.05,
      clearcoatRoughness: 0.60,
      sheen: 0.26,
      sheenRoughness: 0.66,
      sheenColor: new THREE.Color(0xffb4a2),
      normalMap: pbr.skinNormalMap,
      normalScale: new THREE.Vector2(0.50, 0.50),
      bumpMap: pbr.skinBumpMap,
      bumpScale: 0.004,
      roughnessMap: pbr.skinRoughnessMap,
    });

    const charcoalFabricMat = new THREE.MeshPhysicalMaterial({
      color: 0x252a34,
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
    });

    const boneMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4ecda,
      roughness: 0.44,
      metalness: 0.06,
      clearcoat: 0.12,
      clearcoatRoughness: 0.48,
      emissive: new THREE.Color(0x3a2e1a),
      emissiveIntensity: 0.18,
      normalMap: pbr.boneNormalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: pbr.boneRoughnessMap,
    });

    const jointBeaconMat = new THREE.MeshPhysicalMaterial({
      color: 0xf97316,
      emissive: new THREE.Color(0xea580c),
      emissiveIntensity: 0.68,
      roughness: 0.24,
      metalness: 0.34,
      clearcoat: 0.42,
    });

    // Material array for organic lofts: [0: golden skin, 1: charcoal fabric, 2: active muscle warm amber]
    const loftMats = [skinMat, charcoalFabricMat, activeAccentMat];

    // Ground Contact Shadow & Subtle Telemetry Floor Rings
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 1.75),
      new THREE.MeshBasicMaterial({
        map: pbr.contactShadowMap,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.004;
    scene.add(contactShadow);

    const floorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.66, 0.685, 64),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.34,
      })
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.007;
    scene.add(floorRing);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 0.935, 64),
      new THREE.MeshBasicMaterial({
        color: 0x334155,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.30,
      })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.006;
    scene.add(outerRing);

    // ============================================================================
    // UNIFIED SCULPTED ORGANIC LOFT MANNEQUIN (BALD, FACELESS, ATHLETIC)
    // ============================================================================
    const runner = new THREE.Group();
    scene.add(runner);

    const pelvisPivot = new THREE.Group();
    pelvisPivot.position.set(0, 0.94, 0);
    runner.add(pelvisPivot);

    // Seamless Charcoal Pelvis + Waist Shorts Hub
    const pelvisSections: LoftProfile[] = [
      { s: 0.0, rx: 0.02, rzAnt: 0.02, rzPost: 0.02 },
      { s: 0.14, rx: 0.158, rzAnt: 0.105, rzPost: 0.128, cz: -0.008 },
      { s: 0.55, rx: 0.168, rzAnt: 0.114, rzPost: 0.132, cz: -0.006, pinchCenter: 0.012 },
      { s: 1.0, rx: 0.142, rzAnt: 0.102, rzPost: 0.104 },
    ];
    const pelvisMesh = buildOrganicLoftMesh(
      pelvisSections,
      0.19,
      14,
      28,
      loftMats,
      (s, nx, nz, pt) => {
        if (nz < -0.15 && s > 0.18 && s < 0.72) {
          const glute = Math.exp(-Math.pow((Math.abs(nx) - 0.52) / 0.34, 2)) * Math.sin(((s - 0.18) / 0.54) * Math.PI);
          pt.z -= 0.018 * glute;
        }
      },
      () => 1 // Charcoal shorts fabric
    );
    pelvisMesh.position.y = -0.09;
    pelvisPivot.add(pelvisMesh);

    // Flexible Spine -> Sculpted V-Taper Athletic Torso (Abs + Obliques + Pecs + Lats + Traps)
    const spinePivot = new THREE.Group();
    spinePivot.position.set(0, 0.08, 0);
    pelvisPivot.add(spinePivot);

    const torsoSections: LoftProfile[] = [
      { s: 0.0, rx: 0.140, rzAnt: 0.100, rzPost: 0.102, pinchCenter: 0.008 },
      { s: 0.22, rx: 0.136, rzAnt: 0.104, rzPost: 0.102, pinchCenter: 0.014 },
      { s: 0.45, rx: 0.158, rzAnt: 0.114, rzPost: 0.114, pinchCenter: 0.014 },
      { s: 0.70, rx: 0.196, rzAnt: 0.128, rzPost: 0.128, pinchCenter: 0.018 },
      { s: 0.88, rx: 0.188, rzAnt: 0.110, rzPost: 0.112, pinchCenter: 0.010 },
      { s: 1.0, rx: 0.072, rzAnt: 0.068, rzPost: 0.072 },
    ];

    const torsoMesh = buildOrganicLoftMesh(
      torsoSections,
      0.48,
      26,
      36,
      loftMats,
      (s, nx, nz, pt) => {
        // Sculpted Pectoralis Major slabs
        if (nz > 0.2 && s > 0.52 && s < 0.86) {
          const pecY = Math.sin(((s - 0.52) / 0.34) * Math.PI);
          const pecX = Math.exp(-Math.pow((Math.abs(nx) - 0.46) / 0.32, 2));
          pt.z += 0.024 * pecY * pecX * nz;
        }
        // 6-Pack Rectus Abdominis + Linea Alba
        if (nz > 0.35 && s > 0.08 && s < 0.50) {
          const abCol = Math.exp(-Math.pow((Math.abs(nx) - 0.26) / 0.18, 2));
          const abRow = Math.pow(Math.abs(Math.sin(((s - 0.08) / 0.42) * Math.PI * 3)), 0.8);
          pt.z += 0.011 * abCol * abRow;
        }
        // Sculpted Latissimus Dorsi & Upper Back
        if (nz < -0.2 && s > 0.38 && s < 0.84) {
          const latY = Math.sin(((s - 0.38) / 0.46) * Math.PI);
          const latX = Math.exp(-Math.pow((Math.abs(nx) - 0.56) / 0.30, 2));
          pt.z -= 0.018 * latY * latX;
          pt.x += Math.sign(nx) * 0.012 * latY * latX;
        }
      },
      (s, nx, nz) => {
        if (nz > 0.28 && s > 0.54 && s < 0.84 && Math.abs(nx) > 0.12) return 2;
        if (nz > 0.42 && s > 0.10 && s < 0.48 && Math.abs(nx) < 0.46) return 2;
        return 0;
      }
    );
    spinePivot.add(torsoMesh);

    const upperTorsoPivot = new THREE.Group();
    upperTorsoPivot.position.set(0, 0.36, 0);
    spinePivot.add(upperTorsoPivot);

    // Seamless Sculpted Neck & Smooth Bald Faceless Mannequin Head (ZERO eyes/mouth/hair)
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.10, 0.005);
    upperTorsoPivot.add(headPivot);

    const headSections: LoftProfile[] = [
      { s: 0.0, rx: 0.062, rzAnt: 0.060, rzPost: 0.064 },
      { s: 0.22, rx: 0.052, rzAnt: 0.054, rzPost: 0.056 },
      { s: 0.34, rx: 0.058, rzAnt: 0.078, rzPost: 0.062, cz: 0.010 }, // Jaw/chin contour
      { s: 0.52, rx: 0.072, rzAnt: 0.088, rzPost: 0.082, cz: 0.008 }, // Smooth faceless plane
      { s: 0.72, rx: 0.077, rzAnt: 0.089, rzPost: 0.091, cz: 0.002 }, // Smooth bald forehead & cranium
      { s: 0.88, rx: 0.064, rzAnt: 0.074, rzPost: 0.076 },
      { s: 0.97, rx: 0.032, rzAnt: 0.036, rzPost: 0.038 },
      { s: 1.0, rx: 0.003, rzAnt: 0.003, rzPost: 0.003 },
    ];
    const headMesh = buildOrganicLoftMesh(
      headSections,
      0.30,
      22,
      30,
      loftMats,
      (s, nx, nz, pt) => {
        // Subtle mannequin chin taper & clean brow ridge without facial features
        if (s > 0.30 && s < 0.44 && nz > 0.5) {
          const chinTaper = Math.sin(((s - 0.30) / 0.14) * Math.PI);
          pt.z += 0.008 * chinTaper * Math.exp(-nx * nx * 6);
        }
      },
      () => 0
    );
    headPivot.add(headMesh);

    // Helper: 100% Symmetrical Seamless Organic Lofted Arm + Sculpted 3D Anatomical Hand
    function createOrganicArm(side: 'left' | 'right') {
      const isLeft = side === 'left';
      const xSign = isLeft ? -1 : 1;

      const shoulderPivot = new THREE.Group();
      shoulderPivot.position.set(xSign * 0.192, 0.032, 0);

      // Seamless rounded deltoid shoulder dome bridging torso & humerus
      const deltoidCap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 18, 14), activeAccentMat);
      deltoidCap.scale.set(0.96, 1.04, 0.98);
      deltoidCap.position.set(0, -0.008, 0);
      shoulderPivot.add(deltoidCap);

      // Continuous Deltoid + Upper Arm Loft (symmetrical L/R matte-satin clay)
      const upperArmSections: LoftProfile[] = [
        { s: 0.0, rx: 0.004, rzAnt: 0.004, rzPost: 0.004 },
        { s: 0.08, rx: 0.058, rzAnt: 0.060, rzPost: 0.058 },
        { s: 0.20, rx: 0.066, rzAnt: 0.068, rzPost: 0.066 },
        { s: 0.42, rx: 0.055, rzAnt: 0.061, rzPost: 0.059 },
        { s: 0.70, rx: 0.048, rzAnt: 0.055, rzPost: 0.053 },
        { s: 0.92, rx: 0.040, rzAnt: 0.043, rzPost: 0.043 },
        { s: 1.0, rx: 0.038, rzAnt: 0.040, rzPost: 0.040 },
      ];
      const upperArmMesh = buildOrganicLoftMesh(
        upperArmSections,
        0.30,
        18,
        24,
        loftMats,
        (s, _nx, nz, pt) => {
          if (s > 0.36 && s < 0.84) {
            const bell = Math.sin(((s - 0.36) / 0.48) * Math.PI);
            if (nz > 0.2) pt.z += 0.009 * bell * nz;
            if (nz < -0.2) pt.z += 0.008 * bell * nz;
          }
        },
        (s) => (s < 0.30 ? 2 : 0),
        true
      );
      upperArmMesh.position.y = 0.032;
      shoulderPivot.add(upperArmMesh);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -0.265, 0);
      shoulderPivot.add(elbowPivot);

      // Seamless elbow joint bridge (zero gap at 90-130 deg sprint flexion)
      const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.039, 14, 12), skinMat);
      elbowCap.scale.set(0.98, 1.02, 1.02);
      elbowPivot.add(elbowCap);

      // Symmetrical Elbow + Forearm terminating cleanly at Wrist Cuff
      const forearmSections: LoftProfile[] = [
        { s: 0.0, rx: 0.039, rzAnt: 0.041, rzPost: 0.041 },
        { s: 0.24, rx: 0.044, rzAnt: 0.046, rzPost: 0.046 },
        { s: 0.68, rx: 0.032, rzAnt: 0.032, rzPost: 0.032 },
        { s: 1.0, rx: 0.027, rzAnt: 0.023, rzPost: 0.023 },
      ];
      const forearmMesh = buildOrganicLoftMesh(
        forearmSections,
        0.255,
        16,
        22,
        loftMats,
        () => {},
        () => 0,
        true
      );
      elbowPivot.add(forearmMesh);

      // Sculpted 3D Anatomical Hand (Palm + Opposed Thumb + Curled Runner Fingers)
      const handGroup = new THREE.Group();
      handGroup.position.set(0, -0.255, 0);
      const wristCap = new THREE.Mesh(new THREE.SphereGeometry(0.023, 12, 10), skinMat);
      wristCap.scale.set(1.12, 0.88, 0.88);
      handGroup.add(wristCap);

      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.058, 0.022), skinMat);
      palm.position.set(0, -0.034, 0.002);
      handGroup.add(palm);

      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.032, 6, 8), skinMat);
      thumb.position.set(-xSign * 0.028, -0.034, 0.016);
      thumb.rotation.set(0.45, 0, xSign * 0.35);
      handGroup.add(thumb);

      [-0.018, -0.006, 0.006, 0.018].forEach((fx, i) => {
        const fl = i === 1 ? 0.046 : i === 3 ? 0.036 : 0.042;
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0068, fl, 6, 8), skinMat);
        finger.position.set(fx, -0.072, 0.014);
        finger.rotation.x = -0.68;
        handGroup.add(finger);
      });
      elbowPivot.add(handGroup);

      const elbowMarker = new THREE.Object3D();
      elbowPivot.add(elbowMarker);
      const wristMarker = new THREE.Object3D();
      wristMarker.position.set(0, -0.255, 0);
      elbowPivot.add(wristMarker);

      return { shoulderPivot, elbowPivot, elbowMarker, wristMarker };
    }

    // Helper: Seamless Organic Lofted Leg (Charcoal Shorts Thigh + Sculpted Quads + Calves + Barefoot)
    function createOrganicLeg(side: 'left' | 'right') {
      const xSign = side === 'left' ? -1 : 1;
      const hipPivot = new THREE.Group();
      hipPivot.position.set(xSign * 0.098, -0.02, 0);

      // Continuous Sculpted Thigh Loft (Shorts Hem -> Quadriceps/Hamstring -> Knee)
      const thighSections: LoftProfile[] = [
        { s: 0.0, rx: 0.088, rzAnt: 0.092, rzPost: 0.098 },
        { s: 0.28, rx: 0.086, rzAnt: 0.094, rzPost: 0.096 },
        { s: 0.56, rx: 0.078, rzAnt: 0.088, rzPost: 0.084 }, // Quad sweep
        { s: 0.84, rx: 0.060, rzAnt: 0.064, rzPost: 0.062 }, // Vastus teardrop
        { s: 1.0, rx: 0.052, rzAnt: 0.056, rzPost: 0.052 }, // Knee cap
      ];
      const thighMesh = buildOrganicLoftMesh(
        thighSections,
        0.43,
        18,
        24,
        loftMats,
        (s, nx, nz, pt) => {
          if (s > 0.34 && s < 0.86) {
            const quadBell = Math.sin(((s - 0.34) / 0.52) * Math.PI);
            if (nz > 0.15) pt.z += 0.012 * quadBell * nz;
            if (nx * xSign > 0.2) pt.x += xSign * 0.008 * quadBell;
          }
        },
        (s, _nx, nz) => {
          if (s < 0.38) return 1; // Charcoal compression shorts leg
          if (nz > 0.25 && s > 0.42 && s < 0.86) return 2; // Active quad accent
          return 0;
        },
        true
      );
      hipPivot.add(thighMesh);

      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -0.415, 0);
      hipPivot.add(kneePivot);

      // Seamless patella / knee joint dome (eliminates knee seam gap during sprint flexion)
      const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.053, 16, 14), skinMat);
      kneeCap.scale.set(0.98, 1.06, 1.04);
      kneePivot.add(kneeCap);

      // Continuous Sculpted Lower Leg Loft (Knee -> Gastrocnemius Calf -> Achilles/Ankle)
      const calfSections: LoftProfile[] = [
        { s: 0.0, rx: 0.052, rzAnt: 0.054, rzPost: 0.052 },
        { s: 0.28, rx: 0.056, rzAnt: 0.052, rzPost: 0.068 }, // Sculpted calf muscle belly
        { s: 0.55, rx: 0.044, rzAnt: 0.044, rzPost: 0.050 },
        { s: 0.84, rx: 0.032, rzAnt: 0.035, rzPost: 0.036 }, // Achilles taper
        { s: 1.0, rx: 0.032, rzAnt: 0.036, rzPost: 0.036 }, // Ankle
      ];
      const calfMesh = buildOrganicLoftMesh(
        calfSections,
        0.41,
        18,
        22,
        loftMats,
        (s, _nx, nz, pt) => {
          if (nz < -0.2 && s > 0.12 && s < 0.56) {
            const calfPeak = Math.sin(((s - 0.12) / 0.44) * Math.PI);
            pt.z -= 0.012 * calfPeak * -nz;
          }
        },
        (s, _nx, nz) => (nz < -0.25 && s > 0.14 && s < 0.54 ? 2 : 0),
        true
      );
      kneePivot.add(calfMesh);

      // Sculpted Barefoot Mannequin Foot with Seamless Ankle Cuff
      const footPivot = new THREE.Group();
      footPivot.position.set(0, -0.40, 0);
      kneePivot.add(footPivot);

      const ankleCuff = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), skinMat);
      ankleCuff.scale.set(0.98, 1.12, 1.04);
      ankleCuff.position.set(0, -0.004, 0);
      footPivot.add(ankleCuff);

      const instep = new THREE.Mesh(new THREE.CapsuleGeometry(0.033, 0.105, 12, 16), skinMat);
      instep.rotation.x = Math.PI / 2;
      instep.scale.set(1.02, 1.0, 0.70);
      instep.position.set(0, -0.030, 0.044);
      footPivot.add(instep);

      const heel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 12), skinMat);
      heel.scale.set(0.94, 0.88, 1.06);
      heel.position.set(0, -0.028, -0.015);
      footPivot.add(heel);

      const forefoot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), skinMat);
      forefoot.scale.set(1.12, 0.50, 1.16);
      forefoot.position.set(0, -0.038, 0.102);
      footPivot.add(forefoot);

      return { hipPivot, kneePivot, footPivot };
    }

    const leftArm = createOrganicArm('left');
    const rightArm = createOrganicArm('right');
    upperTorsoPivot.add(leftArm.shoulderPivot, rightArm.shoulderPivot);

    const leftLeg = createOrganicLeg('left');
    const rightLeg = createOrganicLeg('right');
    pelvisPivot.add(leftLeg.hipPivot, rightLeg.hipPivot);

    // ============================================================================
    // INTERNAL ARTICULATED 3D ANATOMICAL SKELETON (Synced Live With Sprint Rig)
    // ============================================================================
    const skeletonGroup = new THREE.Group();
    skeletonGroup.visible = false;
    scene.add(skeletonGroup);

    const makeBone = (rTop: number, rBot: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1, 10), boneMat);
      skeletonGroup.add(m);
      return m;
    };
    const makeJoint = (r: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), jointBeaconMat);
      skeletonGroup.add(m);
      return m;
    };

    const skullGroup = new THREE.Group();
    const skCranium = new THREE.Mesh(new THREE.SphereGeometry(0.064, 18, 16), boneMat);
    skCranium.scale.set(0.92, 1.06, 1.05);
    skCranium.position.set(0, 0.19, 0.004);
    const skJaw = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.026, 0.052, 12), boneMat);
    skJaw.position.set(0, 0.132, 0.016);
    skullGroup.add(skCranium, skJaw);
    skeletonGroup.add(skullGroup);

    const ribGroup = new THREE.Group();
    [
      { rx: 0.11, rz: 0.075, y: 0.08 },
      { rx: 0.132, rz: 0.09, y: 0.04 },
      { rx: 0.136, rz: 0.092, y: 0.0 },
      { rx: 0.124, rz: 0.084, y: -0.04 },
      { rx: 0.108, rz: 0.072, y: -0.08 },
    ].forEach((r) => {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 24), boneMat);
      rib.rotation.x = Math.PI / 2;
      rib.scale.set(r.rx, r.rz, 0.12);
      rib.position.y = r.y;
      ribGroup.add(rib);
    });
    const skSternum = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.155, 0.014), boneMat);
    skSternum.position.set(0, 0.0, 0.086);
    ribGroup.add(skSternum);
    skeletonGroup.add(ribGroup);

    const skPelvisGroup = new THREE.Group();
    const skIliumL = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.014, 8, 18), boneMat);
    skIliumL.position.set(-0.066, 0.01, 0);
    skIliumL.rotation.y = Math.PI * 0.25;
    const skIliumR = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.014, 8, 18), boneMat);
    skIliumR.position.set(0.066, 0.01, 0);
    skIliumR.rotation.y = -Math.PI * 0.25;
    skPelvisGroup.add(skIliumL, skIliumR);
    skeletonGroup.add(skPelvisGroup);

    const skVertebrae: THREE.Mesh[] = Array.from({ length: 7 }, () => {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.022, 0.036, 10), boneMat);
      skeletonGroup.add(v);
      return v;
    });

    const skClavL = makeBone(0.011, 0.010);
    const skClavR = makeBone(0.011, 0.010);
    const skHumL = makeBone(0.017, 0.013);
    const skHumR = makeBone(0.017, 0.013);
    const skForeL = makeBone(0.014, 0.011);
    const skForeR = makeBone(0.014, 0.011);
    const skFemL = makeBone(0.021, 0.017);
    const skFemR = makeBone(0.021, 0.017);
    const skTibL = makeBone(0.016, 0.012);
    const skTibR = makeBone(0.016, 0.012);

    const jNeck = makeJoint(0.020);
    const jShL = makeJoint(0.024);
    const jShR = makeJoint(0.024);
    const jElL = makeJoint(0.019);
    const jElR = makeJoint(0.019);
    const jWrL = makeJoint(0.014);
    const jWrR = makeJoint(0.014);
    const jHipL = makeJoint(0.026);
    const jHipR = makeJoint(0.026);
    const jKnL = makeJoint(0.022);
    const jKnR = makeJoint(0.022);
    const jAnL = makeJoint(0.017);
    const jAnR = makeJoint(0.017);

    const applyDisplayMode = (mode: MannequinDisplayMode) => {
      const isXray = mode === 'xray';
      const isSkel = mode === 'skeleton';
      const translucent = isXray || isSkel;
      const skinAlpha = isSkel ? 0.09 : isXray ? 0.30 : 1.0;
      const fabricAlpha = isSkel ? 0.07 : isXray ? 0.25 : 1.0;

      skeletonGroup.visible = translucent;

      [
        { m: skinMat, a: skinAlpha },
        { m: activeAccentMat, a: skinAlpha },
        { m: charcoalFabricMat, a: fabricAlpha },
      ].forEach(({ m, a }) => {
        m.transparent = translucent;
        m.opacity = a;
        m.depthWrite = !translucent;
        m.needsUpdate = true;
      });
    };
    applyModeFnRef.current = applyDisplayMode;
    applyDisplayMode(modeRef.current);

    const upY = new THREE.Vector3(0, 1, 0);
    const vDir = new THREE.Vector3();
    const vMid = new THREE.Vector3();
    const pPelvis = new THREE.Vector3();
    const pNeck = new THREE.Vector3();
    const pShL = new THREE.Vector3();
    const pShR = new THREE.Vector3();
    const pElL = new THREE.Vector3();
    const pElR = new THREE.Vector3();
    const pWrL = new THREE.Vector3();
    const pWrR = new THREE.Vector3();
    const pHipL = new THREE.Vector3();
    const pHipR = new THREE.Vector3();
    const pKnL = new THREE.Vector3();
    const pKnR = new THREE.Vector3();
    const pAnL = new THREE.Vector3();
    const pAnR = new THREE.Vector3();
    const qHead = new THREE.Quaternion();
    const qTorso = new THREE.Quaternion();
    const qPelvis = new THREE.Quaternion();

    const alignBone = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      vDir.subVectors(b, a);
      const len = Math.max(0.001, vDir.length());
      vMid.addVectors(a, b).multiplyScalar(0.5);
      mesh.position.copy(vMid);
      mesh.scale.set(1, len, 1);
      mesh.quaternion.setFromUnitVectors(upY, vDir.divideScalar(len));
    };

    const syncSkeleton = (breath: number) => {
      if (!skeletonGroup.visible) return;
      runner.updateMatrixWorld(true);

      pelvisPivot.getWorldPosition(pPelvis);
      pelvisPivot.getWorldQuaternion(qPelvis);
      headPivot.getWorldPosition(pNeck);
      headPivot.getWorldQuaternion(qHead);
      upperTorsoPivot.getWorldQuaternion(qTorso);

      leftArm.shoulderPivot.getWorldPosition(pShL);
      rightArm.shoulderPivot.getWorldPosition(pShR);
      leftArm.elbowMarker.getWorldPosition(pElL);
      rightArm.elbowMarker.getWorldPosition(pElR);
      leftArm.wristMarker.getWorldPosition(pWrL);
      rightArm.wristMarker.getWorldPosition(pWrR);

      leftLeg.hipPivot.getWorldPosition(pHipL);
      rightLeg.hipPivot.getWorldPosition(pHipR);
      leftLeg.kneePivot.getWorldPosition(pKnL);
      rightLeg.kneePivot.getWorldPosition(pKnR);
      leftLeg.footPivot.getWorldPosition(pAnL);
      rightLeg.footPivot.getWorldPosition(pAnR);

      skullGroup.position.copy(pNeck);
      skullGroup.quaternion.copy(qHead);

      skPelvisGroup.position.copy(pPelvis);
      skPelvisGroup.quaternion.copy(qPelvis);

      ribGroup.position.lerpVectors(pPelvis, pNeck, 0.65);
      ribGroup.quaternion.copy(qTorso);
      ribGroup.scale.set(1 + breath * 0.025, 1, 1 + breath * 0.025);

      for (let i = 0; i < skVertebrae.length; i++) {
        const u = (i + 0.5) / skVertebrae.length;
        skVertebrae[i].position.lerpVectors(pPelvis, pNeck, u);
        skVertebrae[i].quaternion.copy(qTorso);
      }

      alignBone(skClavL, pNeck, pShL);
      alignBone(skClavR, pNeck, pShR);
      alignBone(skHumL, pShL, pElL);
      alignBone(skHumR, pShR, pElR);
      alignBone(skForeL, pElL, pWrL);
      alignBone(skForeR, pElR, pWrR);
      alignBone(skFemL, pHipL, pKnL);
      alignBone(skFemR, pHipR, pKnR);
      alignBone(skTibL, pKnL, pAnL);
      alignBone(skTibR, pKnR, pAnR);

      jNeck.position.copy(pNeck);
      jShL.position.copy(pShL);
      jShR.position.copy(pShR);
      jElL.position.copy(pElL);
      jElR.position.copy(pElR);
      jWrL.position.copy(pWrL);
      jWrR.position.copy(pWrR);
      jHipL.position.copy(pHipL);
      jHipR.position.copy(pHipR);
      jKnL.position.copy(pKnL);
      jKnR.position.copy(pKnR);
      jAnL.position.copy(pAnL);
      jAnR.position.copy(pAnR);
    };

    let targetYaw = -0.58;
    let targetPitch = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const ny = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      targetYaw = -0.58 + nx * 0.45;
      targetPitch = ny * 0.10;
    };
    const onPointerLeave = () => {
      targetYaw = -0.58;
      targetPitch = 0;
    };
    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });

    let rafId = 0;
    let lastTime: number | null = null;
    let elapsed = 0;

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
        afterDraw(() => animate(performance.now()));
      } else {
        rafId = requestAnimationFrame(animate);
      }
    };

    const animate = (now: number) => {
      if (disposed || isContextLost || !isVisible || !isTabVisible) return;

      const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      if (!prefersReducedMotion) {
        elapsed += dt;
      }

      // Dynamic Explosive Sprinting Biomechanics (Forward Drive inspired by Reference 1)
      const cycle = prefersReducedMotion ? 0.65 : elapsed * 5.0 + 0.65;
      const swing = Math.sin(cycle);
      const liftL = Math.max(0, Math.sin(cycle));
      const liftR = Math.max(0, Math.sin(cycle + Math.PI));
      const bounce = Math.abs(Math.sin(cycle)) * 0.08;
      const breath = Math.sin(cycle * 0.5);

      pelvisPivot.position.y = 0.92 + bounce;
      pelvisPivot.rotation.x = 0.28 + bounce * 0.25;
      pelvisPivot.rotation.y = swing * 0.14;
      pelvisPivot.rotation.z = -swing * 0.04;

      spinePivot.rotation.x = 0.14 + breath * 0.03;
      spinePivot.rotation.y = -swing * 0.18;
      upperTorsoPivot.rotation.y = -swing * 0.12;
      headPivot.rotation.x = -0.34;
      headPivot.rotation.y = swing * 0.10;

      leftLeg.hipPivot.rotation.x = -swing * 0.92 - 0.18;
      leftLeg.kneePivot.rotation.x = 0.24 + liftL * 1.18 + Math.max(0, -swing) * 0.30;
      leftLeg.footPivot.rotation.x = -0.18 + liftL * 0.34;

      rightLeg.hipPivot.rotation.x = swing * 0.92 - 0.18;
      rightLeg.kneePivot.rotation.x = 0.24 + liftR * 1.18 + Math.max(0, swing) * 0.30;
      rightLeg.footPivot.rotation.x = -0.18 + liftR * 0.34;

      leftArm.shoulderPivot.rotation.x = swing * 0.96;
      leftArm.shoulderPivot.rotation.z = -0.14;
      leftArm.elbowPivot.rotation.x = -1.16 - Math.max(0, swing) * 0.38;

      rightArm.shoulderPivot.rotation.x = -swing * 0.96;
      rightArm.shoulderPivot.rotation.z = 0.14;
      rightArm.elbowPivot.rotation.x = -1.16 - Math.max(0, -swing) * 0.38;

      const autoYaw = prefersReducedMotion ? 0 : Math.sin(elapsed * 0.35) * 0.26;
      runner.rotation.y += (targetYaw + autoYaw - runner.rotation.y) * 0.08;
      runner.rotation.x += (targetPitch - runner.rotation.x) * 0.08;

      const shadowScale = 1 - bounce * 0.65;
      contactShadow.scale.set(shadowScale, shadowScale, 1);

      syncSkeleton(breath);

      renderer.render(scene, camera);
      scheduleNext();
    };

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const nextVis = Boolean(entries[0]?.isIntersecting);
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

    animate(performance.now());

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 440;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      applyModeFnRef.current = null;
      cancelAnimationFrame(rafId);
      clearTimeout(rafId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      disposeSceneResources(scene);
      pbr.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, []);

  if (!webGLOk) {
    return (
      <div className="w-full h-full flex items-center justify-center rounded-3xl bg-[#111114] border border-[#27272E] text-neutral-400 text-xs p-6 text-center">
        Pratinjau 3D membutuhkan WebGL aktif pada peramban Anda.
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="hero-runner-3d"
      className="w-full h-full min-h-[320px] sm:min-h-[420px] select-none"
    />
  );
}

export default HeroRunner3D;
