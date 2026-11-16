/**
 * Aladhan Prayer Times API Integration + Kemenag RI (Method 20)
 * with daily localStorage cache & deterministic fallback per PROJECT_SPEC.md Section 5.7.
 */

export type PrayerKey = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

export interface PrayerSchedule {
  subuh: string;
  terbit: string;
  dzuhur: string;
  ashar: string;
  maghrib: string;
  isya: string;
  dateReadable: string;
  hijriReadable: string;
  city: string;
  method: number;
}

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  subuh: 'Subuh',
  dzuhur: 'Dzuhur',
  ashar: 'Ashar',
  maghrib: 'Maghrib',
  isya: 'Isya',
};

export const DEFAULT_PRAYER_SCHEDULE: PrayerSchedule = {
  subuh: '04:28',
  terbit: '05:44',
  dzuhur: '11:56',
  ashar: '15:14',
  maghrib: '18:04',
  isya: '19:16',
  dateReadable: '16 Nov 2026',
  hijriReadable: '6 Jumadil Akhir 1448 H',
  city: 'Jakarta Selatan',
  method: 20, // Kemenag RI
};

export async function fetchPrayerTimes(
  lat = -6.2088,
  lng = 106.8456,
  method = 20,
  city = 'Jakarta Selatan'
): Promise<PrayerSchedule> {
  const todayKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `fitforge_prayers_${todayKey}_${lat.toFixed(2)}_${lng.toFixed(2)}_${method}`;

  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as PrayerSchedule;
      } catch {
        // ignore invalid cache
      }
    }
  }

  try {
    const url = `https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lng)}&method=${encodeURIComponent(method)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);
    const json = await res.json();
    const timings = json?.data?.timings;
    const dateInfo = json?.data?.date;

    if (timings) {
      const cleanTime = (val: string | undefined, fallback: string) =>
        val ? val.split(' ')[0].slice(0, 5) : fallback;

      const schedule: PrayerSchedule = {
        subuh: cleanTime(timings.Fajr, DEFAULT_PRAYER_SCHEDULE.subuh),
        terbit: cleanTime(timings.Sunrise, DEFAULT_PRAYER_SCHEDULE.terbit),
        dzuhur: cleanTime(timings.Dhuhr, DEFAULT_PRAYER_SCHEDULE.dzuhur),
        ashar: cleanTime(timings.Asr, DEFAULT_PRAYER_SCHEDULE.ashar),
        maghrib: cleanTime(timings.Maghrib, DEFAULT_PRAYER_SCHEDULE.maghrib),
        isya: cleanTime(timings.Isha, DEFAULT_PRAYER_SCHEDULE.isya),
        dateReadable: dateInfo?.readable || DEFAULT_PRAYER_SCHEDULE.dateReadable,
        hijriReadable: dateInfo?.hijri
          ? `${dateInfo.hijri.day} ${dateInfo.hijri.month?.en || ''} ${dateInfo.hijri.year} H`
          : DEFAULT_PRAYER_SCHEDULE.hijriReadable,
        city,
        method,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(schedule));
      }
      return schedule;
    }
  } catch {
    // Fallback to Kemenag Jakarta schedule if offline or blocked
  }

  return {
    ...DEFAULT_PRAYER_SCHEDULE,
    city,
    method,
  };
}

/**
 * Computes the next upcoming prayer and time remaining in seconds.
 */
export function getNextPrayerCountdown(
  schedule: PrayerSchedule,
  now: Date = new Date()
): {
  key: PrayerKey;
  label: string;
  timeStr: string;
  secondsRemaining: number;
  formattedCountdown: string;
} {
  const order: PrayerKey[] = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  for (const key of order) {
    const [hh, mm] = schedule[key].split(':').map(Number);
    const targetSec = hh * 3600 + mm * 60;
    if (targetSec > nowSec) {
      const diff = targetSec - nowSec;
      return {
        key,
        label: PRAYER_LABELS[key],
        timeStr: schedule[key],
        secondsRemaining: diff,
        formattedCountdown: formatHhMmSs(diff),
      };
    }
  }

  // Next is tomorrow's Subuh
  const [subuhH, subuhM] = schedule.subuh.split(':').map(Number);
  const tomorrowSubuhSec = 24 * 3600 - nowSec + (subuhH * 3600 + subuhM * 60);
  return {
    key: 'subuh',
    label: PRAYER_LABELS.subuh,
    timeStr: schedule.subuh,
    secondsRemaining: tomorrowSubuhSec,
    formattedCountdown: formatHhMmSs(tomorrowSubuhSec),
  };
}

function formatHhMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
}
