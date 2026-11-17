# AI 3D Model + Animation Build Prompt (`AI_BUILD_PROMPT.md`)

Use the JSON files in `models/` (`01_push_up.json`, `02_squat.json`, `03_pull_up.json`) as the **single source of truth**. Use `reference_blueprint.png` (`/assets/aistudio/reference_blueprint_b2822b35.png`) only as a visual style, layout, and anatomy reference, not as a source of mandatory body measurements.

---

## 1. Required Output

Create **one realistic, neutral-proportion human 3D character** with a clean humanoid armature, watertight skinning, matte charcoal athletic shorts, and a separate muscle-highlight overlay layer. Build the three exercises as separate named animation clips (`push_up_cycle`, `bodyweight_squat_cycle`, `pull_up_cycle`). Keep the exact same character, proportions, materials, scale, and rig across all clips.

### Color & Material Guide (Blueprint Standard)
- **Body / Skin (`neutral light gray`)**: `#9CA3AF` – `#B0B7C3`, satin anatomical finish showing clean muscular topography without noisy textures.
- **Clothes (`matte charcoal athletic shorts`)**: `#16181D`, matte athletic fabric covering pelvis and upper thigh, plus dark athletic footwear.
- **Muscle Highlights (`red translucent overlay`)**: `#EF4444` (Primary target muscle) and `#F59E0B` (Secondary/synergist muscle), implemented as a separate mesh/shader overlay layer that illuminates active muscles per exercise.

---

## 2. Technical Requirements

- **Coordinate System**: `Y-up`, character forward is `+Z`, character right is `+X`.
- **Units**: `meters` (reference athletic stature ~`1.80 m`, neutral adult proportions).
- **Rig (`humanoid_fk_ik`)**:
  - **22 Required Bones**:
    `root`, `pelvis`, `spine`, `chest`, `neck`, `head`,
    `clavicle.L`, `upper_arm.L`, `forearm.L`, `hand.L`,
    `clavicle.R`, `upper_arm.R`, `forearm.R`, `hand.R`,
    `thigh.L`, `shin.L`, `foot.L`, `toe.L`,
    `thigh.R`, `shin.R`, `foot.R`, `toe.R`
  - **8 Required FK/IK Controls**:
    `root`, `pelvis`, `chest`, `head`, `hand_ik.L`, `hand_ik.R`, `foot_ik.L`, `foot_ik.R`
- **Mesh & Deformation**:
  - Single watertight skinned character mesh where practical.
  - Clean joint deformation at shoulders, elbows, hips, knees, wrists, and ankles.
- **Animation**:
  - Frame rate: **30 fps** (`60 frames` per cycle).
  - Interpolation: **`smooth_bezier`** loop continuity (`loop: true`, `root_motion: false`).
  - Keep animation clip names and 5 keyframe phases (`Frame 0, 15, 30, 45, 60`) **exactly** as specified in each JSON file.
  - Do not invent extra exercise phases or alter the movement cues in the JSON.
  - Ensure the character never clips through the floor mat or pull-up bar.
- **Cameras & Previews**:
  - Create **4 orthographic/perspective preview cameras**: `front`, `side`, `back`, and `top`.
  - Generate a neutral static A/T-pose and a smooth `360° turntable` preview.
- **Deliverables**:
  - Preferred: `.glb`, `.fbx`
  - Optional: `.blend`, `.obj`
  - Include: `skinned_mesh`, `armature`, `named_animation_clips`, `muscle_highlight_overlay`, `front_side_back_camera_views`.

---

## 3. Exercise Blueprint Specifications (`models/`)

### 01. Push-Up (`models/01_push_up.json`)
- **Clip Name**: `push_up_cycle` (`2.0s` @ `30 fps`, loop `true`, `smooth_bezier`, `root_motion: false`)
- **Category**: `upper_body`
- **Equipment**: Floor mat or stable non-slip floor
- **Target Muscle Highlights**: `pectorals` (Chest), `anterior_deltoids` (Shoulders), `triceps` (Triceps)
- **Setup**: Hands on floor slightly wider than shoulder width; body in a straight plank line; feet supported on floor.
- **Keyframes (30 fps)**:
  - **Frame 0 (`start_high_plank`)**: Elbows extended but not forcefully locked; shoulders over or slightly ahead of wrists; head aligned with spine; pelvis neutral; legs straight.
  - **Frame 15 (`lowering`)**: Bend elbows under control; lower chest and hips together; maintain a stable trunk; elbows angled naturally (~45°) rather than flared straight sideways.
  - **Frame 30 (`bottom_controlled`)**: Reach a comfortable depth while keeping trunk aligned; do not force the shoulder range.
  - **Frame 45 (`press_up`)**: Press the floor away; extend elbows smoothly; keep hips from sagging or rising ahead of the chest.
  - **Frame 60 (`return_start`)**: Return to stable high plank; brief pause.
