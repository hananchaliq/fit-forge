import * as THREE from 'three';

export interface ProceduralPBRTextureSet {
  skinBumpMap: THREE.CanvasTexture;
  skinRoughnessMap: THREE.CanvasTexture;
  fabricBumpMap: THREE.CanvasTexture;
  fabricRoughnessMap: THREE.CanvasTexture;
  carbonBumpMap: THREE.CanvasTexture;
  carbonRoughnessMap: THREE.CanvasTexture;
  floorAlbedoMap: THREE.CanvasTexture;
  floorRoughnessMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

/** Deterministic PRNG (Mulberry32) so procedural textures look identical across renders */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable for procedural PBR textures');
  }
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
  isColor = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates lightweight procedural PBR textures (skin micro-grain & fiber striations,
 * athletic compression weave, carbon-fiber armor weave, vulcanized gym floor, and
 * soft radial contact shadow) with zero external file dependencies.
 */
export function createProceduralPBRTextures(maxAnisotropy = 4): ProceduralPBRTextureSet {
  const size = 256;
  const rand = mulberry32(20250311);

  // 1. Organic Skin & Muscle-Fiber Micro-Detail (Bump + Roughness)
  const [skinBumpCanvas, skinBumpCtx] = createCanvas(size);
  const [skinRoughCanvas, skinRoughCtx] = createCanvas(size);

  skinBumpCtx.fillStyle = '#808080';
  skinBumpCtx.fillRect(0, 0, size, size);
  skinRoughCtx.fillStyle = '#929292'; // base ~0.57 roughness for natural satin skin
  skinRoughCtx.fillRect(0, 0, size, size);

  // Subtle vertical muscle-fiber striation waves
  for (let x = 0; x < size; x += 2) {
    const wave = Math.sin((x / size) * Math.PI * 18) * 10;
    const vBump = Math.max(0, Math.min(255, Math.round(128 + wave)));
    const vRough = Math.max(0, Math.min(255, Math.round(146 - wave * 0.7)));
    skinBumpCtx.fillStyle = `rgba(${vBump},${vBump},${vBump},0.28)`;
    skinBumpCtx.fillRect(x, 0, 2, size);
    skinRoughCtx.fillStyle = `rgba(${vRough},${vRough},${vRough},0.22)`;
    skinRoughCtx.fillRect(x, 0, 2, size);
  }

  // Fine organic skin pores / micro-grain
  for (let i = 0; i < 3600; i++) {
    const px = Math.floor(rand() * size);
    const py = Math.floor(rand() * size);
    const tone = rand() > 0.5 ? 148 : 108;
    const r = rand() > 0.75 ? 2 : 1;
    skinBumpCtx.fillStyle = `rgba(${tone},${tone},${tone},0.16)`;
    skinBumpCtx.fillRect(px, py, r, r);

    const rt = rand() > 0.5 ? 168 : 128;
    skinRoughCtx.fillStyle = `rgba(${rt},${rt},${rt},0.15)`;
    skinRoughCtx.fillRect(px, py, r, r);
  }

  // 2. Athletic Compression Fabric Weave (Shorts)
  const [fabBumpCanvas, fabBumpCtx] = createCanvas(size);
  const [fabRoughCanvas, fabRoughCtx] = createCanvas(size);

  fabBumpCtx.fillStyle = '#787878';
  fabBumpCtx.fillRect(0, 0, size, size);
  fabRoughCtx.fillStyle = '#c8c8c8'; // matte fabric ~0.78 roughness
  fabRoughCtx.fillRect(0, 0, size, size);

  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const checker = ((x / step + y / step) & 1) === 0;
      fabBumpCtx.fillStyle = checker ? '#969696' : '#5e5e5e';
      fabBumpCtx.fillRect(x, y, step - 1, step - 1);
      fabRoughCtx.fillStyle = checker ? '#d8d8d8' : '#b2b2b2';
      fabRoughCtx.fillRect(x, y, step - 1, step - 1);
    }
  }

  // 3. Diagonal Carbon-Fiber Weave (Hero Runner Armor)
  const [carbBumpCanvas, carbBumpCtx] = createCanvas(size);
  const [carbRoughCanvas, carbRoughCtx] = createCanvas(size);

  carbBumpCtx.fillStyle = '#6e6e6e';
  carbBumpCtx.fillRect(0, 0, size, size);
  carbRoughCtx.fillStyle = '#5a5a5a'; // sleek satin carbon ~0.35
  carbRoughCtx.fillRect(0, 0, size, size);

  const cell = 8;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const diag = ((x / cell + y / cell) % 2) === 0;
      carbBumpCtx.fillStyle = diag ? '#a6a6a6' : '#4a4a4a';
      carbBumpCtx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      carbRoughCtx.fillStyle = diag ? '#444444' : '#787878';
      carbRoughCtx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }

  // 4. Studio Gym Rubber Floor (Albedo + Roughness)
  const [floorAlbCanvas, floorAlbCtx] = createCanvas(size);
  const [floorRoughCanvas, floorRoughCtx] = createCanvas(size);

  floorAlbCtx.fillStyle = '#0b1221';
  floorAlbCtx.fillRect(0, 0, size, size);
  floorRoughCtx.fillStyle = '#d4d4d4';
  floorRoughCtx.fillRect(0, 0, size, size);

  // Fine architectural tile seams
  floorAlbCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  floorAlbCtx.lineWidth = 1;
  floorAlbCtx.strokeRect(0.5, 0.5, size - 1, size - 1);

  for (let i = 0; i < 4200; i++) {
    const px = Math.floor(rand() * size);
    const py = Math.floor(rand() * size);
    const bright = rand() > 0.85 ? 36 : 18;
    floorAlbCtx.fillStyle = `rgba(${bright}, ${bright + 10}, ${bright + 24}, 0.35)`;
    floorAlbCtx.fillRect(px, py, 2, 2);

    const rv = Math.round(185 + rand() * 55);
    floorRoughCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    floorRoughCtx.fillRect(px, py, 2, 2);
  }

  // 5. Soft Radial Contact Shadow Map (grounded beneath athlete / runner)
  const [shadowCanvas, shadowCtx] = createCanvas(256);
  const grad = shadowCtx.createRadialGradient(128, 128, 14, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.52)');
  grad.addColorStop(0.78, 'rgba(0, 0, 0, 0.14)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shadowCtx.fillStyle = grad;
  shadowCtx.fillRect(0, 0, 256, 256);

  const skinBumpMap = finalizeTexture(skinBumpCanvas, 4, 4, maxAnisotropy, false);
  const skinRoughnessMap = finalizeTexture(skinRoughCanvas, 4, 4, maxAnisotropy, false);
  const fabricBumpMap = finalizeTexture(fabBumpCanvas, 8, 8, maxAnisotropy, false);
  const fabricRoughnessMap = finalizeTexture(fabRoughCanvas, 8, 8, maxAnisotropy, false);
  const carbonBumpMap = finalizeTexture(carbBumpCanvas, 6, 6, maxAnisotropy, false);
  const carbonRoughnessMap = finalizeTexture(carbRoughCanvas, 6, 6, maxAnisotropy, false);
  const floorAlbedoMap = finalizeTexture(floorAlbCanvas, 10, 10, maxAnisotropy, true);
  const floorRoughnessMap = finalizeTexture(floorRoughCanvas, 10, 10, maxAnisotropy, false);

  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  contactShadowMap.needsUpdate = true;

  return {
    skinBumpMap,
    skinRoughnessMap,
    fabricBumpMap,
    fabricRoughnessMap,
    carbonBumpMap,
    carbonRoughnessMap,
    floorAlbedoMap,
    floorRoughnessMap,
    contactShadowMap,
    dispose: () => {
      skinBumpMap.dispose();
      skinRoughnessMap.dispose();
      fabricBumpMap.dispose();
      fabricRoughnessMap.dispose();
      carbonBumpMap.dispose();
      carbonRoughnessMap.dispose();
      floorAlbedoMap.dispose();
      floorRoughnessMap.dispose();
      contactShadowMap.dispose();
    },
  };
}

/**
 * Safely disposes all geometries, materials, and textures attached to a Three.js scene.
 */
export function disposeSceneResources(scene: THREE.Scene) {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
      disposedGeos.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!disposedMats.has(m)) {
          disposedMats.add(m);
          m.dispose();
        }
      });
    }
  });
}
