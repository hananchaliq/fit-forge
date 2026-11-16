import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import type {
  UserProfile,
  RunSessionRecord,
  WorkoutRecord,
  NutritionLogItem,
} from '@/data/demoData';
import type { PrayerKey } from '@/lib/prayer';

export interface FirestoreUserSyncState {
  profile: UserProfile;
  onboardingComplete: boolean;
  guideDismissed: boolean;
  planMode: 'gym' | 'home';
  waterMl: number;
  streakDays: number;
  goldenRules: {
    protein: boolean;
    water: boolean;
    sleep: boolean;
    overload: boolean;
    steps: boolean;
  };
  prayersCompleted: Record<PrayerKey, boolean>;
  scheduleConfig: {
    wakeAlarmEnabled: boolean;
    wakeAlarmTime: string;
    prayerToggles: Record<PrayerKey, boolean>;
    hydrationEnabled: boolean;
    hydrationIntervalMin: number;
    quietStart: string;
    quietEnd: string;
  };
}

function clampStr(val: string | undefined, fallback: string, maxLen: number): string {
  const s = (val || fallback).trim();
  return (s.length > 0 ? s : fallback).slice(0, maxLen);
}

function clampNum(val: number | undefined, fallback: number, min: number, max: number): number {
  const n = typeof val === 'number' && !Number.isNaN(val) ? val : fallback;
  return Math.max(min, Math.min(max, n));
}

function parseHour(timeStr: string, fallback: number): number {
  const parts = (timeStr || '').split(':');
  const h = parseInt(parts[0] || '', 10);
  return Number.isNaN(h) ? fallback : Math.max(0, Math.min(23, h));
}

export function buildUserPayloadForFirestore(uid: string, state: FirestoreUserSyncState) {
  return {
    ownerId: uid,
    displayName: clampStr(state.profile.displayName, 'Atlet FitForge', 100),
    weightKg: clampNum(state.profile.weightKg, 70, 20, 300),
    heightCm: clampNum(state.profile.heightCm, 170, 80, 250),
    goal: clampStr(state.profile.goal, 'Membangun Otot & Rekomposisi', 100),
    wakeTime: clampStr(state.profile.wakeTime, '05:00', 10),
    sleepTime: clampStr(state.profile.sleepTime, '22:00', 10),
    city: clampStr(state.profile.city, 'Jakarta Selatan', 100),
    lat: clampNum(state.profile.lat, -6.2183, -90, 90),
    lng: clampNum(state.profile.lng, 106.8025, -180, 180),
    prayerMethod: clampNum(state.profile.prayerMethod, 20, 0, 99),
    dailyCalorieTarget: clampNum(state.profile.dailyCalorieTarget, 2200, 800, 10000),
    dailyProteinTargetG: clampNum(state.profile.dailyProteinTargetG, 140, 20, 500),
    dailyWaterTargetMl: clampNum(state.profile.dailyWaterTargetMl, 3000, 500, 12000),
    onboardingComplete: Boolean(state.onboardingComplete),
    guideDismissed: Boolean(state.guideDismissed),
    planMode: state.planMode === 'home' ? 'home' : 'gym',
    waterMl: clampNum(state.waterMl, 0, 0, 20000),
    streakDays: clampNum(state.streakDays, 0, 0, 36500),
    goldenRules: {
      highProtein: Boolean(state.goldenRules.protein),
      water3to4L: Boolean(state.goldenRules.water),
      sleep7to9h: Boolean(state.goldenRules.sleep),
      progressiveOverload: Boolean(state.goldenRules.overload),
      steps8to10k: Boolean(state.goldenRules.steps),
    },
    prayersCompleted: {
      subuh: Boolean(state.prayersCompleted.subuh),
      dzuhur: Boolean(state.prayersCompleted.dzuhur),
      ashar: Boolean(state.prayersCompleted.ashar),
      maghrib: Boolean(state.prayersCompleted.maghrib),
      isya: Boolean(state.prayersCompleted.isya),
    },
    scheduleConfig: {
      wakeAlarmEnabled: Boolean(state.scheduleConfig.wakeAlarmEnabled),
      wakeAlarmTime: clampStr(state.scheduleConfig.wakeAlarmTime, '05:00', 10),
      hydrationHourlyEnabled: Boolean(state.scheduleConfig.hydrationEnabled),
      startHour: parseHour(state.scheduleConfig.quietEnd, 5),
      endHour: parseHour(state.scheduleConfig.quietStart, 22),
      prayerToggles: {
        subuh: Boolean(state.scheduleConfig.prayerToggles.subuh),
        dzuhur: Boolean(state.scheduleConfig.prayerToggles.dzuhur),
        ashar: Boolean(state.scheduleConfig.prayerToggles.ashar),
        maghrib: Boolean(state.scheduleConfig.prayerToggles.maghrib),
        isya: Boolean(state.scheduleConfig.prayerToggles.isya),
      },
    },
  };
}

