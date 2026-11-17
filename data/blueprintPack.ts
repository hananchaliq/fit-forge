export interface BlueprintKeyframe {
  frame: number;
  pose: string;
  description: string;
}

export interface BlueprintExerciseSpec {
  id: '01_push_up' | '02_squat' | '03_pull_up';
  fitforgeExerciseId: 'pushup' | 'squats' | 'pull_ups';
  code: string;
  titleLabel: string;
  exercise: string;
  category: string;
  model: {
    height_cm: number;
    weight_kg: number;
    style: string;
    formats: string[];
    scale: string;
  };
  colorGuide: {
    muscle: { label: string; hex: string };
    body: { label: string; hex: string };
    clothes: { label: string; hex: string };
  };
  target_muscles: {
    primary: string[];
    secondary: string[];
    stabilizers: string[];
  };
  animation: {
    loop: boolean;
    fps: number;
    duration_seconds: number;
    keyframes: BlueprintKeyframe[];
  };
  rigging: {
    required_bones: string[];
    controls: string[];
  };
  camera_views: ('front' | 'side' | 'back' | 'top')[];
  form_checks: string[];
  jsonFileUrl: string;
}

export const BLUEPRINT_IMAGE_URL = '/assets/aistudio/reference_blueprint_b2822b35.png';

