# AI 3D Model + Animation Build Prompt (`AI_BUILD_PROMPT.md`)

Use the JSON files in `models/` (`01_push_up.json`, `02_squat.json`, `03_pull_up.json`) as the **single source of truth**. Use `reference_blueprint.png` (`/assets/aistudio/reference_blueprint_b2822b35.png`) only as a visual style, layout, and anatomy reference, not as a source of mandatory body measurements.

## Required output
Create one realistic, neutral-proportion human 3D character with a clean humanoid armature, skinning, and a separate muscle-highlight overlay. Build the three exercises as separate named animation clips (`push_up_cycle`, `bodyweight_squat_cycle`, `pull_up_cycle`). Keep the same character, proportions, materials, scale, and rig across all clips.

## Technical requirements
- Coordinate system: Y-up; character forward is +Z; character right is +X; units are meters.
- Rig: humanoid FK/IK with 22 named bones and 8 hand/foot IK controls specified in the JSON.
- Mesh: clean topology and deformation around shoulders, elbows, hips, knees, wrists, and ankles.
- Materials:
  - `skin`: neutral light gray (`#9CA3AF` – `#B0B7C3`)
  - `clothing`: matte charcoal athletic shorts (`#16181D`)
  - `muscle_highlights`: red translucent overlay (`#EF4444` primary, `#F59E0B` secondary), separate mesh/material layer
- Animation: 30 fps, smooth_bezier interpolation, 60 frames per cycle (Frames 0, 15, 30, 45, 60), no root motion.
- Create `front`, `side`, `back`, and `top` preview cameras plus a `360° turntable` preview.
- Export `.glb` and `.fbx`; include a native project file when supported.
- Keep animation names (`push_up_cycle`, `bodyweight_squat_cycle`, `pull_up_cycle`) exactly as specified in each JSON file.
- Do not invent extra exercise phases or change the movement cues in the JSON.
- Ensure the character does not clip through the floor or equipment.

## Quality checks
Validate bone hierarchy, skin weights, foot/hand contact, joint deformation, loop continuity, and export/import integrity. Deliver the 3D assets, animation clips, and a short README describing the rig and export settings.
