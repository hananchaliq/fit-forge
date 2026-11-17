'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  INITIAL_ZERO_PROFILE,
  DEFAULT_PRAYER_COMPLETION,
  DEFAULT_GOLDEN_RULES_STATE,
  createZeroWeeklyPerformance,
  GBK_LOOP_COORDS,
  type UserProfile,
  type RunSessionRecord,
  type WorkoutRecord,
  type NutritionLogItem,
  type WeeklyPerformancePoint,
} from '@/data/demoData';
import type { DayKey } from '@/data/weeklyPlan';
import type { PrayerKey } from '@/lib/prayer';
import {
  ensureOrSyncUserDocument,
  saveRunSessionToFirestore,
  saveWorkoutRecordToFirestore,
  saveNutritionLogToFirestore,
  deleteRunSessionFromFirestore,
  deleteWorkoutRecordFromFirestore,
  deleteNutritionLogFromFirestore,
} from '@/lib/firestoreSync';

export interface ScheduleConfig {
  wakeAlarmEnabled: boolean;
  wakeAlarmTime: string;
  prayerToggles: Record<PrayerKey, boolean>;
  hydrationEnabled: boolean;
  hydrationIntervalMin: number;
  quietStart: string;
  quietEnd: string;
}

export interface FitForgeState {
  firebaseUid: string | null;
  authReady: boolean;
  isAuthenticated: boolean;
  isLocalVercelAuth: boolean;
  hasCompletedOnboarding: boolean;
  guideOpen: boolean;
  guideDismissed: boolean;

  profile: UserProfile;
  darkMode: boolean;
  planMode: 'gym' | 'home';
  selectedDayKey: DayKey;
  selectedExerciseId: string;

  // Daily Habit & Golden Rules (all start at 0 / false)
  waterMl: number;
  stepsToday: number;
  sleepHoursToday: number;
  streakDays: number;
  goldenRules: {
    protein: boolean;
    water: boolean;
    sleep: boolean;
    overload: boolean;
    steps: boolean;
  };
  prayersCompleted: Record<PrayerKey, boolean>;

  // Records (all start empty [])
  runSessions: RunSessionRecord[];
  workouts: WorkoutRecord[];
  nutritionLogs: NutritionLogItem[];
  weeklyPerformance: WeeklyPerformancePoint[];

  // Schedule
  scheduleConfig: ScheduleConfig;

  // Auth & Cloud Hydration Actions
  setAuthSession: (uid: string | null, email?: string | null, displayName?: string | null) => void;
  loginWithVercelFallback: (displayName: string, email: string) => void;
  logoutAccount: () => void;
  setGuideOpen: (open: boolean) => void;
  dismissGuide: () => void;
  hydrateUserFromFirestore: (data: Record<string, unknown>) => void;
  hydrateRunsFromFirestore: (docs: Array<{ id: string; data: Record<string, unknown> }>) => void;
  hydrateWorkoutsFromFirestore: (docs: Array<{ id: string; data: Record<string, unknown> }>) => void;
  hydrateNutritionFromFirestore: (docs: Array<{ id: string; data: Record<string, unknown> }>) => void;

  // User Actions
  updateProfile: (partial: Partial<UserProfile>) => void;
  setAuthenticated: (val: boolean) => void;
  completeOnboarding: (partial: Partial<UserProfile>) => void;
  toggleDarkMode: () => void;
  setDarkMode: (val: boolean) => void;
  setPlanMode: (mode: 'gym' | 'home') => void;
  setSelectedDayKey: (day: DayKey) => void;
  setSelectedExerciseId: (id: string) => void;

  addWaterMl: (amount: number) => void;
  setWaterMl: (amount: number) => void;
  toggleGoldenRule: (key: keyof FitForgeState['goldenRules']) => void;
  checkInAllGoldenRules: () => void;
  togglePrayerCompleted: (key: PrayerKey) => void;

