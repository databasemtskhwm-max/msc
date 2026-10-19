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

let activeBuzzerController: { stop: () => void } | null = null;

export function stopBuzzerSound() {
  if (activeBuzzerController) {
    try {
      activeBuzzerController.stop();
    } catch (_) {}
    activeBuzzerController = null;
  }
}

/**
 * Authentic Indonesian Lonceng Alarm Cerdas Cermat (Electric School/Fire Alarm Bell)
 * Menghasilkan bunyi lonceng alarm listrik mekanis ("KRIIIIINNNNNGGGGGG") yang sangat keras,
 * bergetar cepat (~20 Hz pukulan palu pada kubah lonceng kuningan), berbunyi selama 5 detik penuh,
 * dan dapat dihentikan seketika jika Juri melakukan Reset Bel.
 */
export function playBuzzerSound() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Hentikan suara bel aktif sebelumnya jika ada
    stopBuzzerSound();

    const now = ctx.currentTime;
    const totalDuration = 5.0; // Durasi bunyi tepat 5 detik sesuai permintaan!
    const strikeEnd = 4.75;    // Palu alarm berhenti di 4.75s, gema lonceng meluruh halus sampai 5.0s

    // Master Dynamics Compressor: Memaksimalkan volume alarm agar sangat keras dan tembus
    // di speaker aula/panggung tanpa distorsi digital clipping (0 dBFS ceiling)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, now);
    compressor.knee.setValueAtTime(4, now);
    compressor.ratio.setValueAtTime(16, now);
    compressor.attack.setValueAtTime(0.002, now);
    compressor.release.setValueAtTime(0.08, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.95, now + 0.02); // Lonjakan instan bertenaga
    masterGain.gain.setValueAtTime(0.95, now + strikeEnd);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    const oscillatorsToClean: OscillatorNode[] = [];

    // ==========================================
    // 1. MODULASI PALU LONCENG ALISTIK (20 Hz Striker Clapper)
    // Menghasilkan efek getaran dentang mekanis cepat "KRIIIIINNNNGGGG"
    // ==========================================
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.setValueAtTime(20, now); // 20 pukulan palu per detik

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.45, now);

    const bellModGain = ctx.createGain();
    bellModGain.gain.setValueAtTime(0.60, now);

    lfo.connect(lfoGain);
    lfoGain.connect(bellModGain.gain);

    lfo.start(now);
    lfo.stop(now + strikeEnd);
    oscillatorsToClean.push(lfo);

    // ==========================================
    // 2. NADA HARMONIK KUBAH LONCENG ALARM (Brass Bell Dome Partials)
    // ==========================================
    const bellPartials = [
      { freq: 880.0, gain: 0.40, type: 'sine' as OscillatorType },      // Nada pokok A5
      { freq: 1175.0, gain: 0.45, type: 'triangle' as OscillatorType },  // Resonansi kubah D6
      { freq: 1568.0, gain: 0.35, type: 'sine' as OscillatorType },      // Overtone terang G6
      { freq: 2093.0, gain: 0.30, type: 'sine' as OscillatorType },      // Chime tajam C7
      { freq: 2794.0, gain: 0.25, type: 'triangle' as OscillatorType },  // Shimmer logam F7
      { freq: 440.0, gain: 0.35, type: 'sine' as OscillatorType },       // Hum bass kuningan A4
    ];

    bellPartials.forEach((partial) => {
      const osc = ctx.createOscillator();
      const pGain = ctx.createGain();

      osc.type = partial.type;
      osc.frequency.setValueAtTime(partial.freq, now);

      pGain.gain.setValueAtTime(partial.gain, now);

      osc.connect(pGain);
      pGain.connect(bellModGain);

      osc.start(now);
      osc.stop(now + totalDuration);
      oscillatorsToClean.push(osc);
    });

    bellModGain.connect(compressor);

    // ==========================================
    // 3. DENTANG KLIK PALU LOGAM (Metallic Clapper Transient)
    // Memberikan ketukan tajam ("CLANG-CLANG") di setiap pukulan palu lonceng
    // ==========================================
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(1760, now);

    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.setValueAtTime(2200, now);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.20, now);

    clickOsc.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(bellModGain);

    clickOsc.start(now);
    clickOsc.stop(now + strikeEnd);
    oscillatorsToClean.push(clickOsc);

    // ==========================================
    // 4. KONTROLER INTERUPSI SEGERA (Bisa distop saat Juri Reset)
    // ==========================================
    activeBuzzerController = {
      stop: () => {
        try {
          const stopTime = ctx.currentTime;
          masterGain.gain.cancelScheduledValues(stopTime);
          masterGain.gain.setValueAtTime(masterGain.gain.value, stopTime);
          masterGain.gain.linearRampToValueAtTime(0.0001, stopTime + 0.04);
          setTimeout(() => {
            oscillatorsToClean.forEach((osc) => {
              try {
                osc.stop();
                osc.disconnect();
              } catch (_) {}
            });
            masterGain.disconnect();
          }, 50);
        } catch (_) {}
      },
    };

    // Bersihkan referensi controller setelah 5 detik
    setTimeout(() => {
      activeBuzzerController = null;
    }, totalDuration * 1000 + 100);

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
