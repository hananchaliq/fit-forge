/**
 * IndexedDB Crash-Recovery Store for GPS Run Tracker & Offline Sync Queue
 * Saves active run coordinates every 1 second so unfinished runs can be recovered.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { KmSplit } from './haversine';

export interface ActiveRunCheckpoint {
  id: 'current_run';
  startedAt: string;
  durationSec: number;
  distanceM: number;
  elevationGainM: number;
  caloriesKcal: number;
  points: Array<{ lat: number; lng: number; alt: number; timestamp: number }>;
  splits: KmSplit[];
  updatedAt: number;
}

const DB_NAME = 'fitforge-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('active_run')) {
          db.createObjectStore('active_run', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveActiveRunCheckpoint(
  checkpoint: Omit<ActiveRunCheckpoint, 'id' | 'updatedAt'>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.put('active_run', {
    ...checkpoint,
    id: 'current_run',
    updatedAt: Date.now(),
  });
}

export async function getActiveRunCheckpoint(): Promise<ActiveRunCheckpoint | null> {
  const db = await getDb();
  if (!db) return null;
  const record = await db.get('active_run', 'current_run');
  return (record as ActiveRunCheckpoint) || null;
}

export async function clearActiveRunCheckpoint(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete('active_run', 'current_run');
}
