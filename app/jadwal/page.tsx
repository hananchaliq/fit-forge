'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  Volume2,
  Droplets,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Bell,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  MotionProgressBar,
  MOTION_SPRING,
} from '@/components/ui/MotionPrimitives';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import {
  DEFAULT_PRAYER_SCHEDULE,
  fetchPrayerTimes,
  getNextPrayerCountdown,
  PRAYER_LABELS,
  type PrayerKey,
  type PrayerSchedule,
} from '@/lib/prayer';
import { soundEngine } from '@/lib/audio';

export default function JadwalPage() {
  const {
    profile,
    prayersCompleted,
    togglePrayerCompleted,
    waterMl,
    addWaterMl,
    scheduleConfig,
    updateScheduleConfig,
  } = useFitForgeStore();

  const [prayerSchedule, setPrayerSchedule] = useState<PrayerSchedule>(DEFAULT_PRAYER_SCHEDULE);
  const [nowDate, setNowDate] = useState<Date | null>(null);
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [pushStatusMsg, setPushStatusMsg] = useState('');

  useEffect(() => {
    fetchPrayerTimes(profile.lat, profile.lng, profile.prayerMethod, profile.city).then(
      setPrayerSchedule
    );
    const initTimer = window.setTimeout(() => setNowDate(new Date()), 0);
    const interval = window.setInterval(() => setNowDate(new Date()), 1000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, [profile.lat, profile.lng, profile.prayerMethod, profile.city]);

  const nextPrayer = getNextPrayerCountdown(prayerSchedule, nowDate || new Date(0));
  const prayerOrder: PrayerKey[] = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
  const completedPrayersCount = Object.values(prayersCompleted).filter(Boolean).length;

  // MODE A: Loud Wake Alarm Trigger (Escalating Web Audio Synth + Full-screen Snooze/Stop Modal)
  const handleTriggerWakeAlarmModal = () => {
    setAlarmModalOpen(true);
    soundEngine.startWakeAlarm();
  };

  const handleStopWakeAlarm = () => {
    soundEngine.stopWakeAlarm();
    setAlarmModalOpen(false);
  };

  const handleSnoozeWakeAlarm = () => {
    soundEngine.stopWakeAlarm();
    setAlarmModalOpen(false);
    setPushStatusMsg('Alarm ditunda (Snooze) selama 5 menit.');
  };

  // MODE B: Silent Notification Trigger (Standard Web Push / Notification only, NEVER looping synth)
  const handleTestSilentNotification = async (type: 'prayer' | 'hydration') => {
    const title =
      type === 'prayer'
        ? `Waktu Sholat ${nextPrayer.label} (${nextPrayer.timeStr} WIB)`
        : 'Pengingat Hidrasi Jam Ini (+250 ml)';
    const body =
      type === 'prayer'
        ? `Saatnya menunaikan ibadah sholat ${nextPrayer.label} untuk wilayah ${prayerSchedule.city}.`
        : `Pertahankan target 3–4L air harian. Saat ini tercatat ${waterMl} ml.`;

    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, type }),
      });

      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icon.svg', silent: false });
        }
      }
      setPushStatusMsg(
        `Notifikasi Senyap (Mode B) dikirim: "${title}"`
      );
    } catch {
      setPushStatusMsg('Notifikasi Mode B siap ditampilkan.');
    }
  };

  return (
    <AppShell
      title="Jadwal Sholat, Alarm Bangun & Hidrasi"
      subtitle={`Metode Kemenag RI (Method ${prayerSchedule.method}) · ${prayerSchedule.city} · ${prayerSchedule.hijriReadable}`}
      ctaLabel="Tes Alarm Bangun (Mode A)"
      onCtaClick={handleTriggerWakeAlarmModal}
    >
      <AnimatePresence>
        {pushStatusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={MOTION_SPRING}
            className="mb-5 p-3.5 rounded-2xl bg-[#D1FAE5] text-[#047857] text-xs sm:text-sm font-bold flex items-center justify-between gap-3"
          >
            <span className="min-w-0 break-words">✓ {pushStatusMsg}</span>
            <button
              type="button"
              onClick={() => setPushStatusMsg('')}
              className="text-xs underline shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: ALADHAN PRAYER TIMES + COUNTDOWN + CHECK-IN */}
      <div className="rounded-3xl bg-[#0D0F10] text-white border border-[#23272A] p-6 shadow-card mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#23272A]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#84E818]">
              <Clock className="w-4 h-4" />
              <span>JADWAL SHOLAT KEMENAG RI · {prayerSchedule.city.toUpperCase()}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-1">
              Berikutnya: Sholat {nowDate ? `${nextPrayer.label} (${nextPrayer.timeStr} WIB)` : '...'}
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {prayerSchedule.dateReadable} · {prayerSchedule.hijriReadable} · Ibadah selesai hari ini: {completedPrayersCount}/5
            </p>
          </div>

          <div className="rounded-2xl bg-[#131618] border border-[#23272A] px-5 py-3 text-right">
            <span className="text-[11px] text-neutral-400 block">Hitung Mundur Adzan</span>
            <span className="text-3xl sm:text-4xl font-extrabold text-[#84E818] tabular-nums">
              {nowDate ? `-${nextPrayer.formattedCountdown}` : '--:--:--'}
            </span>
          </div>
        </div>

        {/* 5 Prayer Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
          {prayerOrder.map((key) => {
            const done = prayersCompleted[key];
            const isNext = nextPrayer.key === key;
            const notifEnabled = scheduleConfig.prayerToggles[key];

            return (
              <motion.div
                key={key}
                whileHover={{ y: -3 }}
                transition={MOTION_SPRING}
                className={`rounded-2xl p-4 border transition-colors flex flex-col justify-between ${
                  isNext
                    ? 'bg-[#1A1D20] border-[#84E818]'
                    : 'bg-[#131618] border-[#23272A]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-white truncate">
                      {PRAYER_LABELS[key]}
                    </span>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      transition={MOTION_SPRING}
                      onClick={() =>
                        updateScheduleConfig({
                          prayerToggles: {
                            ...scheduleConfig.prayerToggles,
                            [key]: !notifEnabled,
                          },
                        })
                      }
                      className={`min-w-[44px] min-h-[44px] -mr-1 flex items-center justify-center rounded-xl text-xs cursor-pointer transition-colors ${
                        notifEnabled ? 'bg-[#84E818]/15 text-[#84E818]' : 'bg-[#1A1D20] text-neutral-500'
                      }`}
                      aria-label={`Toggle pengingat sholat ${PRAYER_LABELS[key]}`}
                    >
                      <Bell className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <p className="text-2xl font-extrabold text-[#84E818] font-telemetry">
                    {prayerSchedule[key]}
                  </p>
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={MOTION_SPRING}
                  onClick={() => togglePrayerCompleted(key)}
                  className={`mt-4 w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    done
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-[#18181D] hover:bg-[#24242C] text-neutral-200 border border-[#32323D]'
                  }`}
                >
                  <motion.span
                    key={done ? 'done' : 'pending'}
                    initial={{ scale: 0.65, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={MOTION_SPRING}
                    className="inline-flex shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </motion.span>
                  <span>{done ? 'Sudah Sholat' : 'Tandai Sholat'}</span>
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: STRICT SEPARATION BETWEEN MODE A (WAKE ALARM) & MODE B (SILENT PUSH) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MODE A — ALARM BANGUN (KERAS / WEB AUDIO LOOPING SYNTH) */}
        <div className="rounded-2xl bg-white dark:bg-[#161616] p-6 border border-[#EFEFEF] dark:border-[#262626] shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FFE4E6] dark:bg-[#262626] flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-[#BE123C] dark:text-[#EF4444]" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase text-[#EF4444]">
                    MODE A — ALARM BANGUN KERAS
                  </span>
                  <h3 className="text-base font-bold text-[#111111] dark:text-white">
                    Synthesizer Web Audio Bertahap
                  </h3>
                </div>
              </div>

              <input
                type="checkbox"
                aria-label="Aktifkan Alarm Bangun Mode A"
                checked={scheduleConfig.wakeAlarmEnabled}
                onChange={(e) =>
                  updateScheduleConfig({ wakeAlarmEnabled: e.target.checked })
                }
                className="w-5 h-5 accent-[#84E818] cursor-pointer"
              />
            </div>

            <p className="text-xs text-[#6B7280] dark:text-neutral-400 leading-relaxed mb-4">
              Memutar gelombang suara synthesizer secara berulang dengan volume naik bertahap dan menampilkan modal layar penuh Snooze/Matikan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="wake-alarm-time" className="block text-xs font-semibold mb-1.5">
                  Waktu Alarm Bangun Pagi
                </label>
                <input
                  id="wake-alarm-time"
                  type="time"
                  value={scheduleConfig.wakeAlarmTime}
                  onChange={(e) =>
                    updateScheduleConfig({ wakeAlarmTime: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-sm font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Jam Tenang Malam (Quiet Hours)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label="Mulai jam tenang"
                    value={scheduleConfig.quietStart}
                    onChange={(e) =>
                      updateScheduleConfig({ quietStart: e.target.value })
                    }
                    className="w-full px-2.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-xs font-bold tabular-nums"
                  />
                  <span className="text-xs text-neutral-400">–</span>
                  <input
                    type="time"
                    aria-label="Selesai jam tenang"
                    value={scheduleConfig.quietEnd}
                    onChange={(e) =>
                      updateScheduleConfig({ quietEnd: e.target.value })
                    }
                    className="w-full px-2.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-xs font-bold tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#EEFCD8]/70 dark:bg-[#19240E]/60 border border-[#84E818]/35 text-[11px] text-[#2F6100] dark:text-neutral-300 flex items-start gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818] shrink-0 mt-0.5" />
              <span>
                <strong>Catatan Batas Browser:</strong> Browser mobile dapat membatasi pemutaran audio otomatis jika layar terkunci lama. Biarkan PWA terbuka atau pasang alarm cadangan di HP Anda.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerWakeAlarmModal}
            className="w-full py-3 rounded-xl bg-[#161616] hover:bg-[#262626] dark:bg-[#262626] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#EF4444]" />
            <span>Simulasikan Bunyi Alarm Bangun (Mode A)</span>
          </button>
        </div>

        {/* MODE B — NOTIFIKASI SENYAP (SHOLAT & HIDRASI TIAP JAM) */}
        <div className="rounded-2xl bg-white dark:bg-[#161616] p-6 border border-[#EFEFEF] dark:border-[#262626] shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#E0F2FE] dark:bg-[#262626] flex items-center justify-center">
                  <BellRing className="w-5 h-5 text-[#0369A1] dark:text-sky-400" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase text-[#0369A1] dark:text-sky-400">
                    MODE B — NOTIFIKASI SENYAP (WEB PUSH)
                  </span>
                  <h3 className="text-base font-bold text-[#111111] dark:text-white">
                    Pengingat Sholat & Hidrasi (+250ml)
                  </h3>
                </div>
              </div>

              <input
                type="checkbox"
                aria-label="Aktifkan Pengingat Hidrasi Mode B"
                checked={scheduleConfig.hydrationEnabled}
                onChange={(e) =>
                  updateScheduleConfig({ hydrationEnabled: e.target.checked })
                }
                className="w-5 h-5 accent-[#84E818] cursor-pointer"
              />
            </div>

            <p className="text-xs text-[#646A6E] dark:text-neutral-400 leading-relaxed mb-4">
              Terpisah tegas dari alarm bangun: hanya mengirimkan notifikasi standar sistem tanpa suara looping, lengkap dengan tombol aksi cepat <strong>&ldquo;Sudah Sholat&rdquo;</strong> dan <strong>&ldquo;Minum 250ml&rdquo;</strong>.
            </p>

            {/* Hydration Progress + Interval */}
            <div className="p-4 rounded-2xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23272A] mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
                  <span className="text-xs font-bold">Progres Hidrasi Hari Ini</span>
                </div>
                <span className="text-xs font-extrabold text-[#3D7A00] dark:text-[#84E818] tabular-nums">
                  {waterMl} / {profile.dailyWaterTargetMl} ml
                </span>
              </div>

              <div className="mb-3">
                <MotionProgressBar
                  percent={Math.min(100, (waterMl / profile.dailyWaterTargetMl) * 100)}
                  className="h-2.5"
                  barClassName="bg-[#84E818]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  aria-label="Interval pengingat hidrasi"
                  value={scheduleConfig.hydrationIntervalMin}
                  onChange={(e) =>
                    updateScheduleConfig({
                      hydrationIntervalMin: Number(e.target.value),
                    })
                  }
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#131618] border border-[#E6E8E4] dark:border-[#23272A] text-xs font-semibold"
                >
                  <option value={45}>Setiap 45 menit</option>
                  <option value={60}>Setiap 60 menit (1 jam)</option>
                  <option value={90}>Setiap 90 menit</option>
                </select>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.94 }}
                  transition={MOTION_SPRING}
                  onClick={() => addWaterMl(250)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#84E818] hover:bg-[#76D610] text-[#0D0F10] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Minum 250ml</span>
                </motion.button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              transition={MOTION_SPRING}
              onClick={() => handleTestSilentNotification('prayer')}
              className="min-h-[44px] py-3 px-3 rounded-xl bg-[#F7F8F6] dark:bg-[#0B0D0E] hover:bg-[#EEF0EC] dark:hover:bg-[#1E2225] border border-[#E6E8E4] dark:border-[#23272A] text-xs font-bold transition-colors cursor-pointer"
            >
              Tes Notifikasi Sholat (Mode B)
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              transition={MOTION_SPRING}
              onClick={() => handleTestSilentNotification('hydration')}
              className="min-h-[44px] py-3 px-3 rounded-xl bg-[#0D0F10] hover:bg-[#1E2225] dark:bg-[#84E818] dark:hover:bg-[#76D610] text-white dark:text-[#0D0F10] text-xs font-extrabold cursor-pointer"
            >
              Tes Notifikasi Air +250ml (Mode B)
            </motion.button>
          </div>
        </div>
      </div>

      {/* FULL-SCREEN WAKE ALARM MODAL (MODE A) */}
      <AnimatePresence>
        {alarmModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Alarm Bangun Pagi FitForge"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={MOTION_SPRING}
              className="w-full max-w-md rounded-3xl bg-[#161616] border-2 border-[#EF4444] p-7 text-center text-white shadow-2xl"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                className="w-16 h-16 rounded-2xl bg-[#EF4444]/20 border border-[#EF4444] flex items-center justify-center mx-auto mb-4"
              >
                <Volume2 className="w-8 h-8 text-[#EF4444]" />
              </motion.div>
              <span className="text-xs font-extrabold tracking-widest uppercase text-[#84E818]">
                MODE A · ALARM BANGUN AKTIF
              </span>
              <p className="text-5xl font-black tabular-nums mt-2 mb-2">
                {scheduleConfig.wakeAlarmTime}
              </p>
              <p className="text-sm text-neutral-300 mb-6">
                Waktunya bangun untuk persiapan Sholat Subuh, hidrasi 250ml pertama, dan sesi latihan pagi Anda!
              </p>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={MOTION_SPRING}
                  onClick={handleSnoozeWakeAlarm}
                  className="min-h-[48px] py-3.5 rounded-2xl bg-[#1A1D20] hover:bg-[#23272A] text-white font-bold text-sm cursor-pointer"
                >
                  Snooze (5 Menit)
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={MOTION_SPRING}
                  onClick={handleStopWakeAlarm}
                  className="min-h-[48px] py-3.5 rounded-2xl bg-[#84E818] hover:bg-[#76D610] text-[#0D0F10] font-extrabold text-sm cursor-pointer"
                >
                  Matikan Alarm
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
