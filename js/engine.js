// ============================================================
// ENGINE.JS - Core Systems: Config, Input, Sound, Camera, Utils
// ============================================================

// ---- CONFIGURATION ----
const CFG = {
    // Display
    WIDTH: 960,
    HEIGHT: 540,
    TILE: 32,

    // Physics (per frame at 60fps)
    GRAVITY: 0.45,
    TERMINAL_VEL: 14,

    // Player physics
    GROUND_ACCEL: 0.065,
    AIR_ACCEL: 0.12,
    DECEL: 0.5,
    FRICTION: 0.046,
    TOP_SPEED: 7,
    ROLL_DECEL: 0.025,
    JUMP_FORCE: -11.5,
    MIN_JUMP: -4,
    JUMP_BUFFER_FRAMES: 10,  // Press jump ~166ms before landing, still jump
    COYOTE_TIME_FRAMES: 8,   // Jump within ~133ms after leaving ledge
    SPINDASH_POWER: 8,
    SPINDASH_CHARGE: 2,
    SPINDASH_MAX: 14,

    // Camera
    CAM_LEAD_X: 48,
    CAM_SMOOTH: 0.08,
    CAM_SMOOTH_Y: 0.05,

    // Gameplay
    START_LIVES: 3,
    RING_VALUE: 10,
    ENEMY_VALUE: 100,
    INVINCIBLE_TIME: 120, // frames
    RING_SCATTER_COUNT: 16,
    RING_SCATTER_LIFE: 180, // frames
    RING_ATTRACT_DIST: 0, // 0 = no magnet
};

// ---- INPUT SYSTEM ----
const Input = {
    keys: {},
    prev: {},
    _pressBuffer: {},   // Buffered presses (survives quick press+release)
    _releaseBuffer: {}, // Buffered releases

    init() {
        window.addEventListener('keydown', e => {
            if (!this.keys[e.code]) {
                this._pressBuffer[e.code] = true; // Buffer the press event
            }
            this.keys[e.code] = true;
            // Prevent scrolling with game keys
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this._releaseBuffer[e.code] = true;
        });
        // Lose focus = release all
        window.addEventListener('blur', () => {
            this.keys = {};
            this._pressBuffer = {};
            this._releaseBuffer = {};
        });
    },

    update() {
        this.prev = { ...this.keys };
        // Clear buffers after they've been consumed
        this._pressBuffer = {};
        this._releaseBuffer = {};
    },

    pressed(code) { return !!this._pressBuffer[code] || (this.keys[code] && !this.prev[code]); },
    held(code) { return !!this.keys[code]; },
    released(code) { return !!this._releaseBuffer[code] || (!this.keys[code] && this.prev[code]); },

    get left() { return this.held('ArrowLeft') || this.held('KeyA'); },
    get right() { return this.held('ArrowRight') || this.held('KeyD'); },
    get up() { return this.held('ArrowUp') || this.held('KeyW'); },
    get down() { return this.held('ArrowDown') || this.held('KeyS'); },
    get jump() { return this.pressed('Space') || this.pressed('KeyZ'); },
    get jumpHeld() { return this.held('Space') || this.held('KeyZ'); },
    get jumpReleased() { return this.released('Space') || this.released('KeyZ'); },
    get enter() { return this.pressed('Enter') || this.pressed('NumpadEnter'); },
};

