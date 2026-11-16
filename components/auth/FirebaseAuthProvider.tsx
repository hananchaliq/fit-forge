'use client';

import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  auth,
  db,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
} from '@/lib/firebase';
import { ensureOrSyncUserDocument } from '@/lib/firestoreSync';
import { useFitForgeStore } from '@/store/useFitForgeStore';

export function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  const setAuthSession = useFitForgeStore((s) => s.setAuthSession);
  const setGuideOpen = useFitForgeStore((s) => s.setGuideOpen);
  const hydrateUserFromFirestore = useFitForgeStore((s) => s.hydrateUserFromFirestore);
  const hydrateRunsFromFirestore = useFitForgeStore((s) => s.hydrateRunsFromFirestore);
  const hydrateWorkoutsFromFirestore = useFitForgeStore((s) => s.hydrateWorkoutsFromFirestore);
  const hydrateNutritionFromFirestore = useFitForgeStore((s) => s.hydrateNutritionFromFirestore);

  useEffect(() => {
    // Remove legacy dummy-data storage key if present
    try {
      window.localStorage.removeItem('fitforge-storage-v1');
    } catch {
      // ignore storage errors
    }

    void testFirestoreConnection();

    let unsubUser: (() => void) | null = null;
    let unsubRuns: (() => void) | null = null;
    let unsubWorkouts: (() => void) | null = null;
    let unsubNutrition: (() => void) | null = null;

    const cleanupListeners = () => {
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }
      if (unsubRuns) {
        unsubRuns();
        unsubRuns = null;
      }
      if (unsubWorkouts) {
        unsubWorkouts();
        unsubWorkouts = null;
      }
      if (unsubNutrition) {
        unsubNutrition();
        unsubNutrition = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      cleanupListeners();

      if (!user) {
        setAuthSession(null);
        return;
      }

      const uid = user.uid;
      setAuthSession(uid, user.email, user.displayName);

      const userPath = `users/${uid}`;
      const userRef = doc(db, 'users', uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const currentState = useFitForgeStore.getState();
          await ensureOrSyncUserDocument(uid, {
            profile: {
              ...currentState.profile,
              id: uid,
              email: user.email || '',
              displayName:
                user.displayName || user.email?.split('@')[0] || 'Atlet FitForge',
            },
            onboardingComplete: false,
            guideDismissed: false,
            planMode: currentState.planMode,
            waterMl: 0,
            streakDays: 0,
            goldenRules: {
              protein: false,
              water: false,
              sleep: false,
              overload: false,
              steps: false,
            },
            prayersCompleted: {
              subuh: false,
              dzuhur: false,
              ashar: false,
              maghrib: false,
              isya: false,
            },
            scheduleConfig: currentState.scheduleConfig,
          });
          setGuideOpen(true);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath);
      }

      // 1. Real-time listener on /users/{uid}
      unsubUser = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            hydrateUserFromFirestore(docSnap.data() as Record<string, unknown>);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, userPath);
        }
      );

      // 2. Real-time listener on /users/{uid}/runs (with ownerId where clause for Pillar 8)
      const runsPath = `users/${uid}/runs`;
      const runsQuery = query(
        collection(db, 'users', uid, 'runs'),
        where('ownerId', '==', uid)
      );
      unsubRuns = onSnapshot(
        runsQuery,
        (querySnap) => {
          const docs = querySnap.docs.map((d) => ({
            id: d.id,
            data: d.data() as Record<string, unknown>,
          }));
          hydrateRunsFromFirestore(docs);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, runsPath);
        }
      );

      // 3. Real-time listener on /users/{uid}/workouts
      const workoutsPath = `users/${uid}/workouts`;
      const workoutsQuery = query(
        collection(db, 'users', uid, 'workouts'),
        where('ownerId', '==', uid)
      );
      unsubWorkouts = onSnapshot(
        workoutsQuery,
        (querySnap) => {
          const docs = querySnap.docs.map((d) => ({
            id: d.id,
            data: d.data() as Record<string, unknown>,
          }));
          hydrateWorkoutsFromFirestore(docs);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, workoutsPath);
        }
      );

      // 4. Real-time listener on /users/{uid}/nutrition
      const nutritionPath = `users/${uid}/nutrition`;
      const nutritionQuery = query(
        collection(db, 'users', uid, 'nutrition'),
        where('ownerId', '==', uid)
      );
      unsubNutrition = onSnapshot(
        nutritionQuery,
        (querySnap) => {
          const docs = querySnap.docs.map((d) => ({
            id: d.id,
            data: d.data() as Record<string, unknown>,
          }));
          hydrateNutritionFromFirestore(docs);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, nutritionPath);
        }
      );
    });

    return () => {
      cleanupListeners();
      unsubAuth();
    };
  }, [
    setAuthSession,
    setGuideOpen,
    hydrateUserFromFirestore,
    hydrateRunsFromFirestore,
    hydrateWorkoutsFromFirestore,
    hydrateNutritionFromFirestore,
  ]);

  return <>{children}</>;
}
