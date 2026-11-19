'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createProceduralPBRTextures, disposeSceneResources } from '@/lib/pbrTextures';

export function HeroRunner3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let frameId = 0;
    let disposed = false;
    let isVisible = true;
    let isTabVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    let isContextLost = false;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      window.setTimeout(() => setWebglFailed(true), 0);
      return;
    }

    const width = container.clientWidth || 520;
    const height = container.clientHeight || 460;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const pbr = createProceduralPBRTextures(maxAnisotropy);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x09090b, 0.085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.65;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 1.38, 4.15);
    camera.lookAt(0, 1.06, 0);

    // 3-Point Editorial Studio Lighting (Warm Key + Cool Sky Fill + Ember Rim)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x09090b, 0.6);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.35);
    keyLight.position.set(3.2, 5.2, 3.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.85);
    fillLight.position.set(-3.0, 2.4, 2.2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xff3b1d, 6.0, 10);
    rimLight.position.set(-2.1, 2.2, -2.1);
    scene.add(rimLight);

    const warmUnderLight = new THREE.PointLight(0xf97316, 3.2, 7);
    warmUnderLight.position.set(1.8, 0.65, 1.6);
    scene.add(warmUnderLight);

    // Procedural PBR Materials with high roughness/metalness contrast
    const carbonArmorMat = new THREE.MeshPhysicalMaterial({
      color: 0x16161b,
      roughness: 0.34,
      metalness: 0.78,
      clearcoat: 0.22,
      clearcoatRoughness: 0.35,
      bumpMap: pbr.carbonBumpMap,
      bumpScale: 0.006,
      roughnessMap: pbr.carbonRoughnessMap,
    });

    const titaniumTrimMat = new THREE.MeshPhysicalMaterial({
      color: 0x52525b,
      roughness: 0.22,
      metalness: 0.92,
      clearcoat: 0.15,
    });

    const emberMuscleMat = new THREE.MeshPhysicalMaterial({
      color: 0xea580c,
      emissive: 0xff3b1d,
      emissiveIntensity: 0.82,
      roughness: 0.44,
      metalness: 0.18,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xfdba74),
      bumpMap: pbr.skinBumpMap,
      bumpScale: 0.004,
      roughnessMap: pbr.skinRoughnessMap,
    });

    const warmAmberMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.48,
      roughness: 0.48,
      metalness: 0.28,
      bumpMap: pbr.skinBumpMap,
      bumpScale: 0.003,
    });

    const runnerGroup = new THREE.Group();
    scene.add(runnerGroup);

    // 1. Tiered Carbon Studio Pedestal + Recessed Ember Ring + Grounded Contact Shadow
    const basePlinthGeo = new THREE.CylinderGeometry(1.36, 1.48, 0.07, 48);
    const basePlinth = new THREE.Mesh(basePlinthGeo, carbonArmorMat);
    basePlinth.position.y = 0.035;
    basePlinth.receiveShadow = true;
    runnerGroup.add(basePlinth);

    const innerPlateGeo = new THREE.CylinderGeometry(1.16, 1.24, 0.035, 48);
    const innerPlate = new THREE.Mesh(innerPlateGeo, titaniumTrimMat);
    innerPlate.position.y = 0.085;
    innerPlate.receiveShadow = true;
    runnerGroup.add(innerPlate);

    const emberRingGeo = new THREE.TorusGeometry(1.26, 0.016, 16, 64);
    const emberRing = new THREE.Mesh(emberRingGeo, emberMuscleMat);
    emberRing.rotation.x = Math.PI / 2;
    emberRing.position.y = 0.075;
    runnerGroup.add(emberRing);

    const contactShadowGeo = new THREE.PlaneGeometry(1.65, 1.65);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: pbr.contactShadowMap,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.106;
    runnerGroup.add(contactShadow);

    // 2. Sculpted Athletic V-Taper Torso via LatheGeometry
    const torsoPivot = new THREE.Group();
    torsoPivot.position.set(0, 1.12, 0);
    torsoPivot.rotation.x = 0.24; // Dynamic sprint lean
    runnerGroup.add(torsoPivot);

    const torsoProfile = [
      new THREE.Vector2(0.01, -0.18),
      new THREE.Vector2(0.18, -0.14), // Pelvis
      new THREE.Vector2(0.165, -0.02), // Narrow waist
      new THREE.Vector2(0.20, 0.12), // Lower ribcage
      new THREE.Vector2(0.255, 0.28), // Chest / lats flare
      new THREE.Vector2(0.24, 0.41), // Clavicle shelf
      new THREE.Vector2(0.095, 0.49), // Neck base
      new THREE.Vector2(0.068, 0.56), // Upper neck
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoProfile, 28);
    const torsoMesh = new THREE.Mesh(torsoGeo, carbonArmorMat);
    torsoMesh.scale.set(1.06, 1.0, 0.74);
    torsoMesh.castShadow = true;
    torsoPivot.add(torsoMesh);

    // Sculpted Left & Right Pectoral Muscle Plates
    const pecGeo = new THREE.SphereGeometry(0.14, 20, 16);
    [-1, 1].forEach((side) => {
      const pec = new THREE.Mesh(pecGeo, emberMuscleMat);
      pec.scale.set(0.95, 0.68, 0.52);
      pec.position.set(side * 0.115, 0.28, 0.145);
      pec.rotation.y = side * -0.22;
      torsoPivot.add(pec);
    });

    // Sculpted Core Abs Segments (3 contoured segments)
    const abGeo = new THREE.CapsuleGeometry(0.042, 0.12, 6, 12);
    [0.14, 0.05, -0.04].forEach((yOff, idx) => {
      const ab = new THREE.Mesh(abGeo, warmAmberMat);
      ab.rotation.z = Math.PI / 2;
      ab.scale.set(0.85, 1.0 - idx * 0.1, 0.55);
      ab.position.set(0, yOff, 0.132 - idx * 0.008);
      torsoPivot.add(ab);
    });

    // Dorsal Spine Energy Ridge (visible during rotation)
    const spineGeo = new THREE.CapsuleGeometry(0.022, 0.36, 6, 10);
    const spineRidge = new THREE.Mesh(spineGeo, emberMuscleMat);
    spineRidge.position.set(0, 0.18, -0.155);
    torsoPivot.add(spineRidge);

    // 3. Sculpted Aerodynamic Head & Curved Visor
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.67, 0.03);
    torsoPivot.add(headGroup);

    const craniumGeo = new THREE.SphereGeometry(0.145, 24, 24);
    const craniumMesh = new THREE.Mesh(craniumGeo, carbonArmorMat);
    craniumMesh.scale.set(0.88, 1.12, 0.98);
    craniumMesh.castShadow = true;
    headGroup.add(craniumMesh);

    const visorGeo = new THREE.CylinderGeometry(0.142, 0.136, 0.055, 24, 1, true, -Math.PI * 0.36, Math.PI * 0.72);
    const visorMesh = new THREE.Mesh(visorGeo, emberMuscleMat);
    visorMesh.position.set(0, 0.015, 0.015);
    headGroup.add(visorMesh);

    // 4. Sculpted Articulated Arms (Deltoids + Upper + Forearms + Hands)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.31, 0.36, 0);
    torsoPivot.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.31, 0.36, 0);
    torsoPivot.add(rightArmGroup);

    const deltoidGeo = new THREE.SphereGeometry(0.095, 16, 16);
    const upperArmGeo = new THREE.CapsuleGeometry(0.062, 0.24, 8, 14);
    const forearmGeo = new THREE.CapsuleGeometry(0.048, 0.22, 8, 14);
    const handGeo = new THREE.SphereGeometry(0.045, 12, 12);

    [leftArmGroup, rightArmGroup].forEach((armGrp) => {
      const delt = new THREE.Mesh(deltoidGeo, emberMuscleMat);
      delt.scale.set(1.0, 1.12, 0.95);
      armGrp.add(delt);

      const upper = new THREE.Mesh(upperArmGeo, carbonArmorMat);
      upper.position.y = -0.17;
      upper.castShadow = true;
      armGrp.add(upper);

      const elbowPivot = new THREE.Group();
      elbowPivot.position.set(0, -0.31, 0);
      elbowPivot.rotation.x = -1.12;
      armGrp.add(elbowPivot);

      const fore = new THREE.Mesh(forearmGeo, warmAmberMat);
      fore.position.y = -0.13;
      elbowPivot.add(fore);

      const hand = new THREE.Mesh(handGeo, carbonArmorMat);
      hand.scale.set(0.85, 1.2, 0.7);
      hand.position.y = -0.27;
      elbowPivot.add(hand);
    });

    // 5. Sculpted Articulated Legs + Knee Pivots + Aerodynamic Running Shoes
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.145, 0.98, 0);
    runnerGroup.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.145, 0.98, 0);
    runnerGroup.add(rightLegGroup);

    const thighGeo = new THREE.CapsuleGeometry(0.094, 0.32, 8, 16);
    const kneeCapGeo = new THREE.SphereGeometry(0.064, 14, 14);
    const calfGeo = new THREE.CapsuleGeometry(0.068, 0.30, 8, 16);
    const shoeUpperGeo = new THREE.CapsuleGeometry(0.052, 0.14, 6, 12);
    const shoeSoleGeo = new THREE.BoxGeometry(0.11, 0.035, 0.24);

    const kneePivots: THREE.Group[] = [];

    [leftLegGroup, rightLegGroup].forEach((legGrp) => {
      const thigh = new THREE.Mesh(thighGeo, emberMuscleMat);
      thigh.scale.set(0.95, 1.0, 1.08);
      thigh.position.y = -0.21;
      thigh.castShadow = true;
      legGrp.add(thigh);

      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -0.43, 0);
      legGrp.add(kneePivot);
      kneePivots.push(kneePivot);

      const kneeCap = new THREE.Mesh(kneeCapGeo, titaniumTrimMat);
      kneePivot.add(kneeCap);

      const calf = new THREE.Mesh(calfGeo, carbonArmorMat);
      calf.position.set(0, -0.21, -0.01);
      calf.castShadow = true;
      kneePivot.add(calf);

      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -0.42, 0.05);
      kneePivot.add(shoeGroup);

      const shoeUpper = new THREE.Mesh(shoeUpperGeo, carbonArmorMat);
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.position.y = 0.025;
      shoeGroup.add(shoeUpper);

      const shoeSole = new THREE.Mesh(shoeSoleGeo, warmAmberMat);
      shoeSole.position.set(0, -0.01, 0.01);
      shoeGroup.add(shoeSole);
    });

    // 6. Instanced Kinetic Ember Sparks (36 instances -> single draw call)
    const particleCount = 36;
    const particleGeo = new THREE.OctahedronGeometry(0.022, 0);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xff5a26,
      transparent: true,
      opacity: 0.75,
    });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, particleCount);
    const dummyMat4 = new THREE.Matrix4();
    const dummyPos = new THREE.Vector3();
    const dummyQuat = new THREE.Quaternion();
    const dummyScale = new THREE.Vector3(1, 1, 1);

    const particleSeeds = Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2,
      radius: 0.84 + (i % 5) * 0.13,
      yBase: 0.22 + (i % 9) * 0.21,
      speed: 0.28 + (i % 4) * 0.11,
      scale: 0.65 + (i % 3) * 0.32,
    }));

    const updateParticles = (t: number) => {
      for (let i = 0; i < particleCount; i++) {
        const p = particleSeeds[i];
        const a = p.angle + t * p.speed * 0.35;
        const y = 0.18 + ((p.yBase + t * p.speed * 0.22) % 1.85);
        dummyPos.set(Math.cos(a) * p.radius, y, Math.sin(a) * p.radius);
        dummyScale.setScalar(p.scale);
        dummyMat4.compose(dummyPos, dummyQuat, dummyScale);
        particleInstanced.setMatrixAt(i, dummyMat4);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
    };

    updateParticles(0.85);
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer parallax state in closure
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.55;
      targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.25;
      if (prefersReducedMotion && !disposed && !isContextLost) {
        renderFrame(0.85, 0.016);
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 520;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (prefersReducedMotion && !isContextLost) {
        renderFrame(0.85, 0);
      }
    };
    window.addEventListener('resize', onResize);

    // WebGL Context Loss Recovery
    const onContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    const onContextRestored = () => {
      isContextLost = false;
      if (!disposed && !prefersReducedMotion) {
        lastNow = performance.now();
        scheduleNext();
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    // Off-screen & Hidden Tab Pause
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              const nextVis = Boolean(entry?.isIntersecting);
              if (nextVis !== isVisible) {
                isVisible = nextVis;
                if (isVisible && isTabVisible && !prefersReducedMotion && !disposed && !isContextLost) {
                  lastNow = performance.now();
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
      if (isTabVisible && isVisible && !prefersReducedMotion && !disposed && !isContextLost) {
        lastNow = performance.now();
        scheduleNext();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Frame-rate independent clock using performance.now() (replaces deprecated THREE.Clock)
    let lastNow = performance.now();
    let elapsed = 0.85;

    function renderFrame(t: number, dt: number) {
      const damp = dt <= 0.0001 ? 1.0 : 1 - Math.exp(-5 * dt);
      currentMouseX += (targetMouseX - currentMouseX) * damp;
      currentMouseY += (targetMouseY - currentMouseY) * damp;

      runnerGroup.rotation.y = -0.46 + Math.sin(t * 0.42) * 0.24 + currentMouseX;
      runnerGroup.rotation.x = currentMouseY * 0.22;

      // Biomechanical sprint stride with coordinated knee flexion
      const phase = t * 4.0;
      const stride = Math.sin(phase);
      leftArmGroup.rotation.x = stride * 0.62;
      rightArmGroup.rotation.x = -stride * 0.62;
      leftLegGroup.rotation.x = -stride * 0.56;
      rightLegGroup.rotation.x = stride * 0.56;

      // Realistic trailing knee bend during swing phase
      if (kneePivots[0]) kneePivots[0].rotation.x = 0.28 + Math.max(0, stride) * 0.68;
      if (kneePivots[1]) kneePivots[1].rotation.x = 0.28 + Math.max(0, -stride) * 0.68;

      const bounce = Math.abs(Math.sin(phase)) * 0.036;
      torsoPivot.position.y = 1.12 + bounce;
      leftLegGroup.position.y = 0.98 + bounce * 0.6;
      rightLegGroup.position.y = 0.98 + bounce * 0.6;
      contactShadow.scale.setScalar(1.0 - bounce * 2.2);

      emberMuscleMat.emissiveIntensity = 0.78 + Math.sin(t * 2.8) * 0.22;
      updateParticles(t);

      renderer.render(scene, camera);
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 85);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed || isContextLost) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 85);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function scheduleNext() {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (disposed || isContextLost || !isVisible || !isTabVisible) return;
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    function tick() {
      if (disposed || isContextLost || !isVisible || !isTabVisible) return;
      const now = performance.now();
      const dt = Math.max(0, Math.min((now - lastNow) / 1000, 0.08));
      lastNow = now;
      elapsed += dt;

      renderFrame(elapsed, dt);
      scheduleNext();
    }

    // Initial render
    renderFrame(elapsed, 0);
    if (!prefersReducedMotion) {
      scheduleNext();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      disposeSceneResources(scene);
      pbr.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="w-full h-[360px] sm:h-[460px] rounded-2xl bg-[#141418] border border-[#27272E] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] opacity-85 mb-4" />
        <p className="text-sm font-semibold text-white">Siluet Biomekanik 3D FitForge</p>
        <p className="text-xs text-neutral-400 mt-1">Mode pratinjau hemat daya aktif</p>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="hero-3d-canvas"
      className="w-full h-[360px] sm:h-[460px] relative select-none"
      aria-label="Visualisasi 3D Siluet Pelari Berpijar FitForge"
    />
  );
}

export default HeroRunner3D;