// ---- SOUND SYSTEM (Web Audio API) ----
// A proper mix: master compressor + convolution reverb send, all SFX
// are multi-voice with filters and ADSR envelopes, and music layers a
// procedural drum kit + detuned melody voices + filtered bass.
const Sound = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    sfxSend: null,    // SFX -> reverb send
    musicSend: null,  // Music -> reverb send
    reverbIn: null,
    reverbOut: null,
    compressor: null,
    noiseBuffer: null,
    musicPlaying: false,
    musicNodes: [],
    musicGeneration: 0,

    init() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx();

            // Master bus: gain -> compressor -> destination
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.value = -14;
            this.compressor.knee.value = 10;
            this.compressor.ratio.value = 4;
            this.compressor.attack.value = 0.005;
            this.compressor.release.value = 0.15;
            this.compressor.connect(this.ctx.destination);

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.compressor);

            // Reverb bus: in -> convolver -> out -> master
            const convolver = this.ctx.createConvolver();
            convolver.buffer = this._makeImpulse(1.6, 2.0);
            this.reverbIn = this.ctx.createGain();
            this.reverbIn.gain.value = 1;
            this.reverbOut = this.ctx.createGain();
            this.reverbOut.gain.value = 0.35;
            this.reverbIn.connect(convolver);
            convolver.connect(this.reverbOut);
            this.reverbOut.connect(this.masterGain);

            // SFX bus with send to reverb
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.55;
            this.sfxGain.connect(this.masterGain);
            this.sfxSend = this.ctx.createGain();
            this.sfxSend.gain.value = 0.12;
            this.sfxGain.connect(this.sfxSend);
            this.sfxSend.connect(this.reverbIn);

            // Music bus with slightly heavier reverb send
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.22;
            this.musicGain.connect(this.masterGain);
            this.musicSend = this.ctx.createGain();
            this.musicSend.gain.value = 0.18;
            this.musicGain.connect(this.musicSend);
            this.musicSend.connect(this.reverbIn);

            // Pre-generate a 1s white noise buffer for reuse
            this.noiseBuffer = this._makeNoise(1.0);
        } catch (e) {
            console.warn('Web Audio not available:', e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // ---- Helpers -----------------------------------------------------

    _makeImpulse(seconds, decay) {
        const rate = this.ctx.sampleRate;
        const len = Math.floor(seconds * rate);
        const buf = this.ctx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                const n = Math.random() * 2 - 1;
                d[i] = n * Math.pow(1 - i / len, decay);
            }
        }
        return buf;
    },

    _makeNoise(seconds) {
        const rate = this.ctx.sampleRate;
        const len = Math.floor(seconds * rate);
        const buf = this.ctx.createBuffer(1, len, rate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    },

    _noiseSource() {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        return src;
    },

    // One-shot oscillator voice with ADSR-like envelope.
    _voice(opts) {
        if (!this.ctx) return null;
        const {
            freq = 440, duration = 0.2, type = 'square', gain = 0.2,
            detune = 0, attack = 0.002, decay = 0.04, sustain = 0.6,
            release = 0.12, glide = null, dest = this.sfxGain, startTime = null
        } = opts;

        const t0 = startTime != null ? startTime : this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (glide) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(10, glide.to), t0 + (glide.time || duration));
        }
        osc.detune.value = detune;

        const g = this.ctx.createGain();
        // Attack
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + attack);
        // Decay -> sustain
        g.gain.linearRampToValueAtTime(gain * sustain, t0 + attack + decay);
        // Release
        const endT = t0 + duration;
        g.gain.setValueAtTime(gain * sustain, Math.max(t0, endT - release));
        g.gain.exponentialRampToValueAtTime(0.0001, endT);

        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(endT + 0.02);
        return osc;
    },

    // Filtered noise burst (for percussion / whooshes).
    _noiseBurst(opts) {
        if (!this.ctx) return;
        const {
            duration = 0.12, gain = 0.3, filter = 'highpass',
            freq = 1500, q = 1, sweepTo = null, dest = this.sfxGain, startTime = null
        } = opts;

        const t0 = startTime != null ? startTime : this.ctx.currentTime;
        const src = this._noiseSource();
        const flt = this.ctx.createBiquadFilter();
        flt.type = filter;
        flt.frequency.setValueAtTime(freq, t0);
        if (sweepTo) flt.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t0 + duration);
        flt.Q.value = q;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        src.connect(flt);
        flt.connect(g);
        g.connect(dest);
        src.start(t0);
        src.stop(t0 + duration + 0.02);
    },

    // ---- SFX ---------------------------------------------------------

    jump() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Layered tone: detuned square pair sweep + airy noise whoosh
        this._voice({ freq: 220, glide: { to: 720, time: 0.14 }, duration: 0.18,
            type: 'square', gain: 0.17, detune: -8 });
        this._voice({ freq: 220, glide: { to: 720, time: 0.14 }, duration: 0.18,
            type: 'square', gain: 0.14, detune: 8 });
        this._noiseBurst({ duration: 0.18, gain: 0.08, filter: 'highpass',
            freq: 3000, sweepTo: 800 });
    },

    ring() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Bright bell: two detuned triangles, up a fifth for the flourish
        this._voice({ freq: 1320, duration: 0.18, type: 'triangle', gain: 0.18,
            detune: -5, startTime: t });
        this._voice({ freq: 1320, duration: 0.18, type: 'triangle', gain: 0.15,
            detune: 5, startTime: t });
        this._voice({ freq: 1760, duration: 0.22, type: 'triangle', gain: 0.13,
            startTime: t + 0.05 });
    },

    loseRings() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Descending cascade of pinging metallic notes
        [880, 700, 560, 440].forEach((f, i) => {
            this._voice({ freq: f, duration: 0.18, type: 'triangle',
                gain: 0.16, startTime: t + i * 0.06 });
        });
        this._noiseBurst({ duration: 0.22, gain: 0.06, filter: 'bandpass',
            freq: 2200, q: 3, startTime: t });
    },

    spinDash() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Filtered saw sweep, "revving" up
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(520, t + 0.22);

        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(400, t);
        filt.frequency.exponentialRampToValueAtTime(3200, t + 0.22);
        filt.Q.value = 4;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        osc.connect(filt); filt.connect(g); g.connect(this.sfxGain);
        osc.start(t); osc.stop(t + 0.3);
    },

    spinRelease() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Whoosh: filtered noise + descending saw
        this._noiseBurst({ duration: 0.32, gain: 0.22, filter: 'bandpass',
            freq: 2400, sweepTo: 600, q: 1.5, startTime: t });
        this._voice({ freq: 600, glide: { to: 140, time: 0.3 }, duration: 0.32,
            type: 'sawtooth', gain: 0.12, startTime: t });
    },

    enemyPop() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Kick + bright noise + blip
        this._voice({ freq: 180, glide: { to: 50, time: 0.12 }, duration: 0.12,
            type: 'sine', gain: 0.35, attack: 0.001, decay: 0.05,
            sustain: 0.4, release: 0.08, startTime: t });
        this._noiseBurst({ duration: 0.14, gain: 0.25, filter: 'highpass',
            freq: 1600, sweepTo: 500, q: 1, startTime: t });
        this._voice({ freq: 900, glide: { to: 1400, time: 0.06 }, duration: 0.08,
            type: 'square', gain: 0.15, startTime: t });
    },

    hurt() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Rough distorted tone + LP sweep down
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(90, t + 0.45);

        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(2500, t);
        filt.frequency.exponentialRampToValueAtTime(300, t + 0.45);
        filt.Q.value = 6;

        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this._distortionCurve(0.4);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        osc.connect(shaper); shaper.connect(filt); filt.connect(g); g.connect(this.sfxGain);
        osc.start(t); osc.stop(t + 0.5);
    },

    _distortionCurve(amount) {
        const n = 256;
        const c = new Float32Array(n);
        const k = amount * 100;
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            c[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
        }
        return c;
    },

    spring() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Metallic "boing": FM-ish by layering rapid pitch-sweeping triangles
        this._voice({ freq: 260, glide: { to: 900, time: 0.1 }, duration: 0.18,
            type: 'triangle', gain: 0.24, startTime: t });
        this._voice({ freq: 520, glide: { to: 1800, time: 0.08 }, duration: 0.14,
            type: 'triangle', gain: 0.14, startTime: t });
        this._voice({ freq: 900, duration: 0.12, type: 'sine', gain: 0.1,
            startTime: t + 0.08 });
    },

    checkpoint() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Chime arpeggio with reverb tail
        [523, 659, 784, 1047].forEach((f, i) => {
            this._voice({ freq: f, duration: 0.42, type: 'triangle',
                gain: 0.16, attack: 0.003, decay: 0.08, sustain: 0.5,
                release: 0.3, startTime: t + i * 0.09 });
        });
    },

    oneUp() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [523, 659, 784, 1047, 1318, 1568].forEach((f, i) => {
            this._voice({ freq: f, duration: 0.18, type: 'square',
                gain: 0.15, detune: -6, startTime: t + i * 0.08 });
            this._voice({ freq: f, duration: 0.18, type: 'triangle',
                gain: 0.1, detune: 6, startTime: t + i * 0.08 });
        });
    },

    levelComplete() {
        if (!this.ctx) return;
        this.stopMusic();
        const t = this.ctx.currentTime;
        const notes = [523, 523, 523, 659, 784, 784, 659, 784, 1047];
        const durs = [0.12, 0.12, 0.2, 0.2, 0.12, 0.12, 0.15, 0.15, 0.6];
        let time = 0;
        notes.forEach((f, i) => {
            this._voice({ freq: f, duration: durs[i] + 0.1, type: 'square',
                gain: 0.18, detune: -6, startTime: t + time });
            this._voice({ freq: f, duration: durs[i] + 0.1, type: 'triangle',
                gain: 0.12, detune: 6, startTime: t + time });
            // Bass octave below
            this._voice({ freq: f / 2, duration: durs[i] + 0.05, type: 'triangle',
                gain: 0.14, startTime: t + time });
            time += durs[i];
        });
    },

    gameOver() {
        if (!this.ctx) return;
        this.stopMusic();
        const t = this.ctx.currentTime;
        const notes = [392, 349, 330, 294, 262, 247, 220];
        notes.forEach((f, i) => {
            this._voice({ freq: f, duration: 0.38, type: 'sawtooth',
                gain: 0.14, detune: -5, startTime: t + i * 0.25 });
            this._voice({ freq: f, duration: 0.38, type: 'triangle',
                gain: 0.1, detune: 5, startTime: t + i * 0.25 });
        });
    },

    // ---- Music -------------------------------------------------------

    // Procedural kick drum (sub-sine thump with quick pitch env)
    _kick(t, dest) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(g); g.connect(dest);
        osc.start(t); osc.stop(t + 0.2);
    },

    // Procedural closed hi-hat (filtered noise burst)
    _hat(t, dest) {
        const src = this._noiseSource();
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'highpass';
        filt.frequency.value = 7000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        src.connect(filt); filt.connect(g); g.connect(dest);
        src.start(t); src.stop(t + 0.07);
    },

    // Procedural snare (noise + short tonal component)
    _snare(t, dest) {
        const src = this._noiseSource();
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 1800;
        filt.Q.value = 0.8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        src.connect(filt); filt.connect(g); g.connect(dest);
        src.start(t); src.stop(t + 0.14);

        // Body
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
        const og = this.ctx.createGain();
        og.gain.setValueAtTime(0.1, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(og); og.connect(dest);
        osc.start(t); osc.stop(t + 0.12);
    },

    // Procedural background music: detuned-pair melody + filtered bass +
    // drum kit (kick on beats 1,3 and hats on eighths, snare on 2,4).
    startMusic(tempo, notePattern, bassPattern) {
        if (!this.ctx) return;
        this.stopMusic();
        this.musicPlaying = true;
        this.musicGeneration++;
        const gen = this.musicGeneration;

        const beatLen = 60 / tempo;
        const totalBeats = notePattern.length;
        const loopDur = totalBeats * beatLen;

        // Filter for the bass (keeps it warm and tight)
        const bassFilt = this.ctx.createBiquadFilter();
        bassFilt.type = 'lowpass';
        bassFilt.frequency.value = 800;
        bassFilt.Q.value = 1.2;
        bassFilt.connect(this.musicGain);

        const scheduleLoop = (startTime) => {
            if (!this.musicPlaying || gen !== this.musicGeneration) return;

            const addNode = (osc) => {
                osc.onended = () => {
                    const idx = this.musicNodes.indexOf(osc);
                    if (idx !== -1) this.musicNodes.splice(idx, 1);
                };
                this.musicNodes.push(osc);
            };

            // Melody (two detuned voices -> width)
            notePattern.forEach((note, i) => {
                if (note <= 0) return;
                const t = startTime + i * beatLen;
                const dur = beatLen * 0.85;
                [{ type: 'square', gain: 0.09, detune: -7 },
                 { type: 'triangle', gain: 0.08, detune: 7 }].forEach(v => {
                    const osc = this.ctx.createOscillator();
                    osc.type = v.type;
                    osc.frequency.value = note;
                    osc.detune.value = v.detune;
                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(v.gain, t + 0.01);
                    g.gain.linearRampToValueAtTime(v.gain * 0.6, t + dur * 0.5);
                    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                    osc.connect(g); g.connect(this.musicGain);
                    osc.start(t); osc.stop(t + dur + 0.02);
                    addNode(osc);
                });
            });

            // Bass (through LP filter)
            if (bassPattern) {
                bassPattern.forEach((note, i) => {
                    if (note <= 0) return;
                    const t = startTime + i * beatLen;
                    const dur = beatLen * 0.8;
                    const osc = this.ctx.createOscillator();
                    osc.type = 'sawtooth';
                    osc.frequency.value = note;
                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.14, t + 0.015);
                    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                    osc.connect(g); g.connect(bassFilt);
                    osc.start(t); osc.stop(t + dur + 0.02);
                    addNode(osc);
                });
            }

            // Drum kit: four beats on every 2 pattern steps (assumes 8th notes)
            const stepsPerBeat = 2; // pattern is in 8th notes
            const beats = totalBeats / stepsPerBeat;
            for (let b = 0; b < beats; b++) {
                const t = startTime + b * beatLen * stepsPerBeat;
                // Kick on beats 1 and 3 (and syncopated 1-and occasionally)
                if (b % 4 === 0 || b % 4 === 2) this._kick(t, this.musicGain);
                // Snare on beats 2 and 4
                if (b % 4 === 1 || b % 4 === 3) this._snare(t, this.musicGain);
                // Hats on every eighth
                this._hat(t, this.musicGain);
                this._hat(t + beatLen, this.musicGain);
            }

            setTimeout(() => scheduleLoop(startTime + loopDur), (loopDur - 0.5) * 1000);
        };

        scheduleLoop(this.ctx.currentTime + 0.1);
    },

    stopMusic() {
        this.musicPlaying = false;
        this.musicNodes.forEach(n => {
            try { n.stop(); } catch (e) {}
        });
        this.musicNodes = [];
    }
};

