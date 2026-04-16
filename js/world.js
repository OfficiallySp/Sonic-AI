// ============================================================
// WORLD.JS - Level Data, Tile System, Entities
// ============================================================

// ---- TILE TYPES ----
const TILE = {
    EMPTY: 0,
    SOLID: 1,      // Ground with grass/top surface
    FILL: 2,       // Ground fill (dirt/stone, solid)
    PLATFORM: 3,   // One-way platform (pass through from below)
    SLOPE_R: 4,    // Slope going up to the right
    SLOPE_L: 5,    // Slope going up to the left
};

// ---- ENTITY CLASSES ----

class Ring {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 16; this.h = 16;
        this.active = true;
        this.frame = Math.random() * 8 | 0;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.collected = false;
        this.collectTimer = 0;
    }

    update(dt) {
        this.frame = (this.frame + 0.15) % 8;
        if (this.collected) {
            this.collectTimer++;
            if (this.collectTimer > 20) this.active = false;
        }
    }

    draw(ctx) {
        if (this.collected) {
            // Sparkle effect
            const t = this.collectTimer / 20;
            ctx.globalAlpha = 1 - t;
            const spr = GFX.sprites.sparkle;
            GFX.draw(ctx, spr,
                Camera.screenX(this.x - 5) + Math.cos(t * 4) * 8,
                Camera.screenY(this.y - 5) - t * 20);
            ctx.globalAlpha = 1;
            return;
        }
        const bob = Math.sin(Date.now() * 0.004 + this.bobOffset) * 2;
        const spr = GFX.sprites.ring[Math.floor(this.frame) % 8];
        GFX.draw(ctx, spr,
            Camera.screenX(this.x - 10),
            Camera.screenY(this.y - 10 + bob));
    }

    collect() {
        if (this.collected) return false;
        this.collected = true;
        this.collectTimer = 0;
        return true;
    }

    getBounds() {
        return { x: this.x - 8, y: this.y - 8, w: 16, h: 16 };
    }
}

class ScatteredRing {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = Utils.rand(-5, 5);
        this.vy = Utils.rand(-10, -3);
        this.w = 10; this.h = 10;
        this.active = true;
        this.life = CFG.RING_SCATTER_LIFE;
        this.canCollect = false;
        this.collectDelay = 30;
        this.bounces = 0;
    }

    update() {
        this.vy += CFG.GRAVITY * 0.5;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        if (this.collectDelay > 0) {
            this.collectDelay--;
        } else {
            this.canCollect = true;
        }

        // Bounce off ground
        const tileY = Math.floor(this.y / CFG.TILE);
        const tileX = Math.floor(this.x / CFG.TILE);
        if (tileY >= 0 && tileY < World.level.height && tileX >= 0 && tileX < World.level.width) {
            const t = World.getTile(tileX, tileY);
            if (t === TILE.SOLID || t === TILE.FILL) {
                this.y = tileY * CFG.TILE - 5;
                this.vy = -this.vy * 0.5;
                this.vx *= 0.8;
                this.bounces++;
                if (this.bounces > 3) this.vy = 0;
            }
        }

        if (this.life <= 0) this.active = false;
        // Blink when about to disappear
    }

    draw(ctx) {
        if (this.life < 60 && this.life % 4 < 2) return; // Blink
        const spr = GFX.sprites.ringScatter;
        ctx.globalAlpha = Math.min(1, this.life / 30);
        GFX.draw(ctx, spr,
            Camera.screenX(this.x - 7),
            Camera.screenY(this.y - 7));
        ctx.globalAlpha = 1;
    }

    getBounds() {
        return { x: this.x - 5, y: this.y - 5, w: 10, h: 10 };
    }
}

class Crawler {
    constructor(x, y, dir) {
        this.x = x; this.y = y;
        this.w = 28; this.h = 24;
        this.vx = (dir || -1) * 1.2;
        this.active = true;
        this.frame = 0;
        this.dead = false;
        this.deadTimer = 0;
    }

