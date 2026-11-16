'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function HeroRunner3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let frameId = 0;
    let disposed = false;

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
    const height = container.clientHeight || 480;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.12);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 1.35, 4.2);
    camera.lookAt(0, 1.05, 0);

    // Warm Key Light + Cool Hemisphere Fill + Crimson Rim Light
    const hemiLight = new THREE.HemisphereLight(0x3b82f6, 0x0a0a0a, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xff2d1a, 5.5, 10);
    rimLight.position.set(-2.2, 2.0, -2.0);
    scene.add(rimLight);

    const accentLight = new THREE.PointLight(0xf97316, 3.5, 8);
    accentLight.position.set(2.0, 0.8, 1.5);
    scene.add(accentLight);

    // Materials (Varied roughness & metalness across 12 composite parts)
    const obsidianArmorMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.28,
      metalness: 0.82,
    });

    const glowingMuscleMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff2d1a,
      emissiveIntensity: 0.95,
      roughness: 0.35,
      metalness: 0.4,
    });

    const secondaryAmberMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.55,
      metalness: 0.3,
    });

    // Composite 12-Part Articulated Runner & Energy Core Group
    const runnerGroup = new THREE.Group();
    scene.add(runnerGroup);

    // 1. Podium / Ground Ring + Radial Contact Shadow
    const podiumGeo = new THREE.CylinderGeometry(1.25, 1.4, 0.08, 32);
    const podiumMesh = new THREE.Mesh(podiumGeo, obsidianArmorMat);
    podiumMesh.position.y = 0.04;
    runnerGroup.add(podiumMesh);

    const ringGeo = new THREE.TorusGeometry(1.28, 0.02, 12, 48);
    const ringMesh = new THREE.Mesh(ringGeo, glowingMuscleMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.085;
    runnerGroup.add(ringMesh);

    // 2. Torso Core & Pectorals
    const torsoPivot = new THREE.Group();
    torsoPivot.position.set(0, 1.15, 0);
    torsoPivot.rotation.x = 0.22; // Dynamic forward sprint lean
    runnerGroup.add(torsoPivot);

    const ribcageGeo = new THREE.CylinderGeometry(0.28, 0.21, 0.56, 16);
    const ribcageMesh = new THREE.Mesh(ribcageGeo, obsidianArmorMat);
    ribcageMesh.position.y = 0.18;
    torsoPivot.add(ribcageMesh);

    const chestPlateGeo = new THREE.BoxGeometry(0.5, 0.26, 0.28);
    const chestPlateMesh = new THREE.Mesh(chestPlateGeo, glowingMuscleMat);
    chestPlateMesh.position.set(0, 0.3, 0.06);
    torsoPivot.add(chestPlateMesh);

    const absCoreGeo = new THREE.BoxGeometry(0.34, 0.28, 0.22);
    const absCoreMesh = new THREE.Mesh(absCoreGeo, secondaryAmberMat);
    absCoreMesh.position.set(0, 0.0, 0.04);
    torsoPivot.add(absCoreMesh);

    // 3. Head & Athletic Visor
    const headGeo = new THREE.SphereGeometry(0.16, 20, 20);
    const headMesh = new THREE.Mesh(headGeo, obsidianArmorMat);
    headMesh.scale.set(0.92, 1.12, 0.98);
    headMesh.position.set(0, 0.66, 0.03);
    torsoPivot.add(headMesh);

    const visorGeo = new THREE.BoxGeometry(0.24, 0.06, 0.16);
    const visorMesh = new THREE.Mesh(visorGeo, glowingMuscleMat);
    visorMesh.position.set(0, 0.67, 0.11);
    torsoPivot.add(visorMesh);

    // 4. Left & Right Articulated Arms (Shoulders + Upper + Forearms)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.34, 0.4, 0);
    torsoPivot.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.34, 0.4, 0);
    torsoPivot.add(rightArmGroup);

    const deltoidGeo = new THREE.SphereGeometry(0.11, 14, 14);
    const upperArmGeo = new THREE.CapsuleGeometry(0.075, 0.26, 8, 12);
    const forearmGeo = new THREE.CapsuleGeometry(0.06, 0.24, 8, 12);

    [leftArmGroup, rightArmGroup].forEach((armGrp) => {
      const delt = new THREE.Mesh(deltoidGeo, glowingMuscleMat);
      armGrp.add(delt);
      const upper = new THREE.Mesh(upperArmGeo, obsidianArmorMat);
      upper.position.y = -0.18;
      armGrp.add(upper);
      const fore = new THREE.Mesh(forearmGeo, secondaryAmberMat);
      fore.position.set(0, -0.38, 0.12);
      fore.rotation.x = -0.85;
      armGrp.add(fore);
    });

    // 5. Left & Right Articulated Legs
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.16, 0.98, 0);
    runnerGroup.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.16, 0.98, 0);
    runnerGroup.add(rightLegGroup);

    const thighGeo = new THREE.CapsuleGeometry(0.105, 0.34, 8, 12);
    const calfGeo = new THREE.CapsuleGeometry(0.078, 0.34, 8, 12);

    [leftLegGroup, rightLegGroup].forEach((legGrp) => {
      const thigh = new THREE.Mesh(thighGeo, glowingMuscleMat);
      thigh.position.y = -0.22;
      legGrp.add(thigh);
      const calf = new THREE.Mesh(calfGeo, obsidianArmorMat);
      calf.position.set(0, -0.62, -0.08);
      calf.rotation.x = 0.35;
      legGrp.add(calf);
    });

    // 6. Instanced Ember Particles (> 20 repeated items -> InstancedMesh)
    const particleCount = 36;
    const particleGeo = new THREE.OctahedronGeometry(0.03, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xff4d2a });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, particleCount);
    const dummyMat4 = new THREE.Matrix4();
    const dummyPos = new THREE.Vector3();
    const particleSeeds = Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2,
      radius: 0.75 + (i % 5) * 0.14,
      yBase: 0.25 + (i % 9) * 0.22,
      speed: 0.4 + (i % 4) * 0.15,
    }));

    particleSeeds.forEach((p, i) => {
      dummyPos.set(Math.cos(p.angle) * p.radius, p.yBase, Math.sin(p.angle) * p.radius);
      dummyMat4.makeTranslation(dummyPos.x, dummyPos.y, dummyPos.z);
      particleInstanced.setMatrixAt(i, dummyMat4);
    });
    particleInstanced.instanceMatrix.needsUpdate = true;
    particleInstanced.computeBoundingSphere();
    scene.add(particleInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Mouse parallax state stored in plain closure (never triggers React re-render)
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.65;
      targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.35;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || 520;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();

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

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.getElapsedTime() + 0.85;

      const damp = dt <= 0.001 ? 1.0 : 1 - Math.exp(-5 * dt);
      currentMouseX += (targetMouseX - currentMouseX) * damp;
      currentMouseY += (targetMouseY - currentMouseY) * damp;

      runnerGroup.rotation.y = -0.52 + Math.sin(t * 0.45) * 0.28 + currentMouseX;
      runnerGroup.rotation.x = currentMouseY * 0.3;

      // Dynamic biomechanical stride cycle
      const stride = Math.sin(t * 4.2);
      leftArmGroup.rotation.x = stride * 0.65;
      rightArmGroup.rotation.x = -stride * 0.65;
      leftLegGroup.rotation.x = -stride * 0.55;
      rightLegGroup.rotation.x = stride * 0.55;
      torsoPivot.position.y = 1.15 + Math.abs(Math.sin(t * 4.2)) * 0.04;

      glowingMuscleMat.emissiveIntensity = 0.95 + Math.sin(t * 3.0) * 0.3;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  if (webglFailed) {
    return (
      <div className="w-full h-[420px] rounded-2xl bg-[#161616] border border-[#262626] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#EF4444] to-[#F97316] opacity-80 mb-4" />
        <p className="text-sm font-semibold text-white">Siluet Biomekanik 3D FitForge</p>
        <p className="text-xs text-neutral-400 mt-1">Mode pratinjau hemat daya aktif</p>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="hero-3d-canvas"
      className="w-full h-[400px] sm:h-[460px] relative select-none"
      aria-label="Visualisasi 3D Siluet Pelari Berpijar FitForge"
    />
  );
}
