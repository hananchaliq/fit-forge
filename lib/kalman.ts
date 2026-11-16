/**
 * 1D Kalman Filter for smoothing noisy GPS coordinates (latitude / longitude)
 * and GPS accuracy / velocity spike rejection per PROJECT_SPEC.md Section 5.5.
 */

export class KalmanFilter1D {
  private q: number; // Process noise covariance
  private r: number; // Measurement noise covariance
  private x: number; // Estimated value
  private p: number; // Estimation error covariance
  private k: number; // Kalman gain
  private initialized: boolean;

  constructor(processNoise = 1e-5, measurementNoise = 1e-4) {
    this.q = processNoise;
    this.r = measurementNoise;
    this.x = 0;
    this.p = 1;
    this.k = 0;
    this.initialized = false;
  }

  public filter(measurement: number, customMeasurementNoise?: number): number {
    if (!this.initialized) {
      this.x = measurement;
      this.p = 1;
      this.initialized = true;
      return this.x;
    }

    const r = customMeasurementNoise ?? this.r;
    // Prediction update
    this.p = this.p + this.q;

    // Measurement update
    this.k = this.p / (this.p + r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;

    return this.x;
  }

  public reset(): void {
    this.initialized = false;
    this.x = 0;
    this.p = 1;
    this.k = 0;
  }

  public getEstimate(): number {
    return this.x;
  }
}

export class GpsKalmanPair {
  private latFilter: KalmanFilter1D;
  private lngFilter: KalmanFilter1D;

  constructor(processNoise = 1e-5, measurementNoise = 1e-4) {
    this.latFilter = new KalmanFilter1D(processNoise, measurementNoise);
    this.lngFilter = new KalmanFilter1D(processNoise, measurementNoise);
  }

  public process(lat: number, lng: number, accuracyMeters = 8): { lat: number; lng: number } {
    // Scale measurement noise weakly by accuracy
    const r = Math.max(1e-6, (accuracyMeters / 100000) ** 2);
    return {
      lat: this.latFilter.filter(lat, r),
      lng: this.lngFilter.filter(lng, r),
    };
  }

  public reset(): void {
    this.latFilter.reset();
    this.lngFilter.reset();
  }
}

export interface RawGpsFix {
  lat: number;
  lng: number;
  accuracy: number; // meters
  altitude?: number | null;
  timestamp: number; // ms
}

export interface GpsValidationResult {
  valid: boolean;
  reason?: 'accuracy_too_low' | 'speed_spike' | 'invalid_time' | 'unreasonable_jump';
  calculatedSpeedMps: number;
  distanceMeters: number;
}

/**
 * Rejects GPS fixes with:
 * - accuracy > 20 m
 * - speed spike > 12 m/s (world-class sprint threshold)
 * - unreasonable jump (> 150 m in a single tick)
 */
export function validateGpsFix(
  current: RawGpsFix,
  previous: RawGpsFix | null,
  distanceFn: (lat1: number, lng1: number, lat2: number, lng2: number) => number
): GpsValidationResult {
  if (current.accuracy > 20) {
    return { valid: false, reason: 'accuracy_too_low', calculatedSpeedMps: 0, distanceMeters: 0 };
  }

  if (!previous) {
    return { valid: true, calculatedSpeedMps: 0, distanceMeters: 0 };
  }

  const dtSec = (current.timestamp - previous.timestamp) / 1000;
  if (dtSec <= 0) {
    return { valid: false, reason: 'invalid_time', calculatedSpeedMps: 0, distanceMeters: 0 };
  }

  const distM = distanceFn(previous.lat, previous.lng, current.lat, current.lng);
  if (distM > 150 && dtSec < 12) {
    return { valid: false, reason: 'unreasonable_jump', calculatedSpeedMps: distM / dtSec, distanceMeters: distM };
  }

  const speedMps = distM / dtSec;
  if (speedMps > 12) {
    return { valid: false, reason: 'speed_spike', calculatedSpeedMps: speedMps, distanceMeters: distM };
  }

  return { valid: true, calculatedSpeedMps: speedMps, distanceMeters: distM };
}
