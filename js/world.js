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
            // Expanding bright flash when a ring is collected.
            const t = this.collectTimer / 20;
            const sx = Camera.screenX(this.x);
            const sy = Camera.screenY(this.y);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - t;
            GFX.drawGlow(ctx, sx, sy - t * 10, 20 + t * 25,
                'rgba(255,230,120,0.9)', 1 - t);
            ctx.restore();
            return;
        }
        const bob = Math.sin(Date.now() * 0.004 + this.bobOffset) * 2;
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y + bob);

        // Soft pulsing golden halo so bloom lights up the environment.
        const pulse = 0.7 + Math.sin(Date.now() * 0.005 + this.bobOffset) * 0.3;
        GFX.drawGlow(ctx, sx, sy, 14 + pulse * 4, 'rgba(255,215,80,0.55)', pulse);

        const spr = GFX.sprites.ring[Math.floor(this.frame) % 8];
        GFX.draw(ctx, spr, sx - 10, sy - 10);
    }

    collect() {
        if (this.collected) return false;
        this.collected = true;
        this.collectTimer = 0;
        // Burst of golden sparks at the ring position.
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            World.addParticle(
                this.x, this.y,
                Math.cos(a) * Utils.rand(1, 2.5),
                Math.sin(a) * Utils.rand(1, 2.5) - 1,
                18, 'ringburst'
            );
        }
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
            // Explosion with bloom-friendly additive burst
            const t = this.deadTimer / 30;
            const sx = Camera.screenX(this.x);
            const sy = Camera.screenY(this.y - 10 - t * 20);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - t;
            GFX.drawGlow(ctx, sx, sy, 30 + t * 30, 'rgba(255,180,60,0.9)', 1 - t);
            ctx.drawImage(GFX.sprites.enemyPop, sx - 20, sy - 10);
            ctx.restore();
            return;
        }
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        // Shadow pinned to the actual terrain directly below the crawler,
        // so it tracks cliffs / slope edges instead of floating near the sprite.
        const groundY = World.groundYBelow(this.x, this.y + 4);
        if (groundY !== null) {
            GFX.drawShadow(ctx, sx, Camera.screenY(groundY), 14, 0.4);
        }

        // Antenna light pulse
        GFX.drawGlow(ctx, sx + 6, sy - 22, 8, 'rgba(255,255,120,0.6)', 0.9);

        const spr = GFX.sprites.crawler[Math.floor(this.frame)];
        GFX.draw(ctx, spr, sx - 16, sy - 14, this.vx < 0);
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
            const sx = Camera.screenX(this.x);
            const sy = Camera.screenY(this.y);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - t;
            GFX.drawGlow(ctx, sx, sy - 10, 32, 'rgba(255,160,60,0.9)', 1 - t);
            ctx.drawImage(GFX.sprites.enemyPop, sx - 20, sy - 20);
            ctx.restore();
            return;
        }
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        // Project shadow onto the actual ground below the flyer. Size and
        // opacity scale with height so a flyer high in the sky casts a faint,
        // slightly larger diffuse blob while one buzzing low casts a sharper one.
        const groundY = World.groundYBelow(this.x, this.y);
        if (groundY !== null) {
            const height = groundY - this.y;
            const t = Math.max(0, Math.min(1, height / 260));
            const width = 10 + t * 6;
            const opacity = 0.32 * (1 - t * 0.55);
            GFX.drawShadow(ctx, sx, Camera.screenY(groundY), width, opacity);
        }

        // Red eye glow
        const eyeOffset = this.vx < 0 ? -7 : 7;
        GFX.drawGlow(ctx, sx + eyeOffset, sy - 2, 10, 'rgba(255,60,60,0.8)', 1);

        const spr = GFX.sprites.flyer[Math.floor(this.frame)];
        GFX.draw(ctx, spr, sx - 18, sy - 15, this.vx < 0);
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
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        // Faint idle glow + bright burst while triggered.
        if (this.bouncing) {
            const t = 1 - (this.bounceTimer / 15);
            GFX.drawGlow(ctx, sx, sy - 12, 42, 'rgba(255,220,80,0.8)', t);
        } else {
            GFX.drawGlow(ctx, sx, sy - 10, 20, 'rgba(255,220,80,0.35)', 1);
        }

        GFX.draw(ctx, spr, sx - 12, sy - (this.bouncing ? 28 : 24));
    }

    trigger() {
        this.bouncing = true;
        this.bounceTimer = 0;
        // Burst of upward sparks when Sonic hits the spring.
        for (let i = 0; i < 8; i++) {
            World.addParticle(this.x + Utils.rand(-10, 10), this.y - 20,
                Utils.rand(-2, 2), Utils.rand(-4, -1), 18, 'spark');
        }
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
        this.activationTimer = 0;
    }

    update() {
        if (this.activated) {
            this.frame = (this.frame + 0.08) % 2;
            if (this.activationTimer < 60) this.activationTimer++;
        }
    }

    draw(ctx) {
        const sprites = this.activated ? GFX.sprites.checkpointActive : GFX.sprites.checkpoint;
        const spr = sprites[Math.floor(this.frame) % 2];
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y - 8);

        // Pulsing red glow once activated, subtle blue glow while idle.
        if (this.activated) {
            const pulse = 0.6 + Math.sin(Date.now() * 0.008) * 0.4;
            GFX.drawGlow(ctx, sx, sy, 30 + pulse * 8, 'rgba(255,120,80,0.85)', pulse);

            // Burst of sparks right after activation.
            if (this.activationTimer < 30 && (this.activationTimer & 1) === 0) {
                World.addParticle(this.x + Utils.rand(-8, 8), this.y - 8,
                    Utils.rand(-2, 2), Utils.rand(-3, -1), 25, 'spark');
            }
        } else {
            GFX.drawGlow(ctx, sx, sy, 16, 'rgba(100,150,255,0.35)', 1);
        }

        GFX.draw(ctx, spr, sx - 8, Camera.screenY(this.y - 40));
    }

    trigger() {
        if (!this.activated) {
            this.activated = true;
            this.activationTimer = 0;
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
        this.spinTimer = 0;
    }

    update() {
        if (this.spinning) {
            this.frame = (this.frame + 0.25) % 4;
            this.spinTimer++;
        }
    }

    draw(ctx) {
        const spr = GFX.sprites.goalSign[Math.floor(this.frame) % 4];
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y - 24);

        // Always-on pedestal glow, gets way brighter while spinning.
        const baseGlow = this.spinning ? 0.9 : 0.35;
        GFX.drawGlow(ctx, sx, sy, 42, 'rgba(255,220,80,0.9)', baseGlow);

        // Rotating light rays behind the sign while spinning.
        if (this.spinning) {
            const t = this.spinTimer;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(sx, sy);
            ctx.rotate(t * 0.08);
            const rayGrad = ctx.createLinearGradient(-80, 0, 80, 0);
            rayGrad.addColorStop(0, 'rgba(255,240,120,0)');
            rayGrad.addColorStop(0.5, 'rgba(255,240,120,0.4)');
            rayGrad.addColorStop(1, 'rgba(255,240,120,0)');
            ctx.fillStyle = rayGrad;
            for (let r = 0; r < 4; r++) {
                ctx.save();
                ctx.rotate(r * Math.PI / 4);
                ctx.fillRect(-90, -4, 180, 8);
                ctx.restore();
            }
            ctx.restore();

            // Ambient sparkles
            if ((this.spinTimer & 3) === 0) {
                World.addParticle(this.x + Utils.rand(-24, 24), this.y - 24 + Utils.rand(-20, 20),
                    Utils.rand(-1, 1), Utils.rand(-1, 1), 40, 'sparkle');
            }
        }

        GFX.draw(ctx, spr, sx - 16, Camera.screenY(this.y - 48));
    }

    trigger() {
        this.spinning = true;
        this.spinTimer = 0;
    }

    getBounds() {
        return { x: this.x - 16, y: this.y - 48, w: 32, h: 48 };
    }
}

// ---- BOSS SYSTEM ----

// Boss theme: aggressive minor groove in D minor, up-tempo, tight swing.
// Used for every Act 2 fight. Kept intentionally short/loopy so hits
// punch through the mix instead of fighting for attention.
const BOSS_MUSIC = {
    tempo: 168,
    swing: 0.05,
    lead: [
        // Dm:  D5   .   F5   .   A5   .   D6   .   C6   .   A5   .   F5   .   D5   .
        587, 0, 698, 0, 880, 0, 1175, 0, 1047, 0, 880, 0, 698, 0, 587, 0,
        // Gm:  G4   .   Bb4  .   D5   .   G5   .   F5   .   D5   .   Bb4  .   G4   .
        392, 0, 466, 0, 587, 0, 784, 0, 698, 0, 587, 0, 466, 0, 392, 0,
        // A:   A4   .   C#5  .   E5   .   A5   .   G5   .   E5   .   C#5  .   A4   .
        440, 0, 554, 0, 659, 0, 880, 0, 784, 0, 659, 0, 554, 0, 440, 0,
        // Dm:  D5   .   A5   .   D6   .   F6    .   A6    .   F6    .   D6   A5 F5 D5
        587, 0, 880, 0, 1175, 0, 1397, 0, 1760, 0, 1397, 0, 1175, 880, 698, 587,
    ],
    arp: [
        // Dm (D4, F4, A4, D5)
        294, 0, 349, 0, 440, 0, 587, 0, 440, 0, 349, 0, 440, 0, 587, 0,
        // Gm (G3, Bb3, D4, G4)
        196, 0, 233, 0, 294, 0, 392, 0, 294, 0, 233, 0, 294, 0, 392, 0,
        // A (A3, C#4, E4, A4)
        220, 0, 277, 0, 330, 0, 440, 0, 330, 0, 277, 0, 330, 0, 440, 0,
        // Dm (D4, F4, A4, D5)
        294, 0, 349, 0, 440, 0, 587, 0, 440, 0, 349, 0, 440, 0, 587, 0,
    ],
    bass: [
        // Dm: D1 D2 D1 D2 A1 A2 D2 C2
        37, 0, 73, 0, 37, 0, 73, 0, 55, 0, 110, 0, 73, 0, 65, 0,
        // Gm: G1 G2 G1 G2 D2 D3 G2 F2
        49, 0, 98, 0, 49, 0, 98, 0, 73, 0, 147, 0, 98, 0, 87, 0,
        // A: A1 A2 A1 A2 E2 E3 A2 G2
        55, 0, 110, 0, 55, 0, 110, 0, 82, 0, 165, 0, 110, 0, 98, 0,
        // Dm: D1 D2 D1 D2 A1 A2 D2 A1 (drives back to root)
        37, 0, 73, 0, 37, 0, 73, 0, 55, 0, 110, 0, 73, 0, 55, 0,
    ]
};