    update() {
        if (this.dead) {
            this.deadTimer++;
            if (this.deadTimer > 30) this.active = false;
            return;
        }

        this.frame = (this.frame + 0.1) % 2;
        this.x += this.vx;

        // Check for edge or wall
        const feetX = Math.floor((this.x + (this.vx > 0 ? 14 : -14)) / CFG.TILE);
        const feetY = Math.floor((this.y + 14) / CFG.TILE);
        const groundBelow = Math.floor((this.y + 16) / CFG.TILE);

        // Turn at edges
        if (feetY >= 0 && feetY < World.level.height) {
            const below = World.getTile(feetX, groundBelow);
            const ahead = World.getTile(feetX, feetY);
            if (below === TILE.EMPTY || ahead === TILE.SOLID || ahead === TILE.FILL) {
                this.vx = -this.vx;
            }
        }
    }

    draw(ctx) {
        if (this.dead) {
            // Explosion
            const t = this.deadTimer / 30;
            ctx.globalAlpha = 1 - t;
            GFX.draw(ctx, GFX.sprites.enemyPop,
                Camera.screenX(this.x - 20),
                Camera.screenY(this.y - 20 - t * 20));
            ctx.globalAlpha = 1;
            return;
        }
        const spr = GFX.sprites.crawler[Math.floor(this.frame)];
        GFX.draw(ctx, spr,
            Camera.screenX(this.x - 16),
            Camera.screenY(this.y - 14),
            this.vx < 0);
    }

    destroy() {
        this.dead = true;
        this.deadTimer = 0;
    }

    getBounds() {
        return { x: this.x - 14, y: this.y - 12, w: 28, h: 24 };
    }
}

class Flyer {
    constructor(x, y, dir) {
        this.x = x; this.y = y;
        this.startX = x; this.startY = y;
        this.w = 32; this.h = 26;
        this.vx = (dir || -1) * 1.5;
        this.active = true;
        this.frame = 0;
        this.time = Math.random() * 100;
        this.dead = false;
        this.deadTimer = 0;
        this.range = 80 + Math.random() * 60;
    }

    update() {
        if (this.dead) {
            this.deadTimer++;
            this.y += 2; // Fall
            if (this.deadTimer > 40) this.active = false;
            return;
        }

        this.frame = (this.frame + 0.2) % 2;
        this.time += 0.03;

        // Fly in a pattern
        this.x += this.vx;
        this.y = this.startY + Math.sin(this.time) * 25;

        // Reverse at range limit
        if (Math.abs(this.x - this.startX) > this.range) {
            this.vx = -this.vx;
        }
    }

    draw(ctx) {
        if (this.dead) {
            const t = this.deadTimer / 40;
            ctx.globalAlpha = 1 - t;
            GFX.draw(ctx, GFX.sprites.enemyPop,
                Camera.screenX(this.x - 20),
                Camera.screenY(this.y - 20));
            ctx.globalAlpha = 1;
            return;
        }
        const spr = GFX.sprites.flyer[Math.floor(this.frame)];
        GFX.draw(ctx, spr,
            Camera.screenX(this.x - 18),
            Camera.screenY(this.y - 15),
            this.vx < 0);
    }

    destroy() {
        this.dead = true;
        this.deadTimer = 0;
        this.vx = 0;
    }

    getBounds() {
        return { x: this.x - 14, y: this.y - 12, w: 28, h: 24 };
    }
}

class Spring {
    constructor(x, y, power) {
        this.x = x; this.y = y;
        this.w = 24; this.h = 24;
        this.power = power || -14;
        this.active = true;
        this.bouncing = false;
        this.bounceTimer = 0;
    }

    update() {
        if (this.bouncing) {
            this.bounceTimer++;
            if (this.bounceTimer > 15) {
                this.bouncing = false;
                this.bounceTimer = 0;
            }
        }
    }

    draw(ctx) {
        const spr = this.bouncing ? GFX.sprites.springBounce : GFX.sprites.springNormal;
        GFX.draw(ctx, spr,
            Camera.screenX(this.x - 12),
            Camera.screenY(this.y - (this.bouncing ? 28 : 24)));
    }

    trigger() {
        this.bouncing = true;
        this.bounceTimer = 0;
    }

    getBounds() {
        return { x: this.x - 12, y: this.y - 20, w: 24, h: 20 };
    }
}

class Checkpoint {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.activated = false;
        this.frame = 0;
    }

    update() {
        if (this.activated) {
            this.frame = (this.frame + 0.08) % 2;
        }
    }

    draw(ctx) {
        const sprites = this.activated ? GFX.sprites.checkpointActive : GFX.sprites.checkpoint;
        const spr = sprites[Math.floor(this.frame) % 2];
        GFX.draw(ctx, spr,
            Camera.screenX(this.x - 8),
            Camera.screenY(this.y - 40));
    }

    trigger() {
        if (!this.activated) {
            this.activated = true;
            Sound.checkpoint();
            return true;
        }
        return false;
    }

    getBounds() {
        return { x: this.x - 8, y: this.y - 40, w: 16, h: 40 };
    }
}

