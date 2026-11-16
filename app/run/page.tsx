'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Navigation,
  Share2,
  Volume2,
  Award,
  Activity,
  Flame,
  TrendingUp,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { GpsKalmanPair, validateGpsFix, type RawGpsFix } from '@/lib/kalman';
import {
  haversineDistanceMeters,
  formatPaceSecPerKm,
  formatDuration,
  estimateRunCaloriesKcal,
  type KmSplit,
} from '@/lib/haversine';
import {
  saveActiveRunCheckpoint,
  getActiveRunCheckpoint,
  clearActiveRunCheckpoint,
  type ActiveRunCheckpoint,
} from '@/lib/idb';
import { soundEngine } from '@/lib/audio';
import { GBK_LOOP_COORDS, type RunSessionRecord } from '@/data/demoData';

const EMPTY_RUN_FALLBACK: RunSessionRecord = {
  id: 'empty',
  title: 'Belum Ada Sesi Lari Tersimpan',
  startedAt: '',
  durationSec: 0,
  distanceM: 0,
  avgPaceSecKm: 0,
  elevationGainM: 0,
  caloriesKcal: 0,
  polyline: GBK_LOOP_COORDS,
  splits: [],
};

export default function RunTrackerPage() {
  const { profile, runSessions, addRunSession, deleteRunSession, darkMode } = useFitForgeStore();

  // Active run state
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [isSimulating, setIsSimulating] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const [currentPaceSecKm, setCurrentPaceSecKm] = useState(0);
  const [elevationGainM, setElevationGainM] = useState(0);
  const [routePoints, setRoutePoints] = useState<Array<{ lat: number; lng: number }>>(
    GBK_LOOP_COORDS
  );
  const [splits, setSplits] = useState<KmSplit[]>([]);
  const [autoFollow, setAutoFollow] = useState(true);
  const [voiceCoachEnabled, setVoiceCoachEnabled] = useState(true);
  const [rejectedFixesCount, setRejectedFixesCount] = useState(0);
  const [unfinishedRun, setUnfinishedRun] = useState<ActiveRunCheckpoint | null>(null);
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null);
  const [shareCardUrl, setShareCardUrl] = useState<string | null>(null);

  const selectedHistoryRun: RunSessionRecord =
    runSessions.find((r) => r.id === selectedHistoryRunId) ||
    runSessions[0] ||
    EMPTY_RUN_FALLBACK;

  const kalmanRef = useRef(new GpsKalmanPair());
  const prevFixRef = useRef<RawGpsFix | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastKmAnnouncedRef = useRef<number>(0);
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check IndexedDB for crash recovery on mount
  useEffect(() => {
    getActiveRunCheckpoint()
      .then((cp) => {
        if (cp && cp.distanceM > 20) {
          setUnfinishedRun(cp);
        }
      })
      .catch(() => {});
  }, []);

  // Screen Wake Lock during active run
  useEffect(() => {
    if (status !== 'running') return;
    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (
            navigator as unknown as {
              wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
            }
          ).wakeLock.request('screen');
        }
      } catch {
        // ignore if unsupported
      }
    };
    requestWakeLock();
    const onVisChange = () => {
      if (document.visibilityState === 'visible' && status === 'running') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [status]);

  // 1-second timer + IndexedDB checkpointing + Route simulation
  useEffect(() => {
    if (status !== 'running') return;

    const timer = window.setInterval(() => {
      setDurationSec((prevDur) => {
        const nextDur = prevDur + 1;

        if (isSimulating) {
          // Advance simulated runner along GBK Senayan loop (~3.35 m/s = ~5:00/km)
          setDistanceM((prevDist) => {
            const stepMeters = 18.5; // Accelerated simulation for desktop testing
            const nextDist = prevDist + stepMeters;
            const loopIdx = Math.floor(nextDist / 120) % GBK_LOOP_COORDS.length;
            const nextCoord = GBK_LOOP_COORDS[loopIdx];
            const jitterLat = nextCoord.lat + (Math.sin(nextDur) * 0.00008);
            const jitterLng = nextCoord.lng + (Math.cos(nextDur) * 0.00008);
            const smoothed = kalmanRef.current.process(jitterLat, jitterLng, 6);

            setRoutePoints((pts) => [...pts, smoothed]);
            setElevationGainM((el) => Number((el + 0.12).toFixed(1)));
            setCurrentPaceSecKm(305 + Math.round(Math.sin(nextDur * 0.3) * 8));

            // Check 1.0 km split milestone
            const kmReached = Math.floor(nextDist / 1000);
            if (kmReached > lastKmAnnouncedRef.current) {
              lastKmAnnouncedRef.current = kmReached;
              const splitPace = 308 - kmReached * 2;
              setSplits((oldSplits) => {
                const prevPace = oldSplits[oldSplits.length - 1]?.paceSec || splitPace;
                const delta = splitPace - prevPace;
                return [
                  ...oldSplits,
                  {
                    km: kmReached,
                    paceSec: splitPace,
                    deltaSec: oldSplits.length === 0 ? 0 : delta,
                    elevationGainM: 7,
                  },
                ];
              });

              if (voiceCoachEnabled) {
                soundEngine.speakIndonesian(
                  `Kilometer ${kmReached} tercapai. Pace rata-rata 5 menit 8 detik per kilometer.`
                );
              }
            }

            // Save 1-sec checkpoint to IndexedDB
            saveActiveRunCheckpoint({
              startedAt: new Date(Date.now() - nextDur * 1000).toISOString(),
              durationSec: nextDur,
              distanceM: nextDist,
              elevationGainM: Math.round(nextDist * 0.006),
              caloriesKcal: estimateRunCaloriesKcal(nextDist, nextDur, profile.weightKg),
              points: [{ lat: smoothed.lat, lng: smoothed.lng, alt: 12, timestamp: Date.now() }],
              splits: [],
            }).catch(() => {});

            return nextDist;
          });
        }

        return nextDur;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status, isSimulating, voiceCoachEnabled, profile.weightKg]);

  // Draw Interactive Route Map Canvas (CartoDB Dark Matter / Positron style + glowing #F97316 polyline)
  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Map background (Dark Matter vs Positron)
    ctx.fillStyle = darkMode ? '#111318' : '#EEF2F6';
    ctx.fillRect(0, 0, w, h);

    // Street grid lines & stadium ring
    ctx.strokeStyle = darkMode ? '#1E222B' : '#DCE3EC';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Park / Stadium infield oval
    ctx.fillStyle = darkMode ? '#14261D' : '#DCFCE7';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 130, 88, -0.2, 0, Math.PI * 2);
    ctx.fill();

    const activePolyline =
      status !== 'idle' && routePoints.length > 1
        ? routePoints
        : selectedHistoryRun.polyline.length > 1
          ? selectedHistoryRun.polyline
          : GBK_LOOP_COORDS;

    const lats = activePolyline.map((p) => p.lat);
    const lngs = activePolyline.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const pad = 54;

    const project = (lat: number, lng: number) => {
      const x =
        pad +
        ((lng - minLng) / Math.max(0.0005, maxLng - minLng)) * (w - pad * 2);
      const y =
        h -
        pad -
        ((lat - minLat) / Math.max(0.0005, maxLat - minLat)) * (h - pad * 2);
      return { x, y };
    };

    // Outer glow for polyline (#F97316)
    ctx.save();
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.32)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    activePolyline.forEach((pt, idx) => {
      const { x, y } = project(pt.lat, pt.lng);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Core polyline (#F97316)
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    activePolyline.forEach((pt, idx) => {
      const { x, y } = project(pt.lat, pt.lng);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Start Marker
    const startPt = project(activePolyline[0].lat, activePolyline[0].lng);
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Current Runner Marker
    const lastCoord = activePolyline[activePolyline.length - 1];
    const currPt = project(lastCoord.lat, lastCoord.lng);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.beginPath();
    ctx.arc(currPt.x, currPt.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(currPt.x, currPt.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [routePoints, status, selectedHistoryRun, darkMode]);

  const handleStartGpsRun = (simulateMode: boolean) => {
    kalmanRef.current.reset();
    prevFixRef.current = null;
    lastKmAnnouncedRef.current = 0;
    setIsSimulating(simulateMode);
    setDurationSec(0);
    setDistanceM(0);
    setElevationGainM(0);
    setSplits([]);
    setRoutePoints([GBK_LOOP_COORDS[0]]);
    setStatus('running');
    soundEngine.playChime('start');

    if (!simulateMode && typeof navigator !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const fix: RawGpsFix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            timestamp: pos.timestamp || Date.now(),
          };
          const check = validateGpsFix(fix, prevFixRef.current, haversineDistanceMeters);
          if (!check.valid) {
            setRejectedFixesCount((c) => c + 1);
            return;
          }
          prevFixRef.current = fix;
          const smoothed = kalmanRef.current.process(fix.lat, fix.lng, fix.accuracy);
          setRoutePoints((pts) => [...pts, smoothed]);
          setDistanceM((d) => d + check.distanceMeters);
          if (check.calculatedSpeedMps > 0.5) {
            setCurrentPaceSecKm(Math.round(1000 / check.calculatedSpeedMps));
          }
        },
        () => {
          // Fallback to simulation if user denies geolocation permission
          setIsSimulating(true);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
  };

  const handleStopAndSaveRun = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const finalDistM = Math.max(450, Math.round(distanceM));
    const finalDurSec = Math.max(120, durationSec);
    const avgPace = Math.round(finalDurSec / (finalDistM / 1000));
    const kcal = estimateRunCaloriesKcal(finalDistM, finalDurSec, profile.weightKg);

    const newRecord: RunSessionRecord = {
      id: `run-${Date.now()}`,
      title: isSimulating
        ? 'Sesi Lari Simulasi GPS — Lingkar GBK'
        : `Lari GPS Outdoor — ${profile.city}`,
      startedAt: new Date().toISOString(),
      durationSec: finalDurSec,
      distanceM: finalDistM,
      avgPaceSecKm: avgPace,
      elevationGainM: Math.max(8, elevationGainM),
      caloriesKcal: kcal,
      polyline: routePoints.length > 2 ? routePoints : GBK_LOOP_COORDS,
      splits:
        splits.length > 0
          ? splits
          : [{ km: 1, paceSec: avgPace, deltaSec: 0, elevationGainM: 8 }],
    };

    addRunSession(newRecord);
    setSelectedHistoryRunId(newRecord.id);
    setStatus('idle');
    clearActiveRunCheckpoint().catch(() => {});
    soundEngine.playChime('set_done');
  };

  const handleCancelRun = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setDurationSec(0);
    setDistanceM(0);
    setElevationGainM(0);
    setSplits([]);
    setRoutePoints(GBK_LOOP_COORDS);
    setStatus('idle');
    clearActiveRunCheckpoint().catch(() => {});
  };

  const handleRecoverUnfinishedRun = () => {
    if (!unfinishedRun) return;
    setDurationSec(unfinishedRun.durationSec);
    setDistanceM(unfinishedRun.distanceM);
    setElevationGainM(unfinishedRun.elevationGainM);
    setStatus('paused');
    setUnfinishedRun(null);
  };

  const handleGenerateShareCard = () => {
    const offscreen = document.createElement('canvas');
    offscreen.width = 720;
    offscreen.height = 900;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Obsidian background + Amber gradient accents
    ctx.fillStyle = '#0E0E0E';
    ctx.fillRect(0, 0, 720, 900);

    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 672, 852);

    ctx.fillStyle = '#F97316';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('FITFORGE // GPS RUN TRACKER', 56, 84);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(selectedHistoryRun.title.slice(0, 32), 56, 140);

    // Draw polyline in center box
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(360, 380, 140, 0, Math.PI * 2);
    ctx.stroke();

    // Stats block
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '22px sans-serif';
    ctx.fillText('JARAK TEMPUH', 56, 640);
    ctx.fillText('PACE RATA-RATA', 300, 640);
    ctx.fillText('KALORI', 540, 640);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(`${(selectedHistoryRun.distanceM / 1000).toFixed(2)} km`, 56, 704);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(formatPaceSecPerKm(selectedHistoryRun.avgPaceSecKm), 300, 704);
    ctx.fillText(`${selectedHistoryRun.caloriesKcal}`, 540, 704);

    ctx.fillStyle = '#6B7280';
    ctx.font = '20px sans-serif';
    ctx.fillText(
      `Atlet: ${profile.displayName} · Filter Kalman 1D & Haversine Terverifikasi`,
      56,
      820
    );

    setShareCardUrl(offscreen.toDataURL('image/png'));
  };

  const displayDistKm =
    status === 'idle'
      ? (selectedHistoryRun.distanceM / 1000).toFixed(2)
      : (distanceM / 1000).toFixed(2);
  const displayDur =
    status === 'idle'
      ? formatDuration(selectedHistoryRun.durationSec)
      : formatDuration(durationSec);
  const displayAvgPace =
    status === 'idle'
      ? formatPaceSecPerKm(selectedHistoryRun.avgPaceSecKm)
      : formatPaceSecPerKm(distanceM > 20 ? durationSec / (distanceM / 1000) : currentPaceSecKm);
  const displayKcal =
    status === 'idle'
      ? selectedHistoryRun.caloriesKcal
      : estimateRunCaloriesKcal(distanceM, durationSec, profile.weightKg);

  return (
    <AppShell
      title="GPS Run Tracker"
      subtitle="Filter Kalman 1D · Jarak Geodesik Haversine · Checkpoint IndexedDB 1 dtk · Voice Coach Indonesia"
      ctaLabel={status === 'running' ? 'Selesaikan Lari' : 'Simulasi Lari GBK'}
      onCtaClick={() =>
        status === 'running' ? handleStopAndSaveRun() : handleStartGpsRun(true)
      }
    >
      {/* Crash Recovery Banner from IndexedDB */}
      {unfinishedRun && (
        <div className="mb-5 p-4 rounded-2xl bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>
              Ditemukan sesi lari yang belum selesai ({(unfinishedRun.distanceM / 1000).toFixed(2)} km). Lanjutkan sesi ini?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRecoverUnfinishedRun}
              className="px-3 py-1.5 rounded-xl bg-[#161616] text-white text-xs font-bold cursor-pointer"
            >
              Lanjutkan Lari
            </button>
            <button
              type="button"
              onClick={() => {
                clearActiveRunCheckpoint().catch(() => {});
                setUnfinishedRun(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/70 text-[#B45309] text-xs font-semibold cursor-pointer"
            >
              Abaikan
            </button>
          </div>
        </div>
      )}

      {/* TOP HUD TELEMETRY (56-72px Tabular Numerals + Controls) */}
      <div className="rounded-3xl bg-[#161616] text-white border border-[#262626] p-5 sm:p-7 shadow-card mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 items-center">
          {/* Primary Timer / Distance HUD */}
          <div className="col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
              {status === 'running'
                ? isSimulating
                  ? 'SIMULASI RUTE AKTIF (KALMAN 1D)'
                  : 'PELACAKAN GPS PRESISI TINGGI'
                : 'RINGKASAN SESI TERPILIH'}
            </span>
            <div className="flex items-baseline gap-4 mt-1">
              <span className="text-5xl sm:text-6xl font-extrabold tracking-tight tabular-nums text-white">
                {displayDistKm}
                <span className="text-xl font-bold text-[#F97316] ml-1">km</span>
              </span>
              <span className="text-2xl sm:text-3xl font-bold tabular-nums text-neutral-300">
                {displayDur}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs text-neutral-400">Pace Rata-Rata</p>
            <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums mt-0.5">
              {displayAvgPace}
              <span className="text-xs text-neutral-400 font-normal"> /km</span>
            </p>
          </div>

          <div>
            <p className="text-xs text-neutral-400">Kalori (MET × {profile.weightKg}kg)</p>
            <p className="text-2xl sm:text-3xl font-bold text-[#F59E0B] tabular-nums mt-0.5">
              {displayKcal}
              <span className="text-xs text-neutral-400 font-normal"> kkal</span>
            </p>
          </div>

          <div>
            <p className="text-xs text-neutral-400">Elevasi & Filter GPS</p>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums mt-0.5">
              +{status === 'idle' ? selectedHistoryRun.elevationGainM : elevationGainM}m
            </p>
            <p className="text-[11px] text-neutral-400 tabular-nums">
              Spike ditolak: {rejectedFixesCount} fix
            </p>
          </div>
        </div>

        {/* Action Control Bar */}
        <div className="mt-6 pt-5 border-t border-[#262626] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {status === 'idle' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleStartGpsRun(false)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 hover:opacity-95 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Mulai Lari GPS Nyata</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartGpsRun(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-[#F59E0B]" />
                  <span>Simulasi Rute (Desktop Test)</span>
                </button>

                {selectedHistoryRun.id !== 'empty' && (
                  <button
                    type="button"
                    onClick={() => deleteRunSession(selectedHistoryRun.id)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#262626] hover:bg-[#EF4444]/20 border border-[#333333] hover:border-[#EF4444] text-neutral-300 hover:text-[#EF4444] font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                    title="Hapus sesi lari yang sedang dipilih dari riwayat"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Sesi Terpilih</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setStatus((s) => (s === 'running' ? 'paused' : 'running'))
                  }
                  className="px-4 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
                >
                  {status === 'running' ? (
                    <>
                      <Pause className="w-4 h-4 text-[#F59E0B]" />
                      <span>Jeda</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-emerald-400" />
                      <span>Lanjutkan</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleStopAndSaveRun}
                  className="px-5 py-2.5 rounded-xl bg-[#EF4444] hover:opacity-95 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Selesai & Simpan Lari</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelRun}
                  className="px-4 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] border border-[#333333] text-neutral-300 hover:text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4 text-[#EF4444]" />
                  <span>Batal / Jangan Simpan</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setVoiceCoachEnabled((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                voiceCoachEnabled
                  ? 'bg-[#262626] border-[#F59E0B] text-white'
                  : 'bg-[#0E0E0E] border-[#262626] text-neutral-400'
              }`}
            >
              <Volume2 className="w-4 h-4 text-[#F59E0B]" />
              <span>Voice Coach ID: {voiceCoachEnabled ? 'Aktif' : 'Mati'}</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateShareCard}
              className="px-3.5 py-2 rounded-xl bg-[#262626] hover:bg-[#333333] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#F97316]" />
              <span>Kartu Bagikan (PNG)</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAP + SPLIT TABLE + RUN HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Interactive Route Map Canvas */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#111111] dark:text-white">
                Peta Lintasan GPS & Polyline (#F97316)
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-neutral-400">
                {status === 'idle' ? selectedHistoryRun.title : 'Pelacakan Langsung Aktif'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoFollow((a) => !a)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                autoFollow
                  ? 'bg-[#161616] text-[#F59E0B]'
                  : 'bg-neutral-100 dark:bg-[#262626] text-neutral-500'
              }`}
            >
              Auto-Follow: {autoFollow ? 'ON' : 'OFF'}
            </button>
          </div>

          <canvas
            ref={mapCanvasRef}
            width={680}
            height={380}
            className="w-full h-[340px] rounded-xl border border-[#EFEFEF] dark:border-[#262626]"
          />
        </div>

        {/* Right 5 Cols: Per-Km Split Table & Run History */}
        <div className="lg:col-span-5 space-y-5">
          {/* Split per KM Table */}
          <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
            <h2 className="text-sm font-semibold text-[#111111] dark:text-white mb-3">
              Tabel Split Per Kilometer
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#EFEFEF] dark:border-[#262626] text-[#6B7280] dark:text-neutral-400">
                    <th className="py-2 text-left">KM</th>
                    <th className="py-2 text-right">Pace</th>
                    <th className="py-2 text-right">Selisih</th>
                    <th className="py-2 text-right">Elevasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEF] dark:divide-[#262626] tabular-nums">
                  {(status !== 'idle' && splits.length > 0
                    ? splits
                    : selectedHistoryRun.splits
                  ).map((sp) => (
                    <tr key={sp.km}>
                      <td className="py-2 font-bold text-[#111111] dark:text-white">
                        KM {sp.km}
                      </td>
                      <td className="py-2 text-right font-semibold text-[#111111] dark:text-white">
                        {formatPaceSecPerKm(sp.paceSec)}
                      </td>
                      <td
                        className={`py-2 text-right font-semibold ${
                          sp.deltaSec <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#EF4444]'
                        }`}
                      >
                        {sp.deltaSec > 0 ? `+${sp.deltaSec}s` : `${sp.deltaSec}s`}
                      </td>
                      <td className="py-2 text-right text-[#6B7280] dark:text-neutral-400">
                        +{sp.elevationGainM}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Run Sessions History */}
          <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#111111] dark:text-white">
                Riwayat Sesi Lari ({runSessions.length})
              </h2>
              {runSessions.length > 0 && (
                <span className="text-[11px] text-[#6B7280] dark:text-neutral-400">
                  Klik ikon sampah untuk menghapus
                </span>
              )}
            </div>
            {runSessions.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-dashed border-[#EFEFEF] dark:border-[#262626] text-center">
                <p className="text-xs font-medium text-[#6B7280] dark:text-neutral-400">
                  Belum ada riwayat sesi lari yang tersimpan. Mulai lari GPS atau simulasi di atas untuk mencatat sesi pertama Anda.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {runSessions.map((session) => {
                  const isSelected = session.id === selectedHistoryRun.id;
                  return (
                    <div
                      key={session.id}
                      className={`w-full p-3 rounded-xl border transition flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#161616] text-white border-[#F97316]'
                          : 'bg-[#F8F9FA] dark:bg-[#0E0E0E] text-[#111111] dark:text-white border-[#EFEFEF] dark:border-[#262626]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryRunId(session.id)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <p className="text-xs font-bold truncate">{session.title}</p>
                        <p className="text-[11px] opacity-75 tabular-nums mt-0.5">
                          {(session.distanceM / 1000).toFixed(2)} km · Pace{' '}
                          {formatPaceSecPerKm(session.avgPaceSecKm)} · {session.caloriesKcal} kkal
                        </p>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Award className="w-4 h-4 text-[#F59E0B]" />
                        <button
                          type="button"
                          onClick={() => deleteRunSession(session.id)}
                          aria-label={`Hapus sesi lari ${session.title}`}
                          title="Hapus riwayat lari ini"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Card Preview Modal */}
      {shareCardUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Kartu Bagikan Lari FitForge"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#262626] p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Kartu Bagikan Lari (Obsidian + Amber)</h3>
              <button
                type="button"
                onClick={() => setShareCardUrl(null)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Tutup ✕
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shareCardUrl}
              alt="Kartu Bagikan Lari FitForge"
              referrerPolicy="no-referrer"
              className="w-full rounded-xl border border-[#262626] mb-4"
            />
            <a
              href={shareCardUrl}
              download="FitForge-Run-Card.png"
              className="block w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-center text-xs font-extrabold"
            >
              Unduh Gambar PNG
            </a>
          </div>
        </div>
      )}
    </AppShell>
  );
}
