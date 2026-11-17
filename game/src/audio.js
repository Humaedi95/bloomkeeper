// Sound only: every note is synthesised with WebAudio, so the game ships no
// audio files and makes no network request. Sounds start only after the
// player presses a key or clicks, which is when browsers allow audio.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context !== null && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(frequency, seconds, type, volume, when) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const start = ctx.currentTime + (when || 0);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  function sweep(fromFrequency, toFrequency, seconds, type, volume) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const start = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(toFrequency, start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    collect() { tone(880, 0.12, 'sine', 0.12); tone(1320, 0.1, 'sine', 0.08, 0.05); },
    bloom() { tone(523, 0.14, 'triangle', 0.14); tone(659, 0.14, 'triangle', 0.14, 0.08); tone(784, 0.2, 'triangle', 0.14, 0.16); },
    sting() { sweep(220, 70, 0.3, 'sawtooth', 0.16); },
    dash() { sweep(300, 900, 0.16, 'sine', 0.08); },
    shield() { tone(440, 0.2, 'sine', 0.12); tone(660, 0.25, 'sine', 0.1, 0.1); },
    win() { [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, 0.3, 'triangle', 0.15, index * 0.13)); },
    lose() { [392, 330, 262].forEach((frequency, index) => tone(frequency, 0.3, 'triangle', 0.13, index * 0.16)); },
  };
}