export const BLUEPRINT_EXERCISES: BlueprintExerciseSpec[] = [
  {
    id: '01_push_up',
    fitforgeExerciseId: 'pushup',
    code: '01',
    titleLabel: '01. PUSH-UP (Upper Body)',
    exercise: 'push_up',
    category: 'upper_body',
    model: {
      height_cm: 180,
      weight_kg: 70,
      style: 'athletic_realistic_clean',
      formats: ['glb', 'fbx', 'obj'],
      scale: '1_unit_equals_1_meter',
    },
    colorGuide: {
      muscle: { label: 'Muscle (Red)', hex: '#EF4444' },
      body: { label: 'Body (Gray)', hex: '#9CA3AF' },
      clothes: { label: 'Clothes (Black)', hex: '#16181D' },
    },
    target_muscles: {
      primary: ['pectoralis_major', 'anterior_deltoid', 'triceps_brachii'],
      secondary: ['serratus_anterior', 'core_stabilizers'],
      stabilizers: ['glutes', 'erector_spinae', 'scapular_stabilizers'],
    },
    animation: {
      loop: true,
      fps: 30,
      duration_seconds: 2.0,
      keyframes: [
        {
          frame: 0,
          pose: 'high_plank_start',
          description: 'Arms extended, wrists under shoulders, spine neutral, pelvis aligned, feet hip-width apart.',
        },
        {
          frame: 15,
          pose: 'descent_mid',
          description: 'Elbows flexing at roughly 45 degrees from torso, chest lowering with rigid trunk.',
        },
        {
          frame: 30,
          pose: 'bottom_position',
          description: 'Chest hovers slightly above floor, elbows bent near 90 degrees, neck neutral, hips aligned.',
        },
        {
          frame: 45,
          pose: 'ascent_mid',
          description: 'Pressing through palms, extending elbows while keeping core and glutes engaged.',
        },
        {
          frame: 60,
          pose: 'plank_return',
          description: 'Return to start plank without shoulder shrug or lower-back sag.',
        },
      ],
    },
    rigging: {
      required_bones: [
        'root',
        'hips',
        'spine_01',
        'spine_02',
        'spine_03',
        'neck',
        'head',
        'clavicle_l',
        'upperarm_l',
        'lowerarm_l',
        'hand_l',
        'clavicle_r',
        'upperarm_r',
        'lowerarm_r',
        'hand_r',
        'thigh_l',
        'calf_l',
        'foot_l',
        'ball_l',
        'thigh_r',
        'calf_r',
        'foot_r',
        'ball_r',
      ],
      controls: ['hand_ik_l', 'hand_ik_r', 'foot_ik_l', 'foot_ik_r', 'pelvis_ctrl', 'chest_ctrl', 'elbow_pole_l', 'elbow_pole_r'],
    },
    camera_views: ['front', 'side', 'back', 'top'],
    form_checks: [
      'Keep back straight',
      'Engage core',
      'Full range of motion',
      'Keep hands planted with no floor sliding',
      'Avoid lumbar sagging or hip piking',
    ],
    jsonFileUrl: '/assets/aistudio/01_push_up_b5511134.json',
  },
  {
    id: '02_squat',
    fitforgeExerciseId: 'squats',
    code: '02',
    titleLabel: '02. SQUAT (Lower Body)',
    exercise: 'squat',
    category: 'lower_body',
    model: {
      height_cm: 180,
      weight_kg: 70,
      style: 'athletic_realistic_clean',
      formats: ['glb', 'fbx', 'obj'],
      scale: '1_unit_equals_1_meter',
    },
    colorGuide: {
      muscle: { label: 'Muscle (Red)', hex: '#EF4444' },
      body: { label: 'Body (Gray)', hex: '#9CA3AF' },
      clothes: { label: 'Clothes (Black)', hex: '#16181D' },
    },
    target_muscles: {
      primary: ['quadriceps', 'gluteus_maximus', 'hamstrings'],
      secondary: ['adductors', 'calves'],
      stabilizers: ['core', 'erector_spinae', 'hip_stabilizers'],
    },
    animation: {
      loop: true,
      fps: 30,
      duration_seconds: 2.2,
      keyframes: [
        {
          frame: 0,
          pose: 'standing_start',
          description: 'Upright stance, feet shoulder-width apart, toes slightly angled out, arms relaxed or ready to counterbalance.',
        },
        {
          frame: 15,
          pose: 'descent_initiation',
          description: 'Hips hinge back and down, knees flex in line with toes, arms begin raising forward.',
        },
        {
          frame: 30,
          pose: 'bottom_squat',
          description: 'Thighs near parallel, heels grounded, chest upright, spine neutral, arms forward for balance.',
        },
        {
          frame: 45,
          pose: 'ascent_drive',
          description: 'Drive through heels and midfoot, hips and chest rise together, arms begin lowering.',
        },
        {
          frame: 60,
          pose: 'standing_return',
          description: 'Full hip and knee extension back to balanced neutral standing posture.',
        },
      ],
    },
    rigging: {
      required_bones: [
        'root',
        'hips',
        'spine_01',
        'spine_02',
        'spine_03',
        'neck',
        'head',
        'clavicle_l',
        'upperarm_l',
        'lowerarm_l',
        'hand_l',
        'clavicle_r',
        'upperarm_r',
        'lowerarm_r',
        'hand_r',
        'thigh_l',
        'calf_l',
        'foot_l',
        'ball_l',
        'thigh_r',
        'calf_r',
        'foot_r',
        'ball_r',
      ],
      controls: ['foot_ik_l', 'foot_ik_r', 'knee_pole_l', 'knee_pole_r', 'pelvis_ctrl', 'spine_ctrl', 'arm_fk_l', 'arm_fk_r'],
    },
    camera_views: ['front', 'side', 'back', 'top'],
    form_checks: [
      'Knees in line with toes',
      'Push through heels',
      'Keep chest up',
      'Prevent knee valgus collapse',
      'Maintain neutral lumbar spine',
    ],
    jsonFileUrl: '/assets/aistudio/02_squat_531cf8b3.json',
  },
  {
    id: '03_pull_up',
    fitforgeExerciseId: 'pull_ups',
    code: '03',
    titleLabel: '03. PULL-UP (Back)',
    exercise: 'pull_up',
    category: 'back_upper_body',
    model: {
      height_cm: 180,
      weight_kg: 70,
      style: 'athletic_realistic_clean',
      formats: ['glb', 'fbx', 'obj'],
      scale: '1_unit_equals_1_meter',
    },
    colorGuide: {
      muscle: { label: 'Muscle (Red)', hex: '#EF4444' },
      body: { label: 'Body (Gray)', hex: '#9CA3AF' },
      clothes: { label: 'Clothes (Black)', hex: '#16181D' },
    },
    target_muscles: {
      primary: ['latissimus_dorsi', 'biceps_brachii', 'upper_back'],
      secondary: ['brachialis', 'posterior_deltoid', 'forearm_flexors'],
      stabilizers: ['lower_trapezius', 'rhomboids', 'core'],
    },
    animation: {
      loop: true,
      fps: 30,
      duration_seconds: 2.4,
      keyframes: [
        {
          frame: 0,
          pose: 'active_hang',
          description: 'Overhand grip slightly wider than shoulders, arms extended, shoulders engaged, body stable.',
        },
        {
          frame: 15,
          pose: 'scapular_pull_and_initiation',
          description: 'Scapulae depress and retract, elbows begin driving down and back, chest lifts slightly.',
        },
        {
          frame: 30,
          pose: 'top_chin_over_bar',
          description: 'Chin clears bar level, upper chest rises toward bar, lats and biceps fully engaged, minimal leg swing.',
        },
        {
          frame: 45,
          pose: 'controlled_lowering',
          description: 'Smooth eccentric descent while hands stay locked to the bar and core prevents swinging.',
        },
        {
          frame: 60,
          pose: 'hang_return',
          description: 'Return to stable active hang without abrupt drop or shoulder collapse.',
        },
      ],
    },
    rigging: {
      required_bones: [
        'root',
        'hips',
        'spine_01',
        'spine_02',
        'spine_03',
        'neck',
        'head',
        'clavicle_l',
        'upperarm_l',
        'lowerarm_l',
        'hand_l',
        'clavicle_r',
        'upperarm_r',
        'lowerarm_r',
        'hand_r',
        'thigh_l',
        'calf_l',
        'foot_l',
        'ball_l',
        'thigh_r',
        'calf_r',
        'foot_r',
        'ball_r',
      ],
      controls: ['bar_ref', 'hand_ik_l', 'hand_ik_r', 'elbow_pole_l', 'elbow_pole_r', 'pelvis_ctrl', 'chest_ctrl', 'leg_stabilizer_ctrl'],
    },
    camera_views: ['front', 'side', 'back', 'top'],
    form_checks: [
      'Engage back',
      'Pull to chin level',
      'Controlled movement',
      'Keep hands locked to overhead bar with no sliding',
      'Avoid kipping or excessive pendulum swing',
    ],
    jsonFileUrl: '/assets/aistudio/03_pull_up_30e1d6fe.json',
  },
];

