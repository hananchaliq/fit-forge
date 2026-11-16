/**
 * Haversine geodesic distance, pace formatting, MET calorie estimation,
 * and kilometer split calculations per PROJECT_SPEC.md Section 5.5.
 */

const EARTH_RADIUS_M = 6371000;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Formats pace in seconds per km into "MM'SS\"" (e.g. 315 -> "5'15\"")
 */
export function formatPaceSecPerKm(paceSecKm: number): string {
  if (!Number.isFinite(paceSecKm) || paceSecKm <= 0 || paceSecKm > 3600) {
    return "--'--\"";
  }
  const totalSec = Math.round(paceSecKm);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}'${secs.toString().padStart(2, '0')}"`;
}

/**
 * Formats duration in seconds into HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Estimates running calories burned using MET formula:
 * Calories = MET * weightKg * (durationSec / 3600)
 * where MET scales dynamically with average speed (km/h).
 */
export function estimateRunCaloriesKcal(
  distanceMeters: number,
  durationSec: number,
  weightKg = 70
): number {
  if (distanceMeters <= 0 || durationSec <= 0) return 0;
  const hours = durationSec / 3600;
  const speedKmh = distanceMeters / 1000 / hours;

  let met = 8.0;
  if (speedKmh < 6) met = 5.0;
  else if (speedKmh < 8) met = 8.3;
  else if (speedKmh < 10) met = 9.8;
  else if (speedKmh < 12) met = 11.5;
  else met = 12.8;

  return Math.round(met * weightKg * hours);
}

export interface KmSplit {
  km: number;
  paceSec: number;
  deltaSec: number; // vs previous km split
  elevationGainM: number;
}
