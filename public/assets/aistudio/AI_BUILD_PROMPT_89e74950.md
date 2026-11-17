# AI 3D Model + Animation Build Prompt

Use the JSON files in `models/` as the source of truth. Use `reference_blueprint.png` only as a visual style and anatomy reference, not as a source of exact body measurements.

## Required output
Create one realistic, neutral-proportion human 3D character with a clean humanoid armature, skinning, and a separate muscle-highlight overlay. Build the three exercises as separate named animation clips. Keep the same character, proportions, materials, scale, and rig across all clips.

## Technical requirements
- Coordinate system: Y-up; character forward is +Z; units are meters.
- Rig: humanoid FK/IK with named bones and hand/foot IK controls specified in the JSON.
- Mesh: clean topology and deformation around shoulders, elbows, hips, knees, wrists, and ankles.
- Animation: 30 fps, smooth interpolation, no root motion unless explicitly required.
- Create front, side, back, and top preview cameras.
- Export `.glb` and `.fbx`; include a native project file when supported.
- Keep animation names exactly as specified in each JSON file.
- Do not invent extra exercise phases or change the movement cues in the JSON.
- Ensure the character does not clip through the floor or equipment.
- Generate a neutral static pose and a short turntable preview.

## Quality checks
Validate bone hierarchy, skin weights, foot/hand contact, joint deformation, loop continuity, and export/import integrity. Deliver the 3D assets, animation clips, and a short README describing the rig and export settings.