export const AI_BUILD_PROMPT_MD = `# AI_BUILD_PROMPT.md — Fitness 3D Blueprint Pack (Master AI 3D Model + Animation Prompt)

Use the attached reference blueprint image (\`/assets/aistudio/reference_blueprint_b2822b35.png\`) and JSON specification files (\`01_push_up.json\`, \`02_squat.json\`, \`03_pull_up.json\`) to generate a clean, animation-ready 3D athletic male character with anatomical muscle highlight overlays and three exercise animations: **Push-Up**, **Squat**, and **Pull-Up**.

---

## 1. Global Character Specifications
- **Height**: \`180 cm\` (\`1.80 m\`)
- **Weight**: \`70 kg\`
- **Build**: Lean, symmetrical, realistic athletic male anatomy
- **Style**: \`athletic_realistic_clean\` — Clean studio fitness mannequin / anatomical athletic model
- **Base Material (\`Body / Gray\`)**: Neutral athletic light gray skin (\`#9CA3AF\` / \`#A3AAB6\`, roughness \`0.32\`, clearcoat \`0.24\`)
- **Clothing (\`Clothes / Black\`)**: Matte charcoal athletic shorts (\`#16181D\`) and minimalist athletic shoes (\`#0F1115\` with \`#E5E7EB\` sole trim)
- **Muscle Highlight System (\`Muscle / Red\`)**: Separate material groups or submeshes for highlighted active muscle regions (\`#EF4444\` primary red, \`#F59E0B\` secondary amber, \`#64748B\` stabilizer slate)
- **Topology**: Clean quad-dominant deforming topology around shoulders, elbows, hips, knees, ankles, and spine
- **Scale & Orientation**: \`1 unit = 1 meter\` (\`1_unit_equals_1_meter\`), \`Y-up\` or \`Z-up\` consistent across exports, facing \`+Z\` or \`-Y\` consistently
- **Formats**: Export-ready for \`.glb\`, \`.fbx\`, and \`.obj\` (static reference meshes)

---

## 2. Rigging & Control Architecture (22 Required Bones)
Include a clean humanoid skeletal hierarchy with the following **22 required bones**:
\`\`\`text
root -> hips -> spine_01 -> spine_02 -> spine_03 -> neck -> head
     -> clavicle_l -> upperarm_l -> lowerarm_l -> hand_l
     -> clavicle_r -> upperarm_r -> lowerarm_r -> hand_r
     -> thigh_l -> calf_l -> foot_l -> ball_l
     -> thigh_r -> calf_r -> foot_r -> ball_r
\`\`\`

### Required IK / FK Controls per Exercise
- **01. Push-Up Controls**: \`hand_ik_l\`, \`hand_ik_r\`, \`foot_ik_l\`, \`foot_ik_r\`, \`pelvis_ctrl\`, \`chest_ctrl\`, \`elbow_pole_l\`, \`elbow_pole_r\`
- **02. Squat Controls**: \`foot_ik_l\`, \`foot_ik_r\`, \`knee_pole_l\`, \`knee_pole_r\`, \`pelvis_ctrl\`, \`spine_ctrl\`, \`arm_fk_l\`, \`arm_fk_r\`
- **03. Pull-Up Controls**: \`bar_ref\`, \`hand_ik_l\`, \`hand_ik_r\`, \`elbow_pole_l\`, \`elbow_pole_r\`, \`pelvis_ctrl\`, \`chest_ctrl\`, \`leg_stabilizer_ctrl\`

---

## 3. Exercise 01 — PUSH-UP (\`upper_body\`)
### Highlighted Muscles
- **Primary**: \`pectoralis_major\` (Chest), \`anterior_deltoid\` (Shoulders), \`triceps_brachii\` (Triceps)
- **Secondary**: \`serratus_anterior\`, \`core_stabilizers\`
- **Stabilizers**: \`glutes\`, \`erector_spinae\`, \`scapular_stabilizers\`

### Animation Cycle (\`loop: true\`, \`30 FPS\`, \`2.0 seconds\`, \`60 frames\`)
1. **Frame 0 (\`high_plank_start\`)**: Arms extended, wrists under shoulders, spine neutral, pelvis aligned, feet hip-width apart.
2. **Frame 15 (\`descent_mid\`)**: Elbows flexing at roughly 45 degrees from torso, chest lowering with rigid trunk.
3. **Frame 30 (\`bottom_position\`)**: Chest hovers slightly above floor, elbows bent near 90 degrees, neck neutral, hips aligned.
4. **Frame 45 (\`ascent_mid\`)**: Pressing through palms, extending elbows while keeping core and glutes engaged.
5. **Frame 60 (\`plank_return\`)**: Return to start plank without shoulder shrug or lower-back sag.

### Form & Biomechanical Constraints
- Keep back straight, engage core, full range of motion.
- Keep hands and toes planted on the floor with zero sliding (\`hand_ik_l/r\`, \`foot_ik_l/r\` locked).
- Avoid lumbar sagging or hip piking.

---

## 4. Exercise 02 — SQUAT (\`lower_body\`)
### Highlighted Muscles
- **Primary**: \`quadriceps\`, \`gluteus_maximus\`, \`hamstrings\`
- **Secondary**: \`adductors\`, \`calves\`
- **Stabilizers**: \`core\`, \`erector_spinae\`, \`hip_stabilizers\`

### Animation Cycle (\`loop: true\`, \`30 FPS\`, \`2.2 seconds\`, \`60 frames\`)
1. **Frame 0 (\`standing_start\`)**: Upright stance, feet shoulder-width apart, toes slightly angled out, arms relaxed or ready to counterbalance.
2. **Frame 15 (\`descent_initiation\`)**: Hips hinge back and down, knees flex in line with toes, arms begin raising forward.
3. **Frame 30 (\`bottom_squat\`)**: Thighs near parallel, heels grounded, chest upright, spine neutral, arms forward for balance.
4. **Frame 45 (\`ascent_drive\`)**: Drive through heels and midfoot, hips and chest rise together, arms begin lowering.
5. **Frame 60 (\`standing_return\`)**: Full hip and knee extension back to balanced neutral standing posture.

### Form & Biomechanical Constraints
- Knees in line with toes, push through heels, keep chest up.
- Prevent knee valgus collapse and maintain neutral lumbar spine.

---

## 5. Exercise 03 — PULL-UP (\`back_upper_body\`)
### Highlighted Muscles
- **Primary**: \`latissimus_dorsi\` (Lats), \`biceps_brachii\` (Biceps), \`upper_back\` (Back)
- **Secondary**: \`brachialis\`, \`posterior_deltoid\`, \`forearm_flexors\`
- **Stabilizers**: \`lower_trapezius\`, \`rhomboids\`, \`core\`

### Animation Cycle (\`loop: true\`, \`30 FPS\`, \`2.4 seconds\`, \`60 frames\`)
1. **Frame 0 (\`active_hang\`)**: Overhand grip slightly wider than shoulders, arms extended, shoulders engaged, body stable.
2. **Frame 15 (\`scapular_pull_and_initiation\`)**: Scapulae depress and retract, elbows begin driving down and back, chest lifts slightly.
3. **Frame 30 (\`top_chin_over_bar\`)**: Chin clears bar level, upper chest rises toward bar, lats and biceps fully engaged, minimal leg swing.
4. **Frame 45 (\`controlled_lowering\`)**: Smooth eccentric descent while hands stay locked to the bar and core prevents swinging.
5. **Frame 60 (\`hang_return\`)**: Return to stable active hang without abrupt drop or shoulder collapse.

### Form & Biomechanical Constraints
- Engage back, pull to chin level, controlled movement.
- Keep hands locked to the fixed overhead pull-up bar (\`bar_ref\`) with zero sliding.
- Avoid kipping or excessive pendulum swing.

---

## 6. Camera Views & Blueprint Output Checklist
- Provide 4 orthographic/perspective reference camera angles: **\`front\`**, **\`side\`**, **\`back\`**, and **\`top\`**.
- Verify silhouette proportions against Blueprint Details: **Height \`180 cm\`**, **Width \`~70 cm\`**, **Horizontal Plank Length \`~180 cm\`**.
- No mesh intersections, no flipped normals, no wrist pinching, and smooth root/pelvis trajectories across all 60 frames.`;
