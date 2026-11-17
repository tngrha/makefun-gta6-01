// SOLMAR HEAT — audio.js
// One clear job: all sound, synthesised live with WebAudio. No audio files,
// no network: engine hum, sirens, gunshots, pickups and a bassline loop.

export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
    enabled: false, musicTimer: null, sirenNodes: [],
  };

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      const engineOsc2 = audio.ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 58;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      engineOsc2.start();
      audio.engineOsc2 = engineOsc2;
      audio.enabled = true;
      return true;
    } catch (e) {
      audio.enabled = false;
      return false;
    }
  }

  // A short filtered noise burst: gunshot, thud, crash.
  function noiseBurst(duration, freq, gainValue) {
    if (!ensure()) return;
    const t = audio.ctx.currentTime;
    const buffer = audio.ctx.createBuffer(1, Math.floor(audio.ctx.sampleRate * duration), audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(gainValue, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter); filter.connect(g); g.connect(audio.master);
    src.start(t);
  }

  function tone(freq, duration, type, gainValue, when = 0) {
    if (!ensure()) return;
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(gainValue, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g); g.connect(audio.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  // Two-tone police siren, looped while any police car is near.
  function setSiren(on) {
    if (!ensure()) return;
    if (on && audio.sirenNodes.length === 0) {
      const osc = audio.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 700;
      const lfo = audio.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      const g = audio.ctx.createGain();
      g.gain.value = 0.05;
      osc.connect(g); g.connect(audio.master);
      osc.start(); lfo.start();
      audio.sirenNodes = [osc, lfo];
    } else if (!on && audio.sirenNodes.length) {
      for (const n of audio.sirenNodes) { try { n.stop(); } catch (e) { /* already stopped */ } }
      audio.sirenNodes = [];
    }
  }

  // A lazy bassline loop: root notes of a minor groove, one bar at a time.
  const BASSLINE = [55, 0, 55, 65.4, 0, 55, 49, 58.3, 55, 0, 55, 65.4, 82.4, 0, 73.4, 65.4];
  let barStep = 0;
  function startMusic() {
    if (!ensure() || audio.musicTimer) return;
    audio.musicTimer = setInterval(() => {
      if (!audio.ctx || audio.ctx.state !== 'running') return;
      const freq = BASSLINE[barStep % BASSLINE.length];
      barStep += 1;
      if (freq > 0) {
        const t = audio.ctx.currentTime;
        const osc = audio.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = audio.ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.connect(g); g.connect(audio.musicGain);
        osc.start(t); osc.stop(t + 0.45);
      }
      // A soft hat tick on the off-beats.
      if (barStep % 2 === 0) {
        const t = audio.ctx.currentTime;
        const buffer = audio.ctx.createBuffer(1, 1200, audio.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.4;
        const src = audio.ctx.createBufferSource();
        src.buffer = buffer;
        const g = audio.ctx.createGain();
        g.gain.value = 0.25;
        src.connect(g); g.connect(audio.musicGain);
        src.start(t);
      }
    }, 240);
  }

  return {
    unlock() { ensure(); startMusic(); },
    setEngine(speed01, driving) {
      if (!audio.ctx || !audio.engineOsc) return;
      const target = driving ? 0.05 + speed01 * 0.1 : 0;
      audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
      const f = 55 + speed01 * 130;
      audio.engineOsc.frequency.setTargetAtTime(f, audio.ctx.currentTime, 0.08);
      audio.engineOsc2.frequency.setTargetAtTime(f * 1.015, audio.ctx.currentTime, 0.08);
    },
    gunshot() { noiseBurst(0.16, 1800, 0.5); },
    enemyShot() { noiseBurst(0.14, 1200, 0.25); },
    crash() { noiseBurst(0.3, 500, 0.6); },
    pickup() { tone(880, 0.12, 'sine', 0.3); tone(1320, 0.18, 'sine', 0.3, 0.09); },
    cash() { tone(660, 0.1, 'square', 0.18); tone(990, 0.16, 'square', 0.18, 0.08); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.11)); },
    denied() { tone(160, 0.2, 'square', 0.25); },
    siren(on) { setSiren(on); },
    step() { noiseBurst(0.05, 700, 0.06); },
  };
}
