import {
  type AnimationClipName,
  type MuscleGroup,
  EXERCISE_CLIP_MAP,
} from './exerciseClipMap';

export interface ExerciseItem {
  id: string;
  name: string;
  clip: AnimationClipName;
  isApproximateClip: boolean;
  biomechanicalVariant: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  sets: number;
  reps: string;
  restSec: number;
  defaultWeightKg: number;
  difficulty: 'Pemula' | 'Menengah' | 'Lanjutan';
  formTips: [string, string, string];
  commonMistakes: [string, string];
}

function makeExercise(
  id: string,
  name: string,
  primaryMuscles: MuscleGroup[],
  secondaryMuscles: MuscleGroup[],
  sets: number,
  reps: string,
  restSec: number,
  defaultWeightKg: number,
  difficulty: 'Pemula' | 'Menengah' | 'Lanjutan',
  formTips: [string, string, string],
  commonMistakes: [string, string]
): ExerciseItem {
  const mapping = EXERCISE_CLIP_MAP[id] || {
    clip: 'pushup',
    isApproximate: true,
    biomechanicalVariant: 'standard',
  };
  return {
    id,
    name,
    clip: mapping.clip,
    isApproximateClip: mapping.isApproximate,
    biomechanicalVariant: mapping.biomechanicalVariant,
    primaryMuscles,
    secondaryMuscles,
    sets,
    reps,
    restSec,
    defaultWeightKg,
    difficulty,
    formTips,
    commonMistakes,
  };
}

