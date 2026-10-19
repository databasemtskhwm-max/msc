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

// Global auto-unlock on user gesture so stage screen and tablets can play sound
if (typeof window !== 'undefined') {
  const tryUnlock = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    } else if (!audioCtx) {
      getAudioContext();
    }
  };
  window.addEventListener('pointerdown', tryUnlock, { passive: true });
  window.addEventListener('keydown', tryUnlock, { passive: true });
  window.addEventListener('touchstart', tryUnlock, { passive: true });
}

export function unlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === 'suspended') {
    return ctx.resume().then(() => ctx.state === 'running').catch(() => false);
  }
  return Promise.resolve(ctx.state === 'running');
}

export function isAudioUnlocked(): boolean {
  if (!audioCtx) return false;
  return audioCtx.state === 'running';
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
}

export function getAudioMuted(): boolean {
  return isMuted;
}

/**
 * Authentic Indonesian Cerdas Cermat Electronic Quiz Buzzer Synthesizer
 * Produces the iconic loud, harsh, piercing "TEEEEET!" electronic horn sound
 * using harmonic sawtooth + square beating frequencies with megaphone resonance.
 */
export function playBuzzerSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const duration = 0.75;

    // Master envelope with punch attack and crisp cutoff
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.55, now + 0.008);
    masterGain.gain.setValueAtTime(0.55, now + duration - 0.06);
    masterGain.gain.linearRampToValueAtTime(0.001, now + duration);

    // Bandpass megaphone horn filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(1.8, now);

    // Distortion WaveShaper for characteristic gritty electromechanical buzz
    const distortion = ctx.createWaveShaper();
    const nSamples = 2048;
    const curve = new Float32Array(nSamples);
    const k = 15;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    distortion.curve = curve;
    distortion.oversample = '2x';

    // Frequencies: Bb4 (466.16Hz) + A4 (440Hz) produces authentic 26Hz beating buzz
    const osc1 = ctx.createOscillator(); // Main Bb4
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(466.16, now);

    const osc2 = ctx.createOscillator(); // Detuned A4 for beat flutter
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(440.0, now);

    const osc3 = ctx.createOscillator(); // Square wave for relay vibration
    osc3.type = 'square';
    osc3.frequency.setValueAtTime(466.16, now);

    const oscSub = ctx.createOscillator(); // Sub Bb3 for chest presence
    oscSub.type = 'sawtooth';
    oscSub.frequency.setValueAtTime(233.08, now);

    const oscHigh = ctx.createOscillator(); // Piercing Bb5 high overtone
    oscHigh.type = 'sawtooth';
    oscHigh.frequency.setValueAtTime(932.33, now);

    // Mixer gains
    const g1 = ctx.createGain(); g1.gain.value = 0.35;
    const g2 = ctx.createGain(); g2.gain.value = 0.30;
    const g3 = ctx.createGain(); g3.gain.value = 0.25;
    const gSub = ctx.createGain(); gSub.gain.value = 0.20;
    const gHigh = ctx.createGain(); gHigh.gain.value = 0.15;

    osc1.connect(g1); g1.connect(distortion);
    osc2.connect(g2); g2.connect(distortion);
    osc3.connect(g3); g3.connect(distortion);
    oscSub.connect(gSub); gSub.connect(distortion);
    oscHigh.connect(gHigh); gHigh.connect(distortion);

    distortion.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    oscSub.start(now);
    oscHigh.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
    oscSub.stop(now + duration);
    oscHigh.stop(now + duration);
  } catch (e) {
    console.warn('Audio playback error:', e);
  }
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