// Invisible barrier that seals the arena once the fight starts. Acts like
// a tile wall for horizontal motion but only while enabled. Disabled on
// boss defeat so the player can walk to the goal.
class BossWall {
    constructor(x, y, height) {
        this.x = x;
        this.y = y;
        this.h = height || 16 * CFG.TILE;
        this.w = 16;
        this.active = true;
        this.enabled = false;
    }

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }

    update() {}

    draw(ctx) {
        if (!this.enabled) return;
        // Shimmering energy wall so the player sees the arena boundary.
        const sx = Camera.screenX(this.x);
        const top = Camera.screenY(this.y);
        const h = this.h;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 0.3 + Math.sin(Date.now() * 0.006) * 0.15;
        const grad = ctx.createLinearGradient(sx - 6, 0, sx + 10, 0);
        grad.addColorStop(0, 'rgba(120,200,255,0)');
        grad.addColorStop(0.5, `rgba(160,220,255,${pulse})`);
        grad.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - 6, top, 16, h);
        // Vertical scanline streaks
        ctx.strokeStyle = `rgba(200,240,255,${0.25 + pulse * 0.3})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const y = top + ((Date.now() * 0.1 + i * 40) % h);
            ctx.beginPath();
            ctx.moveTo(sx - 4, y);
            ctx.lineTo(sx + 6, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    getBounds() {
        return { x: this.x - this.w / 2, y: this.y, w: this.w, h: this.h };
    }
}

// Invisible line that activates the boss when the player crosses it. The
// trigger lives just inside the arena entrance so running in commits to
// the fight — matches the classic "walk in, door slams shut" setup.
class BossTrigger {
    constructor(x, y, boss, wall) {
        this.x = x;
        this.y = y;
        this.boss = boss;
        this.wall = wall;
        this.active = true;
        this.triggered = false;
        this.w = 16;
        this.h = 16 * CFG.TILE;
    }

    update() {
        if (this.triggered) this.active = false;
    }

    draw(ctx) {}

    getBounds() {
        return { x: this.x - this.w / 2, y: this.y, w: this.w, h: this.h };
    }

    trigger(player) {
        if (this.triggered) return;
        this.triggered = true;
        this.active = false;
        // Enable all boss walls in the arena (entrance + exit) so the fight
        // becomes a sealed room. They're dropped together on Boss.onDefeated.
        World.entities.forEach(e => { if (e instanceof BossWall) e.enable(); });
        if (this.boss) this.boss.activate();
        // Lock the camera to the arena so the fight stays framed.
        if (this.boss && this.boss.arena) {
            Camera.bounds = {
                minX: this.boss.arena.left,
                minY: 0,
                maxX: this.boss.arena.right,
                maxY: World.level.height * CFG.TILE,
            };
        }
        Sound.startMusic(BOSS_MUSIC);
    }
}

// Projectile spawned by bosses: lasers, bombs, and ground shockwaves.
// One class, profile-switched like particles, so bosses can fire whatever
// they need without a subclass explosion.
class BossProjectile {
    constructor(x, y, vx, vy, life, type, opts) {
        this.x = x;
        this.y = y;
        this.vx = vx || 0;
        this.vy = vy || 0;
        this.life = life;
        this.maxLife = life;
        this.type = type;
        this.active = true;
        this.dead = false;
        this.hot = true; // false while detonating so player collision stops early
        const o = opts || {};
        this.w = o.w || 16;
        this.h = o.h || 16;
        this.color = o.color || '#FF4444';
        this.gravity = o.gravity != null ? o.gravity : (type === 'bomb' ? 0.28 : 0);
        this.bounced = false;
    }

    update() {
        this.life--;
        if (this.life <= 0) { this.active = false; return; }

        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;

        if (this.type === 'bomb') {
            const below = World.isSolid(this.x, this.y + this.h / 2 + 2);
            if (below || this.life <= 1) this._detonate();
        } else if (this.type === 'shockwave') {
            // Hug the ground: keep snapping to the nearest tile top underneath.
            const g = World.groundYBelow(this.x, this.y - 8);
            if (g != null) this.y = g - this.h / 2;
            // Expire on wall impact
            if (World.isSolid(this.x + Math.sign(this.vx) * (this.w / 2 + 1), this.y)) {
                this.active = false;
            }
        }
    }

    _detonate() {
        this.active = false;
        this.hot = false;
        Sound.enemyPop();
        Camera.shake(3, 10);
        for (let i = 0; i < 14; i++) {
            const a = Utils.rand(-Math.PI, 0);
            World.addParticle(this.x, this.y,
                Math.cos(a) * Utils.rand(2, 5),
                Math.sin(a) * Utils.rand(1, 4),
                35, 'spark');
        }
        // Ground shockwaves that sweep left and right from the impact point.
        World.entities.push(new BossProjectile(this.x - 12, this.y, -4, 0, 50, 'shockwave',
            { w: 24, h: 14, color: '#88CCFF' }));
        World.entities.push(new BossProjectile(this.x + 12, this.y, 4, 0, 50, 'shockwave',
            { w: 24, h: 14, color: '#88CCFF' }));
    }

    draw(ctx) {
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        if (this.type === 'laser') {
            // Blistering red beam with flicker and additive glow bloom.
            const jitter = (Math.random() - 0.5) * 1.5;
            GFX.drawGlow(ctx, sx, sy, 18, 'rgba(255,80,80,0.85)', 1);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(255,100,100,0.9)';
            ctx.fillRect(sx - this.w / 2, sy - this.h / 2 + jitter, this.w, this.h);
            ctx.fillStyle = 'rgba(255,240,240,1)';
            ctx.fillRect(sx - this.w / 2, sy - this.h / 2 + 1 + jitter, this.w, Math.max(1, this.h - 2));
            ctx.restore();
        } else if (this.type === 'bomb') {
            GFX.drawGlow(ctx, sx, sy, 14, 'rgba(255,140,40,0.7)', 1);
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(sx, sy, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Fuse sparks
            if ((Math.floor(Date.now() / 60) & 1) === 0) {
                ctx.fillStyle = '#FFCC33';
                ctx.beginPath();
                ctx.arc(sx + 3, sy - 7, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.type === 'shockwave') {
            const t = 1 - (this.life / this.maxLife);
            GFX.drawGlow(ctx, sx, sy, 18 + t * 6, 'rgba(120,200,255,0.85)', 1 - t);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(180,230,255,${0.9 - t * 0.7})`;
            ctx.fillRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);
            ctx.restore();
        }
    }

    getBounds() {
        return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    }
}

// Base class for bosses. Handles shared concerns: activation from a
// BossTrigger, invulnerability frames after being hit, death sequence,
// and the standard "hit by ball form" damage response. Subclasses only
// implement AI patterns (updateAI), their own draw, and optionally a
// separate weak-bounds rect if the whole body isn't a valid hit target.
class Boss {
    constructor(x, y, arena) {
        this.x = x;
        this.y = y;
        this.homeX = x;
        this.homeY = y;
        this.arena = arena; // { left, right, top, bottom, centerX, floorY }
        this.active = true;
        this.dead = false;
        this.phase = 'waiting'; // waiting, active, dying, dead
        this.hp = 1;
        this.maxHp = 1;
        this.invulnTimer = 0;
        this.deathTimer = 0;
        this.time = 0;
        this.facing = -1;
        this.name = 'BOSS';
        this.w = 40;
        this.h = 40;
    }

    activate() {
        if (this.phase === 'waiting') {
            this.phase = 'active';
            this.onActivate();
        }
    }

    onActivate() {}

    update() {
        this.time++;
        if (this.invulnTimer > 0) this.invulnTimer--;

        switch (this.phase) {
            case 'waiting':
                this.updateWaiting();
                break;
            case 'active':
                this.updateAI(Player);
                break;
            case 'dying':
                this.updateDying();
                break;
            case 'dead':
                break;
        }
    }

    updateWaiting() {
        // Slight idle bob so the boss looks menacing, not frozen.
        this.y = this.homeY + Math.sin(this.time * 0.04) * 4;
    }

    updateAI(player) {}

    updateDying() {
        this.deathTimer++;
        // Slowly sink while billowing smoke + sparks.
        this.y += 0.6;
        if ((this.deathTimer & 3) === 0) {
            Camera.shake(4, 6);
        }
        if ((this.deathTimer & 1) === 0) {
            for (let i = 0; i < 3; i++) {
                const a = Utils.rand(0, Math.PI * 2);
                World.addParticle(
                    this.x + Utils.rand(-this.w / 2, this.w / 2),
                    this.y + Utils.rand(-this.h / 2, this.h / 2),
                    Math.cos(a) * Utils.rand(1, 3),
                    Math.sin(a) * Utils.rand(1, 3) - 1,
                    40, 'spark');
            }
            World.addParticle(
                this.x + Utils.rand(-20, 20),
                this.y + Utils.rand(-10, 10),
                Utils.rand(-1, 1), Utils.rand(-2, -0.5),
                50, 'ember');
        }
        if (this.deathTimer > 140) {
            this.phase = 'dead';
            this.dead = true;
            this.onDefeated();
            // Let the big boom linger one frame, then despawn on the next
            // cleanup pass so the player sees the wall drop visibly.
            this.active = false;
        }
    }

    // Called when the player hits the boss with ball form. Returns true if
    // the hit landed (caller bounces off), false if the boss was invulnerable.
    takeHit(player) {
        if (this.phase !== 'active' || this.invulnTimer > 0) return false;
        this.hp--;
        this.invulnTimer = 90; // ~1.5s between hits
        Sound.enemyPop();
        Camera.shake(6, 14);
        PostFX.flash('rgba(255,220,120,0.32)', 0.5);
        if (typeof Game !== 'undefined') Game.triggerHitPause(6);
        Player.score += 200;
        World.addPopup(this.x, this.y - 20, '+200', '#FFCC44');

        for (let i = 0; i < 14; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            World.addParticle(this.x, this.y,
                Math.cos(a) * Utils.rand(2, 5),
                Math.sin(a) * Utils.rand(2, 5),
                30, 'spark');
        }

        if (this.hp <= 0) {
            this.phase = 'dying';
            this.deathTimer = 0;
            Camera.shake(10, 40);
            Sound.stopMusic();
            this.onDefeatStart();
        }
        return true;
    }

    onDefeatStart() {}

    onDefeated() {
        // Drop the energy wall and reward the kill.
        Player.score += 2000;
        World.addPopup(this.x, this.y - 40, '+2000', '#FFD700');
        World.entities.forEach(e => {
            if (e instanceof BossWall) e.disable();
        });
        // Big final boom for the death sequence end.
        Camera.shake(12, 20);
        PostFX.flash('rgba(255,240,200,0.6)', 0.9);
        for (let i = 0; i < 40; i++) {
            const a = Utils.rand(0, Math.PI * 2);
            const sp = Utils.rand(3, 8);
            World.addParticle(this.x, this.y,
                Math.cos(a) * sp, Math.sin(a) * sp - 1,
                60, 'ember');
        }
    }

    // The body rect (used for player collision). Subclasses override when
    // their drawn silhouette doesn't match a simple centered box.
    getBounds() {
        return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    }

