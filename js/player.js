// ============================================================
// PLAYER.JS - Sonic Character: Physics, States, Collision
// ============================================================

const Player = {
    // Position (x = center, y = bottom of hitbox)
    x: 0, y: 0,
    vx: 0, vy: 0,
    facing: 1, // 1 = right, -1 = left

    // Hitbox dimensions
    standWidth: 18,
    standHeight: 32,
    ballWidth: 18,
    ballHeight: 22,

    // State
    state: 'idle',  // idle, running, jumping, rolling, spindash, crouching, hurt, spring, dead
    grounded: false,
    jumpBufferTimer: 0,  // Frames left to consume buffered jump (press before landing)
    coyoteTimer: 0,     // Frames left to jump after leaving ground
    _jumpedWhileHolding: false,  // Prevent repeat jump when holding key
    invincible: 0,
    invincibleFlash: false,
    animFrame: 0,
    animTimer: 0,
    isFastRunning: false, // Hysteresis flag for fast-run animation (prevents flicker near threshold)
    spindashCharge: 0,
    controlLock: 0,  // Frames of no input (after hurt, spring, etc.)
    deathTimer: 0,
    lookTimer: 0,

    // Stats
    rings: 0,
    score: 0,
    lives: CFG.START_LIVES,
    time: 0, // frames

    // Checkpoint
    checkpointX: 0,
    checkpointY: 0,
    hasCheckpoint: false,

    // Get current hitbox width/height
    get w() {
        return (this.state === 'rolling' || this.state === 'spindash' || this.state === 'jumping')
            ? this.ballWidth : this.standWidth;
    },
    get h() {
        return (this.state === 'rolling' || this.state === 'spindash' || this.state === 'jumping')
            ? this.ballHeight : this.standHeight;
    },

    // Get hitbox rect
    getBounds() {
        return {
            x: this.x - this.w / 2,
            y: this.y - this.h,
            w: this.w,
            h: this.h
        };
    },

    // Initialize / reset player for a level
    init(spawnX, spawnY) {
        this.x = spawnX;
        this.y = spawnY;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.state = 'idle';
        this.grounded = false;
        this.invincible = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.spindashCharge = 0;
        this.controlLock = 0;
        this.deathTimer = 0;
        this.lookTimer = 0;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this._jumpedWhileHolding = false;
        this.time = 0;
        this.checkpointX = spawnX;
        this.checkpointY = spawnY;
        this.hasCheckpoint = false;
    },

    // Respawn at checkpoint or start
    respawn() {
        if (this.hasCheckpoint) {
            this.x = this.checkpointX;
            this.y = this.checkpointY;
        } else {
            this.x = World.level.playerStart.x;
            this.y = World.level.playerStart.y;
        }
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.state = 'idle';
        this.grounded = false;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        this._jumpedWhileHolding = false;
        this.invincible = 60;
        this.controlLock = 0;
        this.deathTimer = 0;
        this.time = 0;
    },

    // ---- MAIN UPDATE ----
    update() {
        if (this.state === 'dead') {
            this.vy += CFG.GRAVITY;
            this.y += this.vy;
            if (this.deathTimer > 0) {
                this.deathTimer--;
                if (this.deathTimer <= 0) {
                    if (typeof Game !== 'undefined' && Game.onPlayerDeath) {
                        Game.onPlayerDeath();
                    }
                }
            }
            return;
        }

        this.time++;
        if (this.invincible > 0) {
            this.invincible--;
            this.invincibleFlash = (this.invincible % 6) < 3;
        } else {
            this.invincibleFlash = false;
        }
        if (this.controlLock > 0) this.controlLock--;

        // Buffer jump when pressed in air (allows jump if you land within ~100ms)
        if (Input.jump && !this.grounded && this.state !== 'dead') {
            this.jumpBufferTimer = CFG.JUMP_BUFFER_FRAMES;
        }
        if (Input.jumpReleased) this._jumpedWhileHolding = false;

        // State-specific update
        switch (this.state) {
            case 'idle': this.updateIdle(); break;
            case 'running': this.updateRunning(); break;
            case 'jumping': this.updateJumping(); break;
            case 'rolling': this.updateRolling(); break;
            case 'spindash': this.updateSpindash(); break;
            case 'crouching': this.updateCrouching(); break;
            case 'hurt': this.updateHurt(); break;
            case 'spring': this.updateSpring(); break;
        }

        // Apply gravity (if not grounded)
        if (!this.grounded) {
            this.vy += CFG.GRAVITY;
            if (this.vy > CFG.TERMINAL_VEL) this.vy = CFG.TERMINAL_VEL;
        }

        // Move and collide
        this.moveAndCollide();

        // Entity interactions
        this.checkEntities();

        // Coyote time & jump buffer decay (after moveAndCollide set grounded)
        if (this.grounded) {
            this.coyoteTimer = CFG.COYOTE_TIME_FRAMES;
        } else {
            this.coyoteTimer = Math.max(0, this.coyoteTimer - 1);
        }
        if (this.jumpBufferTimer > 0) this.jumpBufferTimer--;

        // Fell off level
        if (this.y > World.level.height * CFG.TILE + 64) {
            this.die();
        }

        // Update animation
        this.updateAnimation();
    },

    // ---- STATE UPDATES ----

    updateIdle() {
        // Friction
        this.vx *= (1 - CFG.FRICTION);
        if (Math.abs(this.vx) < 0.1) this.vx = 0;

        if (this.controlLock > 0) return;

        // Movement input
        if (Input.left || Input.right) {
            this.state = 'running';
            return;
        }

        // Look up
        if (Input.up) {
            this.lookTimer = Math.min(this.lookTimer + 1, 60);
        } else if (Input.down) {
            // Crouch
            this.state = 'crouching';
            return;
        } else {
            this.lookTimer = 0;
        }

        // Jump
        if (this.canJump()) {
            this.doJump();
        }
    },

    updateRunning() {
        if (this.controlLock > 0) {
            // Still apply friction
            this.vx *= (1 - CFG.FRICTION * 0.5);
            return;
        }

        const accel = this.grounded ? CFG.GROUND_ACCEL : CFG.AIR_ACCEL;

        if (Input.left) {
            if (this.vx > 2) {
                // Skidding
                this.vx -= CFG.DECEL;
            } else {
                this.vx -= accel;
                this.facing = -1;
            }
        } else if (Input.right) {
            if (this.vx < -2) {
                this.vx += CFG.DECEL;
            } else {
                this.vx += accel;
                this.facing = 1;
            }
        } else {
            // Friction when no input
            this.vx *= (1 - CFG.FRICTION);
            if (Math.abs(this.vx) < 0.2) {
                this.vx = 0;
                this.state = 'idle';
                return;
            }
        }

        // Cap speed
        if (this.vx > CFG.TOP_SPEED) this.vx = CFG.TOP_SPEED;
        if (this.vx < -CFG.TOP_SPEED) this.vx = -CFG.TOP_SPEED;

        // Jump
        if (this.canJump()) {
            this.doJump();
            return;
        }

        // Roll (press down while moving fast)
        if (Input.down && Math.abs(this.vx) > 2 && this.grounded) {
            this.state = 'rolling';
            Sound.spinRelease();
            return;
        }

        // Crouch (press down while slow)
        if (Input.down && Math.abs(this.vx) < 1 && this.grounded) {
            this.state = 'crouching';
            this.vx = 0;
            return;
        }

        // Became airborne
        if (!this.grounded) {
            this.state = 'jumping';
        }
    },

    updateJumping() {
        // Variable jump height
        if (Input.jumpReleased && this.vy < CFG.MIN_JUMP) {
            this.vy = CFG.MIN_JUMP;
        }

        // Air control
        if (this.controlLock <= 0) {
            if (Input.left) {
                this.vx -= CFG.AIR_ACCEL;
                this.facing = -1;
            }
            if (Input.right) {
                this.vx += CFG.AIR_ACCEL;
                this.facing = 1;
            }
        }

        // Cap horizontal speed
        if (this.vx > CFG.TOP_SPEED * 1.2) this.vx = CFG.TOP_SPEED * 1.2;
        if (this.vx < -CFG.TOP_SPEED * 1.2) this.vx = -CFG.TOP_SPEED * 1.2;

        // Land
        if (this.grounded) {
            if (Math.abs(this.vx) > 1) {
                this.state = 'running';
            } else {
                this.state = 'idle';
            }
            // Dust on landing
            for (let i = 0; i < 3; i++) {
                World.addParticle(this.x + Utils.rand(-8, 8), this.y,
                    Utils.rand(-1, 1), Utils.rand(-1, -0.3), 15, 'dust');
            }
        }
    },

    updateRolling() {
        // Reduced friction while rolling
        const decel = CFG.ROLL_DECEL;
        if (this.vx > 0) {
            this.vx -= decel;
            if (this.vx < 0) this.vx = 0;
        } else if (this.vx < 0) {
            this.vx += decel;
            if (this.vx > 0) this.vx = 0;
        }

        // Stop rolling if too slow
        if (Math.abs(this.vx) < 0.5 && this.grounded) {
            this.state = 'idle';
            this.vx = 0;
            return;
        }

        // Jump out of roll
        if (this.canJump()) {
            this.doJump();
            return;
        }

        // Became airborne
        if (!this.grounded) {
            this.state = 'jumping';
        }
    },

    updateSpindash() {
        this.vx = 0;

        // Charge with jump presses
        if (Input.jump) {
            this.spindashCharge = Math.min(
                this.spindashCharge + CFG.SPINDASH_CHARGE,
                CFG.SPINDASH_MAX
            );
            Sound.spinDash();
            // Dust particles
            World.addParticle(this.x - this.facing * 8, this.y,
                -this.facing * 2, Utils.rand(-1, -0.5), 15, 'dust');
        }

        // Release: launch!
        if (!Input.down) {
            const speed = CFG.SPINDASH_POWER + this.spindashCharge;
            this.vx = this.facing * speed;
            this.state = 'rolling';
            this.spindashCharge = 0;
            Sound.spinRelease();
            Camera.shake(3, 8);
            // Burst of dust
            for (let i = 0; i < 5; i++) {
                World.addParticle(this.x - this.facing * 12, this.y - 4,
                    -this.facing * Utils.rand(1, 4), Utils.rand(-2, 0), 20, 'dust');
            }
            return;
        }

        // Slowly decay charge
        this.spindashCharge *= 0.95;
    },

    updateCrouching() {
        this.vx *= 0.9;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;

        if (this.controlLock > 0) return;

        // Stand up
        if (!Input.down) {
            this.state = 'idle';
            return;
        }

        // Spin dash initiation
        if (Input.jump && Input.down) {
            this.state = 'spindash';
            this.spindashCharge = 0;
            Sound.spinDash();
            return;
        }
    },

    updateHurt() {
        // Hurt state: knocked back, no control
        // Will transition to idle/falling when landing
        if (this.grounded && this.controlLock <= 0) {
            this.vx = 0;
            this.state = 'idle';
        }
    },

    updateSpring() {
        // After spring bounce, behave like jumping but no ball
        if (Input.jumpReleased && this.vy < CFG.MIN_JUMP) {
            this.vy = CFG.MIN_JUMP;
        }

        if (this.controlLock <= 0) {
            if (Input.left) { this.vx -= CFG.AIR_ACCEL; this.facing = -1; }
            if (Input.right) { this.vx += CFG.AIR_ACCEL; this.facing = 1; }
        }

        if (this.vx > CFG.TOP_SPEED) this.vx = CFG.TOP_SPEED;
        if (this.vx < -CFG.TOP_SPEED) this.vx = -CFG.TOP_SPEED;

        if (this.grounded) {
            this.state = Math.abs(this.vx) > 1 ? 'running' : 'idle';
            for (let i = 0; i < 3; i++) {
                World.addParticle(this.x + Utils.rand(-8, 8), this.y,
                    Utils.rand(-1, 1), Utils.rand(-1, -0.3), 15, 'dust');
            }
        }
    },

    // Can jump if on ground (or coyote time) and have jump input (or buffered, or holding)
    canJump() {
        const hasGround = this.grounded || this.coyoteTimer > 0;
        const hasJumpInput = Input.jump || this.jumpBufferTimer > 0 ||
            (Input.jumpHeld && !this._jumpedWhileHolding);
        return hasGround && hasJumpInput && this.controlLock <= 0;
    },

    // ---- JUMP ----
    doJump() {
        this.vy = CFG.JUMP_FORCE;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this._jumpedWhileHolding = true;
        this.state = 'jumping';
        Sound.jump();
        // Dust
        for (let i = 0; i < 2; i++) {
            World.addParticle(this.x + Utils.rand(-6, 6), this.y,
                Utils.rand(-1, 1), Utils.rand(-0.5, 0), 12, 'dust');
        }
    },

    // ---- MOVEMENT & COLLISION ----
    moveAndCollide() {
        const bounds = this.getBounds();
        const oldGrounded = this.grounded;
        this.grounded = false;

        // Horizontal movement
        this.x += this.vx;
        let hBounds = this.getBounds();
        let col = World.collide(hBounds.x, hBounds.y, hBounds.w, hBounds.h);

        if (col.left) {
            // Push right
            const tileX = Math.floor(hBounds.x / CFG.TILE) * CFG.TILE + CFG.TILE;
            this.x = tileX + this.w / 2;
            this.vx = 0;
        }
        if (col.right) {
            // Push left
            const tileX = Math.floor((hBounds.x + hBounds.w) / CFG.TILE) * CFG.TILE;
            this.x = tileX - this.w / 2;
            this.vx = 0;
        }

        // Vertical movement
        this.y += this.vy;
        let vBounds = this.getBounds();
        col = World.collide(vBounds.x, vBounds.y, vBounds.w, vBounds.h);

        if (col.bottom && this.vy >= 0) {
            if (col.groundY !== null) {
                this.y = col.groundY;
            }
            this.vy = 0;
            this.grounded = true;
        }
        if (col.top && this.vy < 0) {
            // Hit ceiling
            const tileY = Math.floor(vBounds.y / CFG.TILE) * CFG.TILE + CFG.TILE;
            this.y = tileY + this.h;
            this.vy = 0;
        }

        // Prevent going off-screen left
        if (this.x < this.w / 2) {
            this.x = this.w / 2;
            this.vx = 0;
        }
        // Prevent going past level right edge
        if (this.x > World.level.width * CFG.TILE - this.w / 2) {
            this.x = World.level.width * CFG.TILE - this.w / 2;
            this.vx = 0;
        }
    },

    // ---- ENTITY INTERACTIONS ----
    checkEntities() {
        const pb = this.getBounds();
        const isBall = this.state === 'jumping' || this.state === 'rolling' || this.state === 'spindash';

        World.entities.forEach(ent => {
            if (!ent.active) return;
            if (ent.dead) return; // Already dying

            // Skip certain checks
            if (ent instanceof Popup || ent instanceof Particle) return;

            const eb = ent.getBounds ? ent.getBounds() : null;
            if (!eb) return;

            if (!Utils.overlap(pb, eb)) return;

            // Ring collection
            if (ent instanceof Ring && !ent.collected) {
                if (ent.collect()) {
                    this.rings++;
                    this.score += CFG.RING_VALUE;
                    Sound.ring();
                    World.addPopup(ent.x, ent.y - 10, '+10', '#FFD700');
                    // 100 rings = extra life
                    if (this.rings % 100 === 0) {
                        this.lives++;
                        Sound.oneUp();
                        World.addPopup(this.x, this.y - 40, '1UP!', '#44FF44');
                    }
                }
                return;
            }

            // Scattered ring collection
            if (ent instanceof ScatteredRing && ent.canCollect) {
                this.rings++;
                this.score += CFG.RING_VALUE;
                ent.active = false;
                Sound.ring();
                return;
            }

            // Spring
            if (ent instanceof Spring) {
                if (pb.y + pb.h > eb.y && pb.y + pb.h < eb.y + eb.h + 4 && this.vy >= 0) {
                    this.vy = ent.power;
                    this.grounded = false;
                    this.state = 'spring';
                    this.controlLock = 10;
                    ent.trigger();
                    Sound.spring();
                }
                return;
            }

            // Checkpoint
            if (ent instanceof Checkpoint) {
                if (ent.trigger()) {
                    this.hasCheckpoint = true;
                    this.checkpointX = ent.x;
                    this.checkpointY = ent.y;
                }
                return;
            }

            // Goal post
            if (ent instanceof GoalPost && !ent.spinning) {
                ent.trigger();
                Sound.levelComplete();
                // Return 'levelComplete' to game.js
                if (typeof Game !== 'undefined' && Game.onLevelComplete) {
                    Game.onLevelComplete();
                }
                return;
            }

            // Enemy collision
            if ((ent instanceof Crawler || ent instanceof Flyer) && !ent.dead) {
                if (this.invincible > 0 && this.state !== 'hurt') {
                    // Destroy enemy while invincible
                    this.destroyEnemy(ent);
                    return;
                }

                // Check if attacking (ball form or falling on top)
                const attackingFromAbove = this.vy > 0 && pb.y + pb.h < eb.y + eb.h * 0.6;
                const isAttacking = isBall || attackingFromAbove;

                if (isAttacking) {
                    this.destroyEnemy(ent);
                    // Bounce off enemy
                    this.vy = CFG.JUMP_FORCE * 0.7;
                    this.grounded = false;
                    if (this.state !== 'rolling') {
                        this.state = 'jumping';
                    }
                } else {
                    // Take damage
                    this.takeDamage(ent);
                }
            }
        });
    },

    destroyEnemy(enemy) {
        enemy.destroy();
        this.score += CFG.ENEMY_VALUE;
        Sound.enemyPop();
        World.addPopup(enemy.x, enemy.y - 10, '+100', '#FFFFFF');
        // Release sparkles
        for (let i = 0; i < 6; i++) {
            World.addParticle(enemy.x + Utils.rand(-10, 10), enemy.y + Utils.rand(-10, 10),
                Utils.rand(-2, 2), Utils.rand(-3, -1), 25, 'sparkle');
        }
    },

    takeDamage(source) {
        if (this.invincible > 0 || this.state === 'hurt') return;

        if (this.rings > 0) {
            // Lose rings
            Sound.loseRings();
            World.scatterRings(this.x, this.y - this.h / 2, this.rings);
            this.rings = 0;
        } else {
            // No rings = die
            this.die();
            return;
        }

        // Knockback
        this.state = 'hurt';
        this.vx = source ? (this.x < source.x ? -3 : 3) : -3 * this.facing;
        this.vy = -7;
        this.grounded = false;
        this.invincible = CFG.INVINCIBLE_TIME;
        this.controlLock = 30;
        Camera.shake(5, 10);
        Sound.hurt();
    },

    die() {
        this.state = 'dead';
        this.vy = -12;
        this.vx = 0;
        this.grounded = false;
        this.deathTimer = 90;
        Sound.stopMusic();
        Sound.hurt();
        Camera.shake(6, 15);
    },

    // ---- ANIMATION ----
    updateAnimation() {
        const speed = Math.abs(this.vx);

        // Leaving the running state clears the fast-run latch so we don't
        // resume in the wrong animation set next time we start running.
        if (this.state !== 'running' && this.isFastRunning) {
            this.isFastRunning = false;
        }

        switch (this.state) {
            case 'idle':
                this.animFrame = 0;
                break;

            case 'running': {
                // Hysteresis prevents flicker when speed hovers around the
                // fast-run threshold: enter fast-run at >6, exit only at <4.
                const wasFast = this.isFastRunning;
                if (!wasFast && speed > 6) {
                    this.isFastRunning = true;
                    this.animTimer = 0;
                    this.animFrame = 0;
                } else if (wasFast && speed < 4) {
                    this.isFastRunning = false;
                    this.animTimer = 0;
                    this.animFrame = 0;
                }

                const runSpeed = Math.max(0.1, speed * 0.08);
                this.animTimer += runSpeed;
                const frameCount = this.isFastRunning ? 4 : 8;
                this.animFrame = Math.floor(this.animTimer) % frameCount;
                this.facing = this.vx > 0 ? 1 : this.vx < 0 ? -1 : this.facing;
                break;
            }

            case 'jumping':
            case 'rolling':
            case 'spindash':
                this.animTimer += 0.3 + speed * 0.05;
                this.animFrame = Math.floor(this.animTimer) % 8;
                break;

            case 'crouching':
                this.animFrame = 0;
                break;

            case 'hurt':
                this.animFrame = 0;
                break;

            case 'spring':
                this.animFrame = 0;
                break;

            case 'dead':
                this.animFrame = 0;
                break;
        }
    },

    // ---- DRAW ----
    draw(ctx) {
        if (this.invincibleFlash) return; // Blink effect

        const S = GFX.sprites;
        const sx = Camera.screenX(this.x);
        const sy = Camera.screenY(this.y);
        const flip = this.facing < 0;
        let sprite = null;
        let offX = -18, offY = -40; // Sprite offset from bottom-center

        switch (this.state) {
            case 'idle':
                sprite = S.sonicIdle;
                break;

            case 'running': {
                const speed = Math.abs(this.vx);
                const isSkidding = (this.vx > 0 && Input.left) || (this.vx < 0 && Input.right);

                if (isSkidding && speed > 2) {
                    sprite = S.sonicSkid;
                } else if (this.isFastRunning) {
                    sprite = S.sonicFastRun[this.animFrame % S.sonicFastRun.length];
                } else {
                    sprite = S.sonicRun[this.animFrame % S.sonicRun.length];
                }
                break;
            }

            case 'jumping':
            case 'rolling':
                sprite = S.sonicBall[this.animFrame % S.sonicBall.length];
                offX = -14; offY = -28;
                break;

            case 'spindash':
                sprite = S.sonicBall[this.animFrame % S.sonicBall.length];
                offX = -14; offY = -28;
                // Dust effect
                if (this.spindashCharge > 1) {
                    ctx.globalAlpha = 0.4;
                    const dust = S.dust;
                    for (let i = 0; i < 3; i++) {
                        ctx.drawImage(dust,
                            sx - this.facing * (15 + i * 8) + Utils.rand(-3, 3),
                            sy - 10 + Utils.rand(-5, 5));
                    }
                    ctx.globalAlpha = 1;
                }
                break;

            case 'crouching':
                sprite = S.sonicCrouch;
                break;

            case 'hurt':
                sprite = S.sonicHurt;
                break;

            case 'spring':
                sprite = S.sonicIdle; // Standing pose during spring
                break;

            case 'dead':
                sprite = S.sonicHurt;
                break;
        }

        if (sprite) {
            GFX.draw(ctx, sprite, sx + offX, sy + offY, flip);
        }

        // Debug hitbox (uncomment to visualize)
        // const b = this.getBounds();
        // ctx.strokeStyle = 'rgba(255,0,0,0.5)';
        // ctx.strokeRect(Camera.screenX(b.x), Camera.screenY(b.y), b.w, b.h);
    }
};
