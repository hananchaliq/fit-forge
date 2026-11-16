import type { KmSplit } from '@/lib/haversine';
import type { PrayerKey } from '@/lib/prayer';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  weightKg: number;
  heightCm: number;
  goal: 'Membangun Otot & Rekomposisi' | 'Membakar Lemak & Definisi' | 'Performa Lari & Daya Tahan';
  wakeTime: string;
  sleepTime: string;
  city: string;
  lat: number;
  lng: number;
  prayerMethod: number;
  dailyCalorieTarget: number;
  dailyProteinTargetG: number;
  dailyWaterTargetMl: number;
}

export interface RunSessionRecord {
  id: string;
  title: string;
  startedAt: string;
  durationSec: number;
  distanceM: number;
  avgPaceSecKm: number;
  elevationGainM: number;
  caloriesKcal: number;
  polyline: Array<{ lat: number; lng: number }>;
  splits: KmSplit[];
}

export interface WorkoutRecord {
  id: string;
  dayKey: string;
  title: string;
  mode: 'gym' | 'home';
  startedAt: string;
  finishedAt: string;
  durationMin: number;
  totalVolumeKg: number;
  totalReps: number;
  setsCompleted: number;
}

export interface NutritionLogItem {
  id: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  portionEstimate: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  healthScore: number;
  tips: string;
  loggedAt: string;
}

export interface WeeklyPerformancePoint {
  day: string;
  dateLabel: string;
  runKm: number;
  caloriesBurned: number;
  workoutVolumeKg: number;
  proteinG: number;
  caloriesIn: number;
}

export const INITIAL_ZERO_PROFILE: UserProfile = {
  id: '',
  displayName: 'Atlet FitForge',
  email: '',
  weightKg: 70,
  heightCm: 170,
  goal: 'Membangun Otot & Rekomposisi',
  wakeTime: '05:00',
  sleepTime: '22:00',
  city: 'Jakarta Selatan',
  lat: -6.2183,
  lng: 106.8025,
  prayerMethod: 20,
  dailyCalorieTarget: 2200,
  dailyProteinTargetG: 140,
  dailyWaterTargetMl: 3000,
};

// Backwards-compatible alias pointing to clean initial profile
export const DEMO_PROFILE: UserProfile = INITIAL_ZERO_PROFILE;

// Gelora Bung Karno (GBK) Senayan loop GPS coordinates for optional desktop route testing
export const GBK_LOOP_COORDS: Array<{ lat: number; lng: number }> = [
  { lat: -6.2186, lng: 106.8018 },
  { lat: -6.2175, lng: 106.8012 },
  { lat: -6.2162, lng: 106.8019 },
  { lat: -6.2156, lng: 106.8032 },
  { lat: -6.2161, lng: 106.8047 },
  { lat: -6.2173, lng: 106.8054 },
  { lat: -6.2188, lng: 106.8051 },
  { lat: -6.2198, lng: 106.8039 },
  { lat: -6.2195, lng: 106.8024 },
  { lat: -6.2186, lng: 106.8018 },
];

export function createZeroWeeklyPerformance(): WeeklyPerformancePoint[] {
  return [
    { day: 'Sen', dateLabel: 'Senin', runKm: 0, caloriesBurned: 0, workoutVolumeKg: 0, proteinG: 0, caloriesIn: 0 },
    { day: 'Sel', dateLabel: 'Selasa', runKm: 0, caloriesBurned: 0, workoutVolumeKg: 0, proteinG: 0, caloriesIn: 0 },
    { day: 'Rab', dateLabel: 'Rabu', runKm: 0, caloriesBurned: 0, workoutVolumeKg: 0, proteinG: 0, caloriesIn: 0 },
    { day: 'Kam', dateLabel: 'Kamis', runKm: 0, caloriesBurned: 0, workoutVolumeKg: 0, proteinG: 0, caloriesIn: 0 },
    { day: 'Jum', dateLabel: 'Jumat', runKm: 0, caloriesBurned: 0, workoutVolumeKg: 0, proteinG: 0, caloriesIn: 0 },
    { day: 'Sab', dateLabel: 'Sabtu', runKm: 0, caloriesBurned: 0, workoutVolumeKg: 0, proteinG: 0, caloriesIn: 0 },
    { day: 'Min', dateLabel: 'Minggu', runKm: 0, caloriesBurned: 0, workoutVolumeKg: 0, proteinG: 0, caloriesIn: 0 },
  ];
}

export const DEMO_WEEKLY_PERFORMANCE: WeeklyPerformancePoint[] = createZeroWeeklyPerformance();

export const DEMO_MONTHLY_WEEKS = [
  { weekLabel: 'Minggu 1', runKm: 0, workouts: 0, avgProtein: 0, avgCalories: 0, volumeKg: 0 },
  { weekLabel: 'Minggu 2', runKm: 0, workouts: 0, avgProtein: 0, avgCalories: 0, volumeKg: 0 },
  { weekLabel: 'Minggu 3', runKm: 0, workouts: 0, avgProtein: 0, avgCalories: 0, volumeKg: 0 },
  { weekLabel: 'Minggu Ini', runKm: 0, workouts: 0, avgProtein: 0, avgCalories: 0, volumeKg: 0 },
];

export const DEMO_RUN_SESSIONS: RunSessionRecord[] = [];

export const DEMO_WORKOUTS: WorkoutRecord[] = [];

export const DEMO_NUTRITION_LOGS: NutritionLogItem[] = [];

export const INDONESIAN_HIGH_PROTEIN_SUGGESTIONS = [
  { name: 'Dada Ayam Fillet Panggang (150g)', proteinG: 45, kcal: 248 },
  { name: 'Tempe Panggang / Kukus (150g)', proteinG: 28, kcal: 290 },
  { name: 'Ikan Tongkol / Tuna Bumbu Kuning (150g)', proteinG: 39, kcal: 210 },
  { name: '3 Putih Telur + 1 Telur Utuh Rebus', proteinG: 17, kcal: 128 },
  { name: 'Edamame Rebus Hangat (150g)', proteinG: 18, kcal: 185 },
];

export const DEFAULT_PRAYER_COMPLETION: Record<PrayerKey, boolean> = {
  subuh: false,
  dzuhur: false,
  ashar: false,
  maghrib: false,
  isya: false,
};

export const DEFAULT_GOLDEN_RULES_STATE = {
  protein: false,
  water: false,
  sleep: false,
  overload: false,
  steps: false,
};