// ---- CAMERA SYSTEM ----
const Camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    bounds: { minX: 0, minY: 0, maxX: 10000, maxY: 600 },

    follow(target, immediate) {
        this.targetX = target.x + (target.facing * CFG.CAM_LEAD_X) - CFG.WIDTH / 2;
        this.targetY = target.y - CFG.HEIGHT / 2 + 60;

        if (immediate) {
            this.x = this.targetX;
            this.y = this.targetY;
        } else {
            this.x += (this.targetX - this.x) * CFG.CAM_SMOOTH;
            this.y += (this.targetY - this.y) * CFG.CAM_SMOOTH_Y;
        }

        // Clamp to level bounds
        this.x = Math.max(this.bounds.minX, Math.min(this.x, this.bounds.maxX - CFG.WIDTH));
        this.y = Math.max(this.bounds.minY, Math.min(this.y, this.bounds.maxY - CFG.HEIGHT));

        // Screen shake
        if (this.shakeTimer > 0) {
            this.shakeTimer--;
            this.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.y += (Math.random() - 0.5) * this.shakeIntensity;
        }
    },

    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    },

    // Convert world coords to screen coords
    screenX(wx) { return Math.round(wx - this.x); },
    screenY(wy) { return Math.round(wy - this.y); },

    // Check if a rect is visible
    visible(x, y, w, h) {
        return x + w > this.x && x < this.x + CFG.WIDTH &&
               y + h > this.y && y < this.y + CFG.HEIGHT;
    }
};

// ---- UTILITY FUNCTIONS ----
const Utils = {
    lerp(a, b, t) { return a + (b - a) * t; },
    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
    sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; },
    rand(min, max) { return Math.random() * (max - min) + min; },
    randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },

    // AABB collision check
    overlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    },

    // Distance between two points
    dist(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    // Format time as M:SS
    formatTime(frames) {
        const secs = Math.floor(frames / 60);
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        return `${mins}:${s.toString().padStart(2, '0')}`;
    }
};
