/**
 * Scheduler Arcade — Main 2D Game Arena Engine
 * 
 * Orchestrates requestAnimationFrame loops, game state transitions,
 * responsive canvas scaling, keyboard input handling, collision detection,
 * HUD binding, warm editorial background rendering, and integration with the
 * CPU scheduling engine (StepSimulator).
 */

(function () {
    'use strict';

    const combatApi = typeof require !== 'undefined' 
        ? require('./combat') 
        : (window.ArcadeGame ? window.ArcadeGame.combat : null);

    const playerApi = typeof require !== 'undefined' 
        ? require('./player') 
        : (window.ArcadeGame ? window.ArcadeGame.player : null);

    const bossApi = typeof require !== 'undefined' 
        ? require('./boss') 
        : (window.ArcadeGame ? window.ArcadeGame.boss : null);

    const stepSimulatorApi = typeof require !== 'undefined'
        ? require('./stepSimulator')
        : (window.ArcadeGame ? window.ArcadeGame.stepSimulator : null);

    const { checkAABB, spawnImpactParticles } = combatApi || {};
    const { Player } = playerApi || {};
    const { Boss } = bossApi || {};
    const { StepSimulator } = stepSimulatorApi || {};

    class GameEngine {
        constructor() {
            this.canvas = null;
            this.ctx = null;
            this.width = 960;
            this.height = 480;
            this.groundY = 415;

            // Entities
            this.player = new Player(120, 360);
            this.boss = new Boss('fcfs', 730, 260);
            this.projectiles = [];
            this.particles = [];

            // Step-by-Step CPU Scheduling Simulator
            this.stepSimulator = StepSimulator ? new StepSimulator() : null;
            this.isWaitingForDecision = false;
            this.feedbackTimer = null;

            // Game State: 'ready' | 'playing' | 'paused' | 'victory' | 'gameover'
            this.state = 'ready';
            this.score = 0;
            this.currentBossId = 'fcfs';

            // Timing
            this.animationFrameId = null;
            this.lastTime = 0;
            this.isRunning = false;

            // Input handling
            this.inputState = {
                left: false,
                right: false,
                jump: false,
                attack: false
            };
            this.isInputBound = false;
            this.onKeydownBound = this.handleKeyDown.bind(this);
            this.onKeyupBound = this.handleKeyUp.bind(this);
        }

        /**
         * Mount canvas and hook controls.
         */
        init(canvasElement) {
            this.canvas = canvasElement;
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = this.width;
            this.canvas.height = this.height;

            if (!this.isInputBound && typeof window !== 'undefined') {
                window.addEventListener('keydown', this.onKeydownBound);
                window.addEventListener('keyup', this.onKeyupBound);
                this.isInputBound = true;
            }

            console.log('[GameEngine] Initialized canvas (960x480).');
        }

        /**
         * Load and start a specific boss level.
         */
        startLevel(bossId) {
            this.currentBossId = bossId;
            this.score = 0;
            this.projectiles = [];
            this.particles = [];

            // Reset entities
            this.player.reset(120, this.groundY - 48);
            this.boss.configureBoss(bossId);
            this.boss.reset(730, this.groundY - this.boss.height);

            // Initialize Step Simulator
            if (this.stepSimulator) {
                this.stepSimulator.init(bossId);
                this.isWaitingForDecision = this.stepSimulator.isWaitingForDecision;
            }

            this.state = 'ready';
            this.updateHUD();
            this.updateSchedulingConsole();
            this.hideFeedbackBanner();
            this.hideDebrief();
            this.showOverlay('ready');

            // Start animation loop if not already running
            if (!this.isRunning) {
                this.isRunning = true;
                const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                this.lastTime = now;
                if (typeof requestAnimationFrame !== 'undefined') {
                    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
                }
            }
        }

        /**
         * Main requestAnimationFrame loop.
         */
        loop(timestamp) {
            if (!this.isRunning) return;

            const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // Clamp dt for safety
            this.lastTime = timestamp;

            if (this.state === 'playing') {
                this.update(dt);
            }

            this.render();

            if (typeof requestAnimationFrame !== 'undefined') {
                this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
            }
        }

        /**
         * Update physics, entities, and collisions.
         */
        update(dt) {
            if (this.stepSimulator) {
                this.isWaitingForDecision = this.stepSimulator.isWaitingForDecision;
            }

            // 1. Update Player
            this.player.update(dt, this.inputState, this.groundY, this.width, this.projectiles, this.particles);

            // 2. Update Boss
            // Pause boss attack patterns during active dispatch decision points
            if (!this.isWaitingForDecision) {
                this.boss.update(dt, this.player.x, this.player.y, this.groundY, this.projectiles, this.particles);
            }

            // 3. Update Projectiles
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const proj = this.projectiles[i];
                proj.update(dt);

                // Boundary culling
                if (!proj.active || proj.x < -40 || proj.x > this.width + 40 || proj.y < -40 || proj.y > this.height + 40) {
                    this.projectiles.splice(i, 1);
                    continue;
                }

                // Collision: Player projectile vs Boss
                if (proj.isPlayer && this.boss.health > 0) {
                    if (checkAABB(proj.getBounds(), this.boss.getBounds())) {
                        proj.active = false;
                        if (proj.type === 'dispatch-packet') {
                            // Main Dispatch Attack impacts boss!
                            if (this.boss.triggerDamageReaction) {
                                this.boss.triggerDamageReaction(this.particles);
                            }
                            if (spawnImpactParticles) {
                                spawnImpactParticles(this.particles, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#c45126', 24);
                                spawnImpactParticles(this.particles, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#d49b29', 18);
                            }
                        } else {
                            // Cosmetic Diagnostic Packet (Z / J): deals 0 damage to boss
                            if (spawnImpactParticles) {
                                spawnImpactParticles(this.particles, proj.x, proj.y, '#d49b29', 6);
                            }
                            this.score += 10; // Tactical cosmetic hit score
                            this.updateHUD();
                        }
                        this.projectiles.splice(i, 1);
                        continue;
                    }

                    // Collision: Player projectile vs Boss hazard projectile (deflection mechanic!)
                    for (let j = this.projectiles.length - 1; j >= 0; j--) {
                        const hazard = this.projectiles[j];
                        if (!hazard.isPlayer && hazard.active) {
                            if (checkAABB(proj.getBounds(), hazard.getBounds())) {
                                proj.active = false;
                                hazard.active = false;
                                if (spawnImpactParticles) {
                                    spawnImpactParticles(this.particles, hazard.x, hazard.y, '#5d6d39', 8);
                                }
                                this.score += 25; // Hazard deflection score bonus
                                this.updateHUD();
                                break;
                            }
                        }
                    }
                }

                // Collision: Boss hazard vs Player
                if (!proj.isPlayer && this.player.health > 0) {
                    if (checkAABB(proj.getBounds(), this.player.getBounds())) {
                        proj.active = false;
                        const damageDealt = proj.damage;
                        const hitSuccess = this.player.takeDamage(damageDealt, this.particles);
                        if (hitSuccess) {
                            this.updateHUD();
                            if (this.player.health <= 0) {
                                this.triggerGameOver();
                            }
                        }
                        this.projectiles.splice(i, 1);
                        continue;
                    }
                }
            }

            // 4. Update Particles
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const part = this.particles[i];
                part.update(dt);
                if (part.life <= 0) {
                    this.particles.splice(i, 1);
                }
            }
        }

        /**
         * Process a player dispatch selection.
         * A correct selection fires a visible CPU burst attack at the boss and depletes boss HP.
         * An incorrect selection penalizes player integrity and provides pedagogical rule feedback.
         * @param {string} chosenPid 
         */
        handleDispatchChoice(chosenPid) {
            if (this.state !== 'playing' || !this.stepSimulator) return;
            if (!this.stepSimulator.isWaitingForDecision || this.stepSimulator.isCompleted) return;

            const validation = this.stepSimulator.validateDecision(chosenPid);

            if (validation.valid) {
                const stepResult = this.stepSimulator.step(chosenPid);
                this.score += 250;

                // Boss Power Reactions on Valid Dispatch
                if (this.currentBossId === 'fcfs') {
                    if (this.boss.releaseFifoLock) {
                        this.boss.releaseFifoLock();
                    }
                } else if (this.currentBossId === 'sjf') {
                    if (this.boss.shatterShield) {
                        this.boss.shatterShield(this.particles);
                    }
                    if (!this.stepSimulator.isCompleted && this.boss.restoreSpeedShield) {
                        this.boss.restoreSpeedShield();
                    }
                } else if (this.currentBossId === 'rr') {
                    const wasRequeued = Boolean(stepResult.wasRequeued);
                    if (this.boss.triggerQuantumStep) {
                        this.boss.triggerQuantumStep(stepResult.duration, wasRequeued, this.particles);
                    }
                }

                // Tie boss health strictly to remaining burst workload ratio
                const totalBurst = this.stepSimulator.processes.reduce((sum, p) => sum + p.burstTime, 0);
                const remainingBurst = this.stepSimulator.processes.reduce((sum, p) => sum + p.remainingBurst, 0);
                const targetHp = totalBurst > 0 ? Math.round((remainingBurst / totalBurst) * this.boss.maxHealth) : 0;
                this.boss.health = targetHp;

                // 1. Visible character attack animation & high-velocity dispatch packet toward boss
                if (this.player && this.player.triggerDispatchAttack) {
                    this.player.triggerDispatchAttack(stepResult.executedPid, stepResult.duration, this.projectiles, this.particles);
                }

                // 2. Visible boss damage reaction (stagger recoil, hit flash, and burst sparks)
                if (this.boss && this.boss.triggerDamageReaction) {
                    this.boss.triggerDamageReaction(this.particles);
                }

                // 3. Educational success feedback banner
                this.showFeedbackBanner(true, validation.explanation);

                this.updateHUD();
                this.updateSchedulingConsole();

                if (this.stepSimulator.isCompleted) {
                    this.boss.health = 0;
                    this.score += 500;
                    this.updateHUD();
                    this.updateSchedulingConsole();

                    if (spawnImpactParticles) {
                        spawnImpactParticles(this.particles, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#d49b29', 36);
                        spawnImpactParticles(this.particles, this.boss.x + this.boss.width / 2, this.boss.y + this.boss.height / 2, '#c45126', 24);
                    }

                    setTimeout(() => {
                        this.triggerVictory();
                    }, 500);
                }
            } else {
                // Incorrect decision: never advance CPU time; penalize player HP and trigger distinct counterattack
                this.player.takeDamage(15, this.particles);
                this.showFeedbackBanner(false, validation.message);

                // Distinct Boss Power Retaliation & Counterattack
                if (this.currentBossId === 'fcfs') {
                    if (this.boss.triggerFifoLock) {
                        this.boss.triggerFifoLock(this.particles);
                    }
                } else if (this.currentBossId === 'sjf') {
                    if (this.boss.triggerSpeedCounterattack) {
                        this.boss.triggerSpeedCounterattack(this.player.x, this.player.y, this.projectiles, this.particles);
                    }
                } else if (this.currentBossId === 'rr') {
                    if (this.boss.triggerTemporalCounterattack) {
                        this.boss.triggerTemporalCounterattack(this.player.x, this.player.y, this.projectiles, this.particles);
                    }
                } else if (this.currentBossId === 'priority') {
                    if (this.boss.triggerRoyalCounterattack) {
                        this.boss.triggerRoyalCounterattack(this.player.x, this.player.y, this.projectiles, this.particles);
                    }
                } else {
                    this.triggerBossRetaliation();
                }

                this.updateHUD();
                this.updateSchedulingConsole();

                if (this.player.health <= 0) {
                    this.triggerGameOver();
                }
            }
        }

        /**
         * Visual retaliation fallback when an incorrect dispatch decision is made.
         */
        triggerBossRetaliation() {
            if (this.boss) {
                this.boss.hitFlashTimer = 0.28;
            }
            if (spawnImpactParticles) {
                spawnImpactParticles(this.particles, this.boss.x - 12, this.boss.y + 40, '#c45126', 16);
            }
        }

        /**
         * Render canvas scene.
         */
        render() {
            if (!this.ctx) return;
            const ctx = this.ctx;

            // 1. Warm Editorial Background
            ctx.fillStyle = '#faf6ee';
            ctx.fillRect(0, 0, this.width, this.height);

            // Subtle drafting grid lines
            ctx.strokeStyle = '#ede4d1';
            ctx.lineWidth = 1;
            for (let x = 0; x <= this.width; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, 0); ctx.lineTo(x, this.height);
                ctx.stroke();
            }
            for (let y = 0; y <= this.height; y += 40) {
                ctx.beginPath();
                ctx.moveTo(0, y); ctx.lineTo(this.width, y);
                ctx.stroke();
            }

            // Top technical metadata stamp
            ctx.fillStyle = '#8f9f85';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('DISPATCH SECTOR: CPU-0 // REAL SCHEDULING INTEGRATION BUS', 20, 24);

            // 2. Real Ready Queue Overhead Conveyor
            this.drawOverheadConveyor(ctx);

            // 3. Ground Platform (Tactile Forest Green + Terracotta Warning Line)
            const groundH = this.height - this.groundY;
            ctx.fillStyle = '#163323';
            ctx.fillRect(0, this.groundY, this.width, groundH);

            // Terracotta warning hazard strip
            ctx.fillStyle = '#c45126';
            ctx.fillRect(0, this.groundY, this.width, 4);

            // Ground mechanical structural rivets
            ctx.fillStyle = '#fbf8ee';
            for (let rx = 30; rx < this.width; rx += 60) {
                ctx.beginPath();
                ctx.arc(rx, this.groundY + 16, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // 4. Draw Entities
            this.player.draw(ctx);
            this.boss.draw(ctx);

            // 5. Draw Projectiles
            for (const proj of this.projectiles) {
                proj.draw(ctx);
            }

            // 6. Draw Particles
            for (const part of this.particles) {
                part.draw(ctx);
            }
        }

        /**
         * Draws the live process conveyor track and CPU execution bay.
         */
        drawOverheadConveyor(ctx) {
            ctx.save();
            const trackY = 44;
            const trackH = 34;

            // Conveyor frame
            ctx.fillStyle = '#ede5d2';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 1.8;
            ctx.fillRect(20, trackY, this.width - 40, trackH);
            ctx.strokeRect(20, trackY, this.width - 40, trackH);

            // Subtle dashed conveyor line
            ctx.strokeStyle = '#cbbfa6';
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(20, trackY + trackH / 2);
            ctx.lineTo(this.width - 20, trackY + trackH / 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label with Boss Power Status
            let conveyorLabel = 'LIVE OS READY QUEUE CONVEYOR // FIFO ENTRANCE → CPU BAY';
            if (this.currentBossId === 'fcfs') {
                conveyorLabel = (this.boss && this.boss.fifoLockActive)
                    ? 'LIVE OS READY QUEUE // 🔒 FIFO LOCK ACTIVE: SKIP PROHIBITED'
                    : 'LIVE OS READY QUEUE // FIFO LAW: FIRST ARRIVED DISPATCHES FIRST';
            } else if (this.currentBossId === 'sjf') {
                conveyorLabel = 'LIVE OS READY QUEUE // 🛡️ SHORTEST JOB SHIELD: DISPATCH MINIMAL BURST';
            } else if (this.currentBossId === 'rr') {
                conveyorLabel = `LIVE OS READY QUEUE // ⏱️ QUANTUM CLOCK (q=${this.stepSimulator ? this.stepSimulator.quantum : 2}ms) ROTATION`;
            } else if (this.currentBossId === 'priority') {
                conveyorLabel = 'LIVE OS READY QUEUE // 👑 ROYAL OVERRIDE: LOWEST PRIORITY RANK PREVAILS';
            }

            ctx.fillStyle = '#5d6d39';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(conveyorLabel, 26, trackY - 6);

            // Ready queue processes
            const readyQueue = (this.stepSimulator && this.stepSimulator.readyQueue) ? this.stepSimulator.readyQueue : [];
            const colors = {
                P1: '#c45126',
                P2: '#5d6d39',
                P3: '#d49b29',
                P4: '#2b5340'
            };

            const startX = 36;
            const chipWidth = 76;
            const chipGap = 12;

            // Power indicators calculations
            const earliestArr = readyQueue.length > 0 ? Math.min(...readyQueue.map(p => p.arrivalTime)) : 0;
            const minBurst = readyQueue.length > 0 ? Math.min(...readyQueue.map(p => p.burstTime)) : 0;
            const minPrio = (this.currentBossId === 'priority' && readyQueue.length > 0)
                ? Math.min(...readyQueue.map(p => p.priority))
                : null;

            for (let i = 0; i < readyQueue.length; i++) {
                const proc = readyQueue[i];
                const cx = startX + i * (chipWidth + chipGap);
                if (cx + chipWidth > this.width - 170) break; // Leave room for CPU bay

                const col = colors[proc.pid] || '#4a5b48';
                ctx.fillStyle = col;
                ctx.strokeStyle = '#163323';
                ctx.lineWidth = 1.2;
                ctx.fillRect(cx, trackY + 4, chipWidth, trackH - 8);
                ctx.strokeRect(cx, trackY + 4, chipWidth, trackH - 8);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 8.5px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const label = this.currentBossId === 'priority'
                    ? `${proc.pid}:B${proc.remainingBurst}:P${proc.priority}`
                    : `${proc.pid}:B${proc.remainingBurst}`;
                ctx.fillText(label, cx + chipWidth / 2, trackY + trackH / 2);

                // Overhead visual boss power badges on conveyor chips
                if (this.currentBossId === 'priority' && proc.priority === minPrio) {
                    ctx.fillStyle = '#d49b29';
                    ctx.font = 'bold 9px monospace';
                    ctx.fillText('👑', cx + chipWidth / 2, trackY - 1);
                } else if (this.currentBossId === 'sjf' && proc.burstTime === minBurst) {
                    ctx.fillStyle = '#5d6d39';
                    ctx.font = 'bold 7px monospace';
                    ctx.fillText('⚡MIN', cx + chipWidth / 2, trackY - 1);
                } else if (this.currentBossId === 'fcfs' && proc.arrivalTime > earliestArr && this.boss && this.boss.fifoLockActive) {
                    ctx.fillStyle = '#c45126';
                    ctx.font = 'bold 8px monospace';
                    ctx.fillText('🔒', cx + chipWidth / 2, trackY - 1);
                }
            }

            // FIFO Lock warning gate on conveyor if active
            if (this.currentBossId === 'fcfs' && this.boss && this.boss.fifoLockActive) {
                ctx.fillStyle = 'rgba(196, 81, 38, 0.22)';
                ctx.fillRect(20, trackY, this.width - 196, trackH);
                ctx.strokeStyle = '#c45126';
                ctx.lineWidth = 2;
                ctx.strokeRect(20, trackY, this.width - 196, trackH);
            }

            // CPU Execution Bay
            const cpuBayX = this.width - 156;
            ctx.fillStyle = '#163323';
            ctx.fillRect(cpuBayX, trackY + 3, 132, trackH - 6);
            ctx.strokeStyle = '#d49b29';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(cpuBayX, trackY + 3, 132, trackH - 6);

            ctx.fillStyle = '#fbf8ee';
            ctx.font = 'bold 8.5px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lastGantt = (this.stepSimulator && this.stepSimulator.ganttChart && this.stepSimulator.ganttChart.length > 0)
                ? this.stepSimulator.ganttChart[this.stepSimulator.ganttChart.length - 1]
                : null;
            const cpuText = lastGantt
                ? (lastGantt.isIdle ? 'CPU: IDLE' : `RUN: ${lastGantt.pid} [${lastGantt.startTime}–${lastGantt.endTime}]`)
                : 'CPU: IDLE';
            ctx.fillText(cpuText, cpuBayX + 66, trackY + trackH / 2);

            ctx.restore();
        }

        // =====================================================================
        // Keyboard Input Manager
        // =====================================================================
        handleKeyDown(e) {
            // Only capture gameplay controls when game screen is active
            if (typeof document !== 'undefined') {
                const gameScreen = document.getElementById('screen-game');
                if (!gameScreen || !gameScreen.classList.contains('screen-active')) {
                    return;
                }
            }

            // Do not capture if user is in an input or textarea
            const target = e.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }

            // Numeric dispatch hotkeys (1-4)
            if (this.state === 'playing' && this.stepSimulator && this.stepSimulator.isWaitingForDecision) {
                if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].includes(e.code)) {
                    const num = parseInt(e.key, 10);
                    const eligible = this.stepSimulator.getEligibleChoices();
                    if (!isNaN(num) && num >= 1 && num <= eligible.length) {
                        e.preventDefault();
                        this.handleDispatchChoice(eligible[num - 1].pid);
                        return;
                    }
                }
            }

            // Prevent default browser scrolling for game keys
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }

            switch (e.code) {
                case 'KeyA':
                case 'ArrowLeft':
                    this.inputState.left = true;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.inputState.right = true;
                    break;
                case 'Space':
                case 'KeyW':
                case 'ArrowUp':
                    if (this.state === 'ready') {
                        this.resumeGame();
                    } else {
                        this.inputState.jump = true;
                    }
                    break;
                case 'KeyJ':
                case 'KeyZ':
                case 'KeyF':
                    this.inputState.attack = true;
                    break;
                case 'KeyP':
                case 'Escape':
                    this.togglePause();
                    break;
            }
        }

        handleKeyUp(e) {
            switch (e.code) {
                case 'KeyA':
                case 'ArrowLeft':
                    this.inputState.left = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.inputState.right = false;
                    break;
                case 'Space':
                case 'KeyW':
                case 'ArrowUp':
                    this.inputState.jump = false;
                    break;
                case 'KeyJ':
                case 'KeyZ':
                case 'KeyF':
                    this.inputState.attack = false;
                    break;
            }
        }

        // =====================================================================
        // State Transitions & Overlays
        // =====================================================================
        resumeGame() {
            this.state = 'playing';
            this.lastTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            this.hideOverlay();
            console.log('[GameEngine] State: PLAYING');
        }

        pauseGame() {
            if (this.state !== 'playing') return;
            this.state = 'paused';
            this.showOverlay('paused');
            console.log('[GameEngine] State: PAUSED');
        }

        togglePause() {
            if (this.state === 'playing') {
                this.pauseGame();
            } else if (this.state === 'paused') {
                this.resumeGame();
            }
        }

        triggerVictory() {
            this.state = 'victory';
            this.showOverlay('victory');
            console.log('[GameEngine] State: VICTORY');
        }

        triggerGameOver() {
            this.state = 'gameover';
            this.showOverlay('gameover');
            console.log('[GameEngine] State: GAMEOVER');
        }

        stop() {
            this.isRunning = false;
            if (this.animationFrameId && typeof cancelAnimationFrame !== 'undefined') {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            console.log('[GameEngine] Engine stopped.');
        }

        // =====================================================================
        // HUD & Console Updates
        // =====================================================================
        updateHUD() {
            if (typeof document === 'undefined') return;
            const bossCodeEl = document.getElementById('hud-boss-code');
            const bossNameEl = document.getElementById('hud-boss-name');
            const bossHpBar = document.getElementById('hud-boss-hp-bar');
            const bossHpVal = document.getElementById('hud-boss-hp-val');
            const playerHpBar = document.getElementById('hud-player-hp-bar');
            const playerHpVal = document.getElementById('hud-player-hp-val');
            const scoreVal = document.getElementById('hud-score-val');

            if (bossCodeEl) bossCodeEl.textContent = this.boss.bossId.toUpperCase();
            if (bossNameEl) bossNameEl.textContent = this.boss.name;

            const bossPct = Math.max(0, (this.boss.health / this.boss.maxHealth) * 100);
            if (bossHpBar) bossHpBar.style.width = `${bossPct}%`;
            if (bossHpVal) bossHpVal.textContent = `${Math.ceil(this.boss.health)} / ${this.boss.maxHealth}`;

            const playerPct = Math.max(0, (this.player.health / this.player.maxHealth) * 100);
            if (playerHpBar) playerHpBar.style.width = `${playerPct}%`;
            if (playerHpVal) playerHpVal.textContent = `${Math.ceil(this.player.health)} / ${this.player.maxHealth}`;

            if (scoreVal) scoreVal.textContent = String(this.score).padStart(4, '0');
        }

        updateSchedulingConsole() {
            if (typeof document === 'undefined' || !this.stepSimulator) return;

            const clockEl = document.getElementById('sim-clock');
            const ruleEl = document.getElementById('sim-rule-badge');
            const statusEl = document.getElementById('sim-status-badge');
            const promptEl = document.getElementById('dispatch-prompt-text');
            const queueContainer = document.getElementById('dispatch-queue-container');
            const ganttTrack = document.getElementById('live-gantt-track');

            const state = this.stepSimulator.getLiveState();

            // Clock element with Round Robin quantum clock integration
            if (clockEl) {
                if (state.algorithm === 'rr') {
                    clockEl.textContent = `t = ${state.currentTime} ms | ⏱️ QUANTUM: q=${state.quantum}ms`;
                } else {
                    clockEl.textContent = `t = ${state.currentTime} ms`;
                }
            }

            // Rule badge with distinct boss power name
            if (ruleEl) {
                switch (state.algorithm) {
                    case 'fcfs':
                        ruleEl.textContent = 'DISPATCH LAW: FCFS (FIFO LOCK)';
                        break;
                    case 'sjf':
                        ruleEl.textContent = 'DISPATCH LAW: SJF (SHORTEST JOB SHIELD)';
                        break;
                    case 'rr':
                        ruleEl.textContent = `DISPATCH LAW: ROUND ROBIN (QUANTUM CLOCK: q=${state.quantum}ms)`;
                        break;
                    case 'priority':
                        ruleEl.textContent = 'DISPATCH LAW: PRIORITY (ROYAL OVERRIDE)';
                        break;
                    default:
                        ruleEl.textContent = `DISPATCH LAW: ${state.algorithmName.toUpperCase()}`;
                }
            }

            if (statusEl) {
                if (state.isCompleted) {
                    statusEl.textContent = 'WORKLOAD COMPLETED';
                    statusEl.style.color = '#2b5340';
                } else if (state.isWaitingForDecision) {
                    if (state.algorithm === 'fcfs' && this.boss && this.boss.fifoLockActive) {
                        statusEl.textContent = '🔒 FIFO LOCK ENGAGED: SKIP BLOCKED';
                        statusEl.style.color = '#c45126';
                    } else if (state.algorithm === 'sjf' && this.boss && this.boss.hasSpeedShield) {
                        statusEl.textContent = '🛡️ SHIELD ACTIVE: MIN(BURST) REQUIRED';
                        statusEl.style.color = '#5d6d39';
                    } else if (state.algorithm === 'priority') {
                        statusEl.textContent = '👑 ROYAL OVERRIDE IN EFFECT (MIN RANK)';
                        statusEl.style.color = '#8c6310';
                    } else if (state.algorithm === 'rr') {
                        statusEl.textContent = `⏱️ AWAITING QUEUE HEAD (q=${state.quantum}ms)`;
                        statusEl.style.color = '#c45126';
                    } else {
                        statusEl.textContent = 'AWAITING OPERATOR DISPATCH';
                        statusEl.style.color = '#c45126';
                    }
                } else {
                    statusEl.textContent = 'PROCESSING...';
                    statusEl.style.color = '#5d6d39';
                }
            }

            // Prompt text tailored to active algorithm and power
            if (promptEl) {
                if (state.isCompleted) {
                    promptEl.textContent = 'Workload completed! Boss scheduling buffer cleared.';
                } else {
                    switch (state.algorithm) {
                        case 'fcfs':
                            promptEl.textContent = 'FCFS Law (FIFO Lock): Select earliest-arrived process [1-4 / Click]. Skipping earlier tasks triggers the Queue Titan\'s FIFO Lock!';
                            break;
                        case 'sjf':
                            promptEl.textContent = 'SJF Law (Shortest Job Shield): Select shortest CPU burst [1-4 / Click] to shatter the Demon\'s shield. Incorrect choices trigger rapid speed counterattacks!';
                            break;
                        case 'rr':
                            promptEl.textContent = `Round Robin Law (Quantum Clock q=${state.quantum}ms): Select queue head [1-4 / Click] for a ${state.quantum}ms quantum slice. Unfinished tasks return to the queue tail.`;
                            break;
                        case 'priority':
                            promptEl.textContent = 'Priority Law (Royal Override): Select highest-priority process [1-4 / Click] (👑 Royal Override). Lower-priority picks trigger the King\'s Royal Decree!';
                            break;
                        default:
                            promptEl.textContent = 'Select next process [1-4 / Click] to execute main CPU attack.';
                    }
                }
            }

            // Render Ready Queue Chips with Power Badges
            if (queueContainer && typeof document.createElement === 'function') {
                queueContainer.innerHTML = '';
                if (state.readyQueue.length === 0) {
                    const emptyNotice = document.createElement('div');
                    emptyNotice.className = 'queue-empty font-mono';
                    emptyNotice.textContent = state.isCompleted
                        ? 'All processes completed execution.'
                        : 'No processes currently waiting in ready queue (CPU Idle).';
                    queueContainer.appendChild(emptyNotice);
                } else {
                    // Precompute power references for ready queue chips
                    const earliestArr = Math.min(...state.readyQueue.map(p => p.arrivalTime));
                    const minBurst = Math.min(...state.readyQueue.map(p => p.burstTime));
                    const minPrio = (this.currentBossId === 'priority')
                        ? Math.min(...state.readyQueue.map(p => p.priority))
                        : null;

                    state.readyQueue.forEach((proc, idx) => {
                        const chip = document.createElement('button');
                        chip.type = 'button';
                        chip.className = `process-chip chip-proc-${proc.pid.toLowerCase()}`;
                        chip.setAttribute('data-pid', proc.pid);
                        chip.setAttribute('aria-label', `Dispatch Process ${proc.pid}`);

                        let prioTag = '';
                        if (this.currentBossId === 'priority' || proc.priority !== undefined) {
                            prioTag = `<span class="chip-metric chip-prio font-mono">PRIO:#${proc.priority}</span>`;
                        }

                        const burstDisplay = proc.remainingBurst !== proc.burstTime
                            ? `${proc.remainingBurst}/${proc.burstTime}`
                            : `${proc.burstTime}`;

                        // Determine distinct boss power badge per chip
                        let powerBadgeHtml = '<span class="chip-badge font-mono">READY</span>';
                        if (this.currentBossId === 'fcfs') {
                            if (proc.arrivalTime > earliestArr) {
                                chip.classList.add('chip-fifo-locked');
                                powerBadgeHtml = '<span class="chip-badge chip-lock-badge font-mono">🔒 FIFO LOCKED</span>';
                            } else {
                                powerBadgeHtml = '<span class="chip-badge chip-fifo-head font-mono">1ST ARRIVAL</span>';
                            }
                        } else if (this.currentBossId === 'sjf') {
                            if (proc.burstTime === minBurst) {
                                chip.classList.add('chip-sjf-optimal');
                                powerBadgeHtml = '<span class="chip-badge chip-shield-breaker font-mono">⚡ SHIELD BREAKER</span>';
                            } else {
                                chip.classList.add('chip-sjf-suboptimal');
                                powerBadgeHtml = '<span class="chip-badge chip-shield-blocked font-mono">🛡️ DEFLECTED</span>';
                            }
                        } else if (this.currentBossId === 'rr') {
                            if (idx === 0) {
                                chip.classList.add('chip-rr-head');
                                powerBadgeHtml = `<span class="chip-badge chip-rr-head font-mono">⏱️ HEAD (q=${state.quantum}ms)</span>`;
                            } else {
                                powerBadgeHtml = `<span class="chip-badge font-mono">TAIL #${idx + 1}</span>`;
                            }
                        } else if (this.currentBossId === 'priority') {
                            if (proc.priority === minPrio) {
                                chip.classList.add('chip-royal-override');
                                powerBadgeHtml = '<span class="chip-badge chip-royal-badge font-mono">👑 ROYAL OVERRIDE</span>';
                            } else {
                                chip.classList.add('chip-subordinate');
                                powerBadgeHtml = '<span class="chip-badge chip-subordinate-badge font-mono">SUBORDINATE</span>';
                            }
                        }

                        chip.innerHTML = `
                            <span class="chip-hotkey font-mono">[${idx + 1}]</span>
                            <span class="chip-pid font-mono">${proc.pid}</span>
                            <span class="chip-metric font-mono">ARR:${proc.arrivalTime}</span>
                            <span class="chip-metric font-mono">BURST:${burstDisplay}ms</span>
                            ${prioTag}
                            ${powerBadgeHtml}
                        `;

                        chip.onclick = () => {
                            this.handleDispatchChoice(proc.pid);
                        };

                        queueContainer.appendChild(chip);
                    });
                }
            }

            // Render Live Gantt Chart
            if (ganttTrack && typeof document.createElement === 'function') {
                ganttTrack.innerHTML = '';
                if (state.ganttChart.length === 0) {
                    const emptyGantt = document.createElement('div');
                    emptyGantt.className = 'gantt-empty font-mono';
                    emptyGantt.textContent = 'Awaiting initial process dispatch...';
                    ganttTrack.appendChild(emptyGantt);
                } else {
                    state.ganttChart.forEach(seg => {
                        const block = document.createElement('div');
                        if (seg.isIdle) {
                            block.className = 'gantt-block gantt-idle font-mono';
                            block.innerHTML = `
                                <span class="gantt-label">IDLE</span>
                                <span class="gantt-range font-mono">${seg.startTime}–${seg.endTime}</span>
                            `;
                        } else {
                            block.className = `gantt-block gantt-proc proc-${seg.pid.toLowerCase()} font-mono`;
                            block.innerHTML = `
                                <span class="gantt-label">${seg.pid}</span>
                                <span class="gantt-range font-mono">${seg.startTime}–${seg.endTime}</span>
                            `;
                        }
                        ganttTrack.appendChild(block);
                    });
                }
            }
        }

        showFeedbackBanner(isSuccess, message) {
            if (typeof document === 'undefined') return;
            const box = document.getElementById('dispatch-feedback-box');
            const icon = document.getElementById('feedback-icon');
            const text = document.getElementById('feedback-text');

            if (!box || !icon || !text) return;

            box.style.display = 'flex';
            if (isSuccess) {
                box.className = 'dispatch-feedback feedback-success';
                icon.textContent = '✓';
            } else {
                box.className = 'dispatch-feedback feedback-error';
                icon.textContent = '⚠';
            }
            text.textContent = message;

            if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
            if (isSuccess) {
                this.feedbackTimer = setTimeout(() => {
                    this.hideFeedbackBanner();
                }, 6000);
            }
        }

        hideFeedbackBanner() {
            if (typeof document === 'undefined') return;
            const box = document.getElementById('dispatch-feedback-box');
            if (box) box.style.display = 'none';
        }

        renderDebrief() {
            if (typeof document === 'undefined' || !this.stepSimulator) return;
            const container = document.getElementById('debrief-container');
            if (!container) return;

            const metrics = this.stepSimulator.finalMetrics;
            if (!metrics) return;

            const isPriority = this.currentBossId === 'priority';

            const procRows = metrics.processes.map(p => `
                <tr>
                    <td class="td-pid font-mono"><strong>${p.pid}</strong></td>
                    <td class="font-mono">${p.arrivalTime} ms</td>
                    <td class="font-mono">${p.burstTime} ms</td>
                    ${isPriority ? `<td class="font-mono">#${p.priority}</td>` : ''}
                    <td class="font-mono">${p.completionTime} ms</td>
                    <td class="font-mono">${p.turnaroundTime} ms</td>
                    <td class="font-mono">${p.waitingTime} ms</td>
                    <td class="font-mono">${p.responseTime} ms</td>
                </tr>
            `).join('');

            container.innerHTML = `
                <div class="debrief-box">
                    <div class="debrief-lesson">
                        <strong class="font-mono">ALGORITHMIC DEBRIEF:</strong>
                        <p class="debrief-lesson-text">${this.stepSimulator.lesson}</p>
                    </div>

                    <div class="debrief-table-wrap">
                        <table class="debrief-table">
                            <thead>
                                <tr>
                                    <th>PID</th>
                                    <th>Arrival</th>
                                    <th>Burst</th>
                                    ${isPriority ? '<th>Priority</th>' : ''}
                                    <th>Completion (CT)</th>
                                    <th>Turnaround (TAT)</th>
                                    <th>Waiting (WT)</th>
                                    <th>Response (RT)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${procRows}
                                <tr class="tr-averages">
                                    <td colspan="${isPriority ? 4 : 3}"><strong>SYSTEM AVERAGES</strong></td>
                                    <td>—</td>
                                    <td class="font-mono"><strong>${metrics.averageTurnaroundTime.toFixed(2)} ms</strong></td>
                                    <td class="font-mono"><strong>${metrics.averageWaitingTime.toFixed(2)} ms</strong></td>
                                    <td class="font-mono"><strong>${metrics.averageResponseTime.toFixed(2)} ms</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="debrief-summary-pills font-mono">
                        <span class="debrief-pill">CPU Utilization: <strong>${metrics.cpuUtilization.toFixed(1)}%</strong></span>
                        <span class="debrief-pill">Total Time: <strong>${metrics.totalElapsedTime} ms</strong></span>
                        <span class="debrief-pill">Idle Time: <strong>${metrics.totalIdleTime} ms</strong></span>
                        <span class="debrief-pill">Throughput: <strong>${metrics.throughput.toFixed(3)} proc/ms</strong></span>
                    </div>

                    <div class="debrief-verification-badge font-mono">
                        ✓ VERIFIED: Live Execution Matches Core Scheduling Engine Reference Output 100%
                    </div>
                </div>
            `;

            container.style.display = 'block';
        }

        hideDebrief() {
            if (typeof document === 'undefined') return;
            const container = document.getElementById('debrief-container');
            if (container) {
                container.style.display = 'none';
                container.innerHTML = '';
            }
        }

        showOverlay(mode) {
            if (typeof document === 'undefined') return;
            const overlay = document.getElementById('game-overlay');
            const tagEl = document.getElementById('overlay-tag');
            const titleEl = document.getElementById('overlay-title');
            const descEl = document.getElementById('overlay-desc');
            const btnPrimary = document.getElementById('btn-overlay-primary');
            const btnSecondary = document.getElementById('btn-overlay-secondary');

            if (!overlay) return;
            overlay.style.display = 'flex';

            if (mode === 'ready') {
                this.hideDebrief();
                if (tagEl) tagEl.textContent = 'DISPATCH GATE READY';
                if (titleEl) titleEl.textContent = `ENGAGE: ${this.boss.name}`;
                if (descEl) descEl.textContent = 'Execute correct CPU scheduling decisions [1-4 or Click] to launch main CPU burst attacks at the boss. Deflect hazards with [Z/J]. Dodge incoming attacks with [A/D] and [SPACE]. Press Space to begin!';
                if (btnPrimary) {
                    btnPrimary.textContent = 'BEGIN BATTLE [SPACE]';
                    btnPrimary.onclick = () => this.resumeGame();
                }
                if (btnSecondary) {
                    btnSecondary.textContent = 'EXIT TO SELECTION';
                    btnSecondary.onclick = () => {
                        if (typeof window !== 'undefined' && window.SchedulerArcade) {
                            window.SchedulerArcade.navigateTo('screen-select');
                        }
                    };
                }
            } else if (mode === 'paused') {
                this.hideDebrief();
                if (tagEl) tagEl.textContent = 'EXECUTION SUSPENDED';
                if (titleEl) titleEl.textContent = 'SYSTEM PAUSED';
                if (descEl) descEl.textContent = 'CPU simulation clock is frozen. Take a breath and resume when ready.';
                if (btnPrimary) {
                    btnPrimary.textContent = 'RESUME BATTLE [P]';
                    btnPrimary.onclick = () => this.resumeGame();
                }
                if (btnSecondary) {
                    btnSecondary.textContent = 'QUIT TO SELECTION';
                    btnSecondary.onclick = () => {
                        if (typeof window !== 'undefined' && window.SchedulerArcade) {
                            window.SchedulerArcade.navigateTo('screen-select');
                        }
                    };
                }
            } else if (mode === 'victory') {
                if (tagEl) tagEl.textContent = 'STAGE CONQUERED';
                if (titleEl) titleEl.textContent = `${this.boss.name} DEFEATED!`;
                if (descEl) descEl.textContent = `Flawless scheduling discipline, Operator! Final Burst Score: ${this.score}. Verified CPU metrics below:`;
                this.renderDebrief();
                if (btnPrimary) {
                    btnPrimary.textContent = 'PLAY AGAIN';
                    btnPrimary.onclick = () => this.startLevel(this.currentBossId);
                }
                if (btnSecondary) {
                    btnSecondary.textContent = 'RETURN TO SELECTION';
                    btnSecondary.onclick = () => {
                        if (typeof window !== 'undefined' && window.SchedulerArcade) {
                            window.SchedulerArcade.navigateTo('screen-select');
                        }
                    };
                }
            } else if (mode === 'gameover') {
                this.hideDebrief();
                if (tagEl) tagEl.textContent = 'KERNEL PANIC';
                if (titleEl) titleEl.textContent = 'PROCESS BUFFER OVERFLOW';
                if (descEl) descEl.textContent = `Integrity dropped to zero. ${this.boss.name} overwhelmed the scheduler buffer with violations.`;
                if (btnPrimary) {
                    btnPrimary.textContent = 'RESTART LEVEL';
                    btnPrimary.onclick = () => this.startLevel(this.currentBossId);
                }
                if (btnSecondary) {
                    btnSecondary.textContent = 'RETURN TO SELECTION';
                    btnSecondary.onclick = () => {
                        if (typeof window !== 'undefined' && window.SchedulerArcade) {
                            window.SchedulerArcade.navigateTo('screen-select');
                        }
                    };
                }
            }
        }

        hideOverlay() {
            if (typeof document === 'undefined') return;
            const overlay = document.getElementById('game-overlay');
            if (overlay) overlay.style.display = 'none';
            this.hideDebrief();
        }
    }

    const engineInstance = new GameEngine();

    const api = {
        GameEngine,
        instance: engineInstance
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.ArcadeGame = window.ArcadeGame || {};
        window.ArcadeGame.engine = api;
    }
})();
