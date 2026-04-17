// ============================================================
// GAME.JS - Main Game Loop, State Machine, UI Screens
// ============================================================

const Game = {
    canvas: null,
    ctx: null,
    state: 'loading',  // loading, title, playing, paused, levelComplete, gameOver, victory
    currentLevel: 0,
    totalLevels: 3,
    frameCount: 0,
    lastTime: 0,
    accumulator: 0,
    TIMESTEP: 1000 / 60, // 60 FPS fixed timestep

    // Hit-pause freezes simulation for a few frames on impactful events
    // (enemy destroy, taking damage). Rendering still runs, so the player
    // gets a satisfying micro-freeze that sells the impact.
    hitPauseFrames: 0,
    triggerHitPause(frames) {
        this.hitPauseFrames = Math.max(this.hitPauseFrames, frames);
    },

    // Level complete tally
    tally: {
        active: false,
        rings: 0,
        ringBonus: 0,
        timeBonus: 0,
        enemyBonus: 0,
        total: 0,
        timer: 0,
        phase: 0,
    },

    // Transition effect
    transition: {
        active: false,
        type: 'none', // 'fadeIn', 'fadeOut', 'circle'
        progress: 0,
        speed: 0.02,
        callback: null,
    },

    // ---- INITIALIZATION ----
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        this.canvas.width = CFG.WIDTH;
        this.canvas.height = CFG.HEIGHT;

        // Scale canvas to fit window while maintaining aspect ratio
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initialize systems
        Input.init();
        Sound.init();
        GFX.init();

        // Hide loading indicator
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';

        // Show title screen
        this.state = 'title';
        this.lastTime = performance.now();

        // Start the game loop
        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        const ratio = CFG.WIDTH / CFG.HEIGHT;
        let w = window.innerWidth;
        let h = window.innerHeight;

        if (w / h > ratio) {
            w = h * ratio;
        } else {
            h = w / ratio;
        }

        this.canvas.style.width = Math.floor(w) + 'px';
        this.canvas.style.height = Math.floor(h) + 'px';
    },

    // ---- MAIN LOOP ----
    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.accumulator += Math.min(dt, 100); // Cap to prevent spiral of death

        while (this.accumulator >= this.TIMESTEP) {
            this.update();
            Input.update();
            this.accumulator -= this.TIMESTEP;
        }

        // Render
        this.render();
        this.frameCount++;

        requestAnimationFrame((t) => this.loop(t));
    },

    // ---- UPDATE ----
    update() {
        // Resume audio context on first interaction
        if (Input.enter || Input.jump) {
            Sound.resume();
        }

        // Update transition
        if (this.transition.active) {
            this.transition.progress += this.transition.speed;
            if (this.transition.progress >= 1) {
                this.transition.progress = 1;
                this.transition.active = false;
                if (this.transition.callback) {
                    this.transition.callback();
                    this.transition.callback = null;
                }
            }
            return; // Don't update game during transitions
        }

        switch (this.state) {
            case 'title':
                this.updateTitle();
                break;
            case 'playing':
                this.updatePlaying();
                break;
            case 'paused':
                this.updatePaused();
                break;
            case 'levelComplete':
                this.updateLevelComplete();
                break;
            case 'gameOver':
                this.updateGameOver();
                break;
            case 'victory':
                this.updateVictory();
                break;
        }
    },

    // ---- STATE UPDATES ----

    updateTitle() {
        if (Input.enter || Input.jump) {
            Sound.resume();
            this.startTransition('fadeOut', 0.03, () => {
                this.startGame();
            });
        }
    },

    updatePlaying() {
        // Pause
        if (Input.pressed('Escape') || Input.pressed('KeyP')) {
            this.state = 'paused';
            Sound.stopMusic();
            return;
        }

        // Hit-pause: skip simulation tick while the freeze is active, but
        // still allow camera shake / post-fx decay to tick via render.
        if (this.hitPauseFrames > 0) {
            this.hitPauseFrames--;
            return;
        }

        // Update player
        Player.update();

        // Update world entities
        World.update();

        // Update camera
        if (Player.state !== 'dead') {
            Camera.follow(Player);
        }
    },

    updatePaused() {
        if (Input.pressed('Escape') || Input.pressed('KeyP') || Input.enter) {
            this.state = 'playing';
            Sound.startMusic(World.level.bgMusic);
        }
    },

    updateLevelComplete() {
        const t = this.tally;
        t.timer++;

        // Tally animation phases
        if (t.phase === 0 && t.timer > 90) {
            t.phase = 1; // Start counting ring bonus
        }
        if (t.phase === 1) {
            if (t.ringBonus > 0) {
                const amount = Math.min(10, t.ringBonus);
                t.ringBonus -= amount;
                t.total += amount;
                Player.score += amount;
            } else {
                t.phase = 2;
                t.timer = 0;
            }
        }
        if (t.phase === 2 && t.timer > 30) {
            t.phase = 3; // Count time bonus
        }
        if (t.phase === 3) {
            if (t.timeBonus > 0) {
                const amount = Math.min(10, t.timeBonus);
                t.timeBonus -= amount;
                t.total += amount;
                Player.score += amount;
            } else {
                t.phase = 4;
                t.timer = 0;
            }
        }
        if (t.phase === 4 && t.timer > 60) {
            t.phase = 5; // Ready for next level
        }
        if (t.phase === 5) {
            if (Input.enter || Input.jump) {
                this.nextLevel();
            }
        }
    },

    updateGameOver() {
        if (Input.enter || Input.jump) {
            this.startTransition('fadeOut', 0.03, () => {
                // Reset and return to title
                Player.lives = CFG.START_LIVES;
                Player.score = 0;
                Player.rings = 0;
                this.currentLevel = 0;
                this.state = 'title';
                Sound.stopMusic();
                this.startTransition('fadeIn', 0.04);
            });
        }
    },

    updateVictory() {
        if (Input.enter || Input.jump) {
            this.startTransition('fadeOut', 0.03, () => {
                Player.lives = CFG.START_LIVES;
                Player.score = 0;
                Player.rings = 0;
                this.currentLevel = 0;
                this.state = 'title';
                Sound.stopMusic();
                this.startTransition('fadeIn', 0.04);
            });
        }
    },

    // ---- GAME FLOW ----

    startGame() {
        // Optional dev shortcut: "#2" in the URL jumps straight to level 3.
        // Useful for testing specific zones without replaying earlier acts.
        const hashLevel = parseInt(window.location.hash.replace('#', ''), 10);
        const startAt = (Number.isFinite(hashLevel) && hashLevel >= 0 && hashLevel < this.totalLevels)
            ? hashLevel : 0;
        this.currentLevel = startAt;
        Player.lives = CFG.START_LIVES;
        Player.score = 0;
        Player.rings = 0;
        this.loadLevel(startAt);
        this.state = 'playing';
        this.startTransition('fadeIn', 0.04);
    },

    loadLevel(num) {
        this.currentLevel = num;
        World.buildLevel(num);
        const lvl = World.level;
        Player.init(lvl.playerStart.x, lvl.playerStart.y);
        Camera.follow(Player, true);

        Sound.startMusic(lvl.bgMusic);
    },

    nextLevel() {
        this.currentLevel++;
        if (this.currentLevel >= this.totalLevels) {
            // Victory!
            this.startTransition('fadeOut', 0.02, () => {
                this.state = 'victory';
                Sound.stopMusic();
                this.startTransition('fadeIn', 0.03);
            });
        } else {
            this.startTransition('fadeOut', 0.03, () => {
                const savedScore = Player.score;
                const savedLives = Player.lives;
                this.loadLevel(this.currentLevel);
                Player.score = savedScore;
                Player.lives = savedLives;
                Player.rings = 0;
                this.state = 'playing';
                this.startTransition('fadeIn', 0.04);
            });
        }
    },

    // Called by Player when reaching goal
    onLevelComplete() {
        this.state = 'levelComplete';
        Sound.stopMusic();
        Player.controlLock = 9999;

        // Calculate bonuses
        const timeSeconds = Math.floor(Player.time / 60);
        let timeBonus = 0;
        if (timeSeconds < 30) timeBonus = 5000;
        else if (timeSeconds < 60) timeBonus = 4000;
        else if (timeSeconds < 90) timeBonus = 3000;
        else if (timeSeconds < 120) timeBonus = 2000;
        else if (timeSeconds < 180) timeBonus = 1000;
        else if (timeSeconds < 300) timeBonus = 500;

        this.tally = {
            active: true,
            rings: Player.rings,
            ringBonus: Player.rings * CFG.RING_VALUE,
            timeBonusOriginal: timeBonus,
            timeBonus: timeBonus,
            total: 0,
            timer: 0,
            phase: 0,
        };
    },

    // Called by Player on death
    onPlayerDeath() {
        Player.lives--;
        if (Player.lives <= 0) {
            this.state = 'gameOver';
            Sound.gameOver();
        } else {
            this.startTransition('fadeOut', 0.03, () => {
                Player.respawn();
                Player.rings = 0;
                this.state = 'playing';
                Camera.follow(Player, true);
                Sound.startMusic(World.level.bgMusic);
                this.startTransition('fadeIn', 0.04);
            });
        }
    },

    // ---- TRANSITIONS ----
    startTransition(type, speed, callback) {
        this.transition = {
            active: true,
            type: type,
            progress: 0,
            speed: speed || 0.03,
            callback: callback || null,
        };
    },

    // ---- RENDER ----
    // Pipeline: draw the scene into PostFX.fbo, composite back to the main
    // canvas with post-effects, then overlay UI (HUD / pause / transitions)
    // on the main canvas so text stays crisp.
    render() {
        const mainCtx = this.ctx;
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.clearRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

        const ctx = PostFX.beginFrame();

        switch (this.state) {
            case 'loading':
                this.drawLoading(ctx);
                break;
            case 'title':
                this.drawTitle(ctx);
                break;
            case 'playing':
            case 'paused':
            case 'levelComplete':
                this.drawGameplay(ctx);
                break;
            case 'gameOver':
                this.drawGameOver(ctx);
                break;
            case 'victory':
                this.drawVictory(ctx);
                break;
        }

        PostFX.endFrame(mainCtx);

        // UI overlays (crisp, outside the post-fx path)
        if (this.state === 'playing' || this.state === 'paused' || this.state === 'levelComplete') {
            this.drawHUD(mainCtx);
        }
        if (this.state === 'paused') this.drawPauseOverlay(mainCtx);
        if (this.state === 'levelComplete') this.drawLevelComplete(mainCtx);

        this.drawTransition(mainCtx);
    },

    // ---- SCREEN RENDERERS ----

    drawLoading(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
        ctx.fillStyle = '#4488FF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', CFG.WIDTH / 2, CFG.HEIGHT / 2);
    },

    drawTitle(ctx) {
        // Background
        const t = this.frameCount * 0.01;
        const grad = ctx.createLinearGradient(0, 0, 0, CFG.HEIGHT);
        grad.addColorStop(0, '#1122AA');
        grad.addColorStop(0.5, '#2244CC');
        grad.addColorStop(1, '#4488FF');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

        // Animated checkerboard ground
        ctx.fillStyle = '#44BB44';
        ctx.fillRect(0, CFG.HEIGHT - 100, CFG.WIDTH, 100);
        ctx.fillStyle = '#55CC55';
        for (let x = -1; x < CFG.WIDTH / 24 + 2; x++) {
            for (let y = 0; y < 5; y++) {
                if ((x + y) % 2 === 0) {
                    ctx.fillRect(x * 24 - (this.frameCount % 48), CFG.HEIGHT - 100 + y * 20, 24, 20);
                }
            }
        }

        // Decorative hills
        ctx.fillStyle = '#338844';
        ctx.beginPath();
        ctx.moveTo(0, CFG.HEIGHT - 100);
        for (let x = 0; x <= CFG.WIDTH; x += 4) {
            const hy = CFG.HEIGHT - 100 - Math.sin((x + this.frameCount * 0.3) * 0.02) * 30
                      - Math.sin(x * 0.01) * 20;
            ctx.lineTo(x, hy);
        }
        ctx.lineTo(CFG.WIDTH, CFG.HEIGHT);
        ctx.lineTo(0, CFG.HEIGHT);
        ctx.fill();

        // Clouds
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 5; i++) {
            const cx = ((i * 200 + this.frameCount * 0.3) % (CFG.WIDTH + 200)) - 100;
            const cy = 60 + i * 30;
            ctx.beginPath();
            ctx.arc(cx, cy, 20, 0, Math.PI * 2);
            ctx.arc(cx + 15, cy - 5, 15, 0, Math.PI * 2);
            ctx.arc(cx + 30, cy, 18, 0, Math.PI * 2);
            ctx.fill();
        }

        // Sonic sprite on title
        const sonicBob = Math.sin(this.frameCount * 0.05) * 3;
        const runFrame = GFX.sprites.sonicRun[Math.floor(this.frameCount * 0.15) % GFX.sprites.sonicRun.length];
        if (runFrame) {
            ctx.drawImage(runFrame, CFG.WIDTH / 2 - 120, CFG.HEIGHT / 2 - 40 + sonicBob, 72, 80);
        }

        // Title text with shadow
        ctx.textAlign = 'center';

        // "SONIC"
        ctx.font = 'bold 64px sans-serif';
        ctx.fillStyle = '#0022AA';
        ctx.fillText('SONIC', CFG.WIDTH / 2 + 3, 143);
        ctx.fillStyle = '#4488FF';
        ctx.fillText('SONIC', CFG.WIDTH / 2, 140);

        // "EMERALD RUSH"
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#006600';
        ctx.fillText('EMERALD RUSH', CFG.WIDTH / 2 + 2, 182);
        ctx.fillStyle = '#44DD44';
        ctx.fillText('EMERALD RUSH', CFG.WIDTH / 2, 180);

        // Ring decorations around title
        const ringSprite = GFX.sprites.ring[Math.floor(this.frameCount * 0.1) % 8];
        if (ringSprite) {
            ctx.drawImage(ringSprite, CFG.WIDTH / 2 - 200, 120, 24, 24);
            ctx.drawImage(ringSprite, CFG.WIDTH / 2 + 176, 120, 24, 24);
        }

        // Prompt (blinking)
        if (Math.floor(this.frameCount * 0.03) % 2 === 0) {
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('PRESS ENTER or SPACE TO START', CFG.WIDTH / 2, CFG.HEIGHT / 2 + 80);
        }

        // Controls info
        ctx.font = '16px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Arrow Keys / WASD = Move    |    Space / Z = Jump    |    Down + Space = Spin Dash', CFG.WIDTH / 2, CFG.HEIGHT - 30);
    },

    drawGameplay(ctx) {
        if (!World.level) return;

        // Background (parallax)
        GFX.drawBg(ctx, World.level.theme, Camera.x, Camera.y);

        // Decorations (behind tiles)
        World.drawDecorations(ctx);

        // Tiles
        World.drawTiles(ctx);

        // Rings (behind player)
        World.drawRings(ctx);

        // Entities (enemies, items)
        World.drawEntities(ctx);

        // Player
        Player.draw(ctx);

        // Particles (on top)
        World.drawParticles(ctx);

        // HUD is rendered by Game.render() on the main canvas for crispness.
    },

    drawHUD(ctx) {
        const pad = 16;
        ctx.textAlign = 'left';

        // Semi-transparent HUD background
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, CFG.WIDTH, 44);

        // Score
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('SCORE', pad, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(Player.score.toString().padStart(7, '0'), pad, 36);

        // Time
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('TIME', CFG.WIDTH / 2, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(Utils.formatTime(Player.time), CFG.WIDTH / 2, 36);

        // Rings (blink when 0)
        ctx.textAlign = 'right';
        if (Player.rings === 0 && Math.floor(this.frameCount * 0.05) % 2 === 0) {
            ctx.fillStyle = '#FF4444';
        } else {
            ctx.fillStyle = '#FFD700';
        }
        ctx.fillText('RINGS', CFG.WIDTH - pad, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(Player.rings.toString(), CFG.WIDTH - pad, 36);

        // Lives (bottom left)
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, CFG.HEIGHT - 32, 120, 32);
        // Mini Sonic face
        ctx.fillStyle = '#2855DD';
        ctx.beginPath();
        ctx.arc(pad + 10, CFG.HEIGHT - 16, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFCC88';
        ctx.beginPath();
        ctx.arc(pad + 14, CFG.HEIGHT - 17, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pad + 13, CFG.HEIGHT - 19, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(pad + 14, CFG.HEIGHT - 18, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('x ' + Player.lives, pad + 26, CFG.HEIGHT - 10);

        // Level name
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(CFG.WIDTH - 180, CFG.HEIGHT - 32, 180, 32);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#FFD700';
        const levelNames = ['EMERALD VALLEY', 'NEON FACTORY', 'SKY SANCTUARY'];
        ctx.fillText(levelNames[this.currentLevel] + ' - ACT ' + (this.currentLevel + 1), CFG.WIDTH - pad, CFG.HEIGHT - 12);
    },

    drawPauseOverlay(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

        ctx.textAlign = 'center';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillStyle = '#4488FF';
        ctx.fillText('PAUSED', CFG.WIDTH / 2, CFG.HEIGHT / 2 - 20);

        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Press ESC or P to resume', CFG.WIDTH / 2, CFG.HEIGHT / 2 + 20);
    },

    drawLevelComplete(ctx) {
        const t = this.tally;

        // Overlay
        ctx.fillStyle = 'rgba(0,0,20,0.7)';
        ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

        const cx = CFG.WIDTH / 2;
        const startY = 100;

        // Title
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#FFD700';
        const levelNames = ['EMERALD VALLEY', 'NEON FACTORY', 'SKY SANCTUARY'];
        ctx.fillText(levelNames[this.currentLevel], cx, startY);

        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('ACT ' + (this.currentLevel + 1) + ' COMPLETE!', cx, startY + 36);

        // Tally
        if (t.timer > 60) {
            ctx.textAlign = 'right';
            ctx.font = 'bold 20px sans-serif';
            const tallyX = cx + 120;
            let ty = startY + 90;

            // Ring bonus
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'left';
            ctx.fillText('RING BONUS', cx - 120, ty);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText((t.rings * CFG.RING_VALUE - t.ringBonus).toString(), tallyX, ty);

            ty += 35;

            // Time bonus
            if (t.phase >= 2) {
                ctx.fillStyle = '#FFD700';
                ctx.textAlign = 'left';
                ctx.fillText('TIME BONUS', cx - 120, ty);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#FFFFFF';
                // Show time bonus counting up from 0 to original
                const tbShown = t.phase >= 3 ?
                    (t.timeBonusOriginal || 0) - t.timeBonus : 0;
                ctx.fillText(tbShown.toString(), tallyX, ty);
            }

            ty += 35;

            // Total
            if (t.phase >= 4) {
                ctx.fillStyle = '#FFD700';
                ctx.textAlign = 'left';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText('TOTAL', cx - 120, ty + 10);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(t.total.toString(), tallyX, ty + 10);
            }

            // Continue prompt
            if (t.phase >= 5 && Math.floor(this.frameCount * 0.03) % 2 === 0) {
                ctx.textAlign = 'center';
                ctx.font = 'bold 20px sans-serif';
                ctx.fillStyle = '#88CCFF';
                ctx.fillText('PRESS ENTER TO CONTINUE', cx, ty + 70);
            }
        }
    },

    drawGameOver(ctx) {
        // Dark background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

        ctx.textAlign = 'center';

        // GAME OVER text
        ctx.font = 'bold 56px sans-serif';
        ctx.fillStyle = '#DD2222';
        ctx.fillText('GAME OVER', CFG.WIDTH / 2 + 3, CFG.HEIGHT / 2 - 27);
        ctx.fillStyle = '#FF4444';
        ctx.fillText('GAME OVER', CFG.WIDTH / 2, CFG.HEIGHT / 2 - 30);

        // Score
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('FINAL SCORE: ' + Player.score.toString().padStart(7, '0'), CFG.WIDTH / 2, CFG.HEIGHT / 2 + 20);

        // Prompt
        if (Math.floor(this.frameCount * 0.03) % 2 === 0) {
            ctx.font = '20px sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('PRESS ENTER TO CONTINUE', CFG.WIDTH / 2, CFG.HEIGHT / 2 + 65);
        }
    },

    drawVictory(ctx) {
        // Gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, CFG.HEIGHT);
        grad.addColorStop(0, '#1122AA');
        grad.addColorStop(1, '#4488FF');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);

        // Stars
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 97 + this.frameCount * 0.2) % CFG.WIDTH;
            const sy = (i * 53 + Math.sin(i + this.frameCount * 0.01) * 20) % CFG.HEIGHT;
            ctx.globalAlpha = 0.3 + Math.sin(i + this.frameCount * 0.05) * 0.3;
            ctx.fillRect(sx, sy, 2, 2);
        }
        ctx.globalAlpha = 1;

        ctx.textAlign = 'center';

        // Sonic sprite (celebratory pose)
        const sonicSprite = GFX.sprites.sonicIdle;
        if (sonicSprite) {
            const bob = Math.sin(this.frameCount * 0.05) * 5;
            ctx.drawImage(sonicSprite, CFG.WIDTH / 2 - 36, 140 + bob, 72, 80);
        }

        // Victory text
        ctx.font = 'bold 48px sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('CONGRATULATIONS!', CFG.WIDTH / 2, 100);

        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('You cleared all zones!', CFG.WIDTH / 2, 260);

        // Final score
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('FINAL SCORE: ' + Player.score.toString().padStart(7, '0'), CFG.WIDTH / 2, 310);

        // Rings
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#88CCFF';
        ctx.fillText('Thank you for playing!', CFG.WIDTH / 2, 360);

        // Prompt
        if (Math.floor(this.frameCount * 0.03) % 2 === 0) {
            ctx.font = '20px sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('PRESS ENTER TO PLAY AGAIN', CFG.WIDTH / 2, 430);
        }
    },

    drawTransition(ctx) {
        if (!this.transition.active && this.transition.progress <= 0) return;

        let alpha = 0;
        if (this.transition.type === 'fadeOut') {
            alpha = this.transition.progress;
        } else if (this.transition.type === 'fadeIn') {
            alpha = 1 - this.transition.progress;
        }

        if (alpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${alpha})`;
            ctx.fillRect(0, 0, CFG.WIDTH, CFG.HEIGHT);
        }
    },

};

// ---- STARTUP ----
window.addEventListener('load', () => {
    Game.init();
});