export async function ensureOrSyncUserDocument(
  uid: string,
  state: FirestoreUserSyncState
): Promise<void> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const payload = buildUserPayloadForFirestore(uid, state);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const { ownerId: _ignoreOwner, ...updatableFields } = payload;
      await updateDoc(ref, {
        ...updatableFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveRunSessionToFirestore(
  uid: string,
  session: RunSessionRecord
): Promise<void> {
  const safeId = session.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || `run-${Date.now()}`;
  const path = `users/${uid}/runs/${safeId}`;
  const dateIso = clampStr(session.startedAt.slice(0, 10), new Date().toISOString().slice(0, 10), 32);
  try {
    await setDoc(doc(collection(db, 'users', uid, 'runs'), safeId), {
      ownerId: uid,
      title: clampStr(session.title, 'Sesi Lari GPS', 160),
      dateIso,
      distanceKm: clampNum(Number((session.distanceM / 1000).toFixed(2)), 0, 0, 500),
      durationSec: clampNum(Math.round(session.durationSec), 0, 0, 864000),
      avgPaceSecPerKm: clampNum(Math.round(session.avgPaceSecKm), 0, 0, 10000),
      caloriesBurned: clampNum(Math.round(session.caloriesKcal), 0, 0, 50000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveWorkoutRecordToFirestore(
  uid: string,
  workout: WorkoutRecord
): Promise<void> {
  const safeId = workout.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || `wo-${Date.now()}`;
  const path = `users/${uid}/workouts/${safeId}`;
  const dateIso = clampStr(workout.startedAt.slice(0, 10), new Date().toISOString().slice(0, 10), 32);
  try {
    await setDoc(doc(collection(db, 'users', uid, 'workouts'), safeId), {
      ownerId: uid,
      exerciseId: clampStr(workout.id, 'pushup', 80),
      exerciseName: clampStr(workout.title, 'Latihan Beban 3D', 120),
      dayKey: clampStr(workout.dayKey, 'mon', 20),
      setsCompleted: clampNum(Math.round(workout.setsCompleted), 1, 1, 100),
      repsPerSet: clampStr(`${workout.totalReps} total reps`, '10-12', 30),
      volumeKg: clampNum(Math.round(workout.totalVolumeKg), 0, 0, 500000),
      durationSec: clampNum(Math.round(workout.durationMin * 60), 0, 0, 86400),
      dateIso,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveNutritionLogToFirestore(
  uid: string,
  item: NutritionLogItem
): Promise<void> {
  const safeId = item.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100) || `meal-${Date.now()}`;
  const path = `users/${uid}/nutrition/${safeId}`;
  const dateIso = new Date().toISOString().slice(0, 10);
  try {
    await setDoc(doc(collection(db, 'users', uid, 'nutrition'), safeId), {
      ownerId: uid,
      mealName: clampStr(item.foodName, 'Makanan Harian', 160),
      timeStr: clampStr(item.loggedAt, '12:00', 16),
      dateIso,
      caloriesKcal: clampNum(Math.round(item.caloriesKcal), 0, 0, 20000),
      proteinG: clampNum(Math.round(item.proteinG), 0, 0, 2000),
      carbsG: clampNum(Math.round(item.carbsG), 0, 0, 3000),
      fatG: clampNum(Math.round(item.fatG), 0, 0, 2000),
      fiberG: clampNum(Math.round(item.fiberG), 0, 0, 1000),
      healthScore: clampNum(Math.round(item.healthScore), 5, 0, 10),
      saran_AI: clampStr(item.tips, 'Pertahankan keseimbangan makronutrisi harian.', 600),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteRunSessionFromFirestore(
  uid: string,
  runId: string
): Promise<void> {
  const safeId = runId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
  const path = `users/${uid}/runs/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'runs', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteWorkoutRecordFromFirestore(
  uid: string,
  workoutId: string
): Promise<void> {
  const safeId = workoutId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
  const path = `users/${uid}/workouts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'workouts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteNutritionLogFromFirestore(
  uid: string,
  mealId: string
): Promise<void> {
  const safeId = mealId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
  const path = `users/${uid}/nutrition/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'nutrition', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