- **Form Checks**:
  - Head, torso, pelvis, and legs remain aligned
  - Hands remain planted (`hand_ik.L`, `hand_ik.R` locked to floor)
  - Left and right sides move symmetrically
  - Use a comfortable range of motion

---

### 02. Bodyweight Squat (`models/02_squat.json`)
- **Clip Name**: `bodyweight_squat_cycle` (`2.0s` @ `30 fps`, loop `true`, `smooth_bezier`, `root_motion: false`)
- **Category**: `lower_body`
- **Equipment**: Clear, level floor
- **Target Muscle Highlights**: `quadriceps`, `gluteals`, `hamstrings`
- **Setup**: Stand with feet around shoulder width, toes turned out slightly if comfortable, arms forward for balance during descent.
- **Keyframes (30 fps)**:
  - **Frame 0 (`standing_start`)**: Stand tall with feet grounded; ribs stacked over pelvis; gaze forward; arms relaxed at sides.
  - **Frame 15 (`descent`)**: Send hips down and slightly back; bend knees in line with toes; raise arms forward for counterbalance; keep heels grounded and torso controlled.
  - **Frame 30 (`bottom_controlled`)**: Reach a comfortable parallel depth without heels lifting or lower back rounding; knees track with toes; arms extended forward horizontally.
  - **Frame 45 (`rise`)**: Push through the whole foot; extend hips and knees together; keep knees tracking with toes.
  - **Frame 60 (`standing_return`)**: Stand tall without leaning backward; pause.
- **Form Checks**:
  - Heels stay grounded (`foot_ik.L`, `foot_ik.R` locked to floor)
  - Knees track in the same direction as toes
  - Movement stays balanced
  - Spine remains controlled

---

### 03. Pull-Up (`models/03_pull_up.json`)
- **Clip Name**: `pull_up_cycle` (`2.5s` @ `30 fps`, loop `true`, `smooth_bezier`, `root_motion: false`)
- **Category**: `back`
- **Equipment**: Properly installed, load-rated overhead pull-up bar
- **Target Muscle Highlights**: `latissimus_dorsi` (Lats), `biceps` (Biceps), `upper_back` (Trapezius / Rhomboids / Teres)
- **Setup**: Hang from a secure pull-up bar with an overhand grip around shoulder width; feet clear of the floor; begin from a controlled active hang.
- **Keyframes (30 fps)**:
  - **Frame 0 (`active_hang`)**: Arms extended comfortably gripping overhead bar; shoulders controlled (depressed) rather than shrugged; legs quiet; no swinging.
  - **Frame 15 (`pulling`)**: Draw shoulder blades down and back; bend elbows and bring torso upward smoothly; avoid kicking.
  - **Frame 30 (`top_controlled`)**: Reach the highest controlled position available without craning the neck; chin approaches or clears bar level.
  - **Frame 45 (`lowering`)**: Lower smoothly under control; avoid dropping suddenly; keep legs quiet.
  - **Frame 60 (`return_hang`)**: Return to controlled active hang; pause before next repetition.
- **Form Checks**:
  - Bar remains fixed (`hand_ik.L`, `hand_ik.R` locked to overhead bar)
  - No kipping or swinging
  - Shoulders remain controlled
  - Lowering phase is controlled

---

## 4. Quality Assurance Checklist

1. **Bone Hierarchy & Naming**: Verify all 22 bones and 8 IK/FK controllers match the exact names in `character.rig`.
2. **Skin Weights & Volume Preservation**: Check shoulder abduction (`pull_up_cycle`), elbow flexion (`push_up_cycle` & `pull_up_cycle`), and deep hip/knee flexion (`bodyweight_squat_cycle`) for pinching or volume collapse.
3. **World-Space IK Contact**:
   - `01_push_up`: Palms (`hand.L`, `hand.R`) and toes (`toe.L`, `toe.R`) must not slide or penetrate `Y = 0`.
   - `02_squat`: Heels and toes (`foot.L`, `foot.R`) must remain planted on `Y = 0`.
   - `03_pull_up`: Hands (`hand.L`, `hand.R`) must remain locked on the fixed overhead bar (`Y = 2.25 m`) while the body translates vertically.
4. **Loop Continuity**: Frame `0` and Frame `60` must have identical transforms and zero-velocity tangents for seamless looping.
