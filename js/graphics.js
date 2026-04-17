// ============================================================
// GRAPHICS.JS - Procedural Sprite Generation & Rendering
// All game graphics are generated using Canvas 2D drawing
// ============================================================

const GFX = {
    sprites: {},
    tileCache: {},

    init() {
        this.genSonic();
        this.genRings();
        this.genEnemies();
        this.genItems();
        this.genTiles();
        this.genParticles();
        PostFX.init();
    },

    // Create an offscreen canvas sprite
    _s(w, h, fn) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        fn(x, w, h);
        return c;
    },

    // Draw sprite (with optional horizontal flip)
    draw(ctx, spr, x, y, flip) {
        if (!spr) return;
        if (flip) {
            ctx.save();
            ctx.translate(Math.round(x) + spr.width, Math.round(y));
            ctx.scale(-1, 1);
            ctx.drawImage(spr, 0, 0);
            ctx.restore();
        } else {
            ctx.drawImage(spr, Math.round(x), Math.round(y));
        }
    },

    // ---- SONIC SPRITES ----
    genSonic() {
        const S = this.sprites;
        const W = 36, H = 52;
        const BODY_Y = 22;

        // Helper to draw Sonic's body at given params.
        // legPhase: 0..2π drives a smooth running cycle. Left and right legs
        //           are 180° out of phase so exactly one is forward at a time.
        // armPhase: similar, manually set for non-run poses (idle/skid/hurt).
        const drawBody = (ctx, opts) => {
            const { lean = 0, crouch = 0, legPhase = 0, armPhase = 0, isRun = false } = opts;
            ctx.save();
            ctx.translate(W / 2, BODY_Y);
            ctx.rotate(lean);

            const bodyY = crouch * 4;

            // Spikes (3 blue triangles on back of head)
            ctx.fillStyle = '#1838AA';
            for (let i = 0; i < 3; i++) {
                ctx.save();
                ctx.translate(-2, -12 + bodyY + i * 3);
                ctx.rotate(-0.3 - i * 0.25);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-14 + i * 2, -4 + i * 3);
                ctx.lineTo(-2, 4);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // Body
            ctx.fillStyle = '#2855DD';
            ctx.beginPath();
            ctx.ellipse(0, 2 + bodyY, 9, 10 - crouch * 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Belly
            ctx.fillStyle = '#FFCC88';
            ctx.beginPath();
            ctx.ellipse(3, 4 + bodyY, 5, 6 - crouch * 2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.fillStyle = '#2855DD';
            ctx.beginPath();
            ctx.arc(1, -10 + bodyY, 10, 0, Math.PI * 2);
            ctx.fill();

            // Face
            ctx.fillStyle = '#FFCC88';
            ctx.beginPath();
            ctx.ellipse(6, -9 + bodyY, 6, 7, 0, -0.5, 1.2);
            ctx.lineTo(6, -2 + bodyY);
            ctx.fill();

            // Nose
            ctx.fillStyle = '#FFCC88';
            ctx.beginPath();
            ctx.arc(12, -7 + bodyY, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Eye (white)
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.ellipse(5, -12 + bodyY, 4.5, 5.5, 0.1, 0, Math.PI * 2);
            ctx.fill();

            // Pupil
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.ellipse(7.5, -11 + bodyY, 2, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Eye shine
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(6.5, -13 + bodyY, 1, 0, Math.PI * 2);
            ctx.fill();

            // Ear (inner)
            ctx.fillStyle = '#FFCC88';
            ctx.beginPath();
            ctx.ellipse(1, -17 + bodyY, 2, 3, -0.3, 0, Math.PI * 2);
            ctx.fill();

            // Legs. For running (isRun=true), each leg uses its own phase
            // offset by π so one is always forward while the other is back —
            // every frame is a distinct pose, no duplicate-frame jitter.
            // For static poses (skid/hurt/idle), fall back to a single
            // legPhase-driven spread so existing callers still look right.
            let bxOff, byOff, fxOff, fyOff;
            if (isRun) {
                const legY = (phase) => Math.sin(phase) * 4;
                const legX = (phase) => Math.cos(phase) * 5;
                bxOff = legX(legPhase + Math.PI);
                byOff = Math.max(0, legY(legPhase + Math.PI));
                fxOff = legX(legPhase);
                fyOff = Math.max(0, legY(legPhase));
            } else {
                const legSpread = Math.sin(legPhase) * 8;
                bxOff = 0;
                byOff = Math.max(0, -legSpread);
                fxOff = 0;
                fyOff = Math.max(0, legSpread);
            }

            ctx.fillStyle = '#FFCC88';
            ctx.fillRect(-3 + bxOff * 0.3, 10 + bodyY, 4, 4 + byOff);
            ctx.fillStyle = '#DD2222';
            ctx.beginPath();
            ctx.ellipse(-1 + bxOff, 16 + bodyY + byOff, 5, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-5 + bxOff, 15 + bodyY + byOff, 6, 1.5);

            ctx.fillStyle = '#FFCC88';
            ctx.fillRect(2 + fxOff * 0.3, 10 + bodyY, 4, 4 + fyOff);
            ctx.fillStyle = '#DD2222';
            ctx.beginPath();
            ctx.ellipse(4 + fxOff, 16 + bodyY + fyOff, 5, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0 + fxOff, 15 + bodyY + fyOff, 6, 1.5);

            // Arm: during running, swing opposite to front leg. Otherwise use
            // whatever armPhase the caller supplied (for idle/skid/hurt).
            const effectiveArmPhase = isRun ? -Math.cos(legPhase) * 0.6 : armPhase;
            ctx.fillStyle = '#FFCC88';
            ctx.save();
            ctx.translate(7, 2 + bodyY);
            ctx.rotate(effectiveArmPhase);
            ctx.fillRect(0, -2, 4, 8);
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(2, 8, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.restore();
        };

        // Idle frame
        S.sonicIdle = this._s(W, H, (ctx) => drawBody(ctx, { legPhase: 0, armPhase: 0 }));

        // Run frames (8 frames). Using 8 instead of 6 avoids the mirror-image
        // collapse of sin(π-x)==sin(x) that made the 6-frame cycle have only
        // 3 unique poses. Each frame now shows a visually distinct stride.
        S.sonicRun = [];
        for (let i = 0; i < 8; i++) {
            const phase = (i / 8) * Math.PI * 2;
            S.sonicRun.push(this._s(W, H, (ctx) => drawBody(ctx, {
                lean: 0.15,
                legPhase: phase,
                isRun: true,
            })));
        }

        // Fast run (legs become circles/blur)
        S.sonicFastRun = [];
        for (let i = 0; i < 4; i++) {
            S.sonicFastRun.push(this._s(W, H, (ctx) => {
                ctx.save();
                ctx.translate(W / 2, BODY_Y);
                ctx.rotate(0.2);

                // Spikes
                ctx.fillStyle = '#1838AA';
                for (let s = 0; s < 3; s++) {
                    ctx.save();
                    ctx.translate(-2, -12 + s * 3);
                    ctx.rotate(-0.4 - s * 0.3);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(-16 + s * 2, -4 + s * 3);
                    ctx.lineTo(-2, 4);
                    ctx.fill();
                    ctx.restore();
                }

                ctx.fillStyle = '#2855DD';
                ctx.beginPath();
                ctx.ellipse(0, 0, 9, 9, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFCC88';
                ctx.beginPath();
                ctx.ellipse(3, 1, 5, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2855DD';
                ctx.beginPath();
                ctx.arc(1, -10, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFCC88';
                ctx.beginPath();
                ctx.ellipse(6, -9, 6, 7, 0, -0.5, 1.2);
                ctx.lineTo(6, -2);
                ctx.fill();
                ctx.fillStyle = '#FFCC88';
                ctx.beginPath();
                ctx.arc(12, -7, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.ellipse(5, -12, 3.5, 5, 0.1, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.ellipse(7, -11, 2, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                // Spinning leg circle
                const angle = (i / 4) * Math.PI * 2;
                ctx.fillStyle = '#DD2222';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(0, 12, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#DD2222';
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * 5, 12 + Math.sin(angle) * 5, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }));
        }

        // Ball / spin frames (4 rotations)
        S.sonicBall = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            S.sonicBall.push(this._s(28, 28, (ctx) => {
                ctx.translate(14, 14);
                ctx.rotate(angle);

                // Main ball
                ctx.fillStyle = '#2855DD';
                ctx.beginPath();
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
                ctx.fill();

                // Darker stripe
                ctx.fillStyle = '#1838AA';
                ctx.beginPath();
                ctx.arc(0, 0, 12, -0.3, 0.3);
                ctx.lineTo(0, 0);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(0, 0, 12, Math.PI - 0.3, Math.PI + 0.3);
                ctx.lineTo(0, 0);
                ctx.fill();

                // Spikes on edge
                ctx.fillStyle = '#1838AA';
                for (let s = 0; s < 3; s++) {
                    ctx.save();
                    ctx.rotate(Math.PI + s * 0.35 - 0.35);
                    ctx.beginPath();
                    ctx.moveTo(10, 0);
                    ctx.lineTo(18, -3);
                    ctx.lineTo(12, 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Shoe peek
                ctx.fillStyle = '#DD2222';
                ctx.beginPath();
                ctx.arc(8, 8, 4, 0, Math.PI * 2);
                ctx.fill();
            }));
        }

        // Skid frame
        S.sonicSkid = this._s(W, H, (ctx) => {
            drawBody(ctx, { lean: -0.15, legPhase: 1.2, armPhase: -0.8 });
            ctx.fillStyle = 'rgba(200,180,150,0.5)';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(W / 2 + 5 + i * 6, BODY_Y + 12, 4, 2);
            }
        });

        // Hurt frame
        S.sonicHurt = this._s(W, H, (ctx) => {
            ctx.translate(W / 2, BODY_Y);
            ctx.rotate(-0.3);
            ctx.translate(-W / 2, -BODY_Y);
            drawBody(ctx, { lean: 0, legPhase: 2, armPhase: -1.5 });
        });

        // Crouch frame
        S.sonicCrouch = this._s(W, H, (ctx) => drawBody(ctx, { crouch: 1, legPhase: 0 }));

        // Look up frame
        S.sonicLookUp = this._s(W, H, (ctx) => {
            drawBody(ctx, { lean: -0.1, legPhase: 0 });
        });
    },

    // ---- RING SPRITES ----
    genRings() {
        const S = this.sprites;
        S.ring = [];
        // 8 rotation frames for 3D ring effect
        for (let i = 0; i < 8; i++) {
            const scaleX = Math.cos((i / 8) * Math.PI * 2);
            S.ring.push(this._s(20, 20, (ctx) => {
                ctx.translate(10, 10);
                ctx.scale(Math.abs(scaleX) * 0.6 + 0.4, 1);
                // Outer ring
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.stroke();
                // Inner highlight
                ctx.strokeStyle = '#FFF8AA';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(-1, -2, 4, -0.5, 1.5);
                ctx.stroke();
                // Shine
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(-3, -4, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }));
        }

        // Scattered ring (smaller, fading)
        S.ringScatter = this._s(14, 14, (ctx) => {
            ctx.translate(7, 7);
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#FFF8AA';
            ctx.beginPath();
            ctx.arc(-1, -2, 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    // ---- ENEMY SPRITES ----
    genEnemies() {
        const S = this.sprites;

        // Crawler (Motobug-like): small red/orange robot bug
        S.crawler = [];
        for (let i = 0; i < 2; i++) {
            S.crawler.push(this._s(32, 28, (ctx) => {
                ctx.translate(16, 14);
                // Body
                ctx.fillStyle = '#DD4422';
                ctx.beginPath();
                ctx.ellipse(0, -2, 12, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                // Shell highlight
                ctx.fillStyle = '#FF6644';
                ctx.beginPath();
                ctx.ellipse(-2, -5, 8, 4, -0.2, 0, Math.PI);
                ctx.fill();
                // Eye
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(6, -4, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(7.5, -3.5, 2, 0, Math.PI * 2);
                ctx.fill();
                // Antenna
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(3, -10);
                ctx.lineTo(6, -15);
                ctx.stroke();
                ctx.fillStyle = '#FF0';
                ctx.beginPath();
                ctx.arc(6, -15, 2, 0, Math.PI * 2);
                ctx.fill();
                // Wheels
                const wheelOff = i * 3;
                ctx.fillStyle = '#444';
                ctx.beginPath();
                ctx.arc(-7, 7, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(7, 7, 4, 0, Math.PI * 2);
                ctx.fill();
                // Wheel detail
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                const wa = (i / 2) * Math.PI;
                [-7, 7].forEach(wx => {
                    ctx.beginPath();
                    ctx.moveTo(wx + Math.cos(wa) * 3, 7 + Math.sin(wa) * 3);
                    ctx.lineTo(wx - Math.cos(wa) * 3, 7 - Math.sin(wa) * 3);
                    ctx.stroke();
                });
            }));
        }

        // Flyer (Buzzbomber-like): wasp robot
        S.flyer = [];
        for (let i = 0; i < 2; i++) {
            S.flyer.push(this._s(36, 30, (ctx) => {
                ctx.translate(18, 15);
                // Wings
                ctx.fillStyle = 'rgba(180,220,255,0.6)';
                ctx.save();
                ctx.rotate(i === 0 ? -0.3 : 0.3);
                ctx.beginPath();
                ctx.ellipse(-4, -14, 10, 5, -0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(4, -12, 8, 4, 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                // Body
                ctx.fillStyle = '#3355CC';
                ctx.beginPath();
                ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                // Stripes
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(-8, -2, 16, 3);
                // Eye
                ctx.fillStyle = '#FF0000';
                ctx.beginPath();
                ctx.arc(7, -2, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(8, -3, 1.5, 0, Math.PI * 2);
                ctx.fill();
                // Stinger
                ctx.fillStyle = '#888';
                ctx.beginPath();
                ctx.moveTo(-10, 2);
                ctx.lineTo(-16, 5);
                ctx.lineTo(-10, 4);
                ctx.fill();
            }));
        }

        // Enemy explosion particles
        S.enemyPop = this._s(40, 40, (ctx) => {
            ctx.translate(20, 20);
            const colors = ['#FF6600', '#FFAA00', '#FF3300', '#FFDD00'];
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const r = 8 + Math.random() * 6;
                ctx.fillStyle = colors[i % colors.length];
                ctx.beginPath();
                ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    },

    // ---- ITEMS (Springs, Checkpoint, Goal) ----
    genItems() {
        const S = this.sprites;

        // Spring (yellow, compressed and extended)
        S.springNormal = this._s(24, 24, (ctx) => {
            // Base
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(2, 16, 20, 6);
            ctx.fillStyle = '#DDAA00';
            ctx.fillRect(4, 18, 16, 3);
            // Coil
            ctx.strokeStyle = '#DDAA00';
            ctx.lineWidth = 3;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(5, 14 - i * 3);
                ctx.lineTo(19, 14 - i * 3);
                ctx.stroke();
            }
            // Top
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(3, 3, 18, 5);
            ctx.fillStyle = '#FFE44D';
            ctx.fillRect(5, 4, 14, 3);
        });

        S.springBounce = this._s(24, 28, (ctx) => {
            // Base
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(2, 22, 20, 6);
            ctx.fillStyle = '#DDAA00';
            ctx.fillRect(4, 24, 16, 3);
            // Extended coil
            ctx.strokeStyle = '#DDAA00';
            ctx.lineWidth = 3;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(5, 20 - i * 4);
                ctx.lineTo(19, 20 - i * 4);
                ctx.stroke();
            }
            // Top
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(3, 0, 18, 5);
        });

        // Checkpoint (post with spinning top)
        S.checkpoint = [];
        S.checkpointActive = [];
        for (let i = 0; i < 2; i++) {
            // Inactive
            S.checkpoint.push(this._s(16, 40, (ctx) => {
                ctx.fillStyle = '#4466AA';
                ctx.fillRect(6, 8, 4, 32);
                ctx.fillStyle = '#6688CC';
                ctx.beginPath();
                ctx.ellipse(8, 8, 7, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#4466AA';
                ctx.beginPath();
                ctx.ellipse(8, 8, 4, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }));
            // Active (spinning)
            S.checkpointActive.push(this._s(16, 40, (ctx) => {
                ctx.fillStyle = '#DD4444';
                ctx.fillRect(6, 8, 4, 32);
                const sx = Math.cos((i / 2) * Math.PI) * 0.5 + 0.5;
                ctx.fillStyle = '#FF6644';
                ctx.save();
                ctx.translate(8, 8);
                ctx.scale(sx * 0.6 + 0.4, 1);
                ctx.beginPath();
                ctx.ellipse(0, 0, 7, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFAA44';
                ctx.beginPath();
                ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }));
        }

        // Goal sign
        S.goalSign = [];
        for (let i = 0; i < 4; i++) {
            S.goalSign.push(this._s(32, 48, (ctx) => {
                // Post
                ctx.fillStyle = '#888888';
                ctx.fillRect(14, 4, 4, 44);
                // Sign (rotating)
                const sx = Math.cos((i / 4) * Math.PI * 2);
                ctx.save();
                ctx.translate(16, 16);
                ctx.scale(Math.abs(sx) * 0.7 + 0.3, 1);
                ctx.fillStyle = sx > 0 ? '#DDDDDD' : '#2855DD';
                ctx.fillRect(-12, -12, 24, 24);
                ctx.fillStyle = sx > 0 ? '#2855DD' : '#FFCC00';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(sx > 0 ? 'S' : '★', 0, 4);
                ctx.restore();
                // Base
                ctx.fillStyle = '#666';
                ctx.fillRect(8, 44, 16, 4);
            }));
        }
    },

    // ---- TILE SPRITES ----
    genTiles() {
        const T = CFG.TILE;
        const tc = this.tileCache;

        // Grass top (green with grass blades) - theme 1
        tc['grass1'] = this._s(T, T, (ctx) => {
            // Dirt fill
            ctx.fillStyle = '#C4863C';
            ctx.fillRect(0, 0, T, T);
            // Checker pattern
            ctx.fillStyle = '#B87830';
            for (let y = 0; y < T; y += 8) {
                for (let x = 0; x < T; x += 8) {
                    if ((x + y) % 16 === 0) ctx.fillRect(x, y, 8, 8);
                }
            }
            // Green top
            ctx.fillStyle = '#44BB44';
            ctx.fillRect(0, 0, T, 10);
            ctx.fillStyle = '#55DD55';
            ctx.fillRect(0, 0, T, 6);
            // Grass blades
            ctx.fillStyle = '#55DD55';
            for (let x = 2; x < T; x += 6) {
                const h = 3 + Math.sin(x * 1.5) * 3;
                ctx.fillRect(x, 10 - h, 2, h);
            }
        });

        // Ground fill (dirt) - theme 1
        tc['dirt1'] = this._s(T, T, (ctx) => {
            ctx.fillStyle = '#C4863C';
            ctx.fillRect(0, 0, T, T);
            ctx.fillStyle = '#B87830';
            for (let y = 0; y < T; y += 8) {
                for (let x = 0; x < T; x += 8) {
                    if ((x + y) % 16 === 0) ctx.fillRect(x, y, 8, 8);
                }
            }
        });

        // Platform - theme 1
        tc['plat1'] = this._s(T, T, (ctx) => {
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(0, 0, T, T);
            ctx.fillStyle = '#A0801C';
            ctx.fillRect(0, 0, T, 4);
            ctx.fillStyle = '#6B5010';
            ctx.fillRect(0, T - 4, T, 4);
            // Edge marks
            ctx.fillStyle = '#705510';
            ctx.fillRect(0, 0, 2, T);
            ctx.fillRect(T - 2, 0, 2, T);
        });

        // Grass top - theme 2 (factory/tech)
        tc['grass2'] = this._s(T, T, (ctx) => {
            ctx.fillStyle = '#4A3A6A';
            ctx.fillRect(0, 0, T, T);
            ctx.fillStyle = '#5A4A7A';
            for (let y = 0; y < T; y += 8) {
                for (let x = 0; x < T; x += 8) {
                    if ((x + y) % 16 === 8) ctx.fillRect(x, y, 8, 8);
                }
            }
            // Metal top edge
            ctx.fillStyle = '#8888CC';
            ctx.fillRect(0, 0, T, 6);
            ctx.fillStyle = '#AAAADD';
            ctx.fillRect(0, 0, T, 3);
            // Rivets
            ctx.fillStyle = '#6666AA';
            for (let x = 4; x < T; x += 10) {
                ctx.beginPath();
                ctx.arc(x, 8, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Ground - theme 2
        tc['dirt2'] = this._s(T, T, (ctx) => {
            ctx.fillStyle = '#4A3A6A';
            ctx.fillRect(0, 0, T, T);
            ctx.fillStyle = '#5A4A7A';
            for (let y = 0; y < T; y += 8) {
                for (let x = 0; x < T; x += 8) {
                    if ((x + y) % 16 === 8) ctx.fillRect(x, y, 8, 8);
                }
            }
        });

        // Platform - theme 2
        tc['plat2'] = this._s(T, T, (ctx) => {
            ctx.fillStyle = '#6666AA';
            ctx.fillRect(0, 0, T, T);
            ctx.fillStyle = '#8888CC';
            ctx.fillRect(0, 0, T, 4);
            ctx.fillStyle = '#444488';
            ctx.fillRect(0, T - 4, T, 4);
            // Tech lines
            ctx.strokeStyle = '#9999DD';
            ctx.lineWidth = 1;
            ctx.strokeRect(4, 4, T - 8, T - 8);
        });

        // Slope tiles (45 degree)
        ['1', '2'].forEach(theme => {
            const topColor = theme === '1' ? '#44BB44' : '#8888CC';
            const fillColor = theme === '1' ? '#C4863C' : '#4A3A6A';
            const checkColor = theme === '1' ? '#B87830' : '#5A4A7A';

            // Slope going up-right
            tc[`slopeR${theme}`] = this._s(T, T, (ctx) => {
                ctx.fillStyle = fillColor;
                ctx.beginPath();
                ctx.moveTo(0, T);
                ctx.lineTo(T, 0);
                ctx.lineTo(T, T);
                ctx.fill();
                // Checker
                ctx.fillStyle = checkColor;
                ctx.save();
                ctx.clip();
                for (let y = 0; y < T; y += 8) {
                    for (let x = 0; x < T; x += 8) {
                        if ((x + y) % 16 === 0) ctx.fillRect(x, y, 8, 8);
                    }
                }
                ctx.restore();
                // Top edge
                ctx.strokeStyle = topColor;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, T);
                ctx.lineTo(T, 0);
                ctx.stroke();
            });

            // Slope going up-left
            tc[`slopeL${theme}`] = this._s(T, T, (ctx) => {
                ctx.fillStyle = fillColor;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(T, T);
                ctx.lineTo(0, T);
                ctx.fill();
                ctx.fillStyle = checkColor;
                ctx.save();
                ctx.clip();
                for (let y = 0; y < T; y += 8) {
                    for (let x = 0; x < T; x += 8) {
                        if ((x + y) % 16 === 0) ctx.fillRect(x, y, 8, 8);
                    }
                }
                ctx.restore();
                ctx.strokeStyle = topColor;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(T, T);
                ctx.stroke();
            });
        });
    },

    // ---- PARTICLES ----
    genParticles() {
        const S = this.sprites;

        // Dust puff (soft, slightly glowy so bloom picks it up)
        S.dust = this._s(14, 14, (ctx) => {
            const g = ctx.createRadialGradient(7, 7, 0, 7, 7, 7);
            g.addColorStop(0, 'rgba(240,220,190,0.85)');
            g.addColorStop(0.6, 'rgba(200,180,150,0.4)');
            g.addColorStop(1, 'rgba(200,180,150,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 14, 14);
        });

        // Sparkle (cross with bright core - reads great with bloom)
        S.sparkle = this._s(12, 12, (ctx) => {
            const g = ctx.createRadialGradient(6, 6, 0, 6, 6, 6);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.5, 'rgba(255,240,120,0.7)');
            g.addColorStop(1, 'rgba(255,240,120,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 12, 12);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(5, 0, 2, 12);
            ctx.fillRect(0, 5, 12, 2);
        });

        // Horizontal speed line streak (used behind fast-running Sonic)
        S.speedline = this._s(24, 4, (ctx) => {
            const g = ctx.createLinearGradient(0, 2, 24, 2);
            g.addColorStop(0, 'rgba(180,220,255,0)');
            g.addColorStop(0.5, 'rgba(200,240,255,0.9)');
            g.addColorStop(1, 'rgba(180,220,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 1, 24, 2);
        });

        // Bright star spark (for enemy destroy / ring collection)
        S.spark = this._s(14, 14, (ctx) => {
            const g = ctx.createRadialGradient(7, 7, 0, 7, 7, 7);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.4, 'rgba(255,200,100,0.8)');
            g.addColorStop(1, 'rgba(255,120,30,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 14, 14);
        });

        // Small hot ember (factory theme ambient)
        S.ember = this._s(8, 8, (ctx) => {
            const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
            g.addColorStop(0, 'rgba(255,220,150,1)');
            g.addColorStop(0.5, 'rgba(255,120,40,0.7)');
            g.addColorStop(1, 'rgba(255,60,20,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 8, 8);
        });

        // Ring burst shard (bright gold flash when collecting a ring)
        S.ringburst = this._s(10, 10, (ctx) => {
            const g = ctx.createRadialGradient(5, 5, 0, 5, 5, 5);
            g.addColorStop(0, 'rgba(255,255,220,1)');
            g.addColorStop(0.5, 'rgba(255,215,0,0.9)');
            g.addColorStop(1, 'rgba(255,215,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 10, 10);
        });

        // Score popup (100)
        S.score100 = this._s(30, 14, (ctx) => {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('100', 15, 12);
        });

        // Score popup (10)
        S.score10 = this._s(24, 14, (ctx) => {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('10', 12, 12);
        });
    },

    // ---- BACKGROUND DRAWING ----
    drawBg(ctx, theme, camX, camY) {
        const w = CFG.WIDTH, h = CFG.HEIGHT;
        const t = Date.now() * 0.001;

        if (theme === 1) {
            // ---- EMERALD VALLEY ----
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#1E5FD4');
            grad.addColorStop(0.35, '#3A9AF4');
            grad.addColorStop(0.8, '#9FD5FF');
            grad.addColorStop(1, '#C9EAFF');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Sun disc with soft bloom-friendly glow
            const sunX = w * 0.8, sunY = h * 0.2;
            const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 180);
            sunGrad.addColorStop(0, 'rgba(255,245,200,0.9)');
            sunGrad.addColorStop(0.2, 'rgba(255,230,150,0.45)');
            sunGrad.addColorStop(0.5, 'rgba(255,210,120,0.15)');
            sunGrad.addColorStop(1, 'rgba(255,200,100,0)');
            ctx.fillStyle = sunGrad;
            ctx.fillRect(0, 0, w, h);

            // God rays (rotated beams of light from the sun)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(sunX, sunY);
            const rayRot = t * 0.05;
            for (let i = 0; i < 6; i++) {
                ctx.save();
                ctx.rotate(rayRot + i * (Math.PI / 3) + Math.sin(t * 0.3 + i) * 0.05);
                const rg = ctx.createLinearGradient(0, 0, 400, 0);
                rg.addColorStop(0, 'rgba(255,240,190,0.25)');
                rg.addColorStop(1, 'rgba(255,240,190,0)');
                ctx.fillStyle = rg;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(400, -40);
                ctx.lineTo(400, 40);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();

            // Clouds (parallax)
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            for (let i = 0; i < 8; i++) {
                const cx = ((i * 180 + 50) - camX * 0.05 + t * 4) % (w + 240) - 120;
                const cy = 30 + i * 22 + Math.sin(i * 2 + t * 0.2) * 12;
                ctx.beginPath();
                ctx.arc(cx, cy, 25, 0, Math.PI * 2);
                ctx.arc(cx + 22, cy - 6, 22, 0, Math.PI * 2);
                ctx.arc(cx + 44, cy, 24, 0, Math.PI * 2);
                ctx.arc(cx + 16, cy + 6, 20, 0, Math.PI * 2);
                ctx.fill();
            }

            // Distant mountains (very pale, far parallax)
            ctx.fillStyle = 'rgba(110,140,200,0.55)';
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 8) {
                const hx = (x + camX * 0.05) * 0.006;
                const hy = h - 260 + Math.sin(hx) * 60 + Math.sin(hx * 3.1) * 30;
                ctx.lineTo(x, hy);
            }
            ctx.lineTo(w, h);
            ctx.fill();

            // Far hills
            ctx.fillStyle = '#2F7A3E';
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 4) {
                const hx = (x + camX * 0.1) * 0.01;
                const hy = h - 180 + Math.sin(hx) * 40 + Math.sin(hx * 2.3) * 20;
                ctx.lineTo(x, hy);
            }
            ctx.lineTo(w, h);
            ctx.fill();

            // Mid hills
            ctx.fillStyle = '#44AA55';
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 4) {
                const hx = (x + camX * 0.2) * 0.015;
                const hy = h - 120 + Math.sin(hx) * 30 + Math.sin(hx * 1.7) * 15;
                ctx.lineTo(x, hy);
            }
            ctx.lineTo(w, h);
            ctx.fill();

            // Near foliage
            ctx.fillStyle = '#55CC66';
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 4) {
                const hx = (x + camX * 0.35) * 0.02;
                const hy = h - 60 + Math.sin(hx) * 20 + Math.sin(hx * 3) * 8;
                ctx.lineTo(x, hy);
            }
            ctx.lineTo(w, h);
            ctx.fill();

            // Animated water band at the bottom with waves + shimmer
            const waterY = h - 30;
            const waterGrad = ctx.createLinearGradient(0, waterY, 0, h);
            waterGrad.addColorStop(0, 'rgba(80,160,230,0.55)');
            waterGrad.addColorStop(1, 'rgba(20,60,140,0.5)');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, waterY, w, 30);

            // Water wave crests (two sine layers)
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            for (let row = 0; row < 3; row++) {
                ctx.beginPath();
                for (let x = 0; x < w; x += 4) {
                    const y = waterY + 4 + row * 8 + Math.sin(x * 0.05 + t * 2 + row) * 1.5;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

        } else {
            // ---- NEON FACTORY ----
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#08062A');
            grad.addColorStop(0.5, '#1A1250');
            grad.addColorStop(1, '#3A1670');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Soft nebula glow blobs (slow-moving ambient color)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const nx = ((i * 320 + t * 10) % (w + 400)) - 200;
                const ny = 100 + i * 80 + Math.sin(t * 0.2 + i) * 30;
                const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 220);
                const hue = i === 0 ? [120, 60, 200] : i === 1 ? [200, 60, 180] : [60, 180, 255];
                ng.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},0.22)`);
                ng.addColorStop(1, `rgba(${hue[0]},${hue[1]},${hue[2]},0)`);
                ctx.fillStyle = ng;
                ctx.fillRect(nx - 220, ny - 220, 440, 440);
            }
            ctx.restore();

            // Twinkling stars
            for (let i = 0; i < 40; i++) {
                const sx = (i * 137.5 + Math.sin(i) * 50) % w;
                const sy = (i * 73.7 + Math.cos(i) * 30) % (h * 0.5);
                const size = 1 + (i % 3);
                const twinkle = 0.3 + Math.abs(Math.sin(t * 2 + i * 0.7)) * 0.7;
                ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.6})`;
                ctx.fillRect(sx, sy, size, size);
            }

            // Industrial silhouettes - far layer
            ctx.fillStyle = '#0B0A2A';
            for (let i = 0; i < 10; i++) {
                const bx = ((i * 140) - camX * 0.05) % (w + 280) - 140;
                const bh = 80 + (i * 43) % 100;
                ctx.fillRect(bx, h - bh, 70, bh);
            }

            // Industrial silhouettes - mid layer with windows
            for (let i = 0; i < 8; i++) {
                const bx = ((i * 170) - camX * 0.12) % (w + 340) - 170;
                const bh = 120 + (i * 59) % 120;
                ctx.fillStyle = '#161040';
                ctx.fillRect(bx, h - bh, 90, bh);

                // Pulsing windows
                const winPulse = 0.5 + Math.sin(t * 3 + i) * 0.5;
                for (let wy = h - bh + 12; wy < h - 20; wy += 18) {
                    for (let wx = bx + 8; wx < bx + 82; wx += 16) {
                        const on = ((wx + wy) * 7 + i) % 5 !== 0;
                        if (on) {
                            ctx.fillStyle = `rgba(80,130,255,${0.5 + winPulse * 0.5})`;
                            ctx.fillRect(wx, wy, 8, 8);
                        }
                    }
                }

                // Tall antenna with blinking light
                if (i % 3 === 0) {
                    ctx.fillStyle = '#2A2A60';
                    ctx.fillRect(bx + 44, h - bh - 20, 2, 22);
                    if (Math.sin(t * 4 + i) > 0) {
                        ctx.fillStyle = '#FF4060';
                        ctx.beginPath();
                        ctx.arc(bx + 45, h - bh - 22, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Neon pipes (with animated glow)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 4; i++) {
                const py = 200 + i * 60 - (camY * 0.1);
                const hue = ['#6644FF', '#FF44AA', '#44AAFF', '#66FFAA'][i];
                // Outer glow pass
                ctx.strokeStyle = hue;
                ctx.globalAlpha = 0.15;
                ctx.lineWidth = 10;
                ctx.beginPath();
                ctx.moveTo(0, py);
                for (let x = 0; x <= w; x += 30) {
                    ctx.lineTo(x + 15, py + Math.sin((x + camX * 0.15 + t * 30) * 0.02) * 20);
                }
                ctx.stroke();
                // Core pass
                ctx.globalAlpha = 0.8;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, py);
                for (let x = 0; x <= w; x += 30) {
                    ctx.lineTo(x + 15, py + Math.sin((x + camX * 0.15 + t * 30) * 0.02) * 20);
                }
                ctx.stroke();
            }
            ctx.restore();

            // Ambient embers spawn (visual only)
            if (Math.random() < 0.15 && typeof World !== 'undefined' && World.level) {
                World.addParticle(
                    Camera.x + Math.random() * w,
                    Camera.y + h - Math.random() * 40,
                    Utils.rand(-0.3, 0.3), Utils.rand(-1.5, -0.5),
                    80 + Math.random() * 40, 'ember'
                );
            }
        }
    },

    // ---- DECORATIONS (drawn in world) ----
    drawTree(ctx, x, y) {
        // Palm tree
        ctx.fillStyle = '#885522';
        ctx.fillRect(x + 8, y - 50, 8, 60);
        // Trunk segments
        ctx.fillStyle = '#774418';
        for (let i = 0; i < 6; i++) {
            ctx.fillRect(x + 7, y - 50 + i * 10, 10, 3);
        }
        // Leaves
        ctx.fillStyle = '#33AA33';
        for (let i = 0; i < 5; i++) {
            ctx.save();
            ctx.translate(x + 12, y - 55);
            ctx.rotate((i / 5) * Math.PI * 2 - 0.5);
            ctx.beginPath();
            ctx.ellipse(18, 0, 22, 6, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },

    drawFlower(ctx, x, y, color) {
        ctx.fillStyle = '#44AA44';
        ctx.fillRect(x + 3, y - 12, 2, 14);
        ctx.fillStyle = color || '#FF4488';
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(x + 4 + Math.cos(a) * 4, y - 14 + Math.sin(a) * 4, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#FFDD00';
        ctx.beginPath();
        ctx.arc(x + 4, y - 14, 3, 0, Math.PI * 2);
        ctx.fill();
    },

    drawFactory(ctx, x, y) {
        ctx.fillStyle = '#3A3A6A';
        ctx.fillRect(x, y - 30, 20, 30);
        ctx.fillStyle = '#5A5A8A';
        ctx.fillRect(x + 2, y - 28, 16, 4);
        // Light (pulsing)
        const pulse = 0.7 + Math.sin(Date.now() * 0.005 + x * 0.01) * 0.3;
        ctx.fillStyle = `rgba(255,${60 + pulse * 30},${60 + pulse * 30},1)`;
        ctx.beginPath();
        ctx.arc(x + 10, y - 35, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,80,80,${0.2 + pulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(x + 10, y - 35, 10 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
    },

    // ============================================================
    // Draw a soft elliptical blob shadow below an entity (multiply).
    // Makes sprites feel grounded without needing real shadow casting.
    // ============================================================
    drawShadow(ctx, screenX, screenY, width, opacity) {
        const op = opacity == null ? 0.35 : opacity;
        const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, width);
        grad.addColorStop(0, `rgba(0,0,0,${op})`);
        grad.addColorStop(0.7, `rgba(0,0,0,${op * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, width, width * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
    },

    // ============================================================
    // Draw a soft radial glow (additive). Used for lighting passes.
    // color: any rgb / rgba / hex string; intensity: 0..1+ multiplier.
    // ============================================================
    drawGlow(ctx, x, y, radius, color, intensity) {
        const i = intensity == null ? 1 : intensity;
        const [r, g, b, a] = this._parseColor(color);
        const alpha = Math.max(0, Math.min(1, a * i));

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

        const prev = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = prev;
    },

    // Parse '#rgb', '#rrggbb', 'rgb(r,g,b)', 'rgba(r,g,b,a)' into [r,g,b,a].
    _parseColor(c) {
        if (c[0] === '#') {
            const hex = c.slice(1);
            if (hex.length === 3) {
                return [
                    parseInt(hex[0] + hex[0], 16),
                    parseInt(hex[1] + hex[1], 16),
                    parseInt(hex[2] + hex[2], 16),
                    1
                ];
            }
            return [
                parseInt(hex.slice(0, 2), 16),
                parseInt(hex.slice(2, 4), 16),
                parseInt(hex.slice(4, 6), 16),
                1
            ];
        }
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (m) {
            const parts = m[1].split(',').map(s => parseFloat(s.trim()));
            return [parts[0] | 0, parts[1] | 0, parts[2] | 0, parts.length > 3 ? parts[3] : 1];
        }
        return [255, 255, 255, 1];
    }
};

// ============================================================
// POST-PROCESSING PIPELINE
// Renders gameplay to an offscreen framebuffer then composites
// to the main canvas with bloom, vignette, color grading,
// subtle scanlines and chromatic-fringe effects.
// ============================================================
const PostFX = {
    enabled: true,
    bloomEnabled: true,
    vignetteEnabled: true,
    scanlinesEnabled: true,
    grainEnabled: true,

    fbo: null,         // full-res offscreen buffer (gameplay target)
    fboCtx: null,
    bloomA: null, bloomACtx: null,  // half-res for bright-pass + blur
    bloomB: null, bloomBCtx: null,  // quarter-res for wide blur
    scanlinePattern: null,
    grainBuffer: null,
    grainFrame: 0,

    // Dynamic effects (set by gameplay code per frame)
    flashColor: null,   // e.g. 'rgba(255,40,40,0.4)' for hurt
    flashAlpha: 0,
    damageVignette: 0,  // 0..1 extra red vignette on damage

    init() {
        this.fbo = document.createElement('canvas');
        this.fbo.width = CFG.WIDTH;
        this.fbo.height = CFG.HEIGHT;
        this.fboCtx = this.fbo.getContext('2d');

        this.bloomA = document.createElement('canvas');
        this.bloomA.width = Math.floor(CFG.WIDTH / 2);
        this.bloomA.height = Math.floor(CFG.HEIGHT / 2);
        this.bloomACtx = this.bloomA.getContext('2d');

        this.bloomB = document.createElement('canvas');
        this.bloomB.width = Math.floor(CFG.WIDTH / 4);
        this.bloomB.height = Math.floor(CFG.HEIGHT / 4);
        this.bloomBCtx = this.bloomB.getContext('2d');

        // Feature-detect canvas filter; if missing, disable bloom to avoid
        // a no-op blur that still costs perf.
        const test = document.createElement('canvas').getContext('2d');
        if (typeof test.filter === 'undefined') {
            this.bloomEnabled = false;
        }

        this._buildScanlines();
        this._buildGrain();
    },

    // Subtle CRT-style scanline pattern. Every other row is slightly darker.
    // Very low opacity so it reads as a hint of CRT softness, not heavy bars.
    _buildScanlines() {
        const c = document.createElement('canvas');
        c.width = 2; c.height = 4;
        const x = c.getContext('2d');
        x.fillStyle = 'rgba(0,0,0,0)';
        x.fillRect(0, 0, 2, 4);
        x.fillStyle = 'rgba(0,0,0,0.06)';
        x.fillRect(0, 3, 2, 1);
        this.scanlinePattern = c;
    },

    // Small noise tile we can animate for filmic grain.
    _buildGrain() {
        const size = 128;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const x = c.getContext('2d');
        const img = x.createImageData(size, size);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = 128 + (Math.random() - 0.5) * 40;
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        this.grainBuffer = c;
    },

    // Start of frame: clear the offscreen target and return its ctx
    // so callers can draw the scene into it.
    beginFrame() {
        const c = this.fboCtx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
        return c;
    },

    // End of frame: composite fbo -> mainCtx with all effects applied.
    endFrame(mainCtx) {
        if (!this.enabled) {
            mainCtx.drawImage(this.fbo, 0, 0);
            return;
        }

        // Base image
        mainCtx.drawImage(this.fbo, 0, 0);

        // BLOOM: downsample brights, blur, add back
        if (this.bloomEnabled) {
            const W = CFG.WIDTH, H = CFG.HEIGHT;

            // Bright pass at half-res: crush midtones so only highlights bloom
            this.bloomACtx.setTransform(1, 0, 0, 1, 0, 0);
            this.bloomACtx.clearRect(0, 0, W / 2, H / 2);
            this.bloomACtx.filter = 'brightness(0.75) contrast(2.2)';
            this.bloomACtx.drawImage(this.fbo, 0, 0, W / 2, H / 2);
            this.bloomACtx.filter = 'none';

            // First blur pass at quarter-res
            this.bloomBCtx.setTransform(1, 0, 0, 1, 0, 0);
            this.bloomBCtx.clearRect(0, 0, W / 4, H / 4);
            this.bloomBCtx.filter = 'blur(3px)';
            this.bloomBCtx.drawImage(this.bloomA, 0, 0, W / 4, H / 4);
            this.bloomBCtx.filter = 'none';

            // Second blur pass for wider halo, back into bloomA
            this.bloomACtx.filter = 'blur(6px)';
            this.bloomACtx.clearRect(0, 0, W / 2, H / 2);
            this.bloomACtx.drawImage(this.bloomB, 0, 0, W / 2, H / 2);
            this.bloomACtx.filter = 'none';

            // Composite additively at full res (subtle halo, not a wash)
            mainCtx.globalCompositeOperation = 'lighter';
            mainCtx.globalAlpha = 0.22;
            mainCtx.drawImage(this.bloomA, 0, 0, W, H);
            mainCtx.globalAlpha = 1;
            mainCtx.globalCompositeOperation = 'source-over';
        }

        // FLASH overlay (fullscreen colored flash that decays)
        if (this.flashAlpha > 0 && this.flashColor) {
            mainCtx.globalCompositeOperation = 'lighter';
            mainCtx.fillStyle = this.flashColor;
            mainCtx.globalAlpha = this.flashAlpha;
            mainCtx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
            mainCtx.globalAlpha = 1;
            mainCtx.globalCompositeOperation = 'source-over';
            this.flashAlpha *= 0.85;
            if (this.flashAlpha < 0.01) this.flashAlpha = 0;
        }

        // VIGNETTE (darken edges, slightly red if damaged)
        if (this.vignetteEnabled) {
            const cx = CFG.WIDTH / 2, cy = CFG.HEIGHT / 2;
            const grad = mainCtx.createRadialGradient(cx, cy, CFG.WIDTH * 0.4, cx, cy, CFG.WIDTH * 0.75);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.42)');
            mainCtx.fillStyle = grad;
            mainCtx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

            if (this.damageVignette > 0) {
                const dg = mainCtx.createRadialGradient(cx, cy, CFG.WIDTH * 0.2, cx, cy, CFG.WIDTH * 0.7);
                dg.addColorStop(0, 'rgba(180,20,20,0)');
                dg.addColorStop(1, `rgba(180,20,20,${0.5 * this.damageVignette})`);
                mainCtx.fillStyle = dg;
                mainCtx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
                this.damageVignette *= 0.94;
                if (this.damageVignette < 0.01) this.damageVignette = 0;
            }
        }

        // SCANLINES (very subtle, multiply)
        if (this.scanlinesEnabled && this.scanlinePattern) {
            const pat = mainCtx.createPattern(this.scanlinePattern, 'repeat');
            if (pat) {
                mainCtx.globalCompositeOperation = 'multiply';
                mainCtx.fillStyle = pat;
                mainCtx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
                mainCtx.globalCompositeOperation = 'source-over';
            }
        }

        // GRAIN (animated film-grain, very subtle)
        if (this.grainEnabled && this.grainBuffer) {
            this.grainFrame = (this.grainFrame + 1) & 0xFF;
            const ox = (this.grainFrame * 37) % 128;
            const oy = (this.grainFrame * 91) % 128;
            mainCtx.globalCompositeOperation = 'overlay';
            mainCtx.globalAlpha = 0.07;
            // Tile the grain across the screen (offset per frame for movement)
            for (let y = -oy; y < CFG.HEIGHT; y += 128) {
                for (let x = -ox; x < CFG.WIDTH; x += 128) {
                    mainCtx.drawImage(this.grainBuffer, x, y);
                }
            }
            mainCtx.globalAlpha = 1;
            mainCtx.globalCompositeOperation = 'source-over';
        }
    },

    // ------- Effect triggers (called from gameplay) -------
    flash(color, alpha) {
        this.flashColor = color;
        this.flashAlpha = Math.max(this.flashAlpha, alpha);
    },

    triggerDamageVignette(intensity) {
        this.damageVignette = Math.max(this.damageVignette, intensity);
    }
};
