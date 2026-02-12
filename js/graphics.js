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
        const W = 36, H = 40;

        // Helper to draw Sonic's body at given params
        const drawBody = (ctx, opts) => {
            const { lean = 0, crouch = 0, legPhase = 0, armPhase = 0 } = opts;
            ctx.save();
            ctx.translate(W / 2, H / 2 + 2);
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

            // Legs
            const legSpread = Math.sin(legPhase) * 8;
            // Back leg
            ctx.fillStyle = '#FFCC88';
            ctx.fillRect(-3, 10 + bodyY, 4, 4 + Math.max(0, -legSpread));
            // Back shoe
            ctx.fillStyle = '#DD2222';
            ctx.beginPath();
            ctx.ellipse(-1, 16 + bodyY - Math.min(0, legSpread), 5, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-5, 15 + bodyY - Math.min(0, legSpread), 6, 1.5);

            // Front leg
            ctx.fillStyle = '#FFCC88';
            ctx.fillRect(2, 10 + bodyY, 4, 4 + Math.max(0, legSpread));
            // Front shoe
            ctx.fillStyle = '#DD2222';
            ctx.beginPath();
            ctx.ellipse(4, 16 + bodyY + Math.max(0, legSpread), 5, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 15 + bodyY + Math.max(0, legSpread), 6, 1.5);

            // Arm
            ctx.fillStyle = '#FFCC88';
            ctx.save();
            ctx.translate(7, 2 + bodyY);
            ctx.rotate(armPhase);
            ctx.fillRect(0, -2, 4, 8);
            // Glove
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(2, 8, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.restore();
        };

        // Idle frame
        S.sonicIdle = this._s(W, H, (ctx) => drawBody(ctx, { legPhase: 0, armPhase: 0 }));

        // Run frames (6 frames)
        S.sonicRun = [];
        for (let i = 0; i < 6; i++) {
            const phase = (i / 6) * Math.PI * 2;
            S.sonicRun.push(this._s(W, H, (ctx) => drawBody(ctx, {
                lean: 0.15,
                legPhase: phase,
                armPhase: Math.sin(phase + Math.PI) * 0.5,
            })));
        }

        // Fast run (legs become circles/blur)
        S.sonicFastRun = [];
        for (let i = 0; i < 4; i++) {
            S.sonicFastRun.push(this._s(W, H, (ctx) => {
                ctx.save();
                ctx.translate(W / 2, H / 2 + 2);
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
            // Add dust lines
            ctx.fillStyle = 'rgba(200,180,150,0.5)';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(W / 2 + 5 + i * 6, H / 2 + 12, 4, 2);
            }
        });

        // Hurt frame
        S.sonicHurt = this._s(W, H, (ctx) => {
            ctx.translate(W / 2, H / 2);
            ctx.rotate(-0.3);
            ctx.translate(-W / 2, -H / 2);
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

        // Dust puff
        S.dust = this._s(12, 12, (ctx) => {
            ctx.fillStyle = 'rgba(200,180,150,0.5)';
            ctx.beginPath();
            ctx.arc(6, 6, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Sparkle
        S.sparkle = this._s(10, 10, (ctx) => {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(4, 0, 2, 10);
            ctx.fillRect(0, 4, 10, 2);
            ctx.fillStyle = '#FFFF88';
            ctx.fillRect(3, 3, 4, 4);
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

        if (theme === 1) {
            // Emerald Valley - Green Hill style
            // Sky gradient
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#2277FF');
            grad.addColorStop(0.5, '#55AAFF');
            grad.addColorStop(1, '#88CCFF');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Clouds (parallax)
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            for (let i = 0; i < 6; i++) {
                const cx = ((i * 200 + 50) - camX * 0.05) % (w + 200) - 100;
                const cy = 30 + i * 20 + Math.sin(i * 2) * 15;
                ctx.beginPath();
                ctx.arc(cx, cy, 25, 0, Math.PI * 2);
                ctx.arc(cx + 20, cy - 5, 20, 0, Math.PI * 2);
                ctx.arc(cx + 40, cy, 22, 0, Math.PI * 2);
                ctx.arc(cx + 15, cy + 5, 18, 0, Math.PI * 2);
                ctx.fill();
            }

            // Far hills
            ctx.fillStyle = '#338844';
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

            // Water at bottom
            ctx.fillStyle = 'rgba(30,100,200,0.3)';
            ctx.fillRect(0, h - 30, w, 30);

        } else {
            // Neon Factory
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#0A0A2E');
            grad.addColorStop(0.5, '#1A1A4E');
            grad.addColorStop(1, '#2A1A5E');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Stars
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 30; i++) {
                const sx = (i * 137.5 + Math.sin(i) * 50) % w;
                const sy = (i * 73.7 + Math.cos(i) * 30) % (h * 0.5);
                const size = 1 + (i % 3);
                ctx.globalAlpha = 0.4 + (i % 5) * 0.12;
                ctx.fillRect(sx, sy, size, size);
            }
            ctx.globalAlpha = 1;

            // Industrial background buildings
            ctx.fillStyle = '#151540';
            for (let i = 0; i < 8; i++) {
                const bx = ((i * 150) - camX * 0.08) % (w + 300) - 150;
                const bh = 100 + (i * 47) % 120;
                ctx.fillRect(bx, h - bh, 80, bh);
                // Windows
                ctx.fillStyle = '#3344AA';
                for (let wy = h - bh + 10; wy < h - 20; wy += 18) {
                    for (let wx = bx + 8; wx < bx + 72; wx += 16) {
                        ctx.fillRect(wx, wy, 8, 8);
                    }
                }
                ctx.fillStyle = '#151540';
            }

            // Neon pipes
            ctx.strokeStyle = '#6644CC';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.4;
            for (let i = 0; i < 4; i++) {
                const py = 200 + i * 60 - (camY * 0.1);
                ctx.beginPath();
                ctx.moveTo(0, py);
                for (let x = 0; x <= w; x += 60) {
                    ctx.lineTo(x + 30, py + Math.sin((x + camX * 0.15) * 0.02) * 20);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
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
        // Light
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.arc(x + 10, y - 35, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,60,60,0.3)';
        ctx.beginPath();
        ctx.arc(x + 10, y - 35, 8, 0, Math.PI * 2);
        ctx.fill();
    }
};
