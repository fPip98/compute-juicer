// Pure Web Audio API procedural synthesizer + generative industrial ambient BGM.
// Zero external audio files required.

const PENTATONIC_HZ = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
// Dark industrial minor-pentatonic bassline & arpeggio (D minor / Dorian tech vibe)
const BGM_BASS_HZ = [73.42, 73.42, 87.31, 73.42, 110.0, 98.0, 87.31, 65.41]; // D2, D2, F2, D2, A2, G2, F2, C2
const BGM_ARP_HZ = [293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 329.63, 261.63];

class ComputeAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private gdbFilter: BiquadFilterNode | null = null;
  private muted = false;
  private bgmEnabled = true;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private highTension = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.gdbFilter = this.ctx.createBiquadFilter();
      this.gdbFilter.type = 'lowpass';
      this.gdbFilter.frequency.value = 20000;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.28;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.bgmEnabled && !this.muted ? 0.22 : 0;

      this.bgmGain.connect(this.gdbFilter);
      this.gdbFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.bgmEnabled && this.bgmTimer === null) {
      this.startBgmLoop();
    }
    return this.ctx;
  }

  private startBgmLoop(): void {
    if (typeof window === 'undefined' || this.bgmTimer !== null) return;
    const stepMs = 265; // ~113 BPM 8th-note industrial pulse
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.bgmGain || !this.bgmEnabled || this.muted) return;
      if (this.ctx.state !== 'running') return;

      const now = this.ctx.currentTime;
      const step = this.bgmStep++;
      const barPos = step % 8;

      // 1. Deep warm sub-bass pulse on beats 0, 2, 4, 6 (or faster under high tension)
      if (barPos % 2 === 0 || (this.highTension && barPos === 7)) {
        const bassIdx = Math.floor(step / 2) % BGM_BASS_HZ.length;
        const bassOsc = this.ctx.createOscillator();
        const bassFilter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(BGM_BASS_HZ[bassIdx], now);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(this.highTension ? 360 : 230, now);
        bassFilter.frequency.exponentialRampToValueAtTime(110, now + 0.22);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.28, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        bassOsc.connect(bassFilter);
        bassFilter.connect(g);
        g.connect(this.bgmGain);
        bassOsc.start(now);
        bassOsc.stop(now + 0.25);
      }

      // 2. Subtle crystalline oscilloscope arpeggio pluck
      if (step % 2 === 1 || this.highTension) {
        const arpFreq = BGM_ARP_HZ[step % BGM_ARP_HZ.length];
        const arpOsc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        arpOsc.type = 'triangle';
        arpOsc.frequency.setValueAtTime(arpFreq, now);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(this.highTension ? 0.09 : 0.055, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        arpOsc.connect(g);
        g.connect(this.bgmGain);
        arpOsc.start(now);
        arpOsc.stop(now + 0.18);
      }

      // 3. Soft clock tick on off-beats
      if (barPos % 2 === 1) {
        const tickOsc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        tickOsc.type = 'square';
        tickOsc.frequency.setValueAtTime(this.highTension ? 2400 : 1800, now);
        g.gain.setValueAtTime(0.018, now);
        g.gain.exponentialRampToValueAtTime(0.0005, now + 0.018);
        tickOsc.connect(g);
        g.connect(this.bgmGain);
        tickOsc.start(now);
        tickOsc.stop(now + 0.02);
      }
    }, stepMs);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.28, this.ctx.currentTime, 0.03);
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(
        !muted && this.bgmEnabled ? 0.22 : 0,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    const ctx = this.ensureContext();
    if (this.bgmGain && ctx) {
      this.bgmGain.gain.setTargetAtTime(
        enabled && !this.muted ? 0.22 : 0,
        ctx.currentTime,
        0.06,
      );
    }
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public setTension(high: boolean): void {
    this.highTension = high;
  }

  /** Crisp tactile mechanical click when staging/hovering cards */
  public playClick(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.gdbFilter) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.03);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.gdbFilter);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /** Balatro-style escalating pentatonic tick during pipeline COMMIT */
  public playPipelineTick(stepIndex: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.gdbFilter) return;
    const now = ctx.currentTime;
    const freq = PENTATONIC_HZ[Math.min(stepIndex, PENTATONIC_HZ.length - 1)];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.03, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.gdbFilter);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Juicy overdrive chord burst when 3+ domains chain together */
  public playOverdriveBurst(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.gdbFilter) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      gain.gain.setValueAtTime(0.001, now + idx * 0.035);
      gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.035 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.28);
      osc.connect(gain);
      gain.connect(this.gdbFilter!);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.3);
    });
  }

  /** Turbo sweep + harmonic fifth lock when crossing the Roofline Ridge Point */
  public playRooflineShift(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.gdbFilter) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.22);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.gdbFilter);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  /** Tape-stop power-down drop for OOM / Thermal Shutdown */
  public playOomPanic(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.gdbFilter) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.42);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.gdbFilter);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  /** Bright chord for SLA Pass */
  public playSlaPass(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.gdbFilter) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.001, now + idx * 0.045);
      gain.gain.linearRampToValueAtTime(0.26, now + idx * 0.045 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.34);
      osc.connect(gain);
      gain.connect(this.gdbFilter!);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.36);
    });
  }

  /** Hardware relay click + muffling lowpass filter when GDB Breakpoint halts execution */
  public setGdbHaltMode(halted: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.gdbFilter) return;
    const now = ctx.currentTime;

    if (!this.muted) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(halted ? 1400 : 1800, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    }

    this.gdbFilter.frequency.cancelScheduledValues(now);
    this.gdbFilter.frequency.exponentialRampToValueAtTime(
      halted ? 460 : 20000,
      now + 0.16,
    );
  }
}

export const audioSynth = new ComputeAudioSynth();