class GoalPost {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.spinning = false;
        this.frame = 0;
    }

    update() {
        if (this.spinning) {
            this.frame = (this.frame + 0.15) % 4;
        }
    }

    draw(ctx) {
        const spr = GFX.sprites.goalSign[Math.floor(this.frame) % 4];
        GFX.draw(ctx, spr,
            Camera.screenX(this.x - 16),
            Camera.screenY(this.y - 48));
    }

    trigger() {
        this.spinning = true;
    }

    getBounds() {
        return { x: this.x - 16, y: this.y - 48, w: 32, h: 48 };
    }
}

// Floating score/effect popup
class Popup {
    constructor(x, y, text, color) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color || '#FFFFFF';
        this.life = 60;
        this.active = true;
    }

    update() {
        this.y -= 0.8;
        this.life--;
        if (this.life <= 0) this.active = false;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.min(1, this.life / 20);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, Camera.screenX(this.x), Camera.screenY(this.y));
        ctx.globalAlpha = 1;
    }
}

// Dust particle
class Particle {
    constructor(x, y, vx, vy, life, sprite) {
        this.x = x; this.y = y;
        this.vx = vx || 0; this.vy = vy || 0;
        this.life = life || 30;
        this.maxLife = this.life;
        this.active = true;
        this.sprite = sprite || 'dust';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        this.vx *= 0.98;
        this.life--;
        if (this.life <= 0) this.active = false;
    }

    draw(ctx) {
        const t = this.life / this.maxLife;
        ctx.globalAlpha = t;
        const spr = GFX.sprites[this.sprite];
        if (spr) {
            const scale = 0.5 + t * 0.5;
            ctx.drawImage(spr,
                Camera.screenX(this.x) - spr.width * scale / 2,
                Camera.screenY(this.y) - spr.height * scale / 2,
                spr.width * scale, spr.height * scale);
        }
        ctx.globalAlpha = 1;
    }
}

