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
 * Authentic Indonesian Cerdas Cermat Horn & Resonant Bell ("Klakson & Lonceng Cerdas Cermat")
 * Menggabungkan semburan klakson kuis dual-tone yang tegas dan bertenaga dengan dentang lonceng
 * tembaga panggung yang nyaring, bergema, dan berbunyi jauh lebih keras ("lebih keras lagi kaya lonceng").
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

    // Master Dynamics Compressor: Memaksimalkan volume audio panggung agar sangat keras
    // tanpa terjadi distorsi digital clipping (0 dBFS ceiling)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, now);
    compressor.knee.setValueAtTime(4, now);
    compressor.ratio.setValueAtTime(16, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.12, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.95, now); // Output volume maksimal dan bertenaga

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // ==========================================
    // 1. KOMPONEN KLAKSON (Dual-Tone Stadium/Quiz Horn Blast)
    // ==========================================
    const hornDuration = 0.48;
    const hornGain = ctx.createGain();
    hornGain.gain.setValueAtTime(0, now);
    hornGain.gain.linearRampToValueAtTime(0.70, now + 0.006); // Serangan cepat & bertenaga
    hornGain.gain.setValueAtTime(0.70, now + hornDuration - 0.06);
    hornGain.gain.exponentialRampToValueAtTime(0.001, now + hornDuration);

    // WaveShaper Distortion untuk karakter serak khas klakson elektromekanis
    const hornDistortion = ctx.createWaveShaper();
    const nSamples = 1024;
    const curve = new Float32Array(nSamples);
    const k = 12;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    hornDistortion.curve = curve;
    hornDistortion.oversample = '2x';

    // Frekuensi Klakson: Akor A4 (440 Hz) + C#5 (554.37 Hz) + sub-bass A3 (220 Hz)
    const hornOsc1 = ctx.createOscillator();
    hornOsc1.type = 'sawtooth';
    hornOsc1.frequency.setValueAtTime(440.0, now);

    const hornOsc2 = ctx.createOscillator();
    hornOsc2.type = 'sawtooth';
    hornOsc2.frequency.setValueAtTime(554.37, now);

    const hornOsc3 = ctx.createOscillator();
    hornOsc3.type = 'square';
    hornOsc3.frequency.setValueAtTime(440.0, now);

    const hornOscSub = ctx.createOscillator();
    hornOscSub.type = 'sawtooth';
    hornOscSub.frequency.setValueAtTime(220.0, now);

    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'peaking';
    hornFilter.frequency.setValueAtTime(1100, now);
    hornFilter.gain.setValueAtTime(5, now);
    hornFilter.Q.setValueAtTime(1.4, now);

    hornOsc1.connect(hornDistortion);
    hornOsc2.connect(hornDistortion);
    hornOsc3.connect(hornDistortion);
    hornOscSub.connect(hornDistortion);
    hornDistortion.connect(hornFilter);
    hornFilter.connect(hornGain);
    hornGain.connect(compressor);

    hornOsc1.start(now);
    hornOsc2.start(now);
    hornOsc3.start(now);
    hornOscSub.start(now);

    hornOsc1.stop(now + hornDuration);
    hornOsc2.stop(now + hornDuration);
    hornOsc3.stop(now + hornDuration);
    hornOscSub.stop(now + hornDuration);

    // ==========================================
    // 2. KOMPONEN LONCENG (Loud Ringing Brass Competition Bell)
    // ==========================================
    const bellDuration = 1.35; // Ekor dengung gema lonceng yang panjang

    const bellGain = ctx.createGain();
    bellGain.gain.setValueAtTime(0, now);
    bellGain.gain.linearRampToValueAtTime(0.90, now + 0.002); // Dentang palu logam instan
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + bellDuration);

    // Harmonik Inharmonis Lonceng Kuningan Asli:
    // Pukulan Utama (880 Hz A5 & 1046.5 Hz C6) + Chime Gemerincing (1760 Hz & 2637 Hz) + Hum Bass (440 Hz)
    const bellPartials = [
      { freq: 880.0, gain: 0.55, decay: 1.25 },  // Nada pokok dentang lonceng
      { freq: 1046.5, gain: 0.40, decay: 1.05 }, // Tierce minor
      { freq: 1318.5, gain: 0.35, decay: 0.95 }, // Kuinta E6
      { freq: 1760.0, gain: 0.35, decay: 0.85 }, // Oktaf nominal lonceng
      { freq: 2637.0, gain: 0.25, decay: 0.60 }, // Dentang logam tinggi
      { freq: 440.0, gain: 0.40, decay: 1.35 },  // Dengung hum tembaga dalam
    ];

    bellPartials.forEach((partial) => {
      const bOsc = ctx.createOscillator();
      const bPartGain = ctx.createGain();

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(partial.freq, now);

      bPartGain.gain.setValueAtTime(partial.gain, now);
      bPartGain.gain.exponentialRampToValueAtTime(0.001, now + partial.decay);

      bOsc.connect(bPartGain);
      bPartGain.connect(bellGain);

      bOsc.start(now);
      bOsc.stop(now + partial.decay);
    });

    bellGain.connect(compressor);
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
