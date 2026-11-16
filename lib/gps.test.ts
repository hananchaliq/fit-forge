import test from 'node:test';
import assert from 'node:assert/strict';
import { KalmanFilter1D, GpsKalmanPair, validateGpsFix } from './kalman';
import {
  haversineDistanceMeters,
  formatPaceSecPerKm,
  formatDuration,
  estimateRunCaloriesKcal,
} from './haversine';

test('Haversine distance calculates accurate distance in Jakarta GBK loop', () => {
  // Approx 1 km north along meridian (~0.008993 degrees latitude)
  const d = haversineDistanceMeters(-6.2183, 106.8025, -6.209307, 106.8025);
  assert.ok(d > 995 && d < 1005, `Expected ~1000m, got ${d}`);
});

test('1D Kalman Filter dampens noisy GPS coordinate spikes', () => {
  const kf = new KalmanFilter1D(1e-5, 1e-4);
  const base = -6.2183;
  const first = kf.filter(base);
  assert.equal(first, base);

  // Inject noisy spike
  const noisy = base + 0.001;
  const filtered = kf.filter(noisy);
  assert.ok(filtered > base && filtered < noisy, 'Filtered coordinate must lie between base and spike');
});

test('GPS fix validator rejects accuracy > 20m and speed spikes > 12 m/s', () => {
  const prev = { lat: -6.2183, lng: 106.8025, accuracy: 6, timestamp: 1000 };

  // High inaccuracy (> 20m)
  const badAcc = validateGpsFix(
    { lat: -6.21835, lng: 106.8025, accuracy: 25, timestamp: 2000 },
    prev,
    haversineDistanceMeters
  );
  assert.equal(badAcc.valid, false);
  assert.equal(badAcc.reason, 'accuracy_too_low');

  // Speed spike (> 12 m/s: ~55 meters in 1 second)
  const spike = validateGpsFix(
    { lat: -6.2178, lng: 106.8025, accuracy: 5, timestamp: 2000 },
    prev,
    haversineDistanceMeters
  );
  assert.equal(spike.valid, false);
  assert.equal(spike.reason, 'speed_spike');

  // Normal running step (~3.3 m/s: ~3.3 meters in 1 second)
  const good = validateGpsFix(
    { lat: -6.21827, lng: 106.8025, accuracy: 5, timestamp: 2000 },
    prev,
    haversineDistanceMeters
  );
  assert.equal(good.valid, true);
  assert.ok(good.distanceMeters > 2 && good.distanceMeters < 5);
});

test('Pace and calorie helpers return expected values', () => {
  assert.equal(formatPaceSecPerKm(315), "5'15\"");
  assert.equal(formatDuration(3665), '01:01:05');
  const kcal = estimateRunCaloriesKcal(5000, 1500, 70);
  assert.ok(kcal > 250 && kcal < 400);
});
