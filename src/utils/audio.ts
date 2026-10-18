// Web Audio API pure synthesizer - zero external sound files required

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
}

export function getAudioMuted(): boolean {
  return isMuted;
}

export function playBuzzerSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'square';
  osc1.frequency.setValueAtTime(220, ctx.currentTime);
  osc2.frequency.setValueAtTime(224, ctx.currentTime);

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.6);
  osc2.stop(ctx.currentTime + 0.6);
}

export function playCorrectSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

    gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + idx * 0.08);
    osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
  });
}

export function playWrongSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [280, 210]; // descending buzz
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);

    gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + idx * 0.15);
    osc.stop(ctx.currentTime + idx * 0.15 + 0.25);
  });
}

export function playTimerTick() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

export function playTimesUpSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Deep dramatic gong strike with dual reverberating harmonic frequencies
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';
  sub.type = 'sine';

  osc1.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
  osc1.frequency.exponentialRampToValueAtTime(164.81, ctx.currentTime + 2.0);

  osc2.frequency.setValueAtTime(440, ctx.currentTime); // A4
  osc2.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 1.8);

  sub.frequency.setValueAtTime(110, ctx.currentTime); // A2 deep bass impact
  sub.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 2.2);

  gain.gain.setValueAtTime(0.6, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.4);

  osc1.connect(gain);
  osc2.connect(gain);
  sub.connect(gain);
  gain.connect(ctx.destination);

  osc1.start();
  osc2.start();
  sub.start();
  osc1.stop(ctx.currentTime + 2.4);
  osc2.stop(ctx.currentTime + 2.4);
  sub.stop(ctx.currentTime + 2.4);
}

export function playFanfareSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Triumphant brass victory fanfare (C4 -> G4 -> C5 -> E5 -> G5 chord strike)
  const fanfareNotes = [
    { freq: 261.63, start: 0, dur: 0.15 },
    { freq: 329.63, start: 0.15, dur: 0.15 },
    { freq: 392.0, start: 0.3, dur: 0.15 },
    { freq: 523.25, start: 0.45, dur: 0.6 },
    { freq: 659.25, start: 0.45, dur: 0.6 },
    { freq: 783.99, start: 0.45, dur: 0.8 },
  ];

  fanfareNotes.forEach((note) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);

    gain.gain.setValueAtTime(0, ctx.currentTime + note.start);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + note.start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.start + note.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + note.start);
    osc.stop(ctx.currentTime + note.start + note.dur);
  });
}

export function playTensionWarningSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // Emergency tension pulse / alarm klaxon
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
  osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.6);

  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.7);
}