    // The hittable rect (where a ball-form Sonic can damage the boss).
    // Defaults to the body bounds; bosses with separate "weak point" visuals
    // can override this to only be vulnerable on e.g. the head / pod.
    getWeakBounds() {
        return this.getBounds();
    }

    // Helper: solid wall-like rects that push the player instead of
    // damaging them (wrecking-ball chain links, tank treads, etc.). Default
    // is none; subclasses can override.
    getHardBounds() { return null; }

    flashing() {
        return this.invulnTimer > 0 && (this.invulnTimer % 6) < 3;
    }

    draw(ctx) {}
}

// ---- ZONE 1 BOSS: WRECKER ----
// Classic Sonic 1 style "swinging wrecking ball" boss. A hover-pod holds
// a chain with a heavy steel ball that pendulums across the arena. Pod is
// the weak point; ball is damage. Hits knock the pod back and up, and
// escalate the swing speed in phase 2.
class ValleyBoss extends Boss {
    constructor(x, y, arena) {
        super(x, y, arena);
        this.name = 'WRECKER';
        this.maxHp = 5;
        this.hp = 5;
        this.w = 64;
        this.h = 44;
        this.chainLength = 110;
        this.ballRadius = 20;
        this.swingPhase = 0;
        this.swingSpeed = 0.042;
        this.swingAmp = 1.15; // radians
        this.rotorPhase = 0;
        this.knockback = { x: 0, y: 0 };
        this.driftPhase = Math.random() * Math.PI * 2;
    }

    onActivate() {
        // Position the pod so the ball swings at floor level (threatens a
        // grounded player) AND the pod is reachable by a jump from the floor.
        // Geometry:
        //   pivotY = homeY + h*0.4, ball at bottom = pivotY + chainLength.
        //   We want ball bottom ~= floorY, pod bounds top ~= Sonic peak-jump.
        this.homeX = this.arena.centerX;
        this.homeY = this.arena.floorY - (this.chainLength + this.h * 0.4 + 12);
        this.x = this.homeX;
        this.y = this.arena.top - 60; // drop in from above the screen
    }

    updateAI(player) {
        this.rotorPhase += 0.5;
        this.swingPhase += this.swingSpeed;
        this.driftPhase += 0.015;

        // Target position: home + gentle horizontal drift, plus any knockback.
        const driftX = Math.sin(this.driftPhase) * 70;
        const bob = Math.sin(this.time * 0.05) * 5;
        const tx = this.homeX + driftX + this.knockback.x;
        const ty = this.homeY + bob + this.knockback.y;
        this.x += (tx - this.x) * 0.06;
        this.y += (ty - this.y) * 0.06;

        // Recover knockback over time.
        this.knockback.x *= 0.94;
        this.knockback.y *= 0.94;

        // Phase 2: swing faster once half-dead.
        if (this.hp <= 2 && this.swingSpeed < 0.065) {
            this.swingSpeed += 0.0002;
        }

        this._damagePlayerFromBall(player);
    }

    _damagePlayerFromBall(player) {
        if (player.invincible > 0 || player.state === 'hurt' || player.state === 'dead') return;
        const b = this.getBallPos();
        const pb = player.getBounds();
        const bx = b.x - this.ballRadius, by = b.y - this.ballRadius;
        if (Utils.overlap(pb, { x: bx, y: by, w: this.ballRadius * 2, h: this.ballRadius * 2 })) {
            player.takeDamage({ x: b.x, y: b.y });
        }
    }

    getBallPos() {
        const angle = Math.sin(this.swingPhase) * this.swingAmp;
        const pivotX = this.x;
        const pivotY = this.y + this.h * 0.4;
        return {
            x: pivotX + Math.sin(angle) * this.chainLength,
            y: pivotY + Math.cos(angle) * this.chainLength,
            angle,
        };
    }

    takeHit(player) {
        const hit = super.takeHit(player);
        if (hit) {
            // Kick the pod up and away from the player.
            const dir = player.x < this.x ? 1 : -1;
            this.knockback.x = dir * 90;
            this.knockback.y = -40;
        }
        return hit;
    }

    draw(ctx) {
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        // Chain + ball always draws, even while dying (dramatic flop).
        const b = this.getBallPos();
        const bsx = Camera.screenX(b.x);
        const bsy = Camera.screenY(b.y);

        // Chain links
        const segments = 8;
        const pivotSX = sx;
        const pivotSY = Camera.screenY(this.y + this.h * 0.4);
        ctx.save();
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const lx = pivotSX + (bsx - pivotSX) * t;
            const ly = pivotSY + (bsy - pivotSY) * t;
            ctx.fillStyle = i % 2 === 0 ? '#777' : '#999';
            ctx.beginPath();
            ctx.arc(lx, ly, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Wrecking ball
        GFX.drawShadow(ctx, bsx, Camera.screenY(this.arena.floorY), 18, 0.3);
        const ballGrad = ctx.createRadialGradient(bsx - 6, bsy - 6, 2, bsx, bsy, this.ballRadius);
        ballGrad.addColorStop(0, '#888');
        ballGrad.addColorStop(0.5, '#555');
        ballGrad.addColorStop(1, '#222');
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(bsx, bsy, this.ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Spikes
        ctx.fillStyle = '#BBB';
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 + this.swingPhase * 0.5;
            const px = bsx + Math.cos(a) * this.ballRadius;
            const py = bsy + Math.sin(a) * this.ballRadius;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5);
            ctx.lineTo(px + Math.cos(a + 0.2) * 3, py + Math.sin(a + 0.2) * 3);
            ctx.closePath();
            ctx.fill();
        }

        // Rotor on top of pod (two spinning blades)
        const rotorY = sy - this.h * 0.55;
        const rc = Math.cos(this.rotorPhase);
        const rs = Math.sin(this.rotorPhase);
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#CCC';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 26 * rc, rotorY - 2 * rs);
        ctx.lineTo(sx + 26 * rc, rotorY + 2 * rs);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx - 26 * rs, rotorY + 2 * rc);
        ctx.lineTo(sx + 26 * rs, rotorY - 2 * rc);
        ctx.stroke();
        ctx.restore();

        // Rotor mast
        ctx.fillStyle = '#555';
        ctx.fillRect(sx - 2, sy - this.h * 0.55, 4, this.h * 0.25);

        // Pod body (the weak point). Flash white on invuln.
        const flash = this.flashing();
        ctx.save();
        if (flash) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 16;
        }
        GFX.drawShadow(ctx, sx, Camera.screenY(this.arena.floorY), 28, 0.22);

        // Dome
        const podGrad = ctx.createLinearGradient(sx - 30, sy - 18, sx + 30, sy + 18);
        podGrad.addColorStop(0, flash ? '#fff' : '#DD3322');
        podGrad.addColorStop(0.5, flash ? '#fff' : '#FF5533');
        podGrad.addColorStop(1, flash ? '#fff' : '#AA2211');
        ctx.fillStyle = podGrad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#660000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cockpit window
        ctx.fillStyle = flash ? '#fff' : '#224477';
        ctx.beginPath();
        ctx.ellipse(sx - 4, sy - 4, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#CCCC88';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Eggman silhouette (mustache + goggles) inside
        if (!flash) {
            ctx.fillStyle = '#FFCC88';
            ctx.beginPath();
            ctx.arc(sx - 4, sy - 4, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.fillRect(sx - 10, sy - 6, 12, 2);
            ctx.fillRect(sx - 10, sy, 10, 1.5); // mustache
        }

        // Engine glow (bottom vents)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glowPulse = 0.5 + Math.sin(this.time * 0.2) * 0.3;
        GFX.drawGlow(ctx, sx - 14, sy + this.h * 0.35, 12, 'rgba(255,160,60,0.8)', glowPulse);
        GFX.drawGlow(ctx, sx + 14, sy + this.h * 0.35, 12, 'rgba(255,160,60,0.8)', glowPulse);
        ctx.restore();

        ctx.restore();
    }

    getBounds() {
        // Pod body is the weak point — chain/ball are handled separately.
        return {
            x: this.x - this.w / 2 + 4,
            y: this.y - this.h / 2 + 4,
            w: this.w - 8,
            h: this.h - 8,
        };
    }
}

// ---- ZONE 2 BOSS: CRUSHER ----
// Teleporting turret-mech. Warps to one of four positions along the arena
// floor, telegraphs from its eye, then fires a thick horizontal laser
// beam. While recovering from the shot it crouches on the ground with its
// head exposed — that's the only time its body is hittable. Phase 2 adds
// twin ground shockwaves after recovery that the player has to jump over.
class FactoryBoss extends Boss {
    constructor(x, y, arena) {
        super(x, y, arena);
        this.name = 'CRUSHER';
        this.maxHp = 6;
        this.hp = 6;
        this.w = 64;
        this.h = 72;
        this.mode = 'idle'; // idle, teleport_out, teleport_in, aim, fire, stunned
        this.modeTimer = 0;
        this.stompPositions = [
            arena.left + 140,
            arena.left + 320,
            arena.left + 500,
            arena.left + 680,
        ];
        this.stompIndex = 1;
        // Picked at the start of teleport_out and telegraphed on the floor
        // so the player can see where the boss will reappear.
        this.nextStompIndex = 1;
        this.visible = true;
        this.beamHeight = 0;
        this.beamProjectile = null;
    }

    onActivate() {
        this.y = this.arena.floorY - this.h / 2;
        this.x = this.stompPositions[1];
        this.homeY = this.y;
        this._enterMode('idle', 40);
    }

    _enterMode(mode, duration) {
        this.mode = mode;
        this.modeTimer = duration;
    }

    _chooseNextPosition() {
        // Pick a position that's different from the current one so the
        // teleport actually repositions the threat. Biased toward landing
        // near the player for tension, but the destination is committed at
        // the start of teleport_out and telegraphed on the floor so the
        // player can dodge.
        const candidates = [];
        for (let i = 0; i < this.stompPositions.length; i++) {
            if (i !== this.stompIndex) candidates.push(i);
        }
        candidates.sort((a, b) =>
            Math.abs(this.stompPositions[a] - Player.x) -
            Math.abs(this.stompPositions[b] - Player.x));
        // 50% closest to player, 50% one of the other slots. Slightly
        // less mean than the old 60/40 split now that it's pre-telegraphed.
        let idx = Math.random() < 0.5
            ? candidates[0]
            : candidates[1 + (Math.random() * (candidates.length - 1) | 0)];
        return Math.max(0, Math.min(this.stompPositions.length - 1, idx));
    }