  addRunSession: (session: RunSessionRecord) => void;
  deleteRunSession: (id: string) => void;
  addWorkoutRecord: (workout: WorkoutRecord) => void;
  deleteWorkoutRecord: (id: string) => void;
  addNutritionLog: (log: NutritionLogItem) => void;
  deleteNutritionLog: (id: string) => void;
  updateScheduleConfig: (partial: Partial<ScheduleConfig>) => void;
  resetDemoData: () => void;
}

function getDayIndexFromIso(dateIso: string): number {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return 6;
  // JS getDay(): 0=Sun..6=Sat -> map to 0=Sen..6=Min
  const jsDay = parsed.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function recomputeWeeklyPerformance(
  runs: RunSessionRecord[],
  workouts: WorkoutRecord[],
  meals: NutritionLogItem[]
): WeeklyPerformancePoint[] {
  const base = createZeroWeeklyPerformance();
  for (const r of runs) {
    const idx = getDayIndexFromIso(r.startedAt);
    const km = Number((r.distanceM / 1000).toFixed(2));
    base[idx].runKm = Number((base[idx].runKm + km).toFixed(2));
    base[idx].caloriesBurned += r.caloriesKcal;
  }
  for (const w of workouts) {
    const idx = getDayIndexFromIso(w.startedAt);
    base[idx].workoutVolumeKg += w.totalVolumeKg;
    base[idx].caloriesBurned += w.durationMin * 7;
  }
  for (const m of meals) {
    // Meals logged today map to current weekday
    const idx = getDayIndexFromIso(new Date().toISOString());
    base[idx].proteinG += m.proteinG;
    base[idx].caloriesIn += m.caloriesKcal;
  }
  return base;
}

function syncUserToCloudIfAuthenticated(state: FitForgeState) {
  if (!state.firebaseUid) return;
  void ensureOrSyncUserDocument(state.firebaseUid, {
    profile: state.profile,
    onboardingComplete: state.hasCompletedOnboarding,
    guideDismissed: state.guideDismissed,
    planMode: state.planMode,
    waterMl: state.waterMl,
    streakDays: state.streakDays,
    goldenRules: state.goldenRules,
    prayersCompleted: state.prayersCompleted,
    scheduleConfig: state.scheduleConfig,
  });
}

const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  wakeAlarmEnabled: false,
  wakeAlarmTime: '05:00',
  prayerToggles: {
    subuh: true,
    dzuhur: true,
    ashar: true,
    maghrib: true,
    isya: true,
  },
  hydrationEnabled: true,
  hydrationIntervalMin: 60,
  quietStart: '22:00',
  quietEnd: '04:30',
};

