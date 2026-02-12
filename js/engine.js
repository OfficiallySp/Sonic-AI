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
const Sound = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    musicPlaying: false,
    musicNodes: [],

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.6;
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.25;
            this.musicGain.connect(this.masterGain);
        } catch (e) {
            console.warn('Web Audio not available:', e);
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Generate a tone with envelope
    _tone(freq, duration, type, gain, dest, startTime) {
        if (!this.ctx) return;
        const t = startTime || this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(gain || 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(g);
        g.connect(dest || this.sfxGain);
        osc.start(t);
        osc.stop(t + duration);
        return osc;
    },

    jump() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.2);
    },

    ring() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone(1200, 0.08, 'square', 0.15, this.sfxGain, t);
        this._tone(1500, 0.12, 'square', 0.12, this.sfxGain, t + 0.06);
    },

    loseRings() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone(600, 0.1, 'square', 0.2, this.sfxGain, t);
        this._tone(400, 0.15, 'square', 0.15, this.sfxGain, t + 0.05);
        this._tone(300, 0.2, 'square', 0.1, this.sfxGain, t + 0.1);
    },

    spinDash() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 0.25);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    },

    spinRelease() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.3);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    },

    enemyPop() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        // Noise burst
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        src.connect(g);
        g.connect(this.sfxGain);
        src.start(t);
        this._tone(800, 0.08, 'square', 0.2, this.sfxGain, t);
    },

    hurt() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(500, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.4);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.4);
    },

    spring() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone(400, 0.1, 'triangle', 0.3, this.sfxGain, t);
        this._tone(800, 0.15, 'triangle', 0.2, this.sfxGain, t + 0.05);
    },

    checkpoint() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [523, 659, 784, 1047].forEach((f, i) => {
            this._tone(f, 0.15, 'square', 0.15, this.sfxGain, t + i * 0.1);
        });
    },

    oneUp() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [523, 659, 784, 1047, 1318, 1568].forEach((f, i) => {
            this._tone(f, 0.12, 'square', 0.15, this.sfxGain, t + i * 0.08);
        });
    },

    levelComplete() {
        if (!this.ctx) return;
        this.stopMusic();
        const t = this.ctx.currentTime;
        const notes = [523, 523, 523, 659, 784, 784, 659, 784, 1047];
        const durs = [0.12, 0.12, 0.2, 0.2, 0.12, 0.12, 0.15, 0.15, 0.5];
        let time = 0;
        notes.forEach((f, i) => {
            this._tone(f, durs[i] + 0.05, 'square', 0.18, this.sfxGain, t + time);
            time += durs[i];
        });
    },

    gameOver() {
        if (!this.ctx) return;
        this.stopMusic();
        const t = this.ctx.currentTime;
        const notes = [392, 349, 330, 294, 262, 247, 220];
        notes.forEach((f, i) => {
            this._tone(f, 0.3, 'square', 0.15, this.sfxGain, t + i * 0.25);
        });
    },

    // Simple procedural background music
    startMusic(tempo, notePattern, bassPattern) {
        if (!this.ctx) return;
        this.stopMusic();
        this.musicPlaying = true;

        const beatLen = 60 / tempo;
        const totalBeats = notePattern.length;
        const loopDur = totalBeats * beatLen;

        const scheduleLoop = (startTime) => {
            if (!this.musicPlaying) return;

            notePattern.forEach((note, i) => {
                if (note > 0) {
                    const t = startTime + i * beatLen;
                    const osc = this.ctx.createOscillator();
                    const g = this.ctx.createGain();
                    osc.type = 'square';
                    osc.frequency.value = note;
                    g.gain.setValueAtTime(0.12, t);
                    g.gain.exponentialRampToValueAtTime(0.001, t + beatLen * 0.9);
                    osc.connect(g);
                    g.connect(this.musicGain);
                    osc.start(t);
                    osc.stop(t + beatLen);
                    this.musicNodes.push(osc);
                }
            });

            if (bassPattern) {
                bassPattern.forEach((note, i) => {
                    if (note > 0) {
                        const t = startTime + i * beatLen;
                        const osc = this.ctx.createOscillator();
                        const g = this.ctx.createGain();
                        osc.type = 'triangle';
                        osc.frequency.value = note;
                        g.gain.setValueAtTime(0.15, t);
                        g.gain.exponentialRampToValueAtTime(0.001, t + beatLen * 0.8);
                        osc.connect(g);
                        g.connect(this.musicGain);
                        osc.start(t);
                        osc.stop(t + beatLen);
                        this.musicNodes.push(osc);
                    }
                });
            }

            // Schedule next loop
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