    updateAI(player) {
        this.facing = player.x < this.x ? -1 : 1;
        this.modeTimer--;

        switch (this.mode) {
            case 'idle':
                if (this.modeTimer <= 0) {
                    // Pick the landing slot up front so teleport_out can
                    // telegraph the destination for the whole window.
                    this.nextStompIndex = this._chooseNextPosition();
                    this._enterMode('teleport_out', 38);
                }
                break;

            case 'teleport_out':
                // Boss fades out over the first third of the window, leaving
                // the remainder as a clear "where am I coming back" warning.
                this.visible = this.modeTimer > 26;
                {
                    const targetX = this.stompPositions[this.nextStompIndex];
                    // Red warning sparks shoot up from the target floor spot
                    // every frame so the player's eye is drawn to it.
                    if ((this.time & 1) === 0) {
                        World.addParticle(
                            targetX + Utils.rand(-18, 18),
                            this.homeY + this.h / 2,
                            Utils.rand(-0.6, 0.6),
                            Utils.rand(-3, -1),
                            22, 'spark');
                    }
                }
                if (this.modeTimer <= 0) {
                    this.stompIndex = this.nextStompIndex;
                    this.x = this.stompPositions[this.stompIndex];
                    this.facing = player.x < this.x ? -1 : 1;
                    this.y = this.homeY + 80; // pop up from below
                    this._enterMode('teleport_in', 22);
                    // Teleport in effect
                    for (let i = 0; i < 10; i++) {
                        World.addParticle(this.x + Utils.rand(-20, 20), this.homeY,
                            Utils.rand(-2, 2), Utils.rand(-4, -1), 30, 'spark');
                    }
                }
                break;

            case 'teleport_in':
                this.visible = true;
                // Rise to home y
                this.y += (this.homeY - this.y) * 0.2;
                if (this.modeTimer <= 0) {
                    this.y = this.homeY;
                    this._enterMode('aim', 36);
                }
                break;

            case 'aim':
                // Eye telegraph, pulse intensifies as timer runs out
                if (this.modeTimer <= 0) {
                    this._fireBeam();
                    this._enterMode('fire', 40);
                }
                break;

            case 'fire':
                // Beam lives as a projectile entity we spawned. Keep aiming
                // direction locked while firing.
                if (this.modeTimer <= 0) {
                    if (this.beamProjectile) this.beamProjectile.active = false;
                    this.beamProjectile = null;
                    // Longer stun window so landing a jump-attack on the
                    // head doesn't demand pixel-perfect timing.
                    this._enterMode('stunned', 105);
                    // Phase 2: ground shockwaves
                    if (this.hp <= 3) {
                        this._fireShockwaves();
                    }
                }
                break;

            case 'stunned':
                // Crouched + head exposed, vulnerable. Steam wisps out.
                if ((this.time & 3) === 0) {
                    World.addParticle(this.x + Utils.rand(-12, 12),
                        this.y - this.h / 2 - 4,
                        Utils.rand(-0.5, 0.5), -1.2, 40, 'sparkle');
                }
                if (this.modeTimer <= 0) {
                    this._enterMode('idle', 30);
                }
                break;
        }
    }

    _fireBeam() {
        const sign = this.facing;
        const eyeY = this.y - this.h / 2 + 14;
        // Beam spans from the eye to the arena wall in the facing direction.
        const beamSpanX = sign > 0 ? this.arena.right - this.x : this.x - this.arena.left;
        const beam = new BossProjectile(
            this.x + sign * (beamSpanX / 2 + 8),
            eyeY,
            0, 0, 40, 'laser',
            { w: beamSpanX, h: 12, color: '#FF4444' }
        );
        beam.hot = true;
        World.entities.push(beam);
        this.beamProjectile = beam;
        Sound.spinDash(); // re-use the aggressive rev as a laser charge sfx
        Camera.shake(2, 6);
    }

    _fireShockwaves() {
        const y = this.arena.floorY - 8;
        World.entities.push(new BossProjectile(this.x - 30, y, -4.5, 0, 60, 'shockwave',
            { w: 22, h: 12 }));
        World.entities.push(new BossProjectile(this.x + 30, y, 4.5, 0, 60, 'shockwave',
            { w: 22, h: 12 }));
    }

    // Body damages the player unless in 'stunned' mode.
    getBounds() {
        return {
            x: this.x - this.w / 2,
            y: this.y - this.h / 2,
            w: this.w,
            h: this.h,
        };
    }

    // Only the head is a valid hit target, and only when stunned (or vulnerable
    // during aim wind-down).
    getWeakBounds() {
        if (this.mode !== 'stunned') {
            // No weak point exposed - return an offscreen rect so the ball
            // collision check always misses.
            return { x: -9999, y: -9999, w: 1, h: 1 };
        }
        // Wider, taller target so the weak spot matches the visible head
        // silhouette instead of demanding a pixel-perfect bop.
        return {
            x: this.x - 30,
            y: this.y - this.h / 2 - 4,
            w: 60,
            h: 32,
        };
    }

    draw(ctx) {
        // Telegraph the teleport destination on the floor whether or not the
        // boss sprite itself is visible, so the player can see where it's
        // about to reappear during the invisible half of teleport_out.
        if (this.mode === 'teleport_out') {
            this._drawTeleportTelegraph(ctx);
        }

        if (!this.visible) return;
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);
        const flash = this.flashing();
        const crouch = this.mode === 'stunned' ? 8 : 0;

        GFX.drawShadow(ctx, sx, Camera.screenY(this.arena.floorY), 34, 0.32);

        // Legs / treads (chunky industrial base)
        ctx.fillStyle = flash ? '#fff' : '#3A3750';
        ctx.fillRect(sx - this.w / 2, sy + this.h / 2 - 18, this.w, 18);
        ctx.fillStyle = flash ? '#fff' : '#222030';
        for (let i = 0; i < 5; i++) {
            const tx = sx - this.w / 2 + 6 + i * (this.w - 12) / 4;
            ctx.beginPath();
            ctx.arc(tx, sy + this.h / 2 - 6, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Hip pistons
        ctx.fillStyle = flash ? '#fff' : '#555';
        ctx.fillRect(sx - 18, sy + this.h / 2 - 26 + crouch, 8, 12);
        ctx.fillRect(sx + 10, sy + this.h / 2 - 26 + crouch, 8, 12);

        // Torso plate
        ctx.save();
        ctx.translate(sx, sy + crouch);
        const bodyGrad = ctx.createLinearGradient(0, -this.h / 2, 0, this.h / 2);
        bodyGrad.addColorStop(0, flash ? '#fff' : '#5E4FB2');
        bodyGrad.addColorStop(1, flash ? '#fff' : '#2B2560');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 10, this.w - 8, this.h - 30);
        ctx.strokeStyle = flash ? '#fff' : '#100E30';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.w / 2 + 4, -this.h / 2 + 10, this.w - 8, this.h - 30);

        // Shoulder bolts
        ctx.fillStyle = flash ? '#fff' : '#FFD044';
        ctx.beginPath(); ctx.arc(-this.w / 2 + 10, -this.h / 2 + 18, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.w / 2 - 10, -this.h / 2 + 18, 3, 0, Math.PI * 2); ctx.fill();