// ---- WORLD SYSTEM ----
const World = {
    level: null,
    entities: [],
    particles: [],
    decorations: [],
    currentLevel: 0,

    // Build a tile map from level description
    buildLevel(levelNum) {
        this.entities = [];
        this.particles = [];
        this.decorations = [];
        this.currentLevel = levelNum;

        if (levelNum === 0) return this.buildLevel1();
        if (levelNum === 1) return this.buildLevel2();
    },

    // ---- LEVEL 1: EMERALD VALLEY ----
    buildLevel1() {
        const W = 310, H = 22;
        const tiles = Array.from({ length: H }, () => new Array(W).fill(TILE.EMPTY));
        const T = CFG.TILE;
        const theme = 1;

        // Ground height function
        const ground = (x) => {
            if (x < 0 || x >= W) return H;
            // Flat start
            if (x < 15) return 15;
            // First gentle hill
            if (x >= 15 && x < 25) return 15 - Math.floor(Math.sin((x - 15) / 10 * Math.PI) * 2);
            // Flat section
            if (x >= 25 && x < 40) return 15;
            // Small gap
            if (x >= 42 && x < 45) return H + 5;
            if (x >= 40 && x < 42) return 15;
            if (x >= 45 && x < 50) return 15;
            // Rising terrain
            if (x >= 50 && x < 58) return 15 - Math.floor((x - 50) * 0.5);
            if (x >= 58 && x < 75) return 11;
            // Drop back down
            if (x >= 75 && x < 80) return 11 + Math.floor((x - 75));
            if (x >= 80 && x < 100) return 16;
            // Big hill
            if (x >= 100 && x < 108) return 16 - Math.floor((x - 100) * 0.75);
            if (x >= 108 && x < 118) return 10;
            if (x >= 118 && x < 126) return 10 + Math.floor((x - 118) * 0.75);
            if (x >= 126 && x < 145) return 16;
            // Gap section
            if (x >= 147 && x < 152) return H + 5;
            if (x >= 145 && x < 147) return 16;
            if (x >= 152 && x < 158) return 16;
            // Speed section (flat)
            if (x >= 158 && x < 210) return 16;
            // Hill section
            if (x >= 210 && x < 218) return 16 - Math.floor((x - 210) * 0.625);
            if (x >= 218 && x < 230) return 11;
            if (x >= 230 && x < 238) return 11 + Math.floor((x - 230) * 0.625);
            // Final flat
            if (x >= 238 && x < W) return 16;
            return 16;
        };

        // Fill tiles based on ground function
        for (let x = 0; x < W; x++) {
            const gy = ground(x);
            if (gy < H) {
                tiles[gy][x] = TILE.SOLID; // Top surface
                for (let y = gy + 1; y < H; y++) {
                    tiles[y][x] = TILE.FILL;
                }
            }
        }

        // Floating platforms
        const platforms = [
            [22, 11, 4], [35, 10, 3], [38, 7, 3],
            [65, 7, 4], [70, 5, 3],
            [90, 12, 5], [95, 9, 3],
            [130, 12, 4], [136, 9, 3],
            [155, 12, 4], [160, 9, 3],
            [180, 12, 5], [190, 10, 4],
            [200, 8, 3],
            [245, 12, 4], [252, 10, 3], [258, 8, 3],
        ];
        platforms.forEach(([px, py, pw]) => {
            for (let x = px; x < px + pw && x < W; x++) {
                tiles[py][x] = TILE.PLATFORM;
            }
        });

        // Place entities
        const ents = this.entities;

        // Player start (at ground level)
        const playerStart = { x: 3 * T + 16, y: 15 * T };

        // Rings - lines along paths
        const ringGroups = [
            // Opening rings (learning area)
            ...this._ringLine(5, 13, 6, 0),
            ...this._ringLine(16, 11, 3, 0),
            // Above first hill
            ...this._ringLine(18, 9, 3, 0),
            // After gap
            ...this._ringLine(46, 13, 4, 0),
            // Rising section rings
            ...this._ringLine(52, 9, 5, 0),
            ...this._ringLine(60, 9, 6, 0),
            // On platforms
            ...this._ringLine(65, 5, 3, 0),
            ...this._ringLine(70, 3, 3, 0),
            // Hill top rings
            ...this._ringLine(110, 8, 8, 0),
            // Speed section rings
            ...this._ringLine(162, 14, 15, 0),
            ...this._ringLine(180, 14, 10, 0),
            // Arc over gap
            ...this._ringArc(148, 10, 5, 4),
            // Platforms
            ...this._ringLine(90, 10, 5, 0),
            ...this._ringLine(245, 10, 4, 0),
            ...this._ringLine(252, 8, 3, 0),
            // Hilltop 2
            ...this._ringLine(220, 9, 8, 0),
            // End area
            ...this._ringLine(270, 14, 12, 0),
            ...this._ringLine(285, 12, 6, 0),
        ];
        ringGroups.forEach(r => ents.push(new Ring(r.x * T + 16, r.y * T + 16)));

        // Enemies
        ents.push(new Crawler(30 * T, 15 * T - 16, -1));
        ents.push(new Crawler(85 * T, 16 * T - 16, 1));
        ents.push(new Crawler(130 * T, 16 * T - 16, -1));
        ents.push(new Crawler(170 * T, 16 * T - 16, -1));
        ents.push(new Crawler(195 * T, 16 * T - 16, 1));
        ents.push(new Crawler(240 * T, 16 * T - 16, -1));
        ents.push(new Crawler(260 * T, 16 * T - 16, 1));

        ents.push(new Flyer(55 * T, 8 * T, -1));
        ents.push(new Flyer(95 * T, 6 * T, 1));
        ents.push(new Flyer(155 * T, 8 * T, -1));
        ents.push(new Flyer(225 * T, 6 * T, 1));
        ents.push(new Flyer(275 * T, 10 * T, -1));

        // Springs
        ents.push(new Spring(35 * T, 15 * T, -14));
        ents.push(new Spring(64 * T, 11 * T, -14));
        ents.push(new Spring(89 * T, 16 * T, -15));
        ents.push(new Spring(135 * T, 16 * T, -14));
        ents.push(new Spring(200 * T, 16 * T, -15));
        ents.push(new Spring(244 * T, 16 * T, -14));

        // Checkpoint
        ents.push(new Checkpoint(140 * T, 16 * T));

        // Goal
        ents.push(new GoalPost(295 * T, 16 * T));

        // Decorations
        const decs = this.decorations;
        [8, 28, 55, 72, 112, 165, 205, 250, 280].forEach(dx => {
            decs.push({ type: 'tree', x: dx * T, y: ground(dx) * T });
        });
        [12, 34, 62, 88, 120, 175, 215, 265].forEach((dx, i) => {
            const colors = ['#FF4488', '#FF88CC', '#FFAA44', '#44AAFF'];
            decs.push({ type: 'flower', x: dx * T, y: ground(dx) * T, color: colors[i % 4] });
        });

        this.level = {
            width: W, height: H, tiles, theme,
            playerStart,
            bgMusic: {
                tempo: 150,
                melody: [
                    523, 0, 659, 0, 784, 0, 659, 0,
                    523, 0, 784, 0, 659, 523, 392, 0,
                    440, 0, 523, 0, 659, 0, 523, 0,
                    440, 0, 392, 0, 349, 0, 392, 0,
                ],
                bass: [
                    131, 0, 131, 0, 165, 0, 165, 0,
                    131, 0, 131, 0, 165, 0, 131, 0,
                    110, 0, 110, 0, 131, 0, 131, 0,
                    110, 0, 98, 0, 87, 0, 98, 0,
                ]
            }
        };

        Camera.bounds = {
            minX: 0, minY: 0,
            maxX: W * T, maxY: H * T
        };

        return this.level;
    },

    // ---- LEVEL 2: NEON FACTORY ----
    buildLevel2() {
        const W = 340, H = 24;
        const tiles = Array.from({ length: H }, () => new Array(W).fill(TILE.EMPTY));
        const T = CFG.TILE;
        const theme = 2;

        const ground = (x) => {
            if (x < 0 || x >= W) return H;
            if (x < 12) return 17;
            if (x >= 12 && x < 20) return 17 - Math.floor((x - 12) * 0.5);
            if (x >= 20 && x < 35) return 13;
            if (x >= 37 && x < 42) return H + 5; // gap
            if (x >= 35 && x < 37) return 17;
            if (x >= 42 && x < 55) return 17;
            if (x >= 55 && x < 62) return 17 - Math.floor((x - 55) * 0.57);
            if (x >= 62 && x < 78) return 13;
            if (x >= 78 && x < 85) return 13 + Math.floor((x - 78) * 0.57);
            if (x >= 85 && x < 100) return 17;
            // More gaps and platforms section
            if (x >= 102 && x < 108) return H + 5;
            if (x >= 100 && x < 102) return 17;
            if (x >= 108 && x < 120) return 17;
            // Tall section
            if (x >= 120 && x < 128) return 17 - Math.floor((x - 120) * 0.875);
            if (x >= 128 && x < 145) return 10;
            if (x >= 145 && x < 153) return 10 + Math.floor((x - 145) * 0.875);
            if (x >= 153 && x < 175) return 17;
            // Gap sequence
            if (x >= 177 && x < 180) return H + 5;
            if (x >= 183 && x < 186) return H + 5;
            if (x >= 175 && x < 177) return 17;
            if (x >= 180 && x < 183) return 17;
            if (x >= 186 && x < 200) return 17;
            // Speed section
            if (x >= 200 && x < 250) return 18;
            // Final climb
            if (x >= 250 && x < 260) return 18 - Math.floor((x - 250) * 0.7);
            if (x >= 260 && x < 280) return 11;
            if (x >= 280 && x < 290) return 11 + Math.floor((x - 280) * 0.7);
            if (x >= 290) return 18;
            return 18;
        };

        // Fill tiles
        for (let x = 0; x < W; x++) {
            const gy = ground(x);
            if (gy < H) {
                tiles[gy][x] = TILE.SOLID;
                for (let y = gy + 1; y < H; y++) {
                    tiles[y][x] = TILE.FILL;
                }
            }
        }

        // Platforms
        const platforms = [
            [25, 9, 4], [30, 6, 3],
            [40, 13, 4], [46, 10, 3], [50, 7, 3],
            [65, 9, 4], [72, 7, 3],
            [90, 13, 4], [96, 10, 3],
            [104, 13, 5], [110, 10, 4], [116, 7, 3],
            [132, 6, 4], [138, 4, 3],
            [160, 13, 5], [167, 10, 3], [172, 7, 3],
            [188, 13, 5], [194, 10, 4],
            [210, 14, 5], [220, 12, 4], [228, 10, 3],
            [235, 8, 3], [240, 6, 3],
            [265, 7, 4], [272, 5, 3],
            [300, 14, 5], [308, 11, 4],
        ];
        platforms.forEach(([px, py, pw]) => {
            for (let x = px; x < px + pw && x < W; x++) {
                tiles[py][x] = TILE.PLATFORM;
            }
        });

        // Entities
        const ents = this.entities;
        const playerStart = { x: 3 * T + 16, y: 17 * T };

        // Rings
        const ringGroups = [
            ...this._ringLine(5, 15, 5, 0),
            ...this._ringLine(14, 12, 4, 0),
            ...this._ringLine(22, 11, 6, 0),
            ...this._ringLine(25, 7, 4, 0),
            ...this._ringLine(43, 15, 5, 0),
            ...this._ringLine(46, 8, 3, 0),
            ...this._ringLine(63, 11, 6, 0),
            ...this._ringLine(72, 5, 3, 0),
            ...this._ringLine(87, 15, 5, 0),
            ...this._ringArc(103, 11, 6, 5),
            ...this._ringLine(110, 8, 4, 0),
            ...this._ringLine(130, 8, 8, 0),
            ...this._ringLine(132, 4, 3, 0),
            ...this._ringLine(155, 15, 8, 0),
            ...this._ringLine(167, 8, 3, 0),
            ...this._ringArc(178, 11, 4, 5),
            ...this._ringArc(183, 11, 3, 5),
            ...this._ringLine(190, 15, 8, 0),
            ...this._ringLine(205, 16, 15, 0),
            ...this._ringLine(225, 16, 10, 0),
            ...this._ringLine(262, 9, 8, 0),
            ...this._ringLine(272, 3, 3, 0),
            ...this._ringLine(292, 16, 10, 0),
            ...this._ringLine(308, 9, 4, 0),
        ];
        ringGroups.forEach(r => ents.push(new Ring(r.x * T + 16, r.y * T + 16)));

        // Enemies (more of them)
        ents.push(new Crawler(28 * T, 13 * T - 16, -1));
        ents.push(new Crawler(48 * T, 17 * T - 16, 1));
        ents.push(new Crawler(75 * T, 13 * T - 16, -1));
        ents.push(new Crawler(92 * T, 17 * T - 16, 1));
        ents.push(new Crawler(112 * T, 17 * T - 16, -1));
        ents.push(new Crawler(135 * T, 10 * T - 16, 1));
        ents.push(new Crawler(160 * T, 17 * T - 16, -1));
        ents.push(new Crawler(195 * T, 17 * T - 16, 1));
        ents.push(new Crawler(215 * T, 18 * T - 16, -1));
        ents.push(new Crawler(240 * T, 18 * T - 16, 1));
        ents.push(new Crawler(265 * T, 11 * T - 16, -1));
        ents.push(new Crawler(300 * T, 18 * T - 16, 1));

        ents.push(new Flyer(35 * T, 8 * T, -1));
        ents.push(new Flyer(60 * T, 7 * T, 1));
        ents.push(new Flyer(100 * T, 10 * T, -1));
        ents.push(new Flyer(145 * T, 5 * T, 1));
        ents.push(new Flyer(175 * T, 10 * T, -1));
        ents.push(new Flyer(210 * T, 11 * T, 1));
        ents.push(new Flyer(255 * T, 7 * T, -1));
        ents.push(new Flyer(290 * T, 12 * T, 1));

        // Springs
        ents.push(new Spring(24 * T, 13 * T, -14));
        ents.push(new Spring(45 * T, 17 * T, -15));
        ents.push(new Spring(89 * T, 17 * T, -14));
        ents.push(new Spring(109 * T, 17 * T, -15));
        ents.push(new Spring(131 * T, 10 * T, -14));
        ents.push(new Spring(166 * T, 17 * T, -14));
        ents.push(new Spring(187 * T, 17 * T, -15));
        ents.push(new Spring(234 * T, 18 * T, -16));
        ents.push(new Spring(264 * T, 11 * T, -14));
        ents.push(new Spring(299 * T, 18 * T, -14));

        // Checkpoint
        ents.push(new Checkpoint(155 * T, 17 * T));

        // Goal
        ents.push(new GoalPost(325 * T, 18 * T));

        // Decorations
        [10, 50, 80, 115, 150, 190, 230, 270, 310].forEach(dx => {
            this.decorations.push({ type: 'factory', x: dx * T, y: ground(dx) * T });
        });

        this.level = {
            width: W, height: H, tiles, theme,
            playerStart,
            bgMusic: {
                tempo: 160,
                melody: [
                    330, 0, 392, 0, 494, 0, 392, 0,
                    330, 0, 494, 0, 392, 330, 294, 0,
                    349, 0, 392, 0, 494, 0, 587, 0,
                    494, 0, 392, 0, 330, 0, 294, 0,
                ],
                bass: [
                    82, 0, 82, 0, 110, 0, 110, 0,
                    82, 0, 82, 0, 98, 0, 82, 0,
                    87, 0, 87, 0, 110, 0, 110, 0,
                    98, 0, 98, 0, 82, 0, 73, 0,
                ]
            }
        };

        Camera.bounds = {
            minX: 0, minY: 0,
            maxX: W * T, maxY: H * T
        };

        return this.level;
    },

    // Helper: create a horizontal line of ring positions
    _ringLine(startX, y, count, spacing) {
        const rings = [];
        const sp = spacing || 2;
        for (let i = 0; i < count; i++) {
            rings.push({ x: startX + i * sp, y });
        }
        return rings;
    },

    // Helper: create an arc of rings (like over a gap)
    _ringArc(centerX, topY, halfWidth, height) {
        const rings = [];
        for (let i = -halfWidth; i <= halfWidth; i++) {
            const t = i / halfWidth;
            const y = topY - Math.floor((1 - t * t) * height);
            rings.push({ x: centerX + i, y });
        }
        return rings;
    },

    // Get tile at grid position (with bounds check)
    getTile(tx, ty) {
        if (!this.level) return TILE.EMPTY;
        if (tx < 0 || tx >= this.level.width || ty < 0 || ty >= this.level.height) {
            return TILE.EMPTY;
        }
        return this.level.tiles[ty][tx];
    },

    // Check if a world-space rect collides with solid tiles
    // Returns collision info: { top, bottom, left, right, groundY }
    collide(x, y, w, h) {
        const T = CFG.TILE;
        const result = { top: false, bottom: false, left: false, right: false, groundY: null, slope: false };

        const left = Math.floor(x / T);
        const right = Math.floor((x + w - 1) / T);
        const top = Math.floor(y / T);
        const bottom = Math.floor((y + h - 1) / T);

        for (let ty = top; ty <= bottom; ty++) {
            for (let tx = left; tx <= right; tx++) {
                const tile = this.getTile(tx, ty);
                if (tile === TILE.EMPTY) continue;

                const tileX = tx * T;
                const tileY = ty * T;

                if (tile === TILE.SOLID || tile === TILE.FILL) {
                    // Full solid collision
                    if (x + w > tileX && x < tileX + T && y + h >= tileY && y < tileY + T) {
                        // Determine collision side based on overlap
                        const overlapL = (x + w) - tileX;
                        const overlapR = (tileX + T) - x;
                        const overlapT = (y + h) - tileY;
                        const overlapB = (tileY + T) - y;
                        const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);

                        if (minOverlap === overlapT) {
                            result.bottom = true;
                            if (result.groundY === null || tileY < result.groundY) {
                                result.groundY = tileY;
                            }
                        } else if (minOverlap === overlapB) {
                            result.top = true;
                        } else if (minOverlap === overlapL) {
                            result.right = true;
                        } else {
                            result.left = true;
                        }
                    }
                } else if (tile === TILE.PLATFORM) {
                    // One-way platform: only collide from top
                    if (y + h >= tileY && y + h < tileY + T * 0.6 && y < tileY) {
                        result.bottom = true;
                        if (result.groundY === null || tileY < result.groundY) {
                            result.groundY = tileY;
                        }
                    }
                } else if (tile === TILE.SLOPE_R) {
                    // Slope going up to the right
                    const relX = Utils.clamp((x + w / 2) - tileX, 0, T);
                    const slopeY = tileY + T - (relX / T) * T;
                    if (y + h >= slopeY && x + w > tileX && x < tileX + T) {
                        result.bottom = true;
                        result.slope = true;
                        if (result.groundY === null || slopeY < result.groundY) {
                            result.groundY = slopeY;
                        }
                    }
                } else if (tile === TILE.SLOPE_L) {
                    const relX = Utils.clamp((x + w / 2) - tileX, 0, T);
                    const slopeY = tileY + (relX / T) * T;
                    if (y + h >= slopeY && x + w > tileX && x < tileX + T) {
                        result.bottom = true;
                        result.slope = true;
                        if (result.groundY === null || slopeY < result.groundY) {
                            result.groundY = slopeY;
                        }
                    }
                }
            }
        }

        return result;
    },

    // Check if a point is inside a solid tile
    isSolid(wx, wy) {
        const t = this.getTile(Math.floor(wx / CFG.TILE), Math.floor(wy / CFG.TILE));
        return t === TILE.SOLID || t === TILE.FILL;
    },

    // Update all entities
    update() {
        this.entities.forEach(e => { if (e.active) e.update(); });
        this.particles.forEach(p => { if (p.active) p.update(); });
        // Clean up dead entities periodically
        this.entities = this.entities.filter(e => e.active);
        this.particles = this.particles.filter(p => p.active);
    },

    // Draw tiles visible on screen
    drawTiles(ctx) {
        const T = CFG.TILE;
        const lvl = this.level;
        if (!lvl) return;

        const startX = Math.max(0, Math.floor(Camera.x / T));
        const endX = Math.min(lvl.width - 1, Math.ceil((Camera.x + CFG.WIDTH) / T));
        const startY = Math.max(0, Math.floor(Camera.y / T));
        const endY = Math.min(lvl.height - 1, Math.ceil((Camera.y + CFG.HEIGHT) / T));

        const tc = GFX.tileCache;
        const th = lvl.theme;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = lvl.tiles[y][x];
                if (tile === TILE.EMPTY) continue;

                const sx = Camera.screenX(x * T);
                const sy = Camera.screenY(y * T);
                let spr = null;

                switch (tile) {
                    case TILE.SOLID: spr = tc[`grass${th}`]; break;
                    case TILE.FILL: spr = tc[`dirt${th}`]; break;
                    case TILE.PLATFORM: spr = tc[`plat${th}`]; break;
                    case TILE.SLOPE_R: spr = tc[`slopeR${th}`]; break;
                    case TILE.SLOPE_L: spr = tc[`slopeL${th}`]; break;
                }

                if (spr) ctx.drawImage(spr, sx, sy);
            }
        }
    },

    // Draw all entities
    drawEntities(ctx) {
        this.entities.forEach(e => {
            if (e.active && !(e instanceof Ring) && !(e instanceof ScatteredRing)) {
                // Check visibility
                const b = e.getBounds ? e.getBounds() : { x: e.x - 20, y: e.y - 20, w: 40, h: 40 };
                if (Camera.visible(b.x, b.y, b.w, b.h)) {
                    e.draw(ctx);
                }
            }
        });
    },

    // Draw rings separately (for layering)
    drawRings(ctx) {
        this.entities.forEach(e => {
            if (e.active && (e instanceof Ring || e instanceof ScatteredRing)) {
                const b = e.getBounds();
                if (Camera.visible(b.x, b.y, b.w, b.h)) {
                    e.draw(ctx);
                }
            }
        });
    },

    // Draw decorations
    drawDecorations(ctx) {
        this.decorations.forEach(d => {
            if (Camera.visible(d.x - 30, d.y - 60, 60, 60)) {
                if (d.type === 'tree') GFX.drawTree(ctx, Camera.screenX(d.x), Camera.screenY(d.y));
                if (d.type === 'flower') GFX.drawFlower(ctx, Camera.screenX(d.x), Camera.screenY(d.y), d.color);
                if (d.type === 'factory') GFX.drawFactory(ctx, Camera.screenX(d.x), Camera.screenY(d.y));
            }
        });
    },

    // Draw particles
    drawParticles(ctx) {
        this.particles.forEach(p => { if (p.active) p.draw(ctx); });
    },

    // Add particle effect
    addParticle(x, y, vx, vy, life, sprite) {
        this.particles.push(new Particle(x, y, vx, vy, life, sprite));
    },

    // Add score popup
    addPopup(x, y, text, color) {
        this.particles.push(new Popup(x, y, text, color));
    },

    // Scatter rings from player position
    scatterRings(x, y, count) {
        const num = Math.min(count, CFG.RING_SCATTER_COUNT);
        for (let i = 0; i < num; i++) {
            this.entities.push(new ScatteredRing(x, y));
        }
    }
};
