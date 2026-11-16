import fs from 'node:fs';
import path from 'node:path';

/**
 * CLI utility to inspect /public/models/trainer.glb (or manifest.json fallback)
 * and print all embedded mesh names and animation clips to help maintain
 * /data/exerciseClipMap.ts.
 */
const modelPath = path.resolve(process.cwd(), 'public/models/trainer.glb');
const manifestPath = path.resolve(process.cwd(), 'public/models/manifest.json');

console.log('=== FitForge 3D Model Inspector ===');

if (fs.existsSync(modelPath)) {
  const stats = fs.statSync(modelPath);
  console.log(`[FOUND] /public/models/trainer.glb (${(stats.size / 1024).toFixed(1)} KB)`);
  // Parse glTF binary header chunk (JSON chunk) to list mesh & animation names without needing browser DOM
  const buffer = fs.readFileSync(modelPath);
  const magic = buffer.toString('ascii', 0, 4);
  if (magic === 'glTF') {
    const jsonChunkLength = buffer.readUInt32LE(12);
    const jsonStr = buffer.toString('utf8', 20, 20 + jsonChunkLength);
    const gltf = JSON.parse(jsonStr);
    console.log('\n--- Meshes ---');
    (gltf.meshes || []).forEach((m, i) => console.log(`  [${i}] ${m.name || 'Unnamed_Mesh'}`));
    console.log('\n--- Nodes ---');
    (gltf.nodes || []).forEach((n, i) => {
      if (n.mesh !== undefined) console.log(`  Node [${i}] ${n.name} -> Mesh[${n.mesh}]`);
    });
    console.log('\n--- Animation Clips ---');
    (gltf.animations || []).forEach((a, i) => console.log(`  [${i}] ${a.name || 'Unnamed_Clip'}`));
  } else {
    console.log('File is not a valid binary glTF (.glb).');
  }
} else {
  console.log('[INFO] /public/models/trainer.glb belum ditempatkan.');
  console.log('Menggunakan Procedural Anatomical Mannequin + /public/models/manifest.json:');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('\n--- Expected Meshes ---');
    (manifest.meshes || []).forEach((m) => console.log(`  - ${m}`));
    console.log('\n--- Expected Animation Clips ---');
    (manifest.clips || []).forEach((c) => console.log(`  - ${c}`));
  }
}
