// Froggy sound — Web Audio synthesis, no assets, framework-free.

export type FroggySfx =
  | "hop"
  | "splash"
  | "squash"
  | "timeout"
  | "pad"
  | "levelClear"
  | "gameOver"
  | "fly"
  | "dive";

export interface FroggySound {
  unlock(): void; // create/resume AudioContext on user gesture
  play(sfx: FroggySfx): void;
  setMuted(muted: boolean): void;
  suspend(): void;
  resume(): void;
  destroy(): void; // close AudioContext
}

const MASTER_GAIN = 0.15;

export function createFroggySound(): FroggySound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  let suspended = false;

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

  function noise(start: number, dur: number, vol = 0.6) {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + start;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g).connect(master);
    src.start(t0);
  }

  const SFX: Record<FroggySfx, () => void> = {
    hop: () => tone("square", 440, 660, 0, 0.06, 0.5),
    splash: () => {
      noise(0, 0.2);
      tone("sine", 200, 80, 0, 0.3);
    },
    squash: () => tone("sawtooth", 150, 40, 0, 0.25),
    timeout: () => {
      tone("square", 440, 440, 0, 0.1, 0.5);
      tone("square", 330, 330, 0.1, 0.1, 0.5);
      tone("square", 220, 220, 0.2, 0.1, 0.5);
    },
    pad: () => {
      [523, 659, 784].forEach((f, i) => tone("triangle", f, f, i * 0.07, 0.07));
    },
    levelClear: () => {
      [523, 659, 784, 880, 1047].forEach((f, i) =>
        tone("triangle", f, f, i * 0.14, 0.14),
      );
    },
    gameOver: () => tone("square", 392, 98, 0, 0.4, 0.5),
    fly: () => tone("square", 1200, 1200, 0, 0.08, 0.4),
    dive: () => tone("sine", 300, 300, 0, 0.04, 0.5),
  };

  return {
    unlock() {
      if (muted) return;
      const c = ensure();
      if (c && c.state === "suspended" && !suspended) void c.resume();
    },
    play(sfx) {
      if (muted || suspended || !ctx) return;
      if (ctx.state === "suspended") return;
      SFX[sfx]();
    },
    setMuted(next) {
      muted = next;
    },
    suspend() {
      suspended = true;
      if (ctx && ctx.state === "running") void ctx.suspend();
    },
    resume() {
      suspended = false;
      if (ctx && !muted && ctx.state === "suspended") void ctx.resume();
    },
    destroy() {
      if (ctx) void ctx.close();
      ctx = null;
      master = null;
    },
  };
}
