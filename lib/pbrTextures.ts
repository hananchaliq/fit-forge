import * as THREE from 'three';

export interface ProceduralPBRTextureSet {
  skinNormalMap: THREE.CanvasTexture;
  skinBumpMap: THREE.CanvasTexture;
  skinRoughnessMap: THREE.CanvasTexture;
  boneNormalMap: THREE.CanvasTexture;
  boneRoughnessMap: THREE.CanvasTexture;
  fabricNormalMap: THREE.CanvasTexture;
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

/**
 * Computes a true tangent-space normal map from a grayscale heightfield canvas
 * using Sobel derivatives so Three.js PBR materials render authentic 3D sculptural relief.
 */
function buildNormalMapFromHeightCanvas(
  heightCanvas: HTMLCanvasElement,
  strength = 2.4
): HTMLCanvasElement {
  const size = heightCanvas.width;
  const srcCtx = heightCanvas.getContext('2d');
  const [normCanvas, normCtx] = createCanvas(size);
  if (!srcCtx) return normCanvas;

  const srcData = srcCtx.getImageData(0, 0, size, size).data;
  const outImg = normCtx.createImageData(size, size);
  const out = outImg.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return srcData[(wy * size + wx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dZ = 1.0;

      const invLen = 1 / Math.sqrt(dX * dX + dY * dY + dZ * dZ);
      const nx = -dX * invLen;
      const ny = -dY * invLen;
      const nz = dZ * invLen;

      const idx = (y * size + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  normCtx.putImageData(outImg, 0, 0);
  return normCanvas;
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
 * Generates high-detail 512x512 procedural 3D PBR maps:
 * - Sculpted mannequin satin clay + anatomical muscle-fiber striation Normal/Bump/Roughness
 * - Cortical bone Normal/Roughness for X-Ray & Mode Tulang
 * - Woven athletic compression fabric Normal/Bump/Roughness for charcoal shorts & arm sleeve
 * - Vulcanized studio gym floor Albedo/Roughness & soft radial contact shadow
 */
export function createProceduralPBRTextures(maxAnisotropy = 4): ProceduralPBRTextureSet {
  const size = 512;
  const smallSize = 256;
  const rand = mulberry32(20250311);

  // 1. Sculpted Mannequin Muscle-Fiber + Micro-Clay Relief (512x512 Height -> Normal + Roughness)
  const [skinBumpCanvas, skinBumpCtx] = createCanvas(size);
  const [skinRoughCanvas, skinRoughCtx] = createCanvas(size);

  skinBumpCtx.fillStyle = '#808080';
  skinBumpCtx.fillRect(0, 0, size, size);
  skinRoughCtx.fillStyle = '#7e7e7e'; // satin sculpted matte-resin ~0.49 base roughness
  skinRoughCtx.fillRect(0, 0, size, size);

  // Fine anatomical muscle-fiber striations (layered harmonic waves)
  for (let x = 0; x < size; x += 2) {
    const primaryWave = Math.sin((x / size) * Math.PI * 36) * 16;
    const secondaryWave = Math.sin((x / size) * Math.PI * 12 + 0.7) * 9;
    const combined = primaryWave + secondaryWave;
    const vBump = Math.max(0, Math.min(255, Math.round(128 + combined)));
    const vRough = Math.max(0, Math.min(255, Math.round(128 - combined * 0.75)));
    skinBumpCtx.fillStyle = `rgba(${vBump},${vBump},${vBump},0.42)`;
    skinBumpCtx.fillRect(x, 0, 2, size);
    skinRoughCtx.fillStyle = `rgba(${vRough},${vRough},${vRough},0.32)`;
    skinRoughCtx.fillRect(x, 0, 2, size);
  }

  // Subtle horizontal sculptural fascia contours
  for (let y = 0; y < size; y += 3) {
    const band = Math.cos((y / size) * Math.PI * 16) * 8;
    const vBump = Math.max(0, Math.min(255, Math.round(128 + band)));
    skinBumpCtx.fillStyle = `rgba(${vBump},${vBump},${vBump},0.18)`;
    skinBumpCtx.fillRect(0, y, size, 3);
  }

  // Sculptural micro-clay / satin resin grain pores
  for (let i = 0; i < 11000; i++) {
    const px = Math.floor(rand() * size);
    const py = Math.floor(rand() * size);
    const tone = rand() > 0.5 ? 162 : 94;
    const r = rand() > 0.8 ? 2 : 1;
    skinBumpCtx.fillStyle = `rgba(${tone},${tone},${tone},0.22)`;
    skinBumpCtx.fillRect(px, py, r, r);

    const rt = rand() > 0.5 ? 158 : 108;
    skinRoughCtx.fillStyle = `rgba(${rt},${rt},${rt},0.20)`;
    skinRoughCtx.fillRect(px, py, r, r);
  }

  const skinNormalCanvas = buildNormalMapFromHeightCanvas(skinBumpCanvas, 2.8);

  // 2. Cortical Ivory Bone Texture (for Mode Tulang & X-Ray)
  const [boneHeightCanvas, boneHeightCtx] = createCanvas(smallSize);
  const [boneRoughCanvas, boneRoughCtx] = createCanvas(smallSize);

  boneHeightCtx.fillStyle = '#828282';
  boneHeightCtx.fillRect(0, 0, smallSize, smallSize);
  boneRoughCtx.fillStyle = '#767676';
  boneRoughCtx.fillRect(0, 0, smallSize, smallSize);

  for (let x = 0; x < smallSize; x += 2) {
    const grain = Math.sin((x / smallSize) * Math.PI * 22) * 10;
    const v = Math.max(0, Math.min(255, Math.round(128 + grain)));
    boneHeightCtx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    boneHeightCtx.fillRect(x, 0, 2, smallSize);
  }
  for (let i = 0; i < 3000; i++) {
    const px = Math.floor(rand() * smallSize);
    const py = Math.floor(rand() * smallSize);
    const v = rand() > 0.5 ? 154 : 102;
    boneHeightCtx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    boneHeightCtx.fillRect(px, py, 2, 1);
    const rv = rand() > 0.5 ? 142 : 98;
    boneRoughCtx.fillStyle = `rgba(${rv},${rv},${rv},0.25)`;
    boneRoughCtx.fillRect(px, py, 2, 2);
  }
  const boneNormalCanvas = buildNormalMapFromHeightCanvas(boneHeightCanvas, 2.1);

  // 3. Athletic Compression Fabric Weave (Charcoal Shorts, Left Arm Sleeve & Right Wrist Wrap)
  const [fabBumpCanvas, fabBumpCtx] = createCanvas(smallSize);
  const [fabRoughCanvas, fabRoughCtx] = createCanvas(smallSize);

  fabBumpCtx.fillStyle = '#787878';
  fabBumpCtx.fillRect(0, 0, smallSize, smallSize);
  fabRoughCtx.fillStyle = '#c4c4c4'; // matte technical jersey ~0.77 roughness
  fabRoughCtx.fillRect(0, 0, smallSize, smallSize);

  const step = 4;
  for (let y = 0; y < smallSize; y += step) {
    for (let x = 0; x < smallSize; x += step) {
      const checker = ((x / step + y / step) & 1) === 0;
      fabBumpCtx.fillStyle = checker ? '#a4a4a4' : '#525252';
      fabBumpCtx.fillRect(x, y, step - 1, step - 1);
      fabRoughCtx.fillStyle = checker ? '#dadada' : '#a8a8a8';
      fabRoughCtx.fillRect(x, y, step - 1, step - 1);
    }
  }
  const fabNormalCanvas = buildNormalMapFromHeightCanvas(fabBumpCanvas, 2.2);

  // 4. Diagonal Carbon-Fiber Weave (Gym Equipment & Stage Accent)
  const [carbBumpCanvas, carbBumpCtx] = createCanvas(smallSize);
  const [carbRoughCanvas, carbRoughCtx] = createCanvas(smallSize);

  carbBumpCtx.fillStyle = '#6e6e6e';
  carbBumpCtx.fillRect(0, 0, smallSize, smallSize);
  carbRoughCtx.fillStyle = '#5a5a5a';
  carbRoughCtx.fillRect(0, 0, smallSize, smallSize);

  const cell = 8;
  for (let y = 0; y < smallSize; y += cell) {
    for (let x = 0; x < smallSize; x += cell) {
      const diag = ((x / cell + y / cell) % 2) === 0;
      carbBumpCtx.fillStyle = diag ? '#a6a6a6' : '#4a4a4a';
      carbBumpCtx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      carbRoughCtx.fillStyle = diag ? '#444444' : '#787878';
      carbRoughCtx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }

  // 5. Studio Gym Rubber Floor (Albedo + Roughness)
  const [floorAlbCanvas, floorAlbCtx] = createCanvas(smallSize);
  const [floorRoughCanvas, floorRoughCtx] = createCanvas(smallSize);

  floorAlbCtx.fillStyle = '#0c111b';
  floorAlbCtx.fillRect(0, 0, smallSize, smallSize);
  floorRoughCtx.fillStyle = '#d4d4d4';
  floorRoughCtx.fillRect(0, 0, smallSize, smallSize);

  floorAlbCtx.strokeStyle = 'rgba(245, 184, 0, 0.08)';
  floorAlbCtx.lineWidth = 1;
  floorAlbCtx.strokeRect(0.5, 0.5, smallSize - 1, smallSize - 1);

  for (let i = 0; i < 4200; i++) {
    const px = Math.floor(rand() * smallSize);
    const py = Math.floor(rand() * smallSize);
    const bright = rand() > 0.85 ? 34 : 18;
    floorAlbCtx.fillStyle = `rgba(${bright}, ${bright + 4}, ${bright + 10}, 0.36)`;
    floorAlbCtx.fillRect(px, py, 2, 2);

    const rv = Math.round(185 + rand() * 55);
    floorRoughCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    floorRoughCtx.fillRect(px, py, 2, 2);
  }

  // 6. Soft Radial Contact Shadow Map
  const [shadowCanvas, shadowCtx] = createCanvas(256);
  const grad = shadowCtx.createRadialGradient(128, 128, 14, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.52)');
  grad.addColorStop(0.78, 'rgba(0, 0, 0, 0.14)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shadowCtx.fillStyle = grad;
  shadowCtx.fillRect(0, 0, 256, 256);

  const skinNormalMap = finalizeTexture(skinNormalCanvas, 3, 3, maxAnisotropy, false);
  const skinBumpMap = finalizeTexture(skinBumpCanvas, 3, 3, maxAnisotropy, false);
  const skinRoughnessMap = finalizeTexture(skinRoughCanvas, 3, 3, maxAnisotropy, false);
  const boneNormalMap = finalizeTexture(boneNormalCanvas, 2, 2, maxAnisotropy, false);
  const boneRoughnessMap = finalizeTexture(boneRoughCanvas, 2, 2, maxAnisotropy, false);
  const fabricNormalMap = finalizeTexture(fabNormalCanvas, 6, 6, maxAnisotropy, false);
  const fabricBumpMap = finalizeTexture(fabBumpCanvas, 6, 6, maxAnisotropy, false);
  const fabricRoughnessMap = finalizeTexture(fabRoughCanvas, 6, 6, maxAnisotropy, false);
  const carbonBumpMap = finalizeTexture(carbBumpCanvas, 6, 6, maxAnisotropy, false);
  const carbonRoughnessMap = finalizeTexture(carbRoughCanvas, 6, 6, maxAnisotropy, false);
  const floorAlbedoMap = finalizeTexture(floorAlbCanvas, 10, 10, maxAnisotropy, true);
  const floorRoughnessMap = finalizeTexture(floorRoughCanvas, 10, 10, maxAnisotropy, false);

  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  contactShadowMap.needsUpdate = true;

  return {
    skinNormalMap,
    skinBumpMap,
    skinRoughnessMap,
    boneNormalMap,
    boneRoughnessMap,
    fabricNormalMap,
    fabricBumpMap,
    fabricRoughnessMap,
    carbonBumpMap,
    carbonRoughnessMap,
    floorAlbedoMap,
    floorRoughnessMap,
    contactShadowMap,
    dispose: () => {
      skinNormalMap.dispose();
      skinBumpMap.dispose();
      skinRoughnessMap.dispose();
      boneNormalMap.dispose();
      boneRoughnessMap.dispose();
      fabricNormalMap.dispose();
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
