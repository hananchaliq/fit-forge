/**
 * Web Audio API synthesizer & Web Speech API Indonesian Voice Coach
 * - Mode A: Escalating Wake Alarm synthesizer (looping synth with gradual volume ramp)
 * - Workout & Run Chimes (rep beep, set complete fanfare, rest timer ticks)
 * - Voice Coach in Bahasa Indonesia (speechSynthesis)
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private alarmInterval: number | null = null;
  private alarmGainValue = 0.08;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a crisp short chime for workout reps / rest timer ticks
   */
  public playChime(type: 'rep' | 'set_done' | 'rest_tick' | 'start' = 'rep'): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'rep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'rest_tick') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'set_done' || type === 'start') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.32); // C6
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    }
  }

  /**
   * Mode A — Loud Wake Alarm with progressive volume escalation.
   * Strictly separated from Mode B (silent prayer/hydration push notifications).
   */
  public startWakeAlarm(): void {
    this.stopWakeAlarm();
    this.alarmGainValue = 0.12;

    const triggerPulse = () => {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Escalate volume up to 0.85
      this.alarmGainValue = Math.min(0.85, this.alarmGainValue + 0.06);

      const freqs = [880, 1108.73, 1318.51, 1760];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(this.alarmGainValue * 0.4, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.11);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.11);
      });
    };

    triggerPulse();
    if (typeof window !== 'undefined') {
      this.alarmInterval = window.setInterval(triggerPulse, 900);
    }
  }

  public stopWakeAlarm(): void {
    if (this.alarmInterval !== null && typeof window !== 'undefined') {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  public speakIndonesian(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.02;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore if speech synthesis is blocked
    }
  }
}

export const soundEngine = new SoundEngine();