export const EXERCISES: Record<string, ExerciseItem> = {
  // === MONDAY: CHEST & TRICEPS (GYM) ===
  bench_press: makeExercise(
    'bench_press',
    'Bench Press',
    ['chest'],
    ['triceps', 'shoulders'],
    4,
    '8–12',
    90,
    60,
    'Menengah',
    [
      'Tarik belikat (retract scapula) menempel kuat ke bangku sebelum menurunkan barbel.',
      'Turunkan barbel terkontrol ke bagian tengah-bawah dada dengan sudut siku ~45–60 derajat.',
      'Dorong eksplosif ke atas sambil menjaga tumit menapak penuh di lantai.',
    ],
    [
      'Membuka siku 90 derajat lurus ke samping yang membebani sendi bahu depan.',
      'Memantulkan barbel dari tulang dada untuk mengangkat beban berlebih.',
    ]
  ),
  incline_dumbbell_press: makeExercise(
    'incline_dumbbell_press',
    'Incline Dumbbell Press',
    ['chest', 'shoulders'],
    ['triceps'],
    4,
    '10–12',
    75,
    22,
    'Menengah',
    [
      'Atur kemiringan bangku pada sudut 30 derajat agar fokus tetap di dada atas (clavicular head).',
      'Turunkan dumbbell sejajar dada atas hingga terasa regangan penuh pada serat pectoral.',
      'Dorong ke atas membentuk busur lembut tanpa membenturkan dumbbell di puncak.',
    ],
    [
      'Mengatur bangku terlalu tegak (>45°) sehingga beban berpindah ke bahu.',
      'Mengangkat punggung bawah secara berlebihan dari sandaran bangku.',
    ]
  ),
  chest_fly: makeExercise(
    'chest_fly',
    'Chest Fly',
    ['chest'],
    ['shoulders'],
    3,
    '12–15',
    60,
    14,
    'Pemula',
    [
      'Pertahankan sedikit tekukan lembut pada siku sepanjang gerakan seperti memeluk pohon besar.',
      'Fokus pada kontraksi dada bagian dalam saat kedua lengan bertemu di atas.',
      'Tahan 1 detik di puncak kontraksi sebelum menurunkan beban secara perlahan.',
    ],
    [
      'Meluruskan siku sepenuhnya yang berisiko mencederai tendon bisep.',
      'Menurunkan beban terlalu dalam melewati garis bahu belakang.',
    ]
  ),
  dips: makeExercise(
    'dips',
    'Dips',
    ['chest', 'triceps'],
    ['shoulders'],
    3,
    '10–15',
    75,
    0,
    'Menengah',
    [
      'Condongkan torso sedikit ke depan (~15°) untuk mengaktifkan dada bawah lebih maksimal.',
      'Turunkan tubuh hingga bahu sejajar dengan siku (90 derajat).',
      'Kunci bagian atas dengan menekan telapak tangan kuat ke palang.',
    ],
    [
      'Bahu terangkat mendekati telinga (shrugging) saat fase turun.',
      'Mengayunkan kaki untuk mencari momentum.',
    ]
  ),
  tricep_pushdown: makeExercise(
    'tricep_pushdown',
    'Tricep Pushdown',
    ['triceps'],
    ['forearms'],
    3,
    '10–15',
    60,
    25,
    'Pemula',
    [
      'Kunci posisi siku rapat di samping rusuk dan hanya gerakkan lengan bawah.',
      'Luruskan lengan penuh di bawah dan kencangkan trisep selama 1 detik.',
      'Kembalikan kabel perlahan hingga sudut siku sekitar 90 derajat.',
    ],
    [
      'Siku ikut maju-mundur sehingga punggung dan bahu mengambil alih beban.',
      'Membungkukkan badan terlalu dekat di atas beban kabel.',
    ]
  ),
  overhead_tricep_ext: makeExercise(
    'overhead_tricep_ext',
    'Overhead Tricep Extension',
    ['triceps'],
    ['shoulders', 'abs'],
    3,
    '12–15',
    60,
    18,
    'Pemula',
    [
      'Arahkan siku ke depan-atas agar kepala panjang trisep (long head) teregang optimal.',
      'Kencangkan otot perut (core) supaya punggung bawah tidak melengkung.',
      'Dorong beban lurus ke atas kepala hingga lengan ekstensi penuh.',
    ],
    [
      'Siku melebar jauh ke samping saat beban diturunkan.',
      'Menurunkan beban terlalu cepat tanpa kontrol eksentrik.',
    ]
  ),

  // === MONDAY: CHEST & TRICEPS (HOME) ===
  pushup: makeExercise(
    'pushup',
    'Push-ups',
    ['chest'],
    ['triceps', 'shoulders', 'abs'],
    4,
    '8–12',
    60,
    0,
    'Pemula',
    [
      'Bentuk garis lurus dari kepala, bahu, pinggul hingga tumit dengan mengencangkan glutes & abs.',
      'Tempatkan tangan sedikit lebih lebar dari bahu dan arahkan siku 45° ke belakang.',
      'Turunkan dada hingga 2–3 cm dari lantai lalu dorong kuat kembali ke atas.',
    ],
    [
      'Pinggul turun melengkung (sagging hips) karena core tidak dikencangkan.',
      'Hanya menurunkan kepala tanpa menekuk siku secara penuh.',
    ]
  ),
  diamond_pushup: makeExercise(
    'diamond_pushup',
    'Diamond Push-ups',
    ['triceps', 'chest'],
    ['shoulders', 'abs'],
    4,
    '10–12',
    60,
    0,
    'Menengah',
    [
      'Satukan ibu jari dan telunjuk membentuk berlian tepat di bawah tengah dada.',
      'Jaga siku tetap dekat dengan sisi tubuh saat turun.',
      'Dorong lurus hingga trisep berkontraksi penuh di puncak gerakan.',
    ],
    [
      'Meletakkan tangan terlalu maju di bawah wajah sehingga membebani leher.',
      'Melebarkan siku keluar karena kelelahan.',
    ]
  ),
  decline_pushup: makeExercise(
    'decline_pushup',
    'Decline Push-ups',
    ['chest', 'shoulders'],
    ['triceps', 'abs'],
    3,
    '12–15',
    60,
    0,
    'Menengah',
    [
      'Naikkan kaki di atas bangku/kursi setinggi 30–45 cm untuk menargetkan dada atas.',
      'Pastikan pandangan menghadap lantai di depan tangan agar leher tetap netral.',
      'Kontrol fase turun selama 2 detik penuh.',
    ],
    [
      'Punggung bawah melengkung tajam akibat core kendor.',
      'Tangan terlalu lebar sehingga bahu depan tertekan.',
    ]
  ),
  chair_dips: makeExercise(
    'chair_dips',
    'Chair Dips',
    ['triceps'],
    ['chest', 'shoulders'],
    3,
    '10–15',
    60,
    0,
    'Pemula',
    [
      'Gunakan kursi kokoh, letakkan telapak tangan di tepi kursi tepat di samping pinggul.',
      'Geser punggung turun menyusuri dekat tepi kursi hingga siku membentuk 90 derajat.',
      'Tekan telapak tangan untuk mengangkat tubuh menggunakan kekuatan trisep.',
    ],
    [
      'Pinggul bergerak terlalu jauh ke depan menjauhi kursi sehingga bahu tertekan.',
      'Turun terlalu rendah melewati batas mobilitas bahu.',
    ]
  ),
  pike_pushup: makeExercise(
    'pike_pushup',
    'Pike Push-ups',
    ['shoulders', 'triceps'],
    ['chest', 'abs'],
    3,
    '10–15',
    60,
    0,
    'Menengah',
    [
      'Angkat pinggul tinggi membentuk huruf V terbalik dengan punggung dan kaki lurus.',
      'Turunkan puncak kepala menuju titik di depan kedua tangan (membentuk segitiga).',
      'Dorong kembali ke posisi awal hingga bahu sejajar telinga.',
    ],
    [
      'Menurunkan kepala lurus di antara tangan seperti push-up biasa.',
      'Menekuk lutut berlebihan sehingga beban bahu berkurang.',
    ]
  ),

  // === TUESDAY: BACK & BICEPS (GYM & HOME) ===
  pull_ups: makeExercise(
    'pull_ups',
    'Pull-Ups',
    ['back_lats'],
    ['biceps', 'forearms', 'shoulders'],
    4,
    '8–12',
    90,
    0,
    'Lanjutan',
    [
      'Mulai dari posisi dead-hang lalu tekan belikat ke bawah (active hang) sebelum menarik.',
      'Bayangkan menarik siku ke arah saku belakang hingga dagu melewati palang.',
      'Turunkan tubuh secara terkontrol hingga tangan lurus penuh.',
    ],
    [
      'Mengayunkan kaki (kipping) tanpa kontrol otot punggung.',
      'Hanya turun setengah jalan (half reps) sehingga lats tidak teregang.',
    ]
  ),
  lat_pulldown: makeExercise(
    'lat_pulldown',
    'Lat Pulldown',
    ['back_lats'],
    ['biceps', 'forearms'],
    4,
    '10–12',
    75,
    50,
    'Pemula',
    [
      'Busungkan dada dan condongkan badan sedikit ke belakang (~10–15 derajat).',
      'Tarik palang ke arah dada atas sambil merapatkan belikat bawah.',
      'Tahan 1 detik di bawah lalu lepaskan perlahan ke atas.',
    ],
    [
      'Menarik palang ke belakang leher yang berbahaya bagi sendi bahu & servikal.',
      'Mengayunkan badan ke belakang menggunakan momentum pinggang.',
    ]
  ),
  barbell_row: makeExercise(
    'barbell_row',
    'Barbell Row',
    ['back_lats'],
    ['biceps', 'hamstrings', 'glutes'],
    4,
    '8–12',
    90,
    55,
    'Menengah',
    [
      'Tekuk pinggul (hip hinge) hingga torso membentuk sudut 45 derajat dengan punggung rata.',
      'Tarik barbel ke arah pusar dengan siku mengarah ke belakang.',
      'Jaga leher sejajar tulang belakang sepanjang set.',
    ],
    [
      'Membungkukkan punggung bawah (rounding lumbar spine).',
      'Berdiri terlalu tegak sehingga gerakan berubah menjadi shrug.',
    ]
  ),
  seated_cable_row: makeExercise(
    'seated_cable_row',
    'Seated Cable Row',
    ['back_lats'],
    ['biceps', 'shoulders'],
    3,
    '12–15',
    60,
    45,
    'Pemula',
    [
      'Duduk tegak dengan lutut sedikit ditekuk dan dada terangkat.',
      'Tarik pegangan ke perut bawah sambil menjepit belikat tengah.',
      'Ulurkan lengan ke depan secara terkontrol tanpa membungkukkan pinggang.',
    ],
    [
      'Memakai ayunan punggung bawah maju-mundur secara berlebihan.',
      'Mengangkat bahu ke arah telinga saat menarik beban.',
    ]
  ),
  barbell_curl: makeExercise(
    'barbell_curl',
    'Barbell Curl',
    ['biceps'],
    ['forearms'],
    4,
    '10–12',
    60,
    25,
    'Pemula',
    [
      'Berdiri tegak, kunci siku di sisi tubuh dan putar telapak tangan menghadap atas.',
      'Angkat barbel menggunakan kontraksi bisep tanpa mengayunkan pinggul.',
      'Turunkan beban selama 2–3 detik untuk memaksimalkan tegangan eksentrik.',
    ],
    [
      'Mengayunkan punggung ke belakang untuk mengangkat beban terlalu berat.',
      'Menggerakkan siku maju ke depan di akhir gerakan.',
    ]
  ),
  hammer_curl: makeExercise(
    'hammer_curl',
    'Hammer Curl',
    ['biceps', 'forearms'],
    ['shoulders'],
    3,
    '12–15',
    60,
    14,
    'Pemula',
    [
      'Pegang dumbbell dengan posisi netral (telapak tangan saling berhadapan).',
      'Angkat beban lurus ke arah bahu depan untuk menargetkan otot brachialis.',
      'Turunkan penuh hingga lengan lurus di samping paha.',
    ],
    [
      'Memutar pergelangan tangan di tengah jalan.',
      'Mengangkat kedua beban sambil memantulkan lutut.',
    ]
  ),
  doorframe_rows: makeExercise(
    'doorframe_rows',
    'Doorframe / Table Rows',
    ['back_lats'],
    ['biceps', 'forearms'],
    4,
    '10–12',
    60,
    0,
    'Pemula',
    [
      'Pegang tepi meja kokoh atau kusen pintu, posisikan tubuh miring lurus.',
      'Tarik dada mendekati titik pegangan sambil menjepit belikat.',
      'Tahan kontraksi puncak 1 detik sebelum turun perlahan.',
    ],
    [
      'Pinggul turun sehingga hanya lengan yang bekerja.',
      'Memakai meja yang ringan/tidak stabil.',
    ]
  ),
  superman_pulls: makeExercise(
    'superman_pulls',
    'Superman Pulls',
    ['back_lats', 'glutes'],
    ['hamstrings', 'shoulders'],
    4,
    '12–15',
    45,
    0,
    'Pemula',
    [
      'Berbaring tengkurap, angkat dada dan paha sedikit dari lantai.',
      'Tarik siku dari posisi lurus di depan menuju samping rusuk (bentuk huruf W).',
      'Jaga pandangan menghadap matras agar leher tidak tegang.',
    ],
    [
      'Mendongakkan kepala terlalu tinggi.',
      'Menahan napas selama gerakan berlangsung.',
    ]
  ),
  reverse_snow_angels: makeExercise(
    'reverse_snow_angels',
    'Reverse Snow Angels',
    ['back_lats', 'shoulders'],
    ['glutes'],
    3,
    '12–15',
    45,
    0,
    'Pemula',
    [
      'Tengkurap dengan dada sedikit terangkat dan lengan lurus melayang dari lantai.',
      'Sapukan lengan membentuk busur lebar dari atas kepala hingga ke sisi paha.',
      'Rasakan kerja otot punggung atas dan bahu belakang di setiap sapuan.',
    ],
    [
      'Menyentuhkan tangan ke lantai di tengah repetisi.',
      'Menggerakkan tangan terlalu cepat tanpa kontrol.',
    ]
  ),
  towel_bicep_curls: makeExercise(
    'towel_bicep_curls',
    'Towel Bicep Curls',
    ['biceps'],
    ['forearms'],
    4,
    '10–12',
    60,
    0,
    'Menengah',
    [
      'Kaitkan handuk di bawah satu telapak kaki, pegang kedua ujung handuk.',
      'Gunakan kaki untuk memberikan tahanan terukur sementara bisep menarik ke atas.',
      'Lawan tekanan kaki saat menurunkan tangan selama 3 detik.',
    ],
    [
      'Kaki tidak memberikan tahanan yang konsisten.',
      'Membungkukkan punggung saat menarik handuk.',
    ]
  ),

  // === WEDNESDAY: LEGS (GYM & HOME) ===
  squats: makeExercise(
    'squats',
    'Squats',
    ['quads', 'glutes'],
    ['hamstrings', 'abs'],
    4,
    '8–12',
    90,
    80,
    'Menengah',
    [
      'Buka kaki selebar bahu dengan ujung kaki mengarah keluar 15–30 derajat.',
      'Tarik napas ke perut (brace core), turunkan pinggul hingga paha minimal sejajar lantai.',
      'Dorong lantai melalui tengah telapak kaki sambil menjaga lutut searah jari kaki.',
    ],
    [
      'Lutut masuk ke dalam (knee valgus) saat mendorong naik.',
      'Tumit terangkat dari lantai akibat kurang mobilitas pergelangan kaki.',
    ]
  ),
  leg_press: makeExercise(
    'leg_press',
    'Leg Press',
    ['quads', 'glutes'],
    ['hamstrings'],
    4,
    '10–12',
    75,
    140,
    'Pemula',
    [
      'Tempelkan punggung bawah dan bokong rapat ke sandaran kursi sepanjang gerakan.',
      'Turunkan platform hingga sudut lutut mencapai 90 derajat.',
      'Dorong dengan tumit dan berhenti sedikit sebelum lutut terkunci lurus.',
    ],
    [
      'Mengunci lutut lurus penuh (hyperextension) dengan beban berat.',
      'Menurunkan beban terlalu dalam hingga bokong terangkat dari kursi.',
    ]
  ),
  romanian_deadlift: makeExercise(
    'romanian_deadlift',
    'Romanian Deadlift',
    ['hamstrings', 'glutes'],
    ['back_lats', 'forearms'],
    4,
    '8–12',
    90,
    70,
    'Menengah',
    [
      'Dorong pinggul ke belakang (hip hinge) dengan lutut sedikit ditekuk tetap.',
      'Biarkan barbel meluncur rapat di sepanjang paha hingga tulang kering atas.',
      'Kencangkan glutes dan hamstring untuk kembali berdiri tegak.',
    ],
    [
      'Membiarkan barbel menjauh dari kaki sehingga membebani pinggang bawah.',
      'Menekuk lutut terlalu banyak seperti gerakan squat.',
    ]
  ),
  walking_lunges: makeExercise(
    'walking_lunges',
    'Walking Lunges',
    ['quads', 'glutes'],
    ['hamstrings', 'calves'],
    3,
    '12 / kaki',
    75,
    16,
    'Menengah',
    [
      'Langkahkan kaki ke depan dan turunkan pinggul hingga kedua lutut membentuk sudut ~90°.',
      'Jaga dada tetap tegak dan dorong melalui tumit kaki depan untuk melangkah maju.',
      'Jaga jarak langkah selebar pinggul agar keseimbangan tetap stabil.',
    ],
    [
      'Melangkah di satu garis lurus seperti berjalan di atas tali.',
      'Membenturkan lutut belakang keras ke lantai.',
    ]
  ),
  leg_curl: makeExercise(
    'leg_curl',
    'Leg Curl',
    ['hamstrings'],
    ['calves'],
    3,
    '12–15',
    60,
    35,
    'Pemula',
    [
      'Sejajarkan poros lutut dengan poros putar mesin leg curl.',
      'Tekuk tumit ke arah bokong secara penuh lalu tahan 1 detik.',
      'Kembalikan beban perlahan tanpa membiarkan tumpukan beban terbanting.',
    ],
    [
      'Mengangkat pinggul dari bantalan saat beban terasa berat.',
      'Gerakan terlalu cepat menggunakan pantulan.',
    ]
  ),
  calf_raises: makeExercise(
    'calf_raises',
    'Calf Raises',
    ['calves'],
    [],
    4,
    '15–20',
    45,
    40,
    'Pemula',
    [
      'Turunkan tumit penuh di bawah pijakan untuk meregangkan tendon Achilles & betis.',
      'Angkat tumit setinggi mungkin di atas bola kaki dan tahan 1–2 detik di puncak.',
      'Hindari memantul; gunakan tempo 2 detik naik, 1 detik tahan, 2 detik turun.',
    ],
    [
      'Memantul cepat dengan rentang gerak sangat pendek.',
      'Menekuk lutut untuk membantu mengangkat beban.',
    ]
  ),
  bodyweight_squats: makeExercise(
    'bodyweight_squats',
    'Bodyweight Squats',
    ['quads', 'glutes'],
    ['hamstrings', 'abs'],
    4,
    '15–20',
    60,
    0,
    'Pemula',
    [
      'Rentangkan tangan ke depan untuk keseimbangan dan jaga dada tetap membusung.',
      'Turunkan pinggul melewati garis sejajar lutut dengan kontrol penuh.',
      'Kencangkan paha depan dan bokong saat berdiri di puncak.',
    ],
    [
      'Lutut runtuh ke arah dalam saat naik.',
      'Membungkukkan punggung atas terlalu jauh ke depan.',
    ]
  ),
  bulgarian_split_squats: makeExercise(
    'bulgarian_split_squats',
    'Bulgarian Split Squats',
    ['quads', 'glutes'],
    ['hamstrings'],
    4,
    '10–12 / kaki',
    75,
    0,
    'Menengah',
    [
      'Letakkan punggung kaki belakang di atas kursi dan berdiri sekitar 2 langkah di depan.',
      'Turunkan lutut belakang mengarah ke lantai sambil menjaga 80% beban di kaki depan.',
      'Dorong kuat melalui telapak kaki depan hingga berdiri penuh.',
    ],
    [
      'Berdiri terlalu dekat atau terlalu jauh dari kursi.',
      'Mendorong terlalu banyak menggunakan kaki belakang.',
    ]
  ),
  glute_bridges: makeExercise(
    'glute_bridges',
    'Glute Bridges',
    ['glutes'],
    ['hamstrings', 'abs'],
    4,
    '15–20',
    60,
    0,
    'Pemula',
    [
      'Berbaring telentang dengan lutut ditekuk dan tumit berjarak ~15 cm dari bokong.',
      'Dorong pinggul ke atas melalui tumit hingga bahu, pinggul, dan lutut segaris lurus.',
      'Kencangkan glutes selama 2 detik di puncak sebelum turun.',
    ],
    [
      'Melengkungkan punggung bawah berlebihan di puncak gerakan.',
      'Mendorong dengan ujung jari kaki bukan tumit.',
    ]
  ),

  // === THURSDAY: SHOULDERS (GYM & HOME) ===
  overhead_press: makeExercise(
    'overhead_press',
    'Overhead Press',
    ['shoulders'],
    ['triceps', 'abs'],
    4,
    '8–12',
    90,
    40,
    'Menengah',
    [
      'Kencangkan bokong dan perut agar tulang belakang tetap kokoh.',
      'Dorong barbel lurus vertikal melewati dagu hingga terkunci di atas bahu.',
      'Turunkan kembali secara terkontrol ke depan tulang selangka.',
    ],
    [
      'Melengkungkan pinggang ke belakang seperti incline press.',
      'Mendorong barbel melenceng ke depan tubuh.',
    ]
  ),
  lateral_raises: makeExercise(
    'lateral_raises',
    'Lateral Raises',
    ['shoulders'],
    ['forearms'],
    4,
    '10–12',
    60,
    10,
    'Pemula',
    [
      'Angkat dumbbell ke samping dalam bidang skapula (~15–20 derajat ke depan).',
      'Pimpin gerakan dengan siku hingga tangan sejajar tinggi bahu.',
      'Turunkan beban perlahan selama 2 detik tanpa mengayunkan badan.',
    ],
    [
      'Memakai beban terlalu berat hingga trapezius mengambil alih.',
      'Mengangkat tangan jauh melewati garis horizontal bahu.',
    ]
  ),
  front_raises: makeExercise(
    'front_raises',
    'Front Raises',
    ['shoulders'],
    ['chest'],
    3,
    '12–15',
    60,
    10,
    'Pemula',
    [
      'Angkat beban di depan paha hingga sejajar pandangan mata dengan siku sedikit ditekuk.',
      'Jaga bahu tetap turun menjauhi telinga.',
      'Turunkan perlahan tanpa memantulkan beban di paha.',
    ],
    [
      'Mengayunkan pinggul untuk mengangkat beban ke atas.',
      'Mengangkat terlalu tinggi di atas kepala.',
    ]
  ),
  rear_delt_fly: makeExercise(
    'rear_delt_fly',
    'Rear Delt Fly',
    ['shoulders', 'back_lats'],
    [],
    3,
    '15',
    60,
    8,
    'Pemula',
    [
      'Condongkan torso hampir sejajar lantai, biarkan lengan menggantung di bawah bahu.',
      'Buka lengan lebar ke samping-belakang dengan fokus pada bahu belakang.',
      'Hindari menjepit belikat terlalu keras agar beban tetap di rear deltoid.',
    ],
    [
      'Mengayunkan torso naik-turun di setiap repetisi.',
      'Menarik beban ke arah pinggang seperti gerakan row.',
    ]
  ),
  shrugs: makeExercise(
    'shrugs',
    'Shrugs',
    ['shoulders', 'back_lats'],
    ['forearms'],
    4,
    '12–15',
    60,
    30,
    'Pemula',
    [
      'Angkat bahu lurus ke atas mendekati telinga setinggi mungkin.',
      'Tahan kontraksi puncak selama 2 detik penuh.',
      'Turunkan perlahan hingga otot trapezius teregang.',
    ],
    [
      'Memutar-mutar sendi bahu saat memegang beban berat.',
      'Menekuk siku untuk membantu mengangkat beban.',
    ]
  ),
  pike_press: makeExercise(
    'pike_press',
    'Pike Press',
    ['shoulders'],
    ['triceps', 'chest'],
    4,
    '8–12',
    75,
    0,
    'Menengah',
    [
      'Posisikan tubuh huruf V terbalik dengan beban bertumpu vertikal di bahu.',
      'Turunkan kepala ke depan tangan lalu tekan kuat kembali ke atas.',
      'Tinggikan kaki di kursi bila ingin menambah beban bahu.',
    ],
    [
      'Pinggul turun sehingga sudut berubah menjadi push-up biasa.',
      'Siku melebar 90 derajat ke samping.',
    ]
  ),
  plank_downward_dog: makeExercise(
    'plank_downward_dog',
    'Plank-to-Downward-Dog',
    ['shoulders', 'abs'],
    ['calves', 'hamstrings'],
    3,
    '12–15',
    45,
    0,
    'Pemula',
    [
      'Mulai dari posisi high plank yang kokoh.',
      'Dorong pinggul tinggi ke belakang sambil menekan lantai dengan telapak tangan.',
      'Tahan 1 detik di posisi downward dog lalu kembali ke plank.',
    ],
    [
      'Pinggul jatuh melewati garis lurus saat kembali ke plank.',
      'Bahu tidak aktif menstabilkan skapula.',
    ]
  ),

  // === FRIDAY: ARMS (GYM & HOME) ===
  ez_bar_curl: makeExercise(
    'ez_bar_curl',
    'EZ Bar Curl',
    ['biceps'],
    ['forearms'],
    4,
    '10–12',
    60,
    25,
    'Pemula',
    [
      'Genggam lekukan bar EZ untuk mengurangi tekanan pada pergelangan tangan.',
      'Angkat barbel dengan siku tetap di samping rusuk hingga kontraksi penuh.',
      'Turunkan secara terkontrol selama 2 detik.',
    ],
    [
      'Mengayunkan punggung bawah saat beban mulai terasa berat.',
      'Melepaskan tegangan di titik terbawah.',
    ]
  ),
  incline_curl: makeExercise(
    'incline_curl',
    'Incline Curl',
    ['biceps'],
    ['forearms'],
    3,
    '12–15',
    60,
    12,
    'Menengah',
    [
      'Bersandar di bangku 45° dan biarkan lengan menggantung tegak lurus di belakang tubuh.',
      'Rasakan regangan maksimal pada long head bisep sebelum melakukan curl.',
      'Jaga bahu tetap menempel di bangku sepanjang gerakan.',
    ],
    [
      'Menggerakkan siku maju ke depan sehingga regangan bisep hilang.',
      'Mengangkat bahu dari sandaran bangku.',
    ]
  ),
  skull_crushers: makeExercise(
    'skull_crushers',
    'Skull Crushers',
    ['triceps'],
    ['forearms'],
    3,
    '10–12',
    75,
    22,
    'Menengah',
    [
      'Berbaring di bangku, arahkan lengan atas sedikit miring ke belakang kepala.',
      'Tekuk siku untuk menurunkan bar EZ menuju dahi/atas kepala secara terkontrol.',
      'Luruskan kembali siku tanpa menggerakkan posisi lengan atas.',
    ],
    [
      'Siku melebar keluar sehingga membebani sendi siku.',
      'Mengubah gerakan menjadi pullover dengan mengayunkan bahu.',
    ]
  ),
  rope_pushdown: makeExercise(
    'rope_pushdown',
    'Rope Pushdown',
    ['triceps'],
    ['forearms'],
    3,
    '12–15',
    60,
    20,
    'Pemula',
    [
      'Tarik tali ke bawah dan pisahkan kedua ujung tali ke samping di akhir gerakan.',
      'Kunci siku di samping tubuh dan tahan kontraksi 1 detik.',
      'Kembalikan perlahan hingga lengan bawah sejajar lantai.',
    ],
    [
      'Menggunakan beban terlalu berat sehingga ujung tali tidak bisa dibuka.',
      'Bahu membungkuk maju menekan tali.',
    ]
  ),
  bench_dips: makeExercise(
    'bench_dips',
    'Bench Dips',
    ['triceps'],
    ['chest', 'shoulders'],
    3,
    '15',
    60,
    0,
    'Pemula',
    [
      'Letakkan tangan di bangku di belakang punggung dan luruskan kaki ke depan.',
      'Turunkan tubuh hingga lengan atas sejajar lantai.',
      'Dorong lurus ke atas hingga trisep mengunci.',
    ],
    [
      'Punggung menjauh terlalu depan dari tepi bangku.',
      'Turun terlalu dalam melampaui sudut 90 derajat.',
    ]
  ),
  close_grip_pushups: makeExercise(
    'close_grip_pushups',
    'Close-Grip Push-ups',
    ['triceps', 'chest'],
    ['shoulders', 'abs'],
    4,
    '10–12',
    60,
    0,
    'Menengah',
    [
      'Letakkan tangan sedikit lebih sempit dari lebar bahu.',
      'Pastikan siku menyapu rapat di sepanjang sisi rusuk saat turun.',
      'Dorong lantai kuat dengan telapak tangan hingga siku lurus.',
    ],
    [
      'Siku terbuka keluar ke samping.',
      'Pinggul turun mendahului dada.',
    ]
  ),
  bodyweight_tricep_ext: makeExercise(
    'bodyweight_tricep_ext',
    'Bodyweight Tricep Extensions',
    ['triceps'],
    ['abs', 'shoulders'],
    3,
    '10–12',
    60,
    0,
    'Lanjutan',
    [
      'Mulai dari posisi plank lengan lurus dengan tangan sedikit di depan bahu.',
      'Turunkan siku menyentuh lantai secara bersamaan dengan tubuh tetap lurus.',
      'Tekan telapak tangan untuk meluruskan siku kembali ke posisi plank.',
    ],
    [
      'Menurunkan satu siku terlebih dahulu secara asimetris.',
      'Pinggul terangkat tinggi untuk meringankan beban.',
    ]
  ),
  isometric_towel_curls: makeExercise(
    'isometric_towel_curls',
    'Isometric Towel Curls',
    ['biceps', 'forearms'],
    [],
    3,
    '12–15',
    60,
    0,
    'Pemula',
    [
      'Injak tengah handuk dan tarik kedua ujungnya dengan sudut siku 90 derajat.',
      'Tahan kontraksi maksimal selama 5 detik per repetisi atau gunakan tahanan kaki.',
      'Jaga pergelangan tangan tetap lurus dan kokoh.',
    ],
    [
      'Menahan napas saat kontraksi isometrik.',
      'Mengangkat bahu ke atas.',
    ]
  ),

  // === SATURDAY: CORE & CARDIO ===
  crunches: makeExercise(
    'crunches',
    'Crunches',
    ['abs'],
    [],
    3,
    '20',
    45,
    0,
    'Pemula',
    [
      'Tekuk lutut, tempelkan punggung bawah ke matras, dan letakkan jari ringan di pelipis.',
      'Angkat tulang belikat dari lantai dengan menggulung tulang rusuk ke arah panggul.',
      'Buang napas di puncak kontraksi dan tahan 1 detik.',
    ],
    [
      'Menarik leher dengan tangan hingga servikal tertekan.',
      'Mengangkat seluruh punggung seperti sit-up yang didominasi hip flexor.',
    ]
  ),
  leg_raises: makeExercise(
    'leg_raises',
    'Leg Raises',
    ['abs'],
    ['quads'],
    3,
    '15',
    45,
    0,
    'Menengah',
    [
      'Tekan punggung bawah rapat ke lantai (posterior pelvic tilt) sepanjang set.',
      'Angkat kedua kaki lurus hingga tegak lurus 90 derajat.',
      'Turunkan perlahan hingga beberapa sentimeter di atas lantai tanpa menyentuh.',
    ],
    [
      'Punggung bawah melengkung terangkat dari matras saat kaki turun.',
      'Mengayunkan kaki dengan momentum.',
    ]
  ),
  russian_twists: makeExercise(
    'russian_twists',
    'Russian Twists',
    ['abs'],
    ['shoulders'],
    3,
    '20',
    45,
    0,
    'Pemula',
    [
      'Duduk membentuk sudut 45 derajat dengan punggung lurus dan perut dikencangkan.',
      'Putar bahu dan dada ke kiri dan kanan secara penuh, bukan hanya menggerakkan tangan.',
      'Jaga keseimbangan pinggul tetap stabil di atas matras.',
    ],
    [
      'Hanya mengetukkan tangan ke samping tanpa memutar batang tubuh (obliques).',
      'Membungkukkan punggung secara berlebihan.',
    ]
  ),
  plank: makeExercise(
    'plank',
    'Plank Hold',
    ['abs'],
    ['shoulders', 'glutes', 'quads'],
    3,
    '60 dtk',
    45,
    0,
    'Pemula',
    [
      'Letakkan siku tepat di bawah bahu dan bentuk garis lurus dari kepala ke tumit.',
      'Kencangkan otot perut, bokong, dan paha depan secara bersamaan.',
      'Bernapas secara teratur dan tarik siku seolah mendekati ujung kaki.',
    ],
    [
      'Pinggul turun melengkung yang menekan tulang belakang bawah.',
      'Mengangkat bokong terlalu tinggi ke atas.',
    ]
  ),
  mountain_climbers: makeExercise(
    'mountain_climbers',
    'Mountain Climbers',
    ['abs', 'quads'],
    ['shoulders', 'calves'],
    3,
    '30 dtk',
    45,
    0,
    'Menengah',
    [
      'Pertahankan bahu tepat di atas pergelangan tangan dalam posisi high plank.',
      'Tarik lutut bergantian ke arah dada dengan ritme cepat namun terkontrol.',
      'Jaga pinggul tetap rendah sejajar bahu.',
    ],
    [
      'Pinggul memantul tinggi naik-turun.',
      'Bahu mundur jauh ke belakang pergelangan tangan.',
    ]
  ),
  burpees: makeExercise(
    'burpees',
    'Burpees',
    ['quads', 'chest', 'abs'],
    ['shoulders', 'calves', 'glutes'],
    3,
    '15',
    60,
    0,
    'Lanjutan',
    [
      'Turun squat, letakkan tangan di lantai, dan lompatkan kaki ke posisi plank.',
      'Lakukan 1 push-up penuh, lompatkan kaki kembali mendekati tangan.',
      'Melompat eksplosif ke atas sambil menepuk tangan di atas kepala.',
    ],
    [
      'Pinggul melengkung jatuh saat mendarat di posisi plank.',
      'Mendarat dengan kaki jinjit sehingga lutut terbebani.',
    ]
  ),
  running_cardio: makeExercise(
    'running_cardio',
    'Running / Cycling 20 Menit',
    ['quads', 'calves'],
    ['hamstrings', 'glutes', 'abs'],
    1,
    '20 mnt',
    60,
    0,
    'Pemula',
    [
      'Jaga postur tubuh tegak dengan ayunan lengan rileks 90 derajat.',
      'Pertahankan detak jantung pada Zona 2–3 (bisa berbicara kalimat pendek).',
      'Gunakan fitur GPS Run Tracker FitForge untuk mencatat pace & split.',
    ],
    [
      'Melangkah terlalu panjang (overstriding) dengan tumit menghantam keras.',
      'Memulai lari terlalu cepat di kilometer pertama.',
    ]
  ),

  // === SUNDAY: RECOVERY ===
  stretching_flow: makeExercise(
    'stretching_flow',
    'Full-Body Stretching',
    ['hamstrings', 'back_lats'],
    ['chest', 'shoulders', 'quads'],
    1,
    '15 mnt',
    30,
    0,
    'Pemula',
    [
      'Tahan setiap posisi peregangan statis selama 30–45 detik sambil bernapas dalam.',
      'Fokus pada area yang kaku setelah latihan seminggu: dada, hip flexor, dan hamstring.',
      'Hindari memantulkan tubuh saat meregangkan otot.',
    ],
    [
      'Memaksa regangan hingga terasa nyeri tajam.',
      'Menahan napas sehingga otot tetap tegang.',
    ]
  ),
  brisk_walk: makeExercise(
    'brisk_walk',
    'Walking 30 Menit',
    ['calves', 'quads'],
    ['glutes', 'hamstrings'],
    1,
    '30 mnt',
    30,
    0,
    'Pemula',
    [
      'Jalan cepat santai di luar ruangan untuk melancarkan aliran darah pemulihan (active recovery).',
      'Bantu capai target Golden Rule 8.000–10.000 langkah harian.',
      'Jaga bahu rileks dan nikmati ritme pernapasan hidung.',
    ],
    [
      'Membungkuk menatap layar ponsel sepanjang jalan.',
      'Memakai alas kaki yang tidak mendukung lengkungan kaki.',
    ]
  ),
  mobility_work: makeExercise(
    'mobility_work',
    'Mobility Work',
    ['shoulders', 'glutes'],
    ['back_lats', 'hamstrings'],
    1,
    '15 mnt',
    30,
    0,
    'Pemula',
    [
      'Lakukan rotasi sendi terkontrol (CARs) pada bahu, tulang belakang toraks, dan panggul.',
      'Gunakan gerakan World’s Greatest Stretch dan Cat-Cow perlahan.',
      'Utamakan rentang gerak yang mulus di setiap sendi.',
    ],
    [
      'Terburu-buru menyelesaikan gerakan mobilitas.',
      'Mengabaikan sisi tubuh yang terasa lebih kaku.',
    ]
  ),
  recovery_sleep: makeExercise(
    'recovery_sleep',
    'Recovery & Sleep (7–9 Jam)',
    ['abs', 'back_lats'],
    [],
    1,
    '7–9 jam',
    0,
    0,
    'Pemula',
    [
      'Matikan layar terang 45 menit sebelum jadwal tidur untuk mengoptimalkan melatonin.',
      'Pastikan kebutuhan protein harian 1.6–2.2 g/kg dan hidrasi 3–4 L sudah terpenuhi.',
      'Aktifkan Alarm Bangun di halaman Jadwal untuk bangun tepat waktu.',
    ],
    [
      'Konsumsi kafein kurang dari 6 jam sebelum waktu tidur.',
      'Jam tidur dan bangun berubah drastis di akhir pekan.',
    ]
  ),
};