export const useFitForgeStore = create<FitForgeState>()(
  persist(
    (set, get) => ({
      firebaseUid: null,
      authReady: false,
      isAuthenticated: false,
      isLocalVercelAuth: false,
      hasCompletedOnboarding: false,
      guideOpen: false,
      guideDismissed: false,

      profile: INITIAL_ZERO_PROFILE,
      darkMode: false,
      planMode: 'gym',
      selectedDayKey: 'mon',
      selectedExerciseId: 'pushup',

      waterMl: 0,
      stepsToday: 0,
      sleepHoursToday: 0,
      streakDays: 0,
      goldenRules: { ...DEFAULT_GOLDEN_RULES_STATE },
      prayersCompleted: { ...DEFAULT_PRAYER_COMPLETION },

      runSessions: [],
      workouts: [],
      nutritionLogs: [],
      weeklyPerformance: createZeroWeeklyPerformance(),

      scheduleConfig: DEFAULT_SCHEDULE_CONFIG,

      setAuthSession: (uid, email, displayName) =>
        set((state) => {
          if (!uid) {
            if (state.isLocalVercelAuth) {
              return {
                firebaseUid: null,
                authReady: true,
                isAuthenticated: true,
              };
            }
            return {
              firebaseUid: null,
              authReady: true,
              isAuthenticated: false,
              isLocalVercelAuth: false,
              hasCompletedOnboarding: false,
              profile: INITIAL_ZERO_PROFILE,
              waterMl: 0,
              stepsToday: 0,
              sleepHoursToday: 0,
              streakDays: 0,
              goldenRules: { ...DEFAULT_GOLDEN_RULES_STATE },
              prayersCompleted: { ...DEFAULT_PRAYER_COMPLETION },
              runSessions: [],
              workouts: [],
              nutritionLogs: [],
              weeklyPerformance: createZeroWeeklyPerformance(),
            };
          }
          return {
            firebaseUid: uid,
            authReady: true,
            isAuthenticated: true,
            isLocalVercelAuth: false,
            profile: {
              ...state.profile,
              id: uid,
              email: email || state.profile.email || '',
              displayName:
                displayName ||
                (state.profile.displayName !== 'Atlet FitForge'
                  ? state.profile.displayName
                  : email?.split('@')[0] || 'Atlet FitForge'),
            },
          };
        }),

      loginWithVercelFallback: (displayName, email) =>
        set((state) => {
          const cleanName = displayName.trim() || 'Atlet FitForge';
          const cleanEmail = email.trim() || 'atlet@fitforge.id';
          return {
            firebaseUid: null,
            authReady: true,
            isAuthenticated: true,
            isLocalVercelAuth: true,
            guideOpen: !state.guideDismissed,
            profile: {
              ...state.profile,
              id: `vercel-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'user'}`,
              displayName: cleanName,
              email: cleanEmail,
            },
          };
        }),

      logoutAccount: () =>
        set(() => ({
          firebaseUid: null,
          authReady: true,
          isAuthenticated: false,
          isLocalVercelAuth: false,
          hasCompletedOnboarding: false,
          profile: INITIAL_ZERO_PROFILE,
          waterMl: 0,
          stepsToday: 0,
          sleepHoursToday: 0,
          streakDays: 0,
          goldenRules: { ...DEFAULT_GOLDEN_RULES_STATE },
          prayersCompleted: { ...DEFAULT_PRAYER_COMPLETION },
          runSessions: [],
          workouts: [],
          nutritionLogs: [],
          weeklyPerformance: createZeroWeeklyPerformance(),
        })),

      setGuideOpen: (open) => set({ guideOpen: open }),

      dismissGuide: () => {
        set({ guideOpen: false, guideDismissed: true });
        syncUserToCloudIfAuthenticated(get());
      },

      hydrateUserFromFirestore: (data) =>
        set((state) => {
          const gr = (data.goldenRules as Record<string, boolean> | undefined) || {};
          const pr = (data.prayersCompleted as Record<string, boolean> | undefined) || {};
          const sc = (data.scheduleConfig as Record<string, unknown> | undefined) || {};
          const pt = (sc.prayerToggles as Record<PrayerKey, boolean> | undefined) || {
            subuh: true,
            dzuhur: true,
            ashar: true,
            maghrib: true,
            isya: true,
          };
          const guideDismissed = Boolean(data.guideDismissed);
          return {
            hasCompletedOnboarding: Boolean(data.onboardingComplete),
            guideDismissed,
            guideOpen: !guideDismissed ? true : state.guideOpen,
            planMode: data.planMode === 'home' ? 'home' : 'gym',
            waterMl: typeof data.waterMl === 'number' ? data.waterMl : 0,
            streakDays: typeof data.streakDays === 'number' ? data.streakDays : 0,
            profile: {
              ...state.profile,
              displayName:
                typeof data.displayName === 'string' && data.displayName
                  ? data.displayName
                  : state.profile.displayName,
              weightKg: typeof data.weightKg === 'number' ? data.weightKg : 70,
              heightCm: typeof data.heightCm === 'number' ? data.heightCm : 170,
              goal:
                (data.goal as UserProfile['goal']) || 'Membangun Otot & Rekomposisi',
              wakeTime: typeof data.wakeTime === 'string' ? data.wakeTime : '05:00',
              sleepTime: typeof data.sleepTime === 'string' ? data.sleepTime : '22:00',
              city: typeof data.city === 'string' ? data.city : 'Jakarta Selatan',
              lat: typeof data.lat === 'number' ? data.lat : -6.2183,
              lng: typeof data.lng === 'number' ? data.lng : 106.8025,
              prayerMethod: typeof data.prayerMethod === 'number' ? data.prayerMethod : 20,
              dailyCalorieTarget:
                typeof data.dailyCalorieTarget === 'number' ? data.dailyCalorieTarget : 2200,
              dailyProteinTargetG:
                typeof data.dailyProteinTargetG === 'number' ? data.dailyProteinTargetG : 140,
              dailyWaterTargetMl:
                typeof data.dailyWaterTargetMl === 'number' ? data.dailyWaterTargetMl : 3000,
            },
            goldenRules: {
              protein: Boolean(gr.highProtein),
              water: Boolean(gr.water3to4L),
              sleep: Boolean(gr.sleep7to9h),
              overload: Boolean(gr.progressiveOverload),
              steps: Boolean(gr.steps8to10k),
            },
            prayersCompleted: {
              subuh: Boolean(pr.subuh),
              dzuhur: Boolean(pr.dzuhur),
              ashar: Boolean(pr.ashar),
              maghrib: Boolean(pr.maghrib),
              isya: Boolean(pr.isya),
            },
            scheduleConfig: {
              ...state.scheduleConfig,
              wakeAlarmEnabled: Boolean(sc.wakeAlarmEnabled),
              wakeAlarmTime:
                typeof sc.wakeAlarmTime === 'string' ? sc.wakeAlarmTime : '05:00',
              hydrationEnabled:
                typeof sc.hydrationHourlyEnabled === 'boolean'
                  ? sc.hydrationHourlyEnabled
                  : true,
              prayerToggles: pt,
            },
          };
        }),

      hydrateRunsFromFirestore: (docs) =>
        set((state) => {
          const runs: RunSessionRecord[] = docs.map(({ id, data }) => {
            const distKm = typeof data.distanceKm === 'number' ? data.distanceKm : 0;
            const dateIso =
              typeof data.dateIso === 'string'
                ? data.dateIso
                : new Date().toISOString().slice(0, 10);
            return {
              id,
              title: typeof data.title === 'string' ? data.title : 'Sesi Lari GPS',
              startedAt: `${dateIso}T06:00:00`,
              durationSec: typeof data.durationSec === 'number' ? data.durationSec : 0,
              distanceM: Math.round(distKm * 1000),
              avgPaceSecKm:
                typeof data.avgPaceSecPerKm === 'number' ? data.avgPaceSecPerKm : 0,
              elevationGainM: 0,
              caloriesKcal:
                typeof data.caloriesBurned === 'number' ? data.caloriesBurned : 0,
              polyline: GBK_LOOP_COORDS,
              splits: [],
            };
          });
          return {
            runSessions: runs,
            weeklyPerformance: recomputeWeeklyPerformance(
              runs,
              state.workouts,
              state.nutritionLogs
            ),
          };
        }),

      hydrateWorkoutsFromFirestore: (docs) =>
        set((state) => {
          const workouts: WorkoutRecord[] = docs.map(({ id, data }) => {
            const durSec = typeof data.durationSec === 'number' ? data.durationSec : 0;
            const dateIso =
              typeof data.dateIso === 'string'
                ? data.dateIso
                : new Date().toISOString().slice(0, 10);
            return {
              id,
              dayKey: typeof data.dayKey === 'string' ? data.dayKey : 'mon',
              title:
                typeof data.exerciseName === 'string'
                  ? data.exerciseName
                  : 'Sesi Latihan 3D',
              mode: state.planMode,
              startedAt: `${dateIso}T07:00:00`,
              finishedAt: `${dateIso}T07:45:00`,
              durationMin: Math.max(1, Math.round(durSec / 60)),
              totalVolumeKg: typeof data.volumeKg === 'number' ? data.volumeKg : 0,
              totalReps: 12,
              setsCompleted:
                typeof data.setsCompleted === 'number' ? data.setsCompleted : 1,
            };
          });
          return {
            workouts,
            weeklyPerformance: recomputeWeeklyPerformance(
              state.runSessions,
              workouts,
              state.nutritionLogs
            ),
          };
        }),

      hydrateNutritionFromFirestore: (docs) =>
        set((state) => {
          const meals: NutritionLogItem[] = docs.map(({ id, data }) => ({
            id,
            mealType: 'lunch',
            foodName: typeof data.mealName === 'string' ? data.mealName : 'Makanan Harian',
            portionEstimate: '1 porsi',
            caloriesKcal: typeof data.caloriesKcal === 'number' ? data.caloriesKcal : 0,
            proteinG: typeof data.proteinG === 'number' ? data.proteinG : 0,
            carbsG: typeof data.carbsG === 'number' ? data.carbsG : 0,
            fatG: typeof data.fatG === 'number' ? data.fatG : 0,
            fiberG: typeof data.fiberG === 'number' ? data.fiberG : 0,
            healthScore: typeof data.healthScore === 'number' ? data.healthScore : 8,
            tips:
              typeof data.saran_AI === 'string'
                ? data.saran_AI
                : 'Pertahankan keseimbangan nutrisi harian.',
            loggedAt: typeof data.timeStr === 'string' ? data.timeStr : '12:00',
          }));
          return {
            nutritionLogs: meals,
            weeklyPerformance: recomputeWeeklyPerformance(
              state.runSessions,
              state.workouts,
              meals
            ),
          };
        }),

      updateProfile: (partial) => {
        set((state) => ({ profile: { ...state.profile, ...partial } }));
        syncUserToCloudIfAuthenticated(get());
      },

      setAuthenticated: (val) => set({ isAuthenticated: val }),

      completeOnboarding: (partial) => {
        set((state) => ({
          profile: { ...state.profile, ...partial },
          isAuthenticated: true,
          hasCompletedOnboarding: true,
        }));
        syncUserToCloudIfAuthenticated(get());
      },

      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next);
          }
          return { darkMode: next };
        }),

      setDarkMode: (val) =>
        set(() => {
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', val);
          }
          return { darkMode: val };
        }),

      setPlanMode: (mode) => {
        set({ planMode: mode });
        syncUserToCloudIfAuthenticated(get());
      },
      setSelectedDayKey: (day) => set({ selectedDayKey: day }),
      setSelectedExerciseId: (id) => set({ selectedExerciseId: id }),

      addWaterMl: (amount) => {
        set((state) => {
          const nextWater = Math.max(0, Math.min(12000, state.waterMl + amount));
          const waterRuleDone = nextWater >= state.profile.dailyWaterTargetMl;
          return {
            waterMl: nextWater,
            goldenRules: {
              ...state.goldenRules,
              water: waterRuleDone ? true : state.goldenRules.water,
            },
          };
        });
        syncUserToCloudIfAuthenticated(get());
      },

      setWaterMl: (amount) => {
        set({ waterMl: Math.max(0, amount) });
        syncUserToCloudIfAuthenticated(get());
      },

      toggleGoldenRule: (key) => {
        set((state) => {
          const nextRules = {
            ...state.goldenRules,
            [key]: !state.goldenRules[key],
          };
          const allDone = Object.values(nextRules).every(Boolean);
          return {
            goldenRules: nextRules,
            streakDays: allDone ? Math.max(1, state.streakDays) : state.streakDays,
          };
        });
        syncUserToCloudIfAuthenticated(get());
      },

      checkInAllGoldenRules: () => {
        set((state) => ({
          goldenRules: {
            protein: true,
            water: true,
            sleep: true,
            overload: true,
            steps: true,
          },
          waterMl: Math.max(state.profile.dailyWaterTargetMl, state.waterMl),
          stepsToday: Math.max(8000, state.stepsToday),
          sleepHoursToday: Math.max(7.5, state.sleepHoursToday),
          streakDays: state.streakDays + 1,
        }));
        syncUserToCloudIfAuthenticated(get());
      },

      togglePrayerCompleted: (key) => {
        set((state) => ({
          prayersCompleted: {
            ...state.prayersCompleted,
            [key]: !state.prayersCompleted[key],
          },
        }));
        syncUserToCloudIfAuthenticated(get());
      },

      addRunSession: (session) => {
        const uid = get().firebaseUid;
        set((state) => {
          const nextRuns = [session, ...state.runSessions];
          return {
            runSessions: nextRuns,
            weeklyPerformance: recomputeWeeklyPerformance(
              nextRuns,
              state.workouts,
              state.nutritionLogs
            ),
          };
        });
        if (uid) {
          void saveRunSessionToFirestore(uid, session);
        }
      },

      deleteRunSession: (id) => {
        const uid = get().firebaseUid;
        set((state) => {
          const nextRuns = state.runSessions.filter((r) => r.id !== id);
          return {
            runSessions: nextRuns,
            weeklyPerformance: recomputeWeeklyPerformance(
              nextRuns,
              state.workouts,
              state.nutritionLogs
            ),
          };
        });
        if (uid) {
          void deleteRunSessionFromFirestore(uid, id);
        }
      },

      addWorkoutRecord: (workout) => {
        const uid = get().firebaseUid;
        set((state) => {
          const nextWorkouts = [workout, ...state.workouts];
          return {
            workouts: nextWorkouts,
            weeklyPerformance: recomputeWeeklyPerformance(
              state.runSessions,
              nextWorkouts,
              state.nutritionLogs
            ),
            goldenRules: { ...state.goldenRules, overload: true },
          };
        });
        if (uid) {
          void saveWorkoutRecordToFirestore(uid, workout);
          syncUserToCloudIfAuthenticated(get());
        }
      },

      deleteWorkoutRecord: (id) => {
        const uid = get().firebaseUid;
        set((state) => {
          const nextWorkouts = state.workouts.filter((w) => w.id !== id);
          return {
            workouts: nextWorkouts,
            weeklyPerformance: recomputeWeeklyPerformance(
              state.runSessions,
              nextWorkouts,
              state.nutritionLogs
            ),
          };
        });
        if (uid) {
          void deleteWorkoutRecordFromFirestore(uid, id);
        }
      },

      addNutritionLog: (log) => {
        const uid = get().firebaseUid;
        set((state) => {
          const nextMeals = [log, ...state.nutritionLogs];
          const totalProtein = nextMeals.reduce((acc, m) => acc + m.proteinG, 0);
          return {
            nutritionLogs: nextMeals,
            weeklyPerformance: recomputeWeeklyPerformance(
              state.runSessions,
              state.workouts,
              nextMeals
            ),
            goldenRules: {
              ...state.goldenRules,
              protein:
                totalProtein >= state.profile.dailyProteinTargetG
                  ? true
                  : state.goldenRules.protein,
            },
          };
        });
        if (uid) {
          void saveNutritionLogToFirestore(uid, log);
          syncUserToCloudIfAuthenticated(get());
        }
      },

      deleteNutritionLog: (id) => {
        const uid = get().firebaseUid;
        set((state) => {
          const nextMeals = state.nutritionLogs.filter((item) => item.id !== id);
          return {
            nutritionLogs: nextMeals,
            weeklyPerformance: recomputeWeeklyPerformance(
              state.runSessions,
              state.workouts,
              nextMeals
            ),
          };
        });
        if (uid) {
          void deleteNutritionLogFromFirestore(uid, id);
        }
      },

      updateScheduleConfig: (partial) => {
        set((state) => ({
          scheduleConfig: { ...state.scheduleConfig, ...partial },
        }));
        syncUserToCloudIfAuthenticated(get());
      },

      resetDemoData: () => {
        set((state) => ({
          waterMl: 0,
          stepsToday: 0,
          sleepHoursToday: 0,
          streakDays: 0,
          goldenRules: { ...DEFAULT_GOLDEN_RULES_STATE },
          prayersCompleted: { ...DEFAULT_PRAYER_COMPLETION },
          runSessions: [],
          workouts: [],
          nutritionLogs: [],
          weeklyPerformance: createZeroWeeklyPerformance(),
          profile: {
            ...INITIAL_ZERO_PROFILE,
            id: state.firebaseUid || '',
            email: state.profile.email,
            displayName: state.profile.displayName,
          },
        }));
        syncUserToCloudIfAuthenticated(get());
      },
    }),
    {
      name: 'fitforge-cloud-zero-v2',
    }
  )
);
