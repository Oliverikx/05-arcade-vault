// Minesweeper sound — Web Audio synthesis, no assets, framework-free.

export type SoundName =
  "reveal" | "flood" | "flag" | "unflag" | "chord" | "lose" | "clear" | "tick";

export interface Sound {
  unlock(): void; // create/resume the AudioContext on a user gesture
  play(name: SoundName): void; // no-op while muted or before the context is allowed
  setMuted(muted: boolean): void;
  destroy(): void; // closes the AudioContext
}

const MASTER_GAIN = 0.25;
const MAX_VOICES = 6;

// Length in seconds of each sound, used to count simultaneous voices.
const DURATIONS: Record<SoundName, number> = {
  reveal: 0.06,
  flood: 0.12,
  flag: 0.05,
  unflag: 0.05,
  chord: 0.09,
  lose: 0.7,
  clear: 0.36,
  tick: 0.03,
};

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  let voiceEnds: number[] = []; // ctx.currentTime at which each voice ends

  function ensure(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    return ctx;
  }

  /** One oscillator note with a fast attack and exponential release. */
  function tone(
    type: OscillatorType,
    from: number,
    to: number,
    start: number,
    dur: number,
    vol = 1,
  ) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** White-noise burst through a lowpass sweeping `fromHz` → `toHz`. */
  function noiseSweep(dur: number, fromHz: number, toHz: number, vol = 0.8) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(fromHz, t0);
    filter.frequency.exponentialRampToValueAtTime(toHz, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  }

  const SFX: Record<SoundName, () => void> = {
    reveal: () => tone("square", 520, 520, 0, 0.06, 0.5),
    flood: () => tone("triangle", 400, 800, 0, 0.12),
    flag: () => tone("square", 880, 880, 0, 0.05, 0.5),
    unflag: () => tone("square", 440, 440, 0, 0.05, 0.5),
    chord: () => tone("square", 660, 660, 0, 0.09, 0.5),
    lose: () => {
      noiseSweep(0.7, 1200, 120);
      tone("sine", 200, 50, 0, 0.7);
    },
    clear: () => {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone("triangle", f, f, i * 0.09, 0.09),
      );
    },
    tick: () => tone("sine", 1200, 1200, 0, 0.03, 0.5),
  };

  return {
    unlock() {
      if (muted) return;
      const c = ensure();
      if (c && c.state === "suspended") void c.resume();
    },
    play(name) {
      if (muted || !ctx || ctx.state !== "running") return;
      const now = ctx.currentTime;
      voiceEnds = voiceEnds.filter((end) => end > now);
      if (voiceEnds.length >= MAX_VOICES) return;
      voiceEnds.push(now + DURATIONS[name]);
      SFX[name]();
    },
    setMuted(next) {
      muted = next;
    },
    destroy() {
      if (ctx) void ctx.close();
      ctx = null;
      master = null;
      voiceEnds = [];
    },
  };
}