        // Head "helmet" — smaller when stunned
        const headScale = this.mode === 'stunned' ? 0.85 : 1.0;
        const headY = -this.h / 2 + 6;
        ctx.fillStyle = flash ? '#fff' : '#7766CC';
        ctx.beginPath();
        ctx.ellipse(0, headY, 18 * headScale, 14 * headScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = flash ? '#fff' : '#100E30';
        ctx.stroke();

        // The eye: giant single lens that glows + charges before firing.
        const eyeR = 7 * headScale;
        const aimT = this.mode === 'aim' ? (1 - Math.max(0, this.modeTimer) / 36) : 0;
        const firing = this.mode === 'fire';
        const eyeColor = firing ? '#FF3333' : (this.mode === 'aim' ? '#FFAA44' : '#FF6644');
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.facing * 3, headY, eyeR + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        ctx.arc(this.facing * 3, headY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.facing * 3 + 2, headY - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Eye glow — drawn outside translated ctx so screen coords are honored.
        const glowR = 14 + aimT * 14 + (firing ? 10 : 0);
        GFX.drawGlow(ctx, sx + this.facing * 3, sy + crouch + headY,
            glowR, 'rgba(255,80,80,0.85)', 1);

        // Charge-up crackle during aim
        if (this.mode === 'aim' && (this.time & 1) === 0) {
            const ey = this.y - this.h / 2 + 14;
            for (let i = 0; i < 2; i++) {
                World.addParticle(this.x + this.facing * 4, ey,
                    this.facing * Utils.rand(1, 3) + Utils.rand(-1, 1),
                    Utils.rand(-1, 1), 14, 'spark');
            }
        }
    }

    // Red floor marker + downward arrow at the telegraphed teleport
    // destination. Drawn from draw() during teleport_out so the player has
    // time to clear the landing zone before the boss reappears.
    _drawTeleportTelegraph(ctx) {
        const tx = this.stompPositions[this.nextStompIndex];
        const sx = Camera.screenX(tx);
        const floorSY = Camera.screenY(this.arena.floorY);
        const total = 38;
        const progress = 1 - Math.max(0, this.modeTimer) / total;
        const pulse = 0.55 + Math.sin(this.time * 0.55) * 0.45;

        // Ground-level glow bloom
        GFX.drawGlow(ctx, sx, floorSY - 4, 22 + progress * 16,
            'rgba(255,70,70,0.9)', 0.75 * pulse);

        // Pulsing elliptical ring hugging the floor
        ctx.save();
        ctx.strokeStyle = `rgba(255,110,110,${0.85 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx, floorSY - 3,
            24 + progress * 10, 7 + progress * 2,
            0, 0, Math.PI * 2);
        ctx.stroke();

        // Downward warning triangle hovering above the spot
        const arrowY = floorSY - 44 - Math.sin(this.time * 0.4) * 3;
        ctx.fillStyle = `rgba(255,80,80,${0.9 * pulse})`;
        ctx.strokeStyle = '#440000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, arrowY + 12);
        ctx.lineTo(sx - 9, arrowY);
        ctx.lineTo(sx + 9, arrowY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

// ---- ZONE 3 BOSS: FINAL EGGMOBILE ----
// Flying pod that patrols the upper arena and drops bombs. Every few cycles
// it arms up and dives at the player in a J-shaped arc — that dive is the
// best window to ball-bounce the pod. At half HP it spawns flying minions
// to divide the player's attention, and at critical HP its attack tempo
// doubles for a chaotic final push.
class SkyBoss extends Boss {
    constructor(x, y, arena) {
        super(x, y, arena);
        this.name = 'EGG WRECKER';
        this.maxHp = 7;
        this.hp = 7;
        this.w = 70;
        this.h = 50;
        this.mode = 'hover'; // hover, dive, recover, bomb, summon
        this.modeTimer = 90;
        this.hoverPhase = 0;
        this.propPhase = 0;
        this.diveFromX = x;
        this.diveFromY = y;
        this.diveToX = x;
        this.diveToY = y;
        this.diveT = 0;
        this.minionsSpawned = false;
    }

    onActivate() {
        // Hover above the arena's top jump platform so a player jumping from
        // there can reach the pod. Top platform is at tile-row 11 (y = 352);
        // a ball-form jump from it leaves Sonic's body around y = 183..205.
        // Parking the pod around y = 202 puts the weak bounds at ~183..223
        // so there's a comfortable overlap window instead of pixel-perfect.
        this.homeY = this.arena.floorY - 310;
        this.y = this.arena.top - 40;
        this.x = this.arena.centerX;
    }

    updateAI(player) {
        this.propPhase += 0.6;
        this.facing = player.x < this.x ? -1 : 1;
        this.modeTimer--;

        // Drive patterns differ per phase:
        //   Phase 1 (7-5): hover + bomb
        //   Phase 2 (4-3): add dive attacks, spawn minions once
        //   Phase 3 (<=2): rapid bomb + dive cycle
        const phase = this.hp <= 2 ? 3 : (this.hp <= 4 ? 2 : 1);

        switch (this.mode) {
            case 'hover':
                this.hoverPhase += 0.02;
                {
                    const driftX = Math.sin(this.hoverPhase) * 130;
                    const tx = this.arena.centerX + driftX;
                    this.x += (tx - this.x) * 0.05;
                    const ty = this.homeY + Math.sin(this.hoverPhase * 2) * 10;
                    this.y += (ty - this.y) * 0.08;
                }
                if (this.modeTimer <= 0) {
                    // Choose next attack based on phase
                    const roll = Math.random();
                    if (phase === 1) {
                        this._startBomb();
                    } else if (phase === 2) {
                        if (!this.minionsSpawned) {
                            this._summonMinions();
                            this.minionsSpawned = true;
                        } else if (roll < 0.55) {
                            this._startDive(player);
                        } else {
                            this._startBomb();
                        }
                    } else {
                        if (roll < 0.6) this._startDive(player);
                        else this._startBomb();
                    }
                }
                break;

            case 'bomb':
                if (this.modeTimer <= 0) {
                    this._dropBomb();
                    const base = phase === 3 ? 30 : (phase === 2 ? 55 : 75);
                    this._enterMode('hover', base);
                }
                break;

            case 'dive':
                // J-shaped arc parameterized by diveT 0..1. Phase 3 is
                // slightly slower than before so the player still has time
                // to read the dive after the low-HP tempo change.
                this.diveT += phase === 3 ? 0.019 : 0.016;
                if (this.diveT > 1) this.diveT = 1;
                {
                    const t = this.diveT;
                    // Linear traverse with a parabolic lift over the midpoint:
                    // starts cleanly at (diveFromX, diveFromY) and ends at
                    // (diveToX, diveToY) so the pod visibly sweeps in instead
                    // of snapping next to the player on frame 1.
                    const ex = this.diveFromX + (this.diveToX - this.diveFromX) * t;
                    const peak = -4 * (t - 0.5) * (t - 0.5) + 1;
                    const ey = this.diveFromY
                        + (this.diveToY - this.diveFromY) * t
                        - peak * 32;
                    this.x = ex;
                    this.y = ey;
                }
                if (this.diveT >= 1) {
                    this._enterMode('recover', phase === 3 ? 34 : 50);
                }
                break;

            case 'recover':
                {
                    const ty = this.homeY;
                    this.y += (ty - this.y) * 0.08;
                }
                if (this.modeTimer <= 0) {
                    const base = phase === 3 ? 40 : 70;
                    this._enterMode('hover', base);
                }
                break;
        }
    }

    _enterMode(mode, duration) {
        this.mode = mode;
        this.modeTimer = duration;
    }

    _startBomb() {
        this._enterMode('bomb', 28);
    }

    _startDive(player) {
        this.diveFromX = this.x;
        this.diveFromY = this.y;
        // Target lands slightly past the player's current x so they have to dodge.
        const offset = player.x > this.x ? 90 : -90;
        this.diveToX = Utils.clamp(player.x + offset,
            this.arena.left + 80, this.arena.right - 80);
        this.diveToY = this.arena.floorY - 80;
        this.diveT = 0;
        this._enterMode('dive', 120);
    }

    _dropBomb() {
        const bomb = new BossProjectile(this.x, this.y + this.h / 2, 0, 2, 240, 'bomb',
            { w: 16, h: 16, color: '#222' });
        bomb.gravity = 0.32;
        World.entities.push(bomb);
    }

    _summonMinions() {
        World.addPopup(this.x, this.y - 40, 'REINFORCEMENTS', '#FF6666');
        // Spawn below the pod, between the boss and the top jump platform.
        // The old arena.top + 80 (y=80) was above the camera's clamped top,
        // so the flyers were effectively off-screen and the player never
        // noticed them. This height keeps them inside the active play area.
        const spawnY = this.homeY + 100;
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? -1 : 1;
            const spawnX = side < 0 ? this.arena.left + 40 : this.arena.right - 40;
            const f = new Flyer(spawnX, spawnY, -side);
            f.range = 220;
            World.entities.push(f);
            // Spark burst at each entry point so the player's eye catches
            // the spawn even if they're looking at the boss.
            for (let j = 0; j < 10; j++) {
                const a = Utils.rand(0, Math.PI * 2);
                World.addParticle(spawnX, spawnY,
                    Math.cos(a) * Utils.rand(1, 3),
                    Math.sin(a) * Utils.rand(1, 3),
                    26, 'spark');
            }
        }
    }

    getBounds() {
        // Pod body, slightly inset so the propeller visual doesn't over-grab.
        return {
            x: this.x - this.w / 2 + 4,
            y: this.y - this.h / 2 + 6,
            w: this.w - 8,
            h: this.h - 10,
        };
    }

    draw(ctx) {
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);
        const flash = this.flashing();

        // Dropping shadow on arena floor below
        GFX.drawShadow(ctx, sx, Camera.screenY(this.arena.floorY), 28, 0.25);

        // Propeller blades above
        const propY = sy - this.h / 2 - 8;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#CCC';
        ctx.lineWidth = 3;
        const a1 = this.propPhase;
        const a2 = this.propPhase + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(sx - 22 * Math.cos(a1), propY - 2 * Math.sin(a1));
        ctx.lineTo(sx + 22 * Math.cos(a1), propY + 2 * Math.sin(a1));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx - 22 * Math.cos(a2), propY - 2 * Math.sin(a2));
        ctx.lineTo(sx + 22 * Math.cos(a2), propY + 2 * Math.sin(a2));
        ctx.stroke();
        ctx.restore();

        // Propeller mast
        ctx.fillStyle = '#444';
        ctx.fillRect(sx - 2, sy - this.h / 2 - 8, 4, 8);

        // Pod hull (teardrop)
        ctx.save();
        if (flash) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; }

        const hullGrad = ctx.createLinearGradient(sx - 30, sy - 16, sx + 30, sy + 16);
        hullGrad.addColorStop(0, flash ? '#fff' : '#8844AA');
        hullGrad.addColorStop(0.5, flash ? '#fff' : '#CC66DD');
        hullGrad.addColorStop(1, flash ? '#fff' : '#552277');
        ctx.fillStyle = hullGrad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#220033';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Canopy
        ctx.fillStyle = flash ? '#fff' : '#224488';
        ctx.beginPath();
        ctx.ellipse(sx - 4, sy - 6, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFD044';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (!flash) {
            ctx.fillStyle = '#FFCC88';
            ctx.beginPath();
            ctx.arc(sx - 4, sy - 6, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.fillRect(sx - 10, sy - 8, 12, 2);
            ctx.fillRect(sx - 10, sy - 2, 10, 1.5);
        }

        // Side cannons
        ctx.fillStyle = flash ? '#fff' : '#444';
        ctx.fillRect(sx - this.w / 2 - 4, sy - 2, 10, 6);
        ctx.fillRect(sx + this.w / 2 - 6, sy - 2, 10, 6);

        // Twin engine glows
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glowPulse = 0.55 + Math.sin(this.time * 0.25) * 0.35;
        GFX.drawGlow(ctx, sx - 18, sy + this.h * 0.35, 12, 'rgba(255,140,220,0.85)', glowPulse);
        GFX.drawGlow(ctx, sx + 18, sy + this.h * 0.35, 12, 'rgba(255,140,220,0.85)', glowPulse);
        ctx.restore();

        ctx.restore();

        // Dive-charging exhaust trail
        if (this.mode === 'dive' && (this.time & 1) === 0) {
            World.addParticle(this.x, this.y + this.h / 2,
                Utils.rand(-1, 1), Utils.rand(1, 3),
                22, 'ember');
        }
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

// Particles are purely visual effects. The sprite name selects a
// behaviour profile (gravity, blend mode) so one class covers dust,
// sparks, speed lines, embers, and more without subclass explosion.
const PARTICLE_PROFILES = {
    dust:      { gravity: 0.1,  friction: 0.98, blend: 'source-over', growth: 1.0 },
    sparkle:   { gravity: 0.05, friction: 0.96, blend: 'lighter',     growth: 0.8 },
    spark:     { gravity: 0.15, friction: 0.95, blend: 'lighter',     growth: 1.2 },
    ember:     { gravity: -0.04, friction: 0.99, blend: 'lighter',    growth: 0.9 }, // rises
    speedline: { gravity: 0,    friction: 0.92, blend: 'lighter',     growth: 1.0 },
    ringburst: { gravity: 0.04, friction: 0.92, blend: 'lighter',     growth: 1.0 },
};

class Particle {
    constructor(x, y, vx, vy, life, sprite) {
        this.x = x; this.y = y;
        this.vx = vx || 0; this.vy = vy || 0;
        this.life = life || 30;
        this.maxLife = this.life;
        this.active = true;
        this.sprite = sprite || 'dust';
        this.rot = 0;
        this.rotVel = 0;
    }

    update() {
        const p = PARTICLE_PROFILES[this.sprite] || PARTICLE_PROFILES.dust;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += p.gravity;
        this.vx *= p.friction;
        this.rot += this.rotVel;
        this.life--;
        if (this.life <= 0) this.active = false;
    }

    draw(ctx) {
        const p = PARTICLE_PROFILES[this.sprite] || PARTICLE_PROFILES.dust;
        const t = this.life / this.maxLife;
        const spr = GFX.sprites[this.sprite];
        if (!spr) return;

        const prev = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = p.blend;
        ctx.globalAlpha = t;
        const scale = (0.5 + t * 0.5) * p.growth;
        const w = spr.width * scale;
        const h = spr.height * scale;
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);

        if (this.rot !== 0) {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(this.rot);
            ctx.drawImage(spr, -w / 2, -h / 2, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(spr, sx - w / 2, sy - h / 2, w, h);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = prev;
    }
}

// ---- WORLD SYSTEM ----
const World = {
    level: null,
    entities: [],
    particles: [],
    decorations: [],
    currentLevel: 0,

    // Build a tile map from level description.
    // Six levels total: three zones × two acts each. Act 1 is the classic
    // platforming run; Act 2 is a short runway + boss arena.
    //   0: Zone 1 Act 1 (Emerald Valley)
    //   1: Zone 1 Act 2 (Valley boss — Wrecker)
    //   2: Zone 2 Act 1 (Neon Factory)
    //   3: Zone 2 Act 2 (Factory boss — Crusher)
    //   4: Zone 3 Act 1 (Sky Sanctuary)
    //   5: Zone 3 Act 2 (Sky boss — Egg Wrecker, final)
    buildLevel(levelNum) {
        this.entities = [];
        this.particles = [];
        this.decorations = [];
        this.currentLevel = levelNum;

        switch (levelNum) {
            case 0: return this.buildLevel1();
            case 1: return this.buildZone1Act2();
            case 2: return this.buildLevel2();
            case 3: return this.buildZone2Act2();
            case 4: return this.buildLevel3();
            case 5: return this.buildZone3Act2();
        }
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
                // Emerald Valley: bouncy Green Hill energy in C major.
                // Progression: C - G - Am - F (I V vi IV). 4 bars of 16ths.
                tempo: 150,
                swing: 0.22,
                lead: [
                    // C:   C5    .   E5   .   G5  .  .   C6    .  .   G5  .  .  E5   .  .
                    523, 0, 659, 0, 784, 0, 0, 1047, 0, 0, 784, 0, 0, 659, 0, 0,
                    // G:   B4    .   D5   .   G5  .  .   B5    .  .   G5  .  .  D5   .  .
                    494, 0, 587, 0, 784, 0, 0,  988, 0, 0, 784, 0, 0, 587, 0, 0,
                    // Am:  C5    .   E5   .   A5  .  .   C6    .  .   A5  .  .  G5  E5  .
                    523, 0, 659, 0, 880, 0, 0, 1047, 0, 0, 880, 0, 0, 784, 659, 0,
                    // F:   C5    .   F5   .   A5  .  .   C6    .  .   A5  .  .  G5  E5  .
                    523, 0, 698, 0, 880, 0, 0, 1047, 0, 0, 880, 0, 0, 784, 659, 0,
                ],
                arp: [
                    // C (C4, E4, G4, C5 broken chord on 8ths)
                    262, 0, 330, 0, 392, 0, 523, 0, 392, 0, 330, 0, 392, 0, 523, 0,
                    // G (D4, G4, B4, D5)
                    294, 0, 392, 0, 494, 0, 587, 0, 494, 0, 392, 0, 494, 0, 587, 0,
                    // Am (A3, C4, E4, A4)
                    220, 0, 262, 0, 330, 0, 440, 0, 330, 0, 262, 0, 330, 0, 440, 0,
                    // F (F3, A3, C4, F4)
                    175, 0, 220, 0, 262, 0, 349, 0, 262, 0, 220, 0, 262, 0, 349, 0,
                ],
                bass: [
                    // Classic octave-bounce on each chord root/fifth/third
                    // C: C2 C3 C2 C3 G2 G3 E2 E3
                    65, 0, 131, 0, 65, 0, 131, 0, 98, 0, 196, 0, 82, 0, 165, 0,
                    // G: G2 G3 G2 G3 D2 D3 B2 B3
                    98, 0, 196, 0, 98, 0, 196, 0, 73, 0, 147, 0, 123, 0, 247, 0,
                    // Am: A2 A3 A2 A3 E2 E3 C3 C4
                    110, 0, 220, 0, 110, 0, 220, 0, 82, 0, 165, 0, 131, 0, 262, 0,
                    // F: F2 F3 F2 F3 C3 C4 A2 G2 (walks back toward C root)
                    87, 0, 175, 0, 87, 0, 175, 0, 131, 0, 262, 0, 110, 0, 98, 0,
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
                // Neon Factory: driving minor groove. A natural minor.
                // Progression: Am - F - G - E (i VI VII V). Almost-straight feel.
                tempo: 160,
                swing: 0.08,
                lead: [
                    // Am:  A4   .   C5  .   E5   .   A5   .   G5   .   E5   .   C5  . . .
                    440, 0, 523, 0, 659, 0, 880, 0, 784, 0, 659, 0, 523, 0, 0, 0,
                    // F:   A4   .   C5  .   F5   .   A5   .   G5   .   F5   .   C5  . . .
                    440, 0, 523, 0, 698, 0, 880, 0, 784, 0, 698, 0, 523, 0, 0, 0,
                    // G:   B4   .   D5  .   G5   .   B5   .   A5   .   G5   .   D5  . . .
                    494, 0, 587, 0, 784, 0, 988, 0, 880, 0, 784, 0, 587, 0, 0, 0,
                    // E:   E5   .   G5  .   B5   .   E6    .    D6    .    B5   .   A5  G5  E5  .
                    659, 0, 784, 0, 988, 0, 1319, 0, 1175, 0, 988, 0, 880, 784, 659, 0,
                ],
                arp: [
                    // Am (A3, C4, E4, A4)
                    220, 0, 262, 0, 330, 0, 440, 0, 330, 0, 262, 0, 330, 0, 440, 0,
                    // F (F3, A3, C4, F4)
                    175, 0, 220, 0, 262, 0, 349, 0, 262, 0, 220, 0, 262, 0, 349, 0,
                    // G (G3, B3, D4, G4)
                    196, 0, 247, 0, 294, 0, 392, 0, 294, 0, 247, 0, 294, 0, 392, 0,
                    // E (E3, G3, B3, E4) - natural minor color, no G#
                    165, 0, 196, 0, 247, 0, 330, 0, 247, 0, 196, 0, 247, 0, 330, 0,
                ],
                bass: [
                    // Dark low octave bass with chord tone walk
                    // Am: A1 A2 A1 A2 E2 E3 A2 G2
                    55, 0, 110, 0, 55, 0, 110, 0, 82, 0, 165, 0, 110, 0, 98, 0,
                    // F: F1 F2 F1 F2 C2 C3 F2 E2
                    44, 0, 87, 0, 44, 0, 87, 0, 65, 0, 131, 0, 87, 0, 82, 0,
                    // G: G1 G2 G1 G2 D2 D3 G2 B2
                    49, 0, 98, 0, 49, 0, 98, 0, 73, 0, 147, 0, 98, 0, 123, 0,
                    // E: E1 E2 E1 E2 B1 B2 E2 D2 (leads back to Am)
                    41, 0, 82, 0, 41, 0, 82, 0, 62, 0, 123, 0, 82, 0, 73, 0,
                ]
            }
        };

        Camera.bounds = {
            minX: 0, minY: 0,
            maxX: W * T, maxY: H * T
        };

        return this.level;
    },

    // ---- LEVEL 3: SKY SANCTUARY ----
    // A sunset temple in the clouds. Emphasizes vertical play, long spring
    // chains, sky-high bonus routes, and a climactic pillar-lined finale.
    buildLevel3() {
        const W = 325, H = 24;
        const tiles = Array.from({ length: H }, () => new Array(W).fill(TILE.EMPTY));
        const T = CFG.TILE;
        const theme = 3;

        const ground = (x) => {
            if (x < 0 || x >= W) return H;
            // Opening terrace
            if (x < 12) return 19;
            // Gentle stairstep up to the sanctuary entry
            if (x >= 12 && x < 18) return 19 - Math.floor((x - 12) * 0.5);
            if (x >= 18 && x < 30) return 16;
            // Small step down
            if (x >= 30 && x < 33) return 17;
            if (x >= 33 && x < 36) return 18;
            if (x >= 36 && x < 42) return 19;
            // First big chasm — crossed by stepping platforms
            if (x >= 42 && x < 48) return H + 5;
            if (x >= 48 && x < 60) return 18;
            // Steep rise to a sky-high plateau
            if (x >= 60 && x < 70) return 18 - Math.floor((x - 60) * 1.0);
            if (x >= 70 && x < 85) return 8;
            if (x >= 85 && x < 92) return 8 + Math.floor((x - 85) * 1.0);
            if (x >= 92 && x < 105) return 15;
            // Second chasm
            if (x >= 105 && x < 112) return H + 5;
            if (x >= 112 && x < 130) return 17;
            // Speed straightaway
            if (x >= 130 && x < 180) return 18;
            // Gentle rolling hill
            if (x >= 180 && x < 190) return 18 - Math.floor((x - 180) * 0.5);
            if (x >= 190 && x < 205) return 13;
            if (x >= 205 && x < 215) return 13 + Math.floor((x - 205) * 0.5);
            if (x >= 215 && x < 220) return 18;
            // Triple-pit gauntlet
            if (x >= 220 && x < 224) return H + 5;
            if (x >= 224 && x < 228) return 18;
            if (x >= 228 && x < 232) return H + 5;
            if (x >= 232 && x < 236) return 18;
            if (x >= 236 && x < 240) return H + 5;
            if (x >= 240 && x < 260) return 18;
            // Grand rise up to the temple plateau
            if (x >= 260 && x < 272) return 18 - Math.floor((x - 260) * 0.833);
            if (x >= 272 && x < 298) return 8;
            if (x >= 298 && x < 306) return 8 + Math.floor((x - 298) * 1.25);
            if (x >= 306 && x < W) return 18;
            return 18;
        };

        // Fill tiles based on ground function
        for (let x = 0; x < W; x++) {
            const gy = ground(x);
            if (gy < H) {
                tiles[gy][x] = TILE.SOLID;
                for (let y = gy + 1; y < H; y++) {
                    tiles[y][x] = TILE.FILL;
                }
            }
        }

        // Floating sanctuary platforms — islands of marble suspended in air
        const platforms = [
            [13, 13, 3], [24, 12, 3],            // opening aerial steps
            [44, 16, 3], [46, 13, 3],            // bridge the first chasm
            [53, 14, 4], [58, 11, 3],            // ramp up toward sky plateau
            [73, 4, 3], [78, 2, 3],              // sky-high bonus route
            [88, 12, 4], [97, 12, 3],            // descending path
            [107, 14, 4], [113, 11, 3],          // bridge second chasm
            [125, 15, 4],
            [140, 15, 4], [148, 12, 3],          // start of climbing tower
            [155, 9, 3], [162, 6, 3],            // top of climbing tower
            [168, 4, 3],                         // highest aerial bonus
            [195, 10, 5],                        // above the rolling hill
            [222, 15, 3], [230, 14, 3], [238, 15, 3], // stepping stones over triple-pit
            [250, 14, 4], [256, 11, 3],          // approach to temple
            [275, 5, 3], [283, 5, 3],            // over-temple bonus
            [300, 14, 4], [310, 12, 4],          // final descent
        ];
        platforms.forEach(([px, py, pw]) => {
            for (let x = px; x < px + pw && x < W; x++) {
                tiles[py][x] = TILE.PLATFORM;
            }
        });

        // Entities
        const ents = this.entities;
        const playerStart = { x: 3 * T + 16, y: 19 * T };

        // Rings — reward exploration of the aerial bonus paths
        const ringGroups = [
            // Opening terrace
            ...this._ringLine(5, 17, 6, 0),
            ...this._ringLine(14, 11, 3, 0),
            // Plateau approach
            ...this._ringLine(20, 14, 8, 0),
            // Arc over the first chasm
            ...this._ringArc(45, 15, 3, 4),
            // Rising section
            ...this._ringLine(52, 12, 4, 0),
            ...this._ringLine(60, 11, 6, 0),
            // Sky plateau
            ...this._ringLine(72, 6, 10, 0),
            // High bonus route
            ...this._ringLine(74, 2, 3, 0),
            ...this._ringLine(79, 0, 3, 0),
            // Descent
            ...this._ringLine(89, 10, 4, 0),
            // Arc over the second chasm
            ...this._ringArc(108, 13, 4, 5),
            // Speed section mid air
            ...this._ringLine(132, 14, 12, 0),
            ...this._ringLine(150, 16, 10, 0),
            // Climbing tower rings
            ...this._ringLine(141, 13, 4, 0),
            ...this._ringLine(149, 10, 3, 0),
            ...this._ringLine(156, 7, 3, 0),
            ...this._ringLine(169, 2, 3, 0),
            // Rolling hill top
            ...this._ringLine(192, 11, 8, 0),
            // Over the rolling hill bonus
            ...this._ringLine(196, 8, 4, 0),
            // Arcs over each pit in the triple-pit gauntlet
            ...this._ringArc(222, 14, 2, 3),
            ...this._ringArc(230, 14, 2, 3),
            ...this._ringArc(238, 14, 2, 3),
            // Approach to temple
            ...this._ringLine(251, 12, 4, 0),
            ...this._ringLine(262, 14, 4, 0),
            // Temple plateau — the prize run
            ...this._ringLine(274, 6, 12, 0),
            ...this._ringLine(276, 3, 3, 0),
            ...this._ringLine(284, 3, 3, 0),
            // Final descent
            ...this._ringLine(302, 12, 4, 0),
            ...this._ringLine(312, 10, 4, 0),
        ];
        ringGroups.forEach(r => ents.push(new Ring(r.x * T + 16, r.y * T + 16)));

        // Enemies — a mix of ground guards and flyers patrolling the open sky
        ents.push(new Crawler(25 * T, 16 * T - 16, -1));
        ents.push(new Crawler(55 * T, 18 * T - 16, 1));
        ents.push(new Crawler(76 * T, 8 * T - 16, -1));
        ents.push(new Crawler(100 * T, 15 * T - 16, 1));
        ents.push(new Crawler(120 * T, 17 * T - 16, -1));
        ents.push(new Crawler(150 * T, 18 * T - 16, 1));
        ents.push(new Crawler(175 * T, 18 * T - 16, -1));
        ents.push(new Crawler(200 * T, 13 * T - 16, 1));
        ents.push(new Crawler(245 * T, 18 * T - 16, -1));
        ents.push(new Crawler(280 * T, 8 * T - 16, 1));
        ents.push(new Crawler(310 * T, 18 * T - 16, -1));

        ents.push(new Flyer(45 * T, 10 * T, -1));
        ents.push(new Flyer(65 * T, 5 * T, 1));
        ents.push(new Flyer(95 * T, 9 * T, -1));
        ents.push(new Flyer(115 * T, 10 * T, 1));
        ents.push(new Flyer(145 * T, 7 * T, -1));
        ents.push(new Flyer(165 * T, 3 * T, 1));
        ents.push(new Flyer(200 * T, 7 * T, -1));
        ents.push(new Flyer(235 * T, 12 * T, 1));
        ents.push(new Flyer(270 * T, 4 * T, -1));
        ents.push(new Flyer(305 * T, 10 * T, 1));

        // Springs — the sky zone uses them as the primary vertical traversal
        ents.push(new Spring(30 * T, 16 * T, -14));
        ents.push(new Spring(50 * T, 18 * T, -16));  // vault the first chasm
        ents.push(new Spring(83 * T, 8 * T, -15));   // launch off the high plateau
        ents.push(new Spring(104 * T, 15 * T, -16)); // vault the second chasm
        ents.push(new Spring(140 * T, 18 * T, -15)); // up to the climbing tower
        ents.push(new Spring(164 * T, 6 * T, -14));  // access top bonus
        ents.push(new Spring(218 * T, 18 * T, -16)); // spring into the pit gauntlet
        ents.push(new Spring(243 * T, 18 * T, -15));
        ents.push(new Spring(270 * T, 8 * T, -14));  // up to temple bonus ring
        ents.push(new Spring(308 * T, 18 * T, -14));

        // Checkpoint — mid-run at the top of the climbing tower area
        ents.push(new Checkpoint(160 * T, 18 * T));

        // Goal
        ents.push(new GoalPost(320 * T, 18 * T));

        // Decorations — classical columns dressing the temple plateau
        const decs = this.decorations;
        [20, 25, 75, 80, 125, 175, 200, 245, 275, 282, 289, 296, 315].forEach(dx => {
            decs.push({ type: 'pillar', x: dx * T, y: ground(dx) * T });
        });

        this.level = {
            width: W, height: H, tiles, theme,
            playerStart,
            bgMusic: {
                // Sky Sanctuary: flowing and majestic. G major.
                // Progression: G - D - Em - C (I V vi IV). Moderate swing.
                tempo: 135,
                swing: 0.16,
                lead: [
                    // G:    G5   .  .   B5   .    D6   .   B5    .  .   G5   .  .   D5  . .
                    784, 0, 0, 988, 0, 1175, 0,  988, 0, 0, 784, 0, 0, 587, 0, 0,
                    // D:    A5   .  .   D6   .    F#6  .   D6    .  .   A5   .  .  F#5  . .
                    880, 0, 0, 1175, 0, 1480, 0, 1175, 0, 0, 880, 0, 0, 740, 0, 0,
                    // Em:   B5   .  .   E6   .    G6   .   E6    .  .   B5   .  .   G5  . .
                    988, 0, 0, 1319, 0, 1568, 0, 1319, 0, 0, 988, 0, 0, 784, 0, 0,
                    // C:    C6   .  .   E6   .    G6   .   E6    .  .   C6   .   G5 E5 D5 .
                    1047, 0, 0, 1319, 0, 1568, 0, 1319, 0, 0, 1047, 0, 784, 659, 587, 0,
                ],
                arp: [
                    // G (G4, B4, D5, G5)
                    392, 0, 494, 0, 587, 0, 784, 0, 587, 0, 494, 0, 587, 0, 784, 0,
                    // D (D4, F#4, A4, D5)
                    294, 0, 370, 0, 440, 0, 587, 0, 440, 0, 370, 0, 440, 0, 587, 0,
                    // Em (E4, G4, B4, E5)
                    330, 0, 392, 0, 494, 0, 659, 0, 494, 0, 392, 0, 494, 0, 659, 0,
                    // C (C4, E4, G4, C5)
                    262, 0, 330, 0, 392, 0, 523, 0, 392, 0, 330, 0, 392, 0, 523, 0,
                ],
                bass: [
                    // G: G2 G3 G2 G3 D2 D3 B2 B3
                    98, 0, 196, 0, 98, 0, 196, 0, 73, 0, 147, 0, 123, 0, 247, 0,
                    // D: D2 D3 D2 D3 A2 A3 F#2 F#3
                    73, 0, 147, 0, 73, 0, 147, 0, 110, 0, 220, 0, 92, 0, 185, 0,
                    // Em: E2 E3 E2 E3 B2 B3 G2 G3
                    82, 0, 165, 0, 82, 0, 165, 0, 123, 0, 247, 0, 98, 0, 196, 0,
                    // C: C2 C3 C2 C3 G2 G3 E2 D2 (walks back toward G)
                    65, 0, 131, 0, 65, 0, 131, 0, 98, 0, 196, 0, 82, 0, 73, 0,
                ]
            }
        };

        Camera.bounds = {
            minX: 0, minY: 0,
            maxX: W * T, maxY: H * T
        };

        return this.level;
    },

    // Internal helper used by all three boss acts: lays down a short runway,
    // a flat arena with invisible wall + trigger, and places a boss at the
    // center of the arena. Each zone act is just (runway tiles, boss class,
    // theme, decorations) on top of this shared skeleton.
    _buildBossAct(config) {
        const T = CFG.TILE;
        const W = config.width;
        const H = config.height;
        const theme = config.theme;
        const groundRow = config.groundRow;
        const tiles = Array.from({ length: H }, () => new Array(W).fill(TILE.EMPTY));

        // Flat ground across the whole act.
        for (let x = 0; x < W; x++) {
            tiles[groundRow][x] = TILE.SOLID;
            for (let y = groundRow + 1; y < H; y++) {
                tiles[y][x] = TILE.FILL;
            }
        }

        // Small platforming detail on the runway so Act 2 isn't just "run
        // 15 tiles to a boss room". Each config can override this.
        (config.platforms || []).forEach(([px, py, pw]) => {
            for (let x = px; x < px + pw && x < W; x++) {
                tiles[py][x] = TILE.PLATFORM;
            }
        });

        const ents = this.entities;
        const playerStart = { x: 3 * T + 16, y: groundRow * T };

        (config.rings || []).forEach(r => ents.push(new Ring(r.x * T + 16, r.y * T + 16)));
        (config.enemies || []).forEach(e => ents.push(e));

        // Arena extents (pixel-space). Camera locks here once the trigger fires.
        const arenaLeftT = config.arenaLeftTile;
        const arenaLeftX = arenaLeftT * T;
        const arenaRightX = W * T;
        const floorY = groundRow * T;
        const arena = {
            left: arenaLeftX,
            right: arenaRightX,
            top: 0,
            bottom: H * T,
            centerX: (arenaLeftX + arenaRightX) / 2,
            floorY: floorY,
        };

        // Boss spawns in a "waiting" phase at its home position above arena.
        const bossHomeX = config.bossHomeX != null
            ? config.bossHomeX
            : arena.centerX;
        const bossHomeY = config.bossHomeY != null
            ? config.bossHomeY
            : floorY - 180;
        const boss = new config.bossClass(bossHomeX, bossHomeY, arena);
        ents.push(boss);

        // Energy walls: one at the entrance slams shut behind the player on
        // trigger, another just before the goal post blocks the exit until
        // the boss is defeated. Both are disabled until the trigger fires and
        // both drop together on Boss.onDefeated.
        const entryWall = new BossWall(arenaLeftX + 8, 0, H * T);
        ents.push(entryWall);

        const goalX = config.goalTile != null ? config.goalTile : (W - 3);
        const exitWallX = (goalX - 2) * T;
        const exitWall = new BossWall(exitWallX, 0, H * T);
        ents.push(exitWall);

        // Trigger line just inside the arena entrance.
        const trigger = new BossTrigger(arenaLeftX + 32, 0, boss, entryWall);
        ents.push(trigger);

        // Goal post placed behind the exit wall so the boss must be defeated
        // before the player can reach it.
        ents.push(new GoalPost(goalX * T, groundRow * T));

        this.decorations.push(...(config.decorations || []));

        this.level = {
            width: W,
            height: H,
            tiles,
            theme,
            playerStart,
            bgMusic: config.bgMusic,
            isBossAct: true,
        };

        Camera.bounds = { minX: 0, minY: 0, maxX: W * T, maxY: H * T };

        return this.level;
    },

    // ---- ZONE 1 ACT 2: VALLEY SHOWDOWN ----
    // Short grass runway with a couple enemies and rings to warm up, then
    // straight into the Wrecker boss arena.
    buildZone1Act2() {
        const T = CFG.TILE;
        const W = 50, H = 22, groundRow = 16;

        const rings = [
            ...this._ringLine(6, 14, 5, 0),
            ...this._ringLine(12, 14, 4, 0),
        ];
        const enemies = [
            new Crawler(8 * T, groundRow * T - 16, 1),
            new Flyer(10 * T, 10 * T, -1),
        ];
        const platforms = [
            [7, 13, 3],
            [12, 11, 3],
        ];
        const decorations = [
            { type: 'tree', x: 5 * T, y: groundRow * T },
            { type: 'flower', x: 9 * T, y: groundRow * T, color: '#FF4488' },
            { type: 'tree', x: 45 * T, y: groundRow * T },
            { type: 'flower', x: 42 * T, y: groundRow * T, color: '#44AAFF' },
        ];

        return this._buildBossAct({
            width: W, height: H, theme: 1, groundRow,
            platforms, rings, enemies, decorations,
            arenaLeftTile: 18,
            bossClass: ValleyBoss,
            bossHomeX: (18 * T + W * T) / 2,
            bossHomeY: groundRow * T - 190,
            goalTile: W - 4,
            bgMusic: World._zone1Act1Music(),
        });
    },

    // ---- ZONE 2 ACT 2: FACTORY LOCKDOWN ----
    buildZone2Act2() {
        const T = CFG.TILE;
        const W = 50, H = 22, groundRow = 16;

        const rings = [
            ...this._ringLine(6, 14, 5, 0),
            ...this._ringLine(13, 13, 3, 0),
        ];
        const enemies = [
            new Crawler(8 * T, groundRow * T - 16, 1),
            new Crawler(14 * T, groundRow * T - 16, -1),
            new Flyer(11 * T, 10 * T, -1),
        ];
        const platforms = [
            [8, 13, 3],
            [13, 11, 3],
        ];
        const decorations = [
            { type: 'factory', x: 4 * T, y: groundRow * T },
            { type: 'factory', x: 44 * T, y: groundRow * T },
        ];

        return this._buildBossAct({
            width: W, height: H, theme: 2, groundRow,
            platforms, rings, enemies, decorations,
            arenaLeftTile: 18,
            bossClass: FactoryBoss,
            bossHomeX: (18 * T + W * T) / 2,
            bossHomeY: groundRow * T - 36,
            goalTile: W - 4,
            bgMusic: World._zone2Act1Music(),
        });
    },

    // ---- ZONE 3 ACT 2: FINAL SHOWDOWN ----
    // Slightly longer arena and bigger decorations befitting the final boss.
    buildZone3Act2() {
        const T = CFG.TILE;
        const W = 54, H = 22, groundRow = 16;

        const rings = [
            ...this._ringLine(6, 14, 6, 0),
            ...this._ringLine(13, 12, 4, 0),
            ...this._ringArc(16, 13, 2, 3),
        ];
        const enemies = [
            new Crawler(10 * T, groundRow * T - 16, -1),
            new Flyer(12 * T, 9 * T, 1),
        ];
        const platforms = [
            [7, 13, 3],
            [13, 10, 3],
            // Arena-side jump platforms so the player can reach the flying
            // boss. Lowered from rows 11/9/11 so climbing the stack doesn't
            // require near-perfect jumps; the boss hover height was lowered
            // to match so the weak-bounds stay reachable from the top.
            [24, 13, 3],
            [33, 11, 3],
            [42, 13, 3],
        ];
        const decorations = [
            { type: 'pillar', x: 4 * T, y: groundRow * T },
            { type: 'pillar', x: 17 * T, y: groundRow * T },
            { type: 'pillar', x: 25 * T, y: groundRow * T },
            { type: 'pillar', x: 41 * T, y: groundRow * T },
            { type: 'pillar', x: 49 * T, y: groundRow * T },
        ];

        return this._buildBossAct({
            width: W, height: H, theme: 3, groundRow,
            platforms, rings, enemies, decorations,
            arenaLeftTile: 20,
            bossClass: SkyBoss,
            bossHomeX: (20 * T + W * T) / 2,
            bossHomeY: groundRow * T - 260,
            goalTile: W - 4,
            bgMusic: World._zone3Act1Music(),
        });
    },

    // Music-descriptor getters — lazy so the per-act builders don't have to
    // copy-paste the full track data. They just pull the same soundtrack as
    // that zone's Act 1 during the runway; BossTrigger swaps to BOSS_MUSIC
    // when the fight actually starts.
    _zone1Act1Music() {
        // Extracted from buildLevel1 so both acts can share it.
        return {
            tempo: 150, swing: 0.22,
            lead: [
                523, 0, 659, 0, 784, 0, 0, 1047, 0, 0, 784, 0, 0, 659, 0, 0,
                494, 0, 587, 0, 784, 0, 0, 988, 0, 0, 784, 0, 0, 587, 0, 0,
                523, 0, 659, 0, 880, 0, 0, 1047, 0, 0, 880, 0, 0, 784, 659, 0,
                523, 0, 698, 0, 880, 0, 0, 1047, 0, 0, 880, 0, 0, 784, 659, 0,
            ],
            arp: [
                262, 0, 330, 0, 392, 0, 523, 0, 392, 0, 330, 0, 392, 0, 523, 0,
                294, 0, 392, 0, 494, 0, 587, 0, 494, 0, 392, 0, 494, 0, 587, 0,
                220, 0, 262, 0, 330, 0, 440, 0, 330, 0, 262, 0, 330, 0, 440, 0,
                175, 0, 220, 0, 262, 0, 349, 0, 262, 0, 220, 0, 262, 0, 349, 0,
            ],
            bass: [
                65, 0, 131, 0, 65, 0, 131, 0, 98, 0, 196, 0, 82, 0, 165, 0,
                98, 0, 196, 0, 98, 0, 196, 0, 73, 0, 147, 0, 123, 0, 247, 0,
                110, 0, 220, 0, 110, 0, 220, 0, 82, 0, 165, 0, 131, 0, 262, 0,
                87, 0, 175, 0, 87, 0, 175, 0, 131, 0, 262, 0, 110, 0, 98, 0,
            ]
        };
    },
    _zone2Act1Music() {
        return {
            tempo: 160, swing: 0.08,
            lead: [
                440, 0, 523, 0, 659, 0, 880, 0, 784, 0, 659, 0, 523, 0, 0, 0,
                440, 0, 523, 0, 698, 0, 880, 0, 784, 0, 698, 0, 523, 0, 0, 0,
                494, 0, 587, 0, 784, 0, 988, 0, 880, 0, 784, 0, 587, 0, 0, 0,
                659, 0, 784, 0, 988, 0, 1319, 0, 1175, 0, 988, 0, 880, 784, 659, 0,
            ],
            arp: [
                220, 0, 262, 0, 330, 0, 440, 0, 330, 0, 262, 0, 330, 0, 440, 0,
                175, 0, 220, 0, 262, 0, 349, 0, 262, 0, 220, 0, 262, 0, 349, 0,
                196, 0, 247, 0, 294, 0, 392, 0, 294, 0, 247, 0, 294, 0, 392, 0,
                165, 0, 196, 0, 247, 0, 330, 0, 247, 0, 196, 0, 247, 0, 330, 0,
            ],
            bass: [
                55, 0, 110, 0, 55, 0, 110, 0, 82, 0, 165, 0, 110, 0, 98, 0,
                44, 0, 87, 0, 44, 0, 87, 0, 65, 0, 131, 0, 87, 0, 82, 0,
                49, 0, 98, 0, 49, 0, 98, 0, 73, 0, 147, 0, 98, 0, 123, 0,
                41, 0, 82, 0, 41, 0, 82, 0, 62, 0, 123, 0, 82, 0, 73, 0,
            ]
        };
    },
    _zone3Act1Music() {
        return {
            tempo: 135, swing: 0.16,
            lead: [
                784, 0, 0, 988, 0, 1175, 0, 988, 0, 0, 784, 0, 0, 587, 0, 0,
                880, 0, 0, 1175, 0, 1480, 0, 1175, 0, 0, 880, 0, 0, 740, 0, 0,
                988, 0, 0, 1319, 0, 1568, 0, 1319, 0, 0, 988, 0, 0, 784, 0, 0,
                1047, 0, 0, 1319, 0, 1568, 0, 1319, 0, 0, 1047, 0, 784, 659, 587, 0,
            ],
            arp: [
                392, 0, 494, 0, 587, 0, 784, 0, 587, 0, 494, 0, 587, 0, 784, 0,
                294, 0, 370, 0, 440, 0, 587, 0, 440, 0, 370, 0, 440, 0, 587, 0,
                330, 0, 392, 0, 494, 0, 659, 0, 494, 0, 392, 0, 494, 0, 659, 0,
                262, 0, 330, 0, 392, 0, 523, 0, 392, 0, 330, 0, 392, 0, 523, 0,
            ],
            bass: [
                98, 0, 196, 0, 98, 0, 196, 0, 73, 0, 147, 0, 123, 0, 247, 0,
                73, 0, 147, 0, 73, 0, 147, 0, 110, 0, 220, 0, 92, 0, 185, 0,
                82, 0, 165, 0, 82, 0, 165, 0, 123, 0, 247, 0, 98, 0, 196, 0,
                65, 0, 131, 0, 65, 0, 131, 0, 98, 0, 196, 0, 82, 0, 73, 0,
            ]
        };
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

    // Find the top Y of the first solid tile at or below a world-space point.
    // Used by enemies/flyers to project accurate blob shadows onto terrain.
    // Returns the world Y of the tile top, or null if nothing solid found.
    groundYBelow(worldX, worldY, maxTiles) {
        const T = CFG.TILE;
        const tx = Math.floor(worldX / T);
        const startTy = Math.max(0, Math.floor(worldY / T));
        const limit = Math.min(this.level ? this.level.height : 0, startTy + (maxTiles || 48));
        for (let ty = startTy; ty < limit; ty++) {
            const tile = this.getTile(tx, ty);
            if (tile === TILE.SOLID || tile === TILE.FILL) {
                return ty * T;
            }
        }
        return null;
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
            // Pillars are taller than the other decorations; widen the cull
            // box a bit so their capitals don't pop in near the top of screen.
            if (Camera.visible(d.x - 30, d.y - 80, 60, 80)) {
                if (d.type === 'tree') GFX.drawTree(ctx, Camera.screenX(d.x), Camera.screenY(d.y));
                if (d.type === 'flower') GFX.drawFlower(ctx, Camera.screenX(d.x), Camera.screenY(d.y), d.color);
                if (d.type === 'factory') GFX.drawFactory(ctx, Camera.screenX(d.x), Camera.screenY(d.y));
                if (d.type === 'pillar') GFX.drawPillar(ctx, Camera.screenX(d.x), Camera.screenY(d.y));
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
