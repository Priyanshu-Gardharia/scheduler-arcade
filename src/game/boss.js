/**
 * Scheduler Arcade — Boss Character Entities
 * 
 * Implements 4 visually distinct original bosses matching the game's identity:
 * - FCFS: The Queue Titan (Monolithic stone automaton with rotating tape reels & FIFO blocks)
 * - SJF: The Speed Demon (Aerodynamic avian automaton with burst calipers & needle pulses)
 * - Round Robin: The Time Wizard (Chronomancer with rotating quantum astrolabe ring)
 * - Priority: The Priority King (Gilded monarch with tiered register crown & royal scepter)
 */

(function () {
    'use strict';

    const combatApi = typeof require !== 'undefined' 
        ? require('./combat') 
        : (window.ArcadeGame ? window.ArcadeGame.combat : null);

    const { Projectile, spawnImpactParticles } = combatApi || {};

    class Boss {
        constructor(bossId = 'fcfs', x = 720, y = 260) {
            this.bossId = bossId;
            this.x = x;
            this.y = y;
            this.startX = x;
            this.startY = y;
            this.width = 90;
            this.height = 110;

            // Stats
            this.maxHealth = 100;
            this.health = 100;
            this.hitFlashTimer = 0;
            this.animTimer = 0;
            this.attackTimer = 0;
            this.attackInterval = 2.4; // Base cooldown

            // Boss Power States
            this.fifoLockActive = false;
            this.fifoLockTimer = 0;
            this.hasSpeedShield = (bossId === 'sjf');
            this.shieldShatterTimer = 0;
            this.quantumClock = 2;
            this.quantumMax = 2;
            this.quantumRequeueTimer = 0;
            this.royalWrathTimer = 0;

            // Adjust dimensions and timings per boss
            this.configureBoss(bossId);
        }

        configureBoss(bossId) {
            this.bossId = bossId;
            this.animTimer = 0;
            this.hitFlashTimer = 0;
            this.health = this.maxHealth;

            // Power state reset
            this.fifoLockActive = false;
            this.fifoLockTimer = 0;
            this.hasSpeedShield = (bossId === 'sjf');
            this.shieldShatterTimer = 0;
            this.quantumClock = 2;
            this.quantumMax = 2;
            this.quantumRequeueTimer = 0;
            this.royalWrathTimer = 0;

            if (bossId === 'fcfs') {
                this.name = 'THE QUEUE TITAN';
                this.width = 94;
                this.height = 114;
                this.attackInterval = 2.6;
            } else if (bossId === 'sjf') {
                this.name = 'THE SPEED DEMON';
                this.width = 84;
                this.height = 92;
                this.attackInterval = 1.9;
            } else if (bossId === 'rr') {
                this.name = 'THE TIME WIZARD';
                this.width = 86;
                this.height = 100;
                this.attackInterval = 2.3;
            } else if (bossId === 'priority') {
                this.name = 'THE PRIORITY KING';
                this.width = 90;
                this.height = 110;
                this.attackInterval = 2.4;
            }
            this.attackTimer = 1.0; // Initial delay before first attack
        }

        reset(x = 720, y = 260) {
            this.x = x;
            this.y = y;
            this.startX = x;
            this.startY = y;
            this.health = this.maxHealth;
            this.hitFlashTimer = 0;
            this.hitStaggerX = 0;
            this.damageAnimTimer = 0;
            this.animTimer = 0;
            this.attackTimer = 1.2;

            // Reset powers
            this.fifoLockActive = false;
            this.fifoLockTimer = 0;
            this.hasSpeedShield = (this.bossId === 'sjf');
            this.shieldShatterTimer = 0;
            this.quantumClock = 2;
            this.quantumRequeueTimer = 0;
            this.royalWrathTimer = 0;
        }

        // =====================================================================
        // BOSS POWERS & COUNTERATTACKS
        // =====================================================================

        /**
         * Power 1: FCFS — FIFO Lock
         * Activates stone barrier when player attempts to skip an earlier-arrived process.
         */
        triggerFifoLock(particlesList) {
            this.fifoLockActive = true;
            this.fifoLockTimer = 1.4; // Barrier remains visible for 1.4s
            this.hitFlashTimer = 0.3; // Flash terracotta
            if (particlesList) {
                spawnImpactParticles(particlesList, this.x - 30, this.y + this.height / 2, '#7a756b', 14);
                spawnImpactParticles(particlesList, this.x - 30, this.y + this.height / 2, '#c45126', 12);
            }
        }

        releaseFifoLock() {
            this.fifoLockActive = false;
            this.fifoLockTimer = 0;
        }

        /**
         * Power 2: SJF — Shortest Job Shield
         * Shatters aerodynamic shield when minimal burst is chosen; restores when next decision awaits.
         */
        shatterShield(particlesList) {
            this.hasSpeedShield = false;
            this.shieldShatterTimer = 0.6; // 600ms shatter burst effect
            if (particlesList) {
                spawnImpactParticles(particlesList, this.x + this.width / 2, this.y + this.height / 2, '#b2c494', 20);
                spawnImpactParticles(particlesList, this.x + this.width / 2, this.y + this.height / 2, '#5d6d39', 16);
                spawnImpactParticles(particlesList, this.x + this.width / 2, this.y + this.height / 2, '#d49b29', 14);
            }
        }

        restoreSpeedShield() {
            if (this.bossId === 'sjf') {
                this.hasSpeedShield = true;
            }
        }

        /**
         * Power 2 Counterattack: Speed Demon Rapid Needle Volley
         * Triggered on selecting longer burst when shorter job was ready.
         */
        triggerSpeedCounterattack(playerX, playerY, projectilesList, particlesList) {
            this.hitFlashTimer = 0.3;
            if (!projectilesList) return;

            const spawnX = this.x - 12;
            const spawnY = this.y + this.height * 0.5;
            const dx = (playerX + 17) - spawnX;
            const dy = (playerY + 24) - spawnY;
            const baseAngle = Math.atan2(dy, dx);
            const speed = 420; // High speed

            // Fire a rapid 3-needle spread volley
            [-0.14, 0, 0.14].forEach(angleOffset => {
                const angle = baseAngle + angleOffset;
                projectilesList.push(new Projectile({
                    x: spawnX,
                    y: spawnY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    width: 18,
                    height: 10,
                    damage: 12,
                    isPlayer: false,
                    type: 'sjf-needle',
                    color: '#5d6d39'
                }));
            });

            if (particlesList) {
                spawnImpactParticles(particlesList, spawnX, spawnY, '#5d6d39', 10);
                spawnImpactParticles(particlesList, spawnX, spawnY, '#c45126', 8);
            }
        }

        /**
         * Power 3: Round Robin — Quantum Clock
         * Advances quantum clock animation and triggers requeue flash if unfinished.
         */
        triggerQuantumStep(duration, wasRequeued, particlesList) {
            this.quantumClock = duration;
            if (wasRequeued) {
                this.quantumRequeueTimer = 0.7; // Visual requeue rotation spiral
            }
            if (particlesList) {
                spawnImpactParticles(particlesList, this.x - 10, this.y + 30, '#d49b29', 10);
                spawnImpactParticles(particlesList, this.x - 10, this.y + 30, '#c45126', 8);
            }
        }

        /**
         * Power 3 Counterattack: Temporal Anomaly Ring
         * Triggered when player skips head of Round Robin ready queue.
         */
        triggerTemporalCounterattack(playerX, playerY, projectilesList, particlesList) {
            this.hitFlashTimer = 0.3;
            if (!projectilesList) return;

            const spawnX = this.x - 12;
            const spawnY = this.y + this.height * 0.5;
            const dx = (playerX + 17) - spawnX;
            const dy = (playerY + 24) - spawnY;
            const dist = Math.hypot(dx, dy) || 1;

            // Two concentric temporal quantum rings
            [270, 220].forEach(speed => {
                projectilesList.push(new Projectile({
                    x: spawnX,
                    y: spawnY,
                    vx: (dx / dist) * speed,
                    vy: (dy / dist) * speed,
                    width: 24,
                    height: 24,
                    damage: 15,
                    isPlayer: false,
                    type: 'rr-ring',
                    color: '#c45126'
                }));
            });

            if (particlesList) {
                spawnImpactParticles(particlesList, spawnX, spawnY, '#c45126', 14);
                spawnImpactParticles(particlesList, spawnX, spawnY, '#163323', 8);
            }
        }

        /**
         * Power 4 Counterattack: Priority King Royal Decree
         * Triggered when selecting a lower-priority process while a higher rank waits.
         */
        triggerRoyalCounterattack(playerX, playerY, projectilesList, particlesList) {
            this.royalWrathTimer = 0.9;
            this.hitFlashTimer = 0.35;
            if (!projectilesList) return;

            const spawnX = this.x - 14;
            const spawnY = this.y + this.height * 0.45;

            // Royal Gilded Scepter Seal
            projectilesList.push(new Projectile({
                x: spawnX,
                y: spawnY,
                vx: -320,
                vy: 0,
                width: 26,
                height: 26,
                damage: 20,
                isPlayer: false,
                type: 'priority-seal',
                color: '#d49b29'
            }));

            if (particlesList) {
                spawnImpactParticles(particlesList, spawnX, spawnY, '#d49b29', 18);
                spawnImpactParticles(particlesList, spawnX, spawnY, '#c45126', 12);
            }
        }

        takeDamage(amount, particlesList) {
            if (this.health <= 0) return false;

            this.health = Math.max(0, this.health - amount);
            this.triggerDamageReaction(particlesList);
            return true;
        }

        /**
         * Triggers visible boss damage animation: hit flash, shudder shake, and horizontal stagger recoil.
         */
        triggerDamageReaction(particlesList) {
            this.hitFlashTimer = 0.35; // 350ms bright damage flash
            this.damageAnimTimer = 0.35;
            this.hitStaggerX = 14; // Recoil 14px to the right away from player

            if (particlesList) {
                spawnImpactParticles(particlesList, this.x + this.width / 2, this.y + this.height / 2, '#c45126', 16);
                spawnImpactParticles(particlesList, this.x + this.width / 2, this.y + this.height / 2, '#d49b29', 14);
            }
        }

        getBounds() {
            return {
                x: this.x + 8,
                y: this.y + 8,
                width: this.width - 16,
                height: this.height - 12
            };
        }

        update(dt, playerX, playerY, groundY, projectilesList, particlesList) {
            this.animTimer += dt;
            if (this.hitFlashTimer > 0) {
                this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
            }
            if (this.damageAnimTimer > 0) {
                this.damageAnimTimer = Math.max(0, this.damageAnimTimer - dt);
                this.hitStaggerX = Math.max(0, this.hitStaggerX - dt * 45); // Smooth recoil recovery
            }

            // Power Timers
            if (this.fifoLockTimer > 0) {
                this.fifoLockTimer = Math.max(0, this.fifoLockTimer - dt);
                if (this.fifoLockTimer === 0) {
                    this.fifoLockActive = false;
                }
            }
            if (this.shieldShatterTimer > 0) {
                this.shieldShatterTimer = Math.max(0, this.shieldShatterTimer - dt);
            }
            if (this.quantumRequeueTimer > 0) {
                this.quantumRequeueTimer = Math.max(0, this.quantumRequeueTimer - dt);
            }
            if (this.royalWrathTimer > 0) {
                this.royalWrathTimer = Math.max(0, this.royalWrathTimer - dt);
            }

            // Boss-specific idle movement patterns
            if (this.bossId === 'fcfs') {
                // Steady grounding with slight breathing heave
                this.y = groundY - this.height + Math.sin(this.animTimer * 2.5) * 3;
            } else if (this.bossId === 'sjf') {
                // Agile predatory floating & quick swoops
                this.x = this.startX + Math.sin(this.animTimer * 3.5) * 30;
                this.y = this.startY - 30 + Math.cos(this.animTimer * 4.5) * 20;
            } else if (this.bossId === 'rr') {
                // Pendulum hovering oscillation
                this.x = this.startX + Math.sin(this.animTimer * 2) * 20;
                this.y = this.startY - 25 + Math.sin(this.animTimer * 3) * 15;
            } else if (this.bossId === 'priority') {
                // Regal sovereign levitation
                this.y = this.startY - 20 + Math.sin(this.animTimer * 2) * 10;
            }

            // Attack AI Timer
            if (this.health > 0) {
                this.attackTimer -= dt;
                if (this.attackTimer <= 0) {
                    this.executeAttack(playerX, playerY, projectilesList, particlesList);
                    this.attackTimer = this.attackInterval;
                }
            }
        }

        executeAttack(playerX, playerY, projectilesList, particlesList) {
            if (!projectilesList) return;

            const spawnX = this.x - 12;
            const spawnY = this.y + this.height * 0.55;

            // Aim velocity towards player
            const dx = (playerX + 17) - spawnX;
            const dy = (playerY + 24) - spawnY;
            const dist = Math.hypot(dx, dy) || 1;

            if (this.bossId === 'fcfs') {
                // Launch rolling FIFO stone block across floor
                projectilesList.push(new Projectile({
                    x: spawnX,
                    y: this.y + this.height - 24,
                    vx: -240,
                    vy: 0,
                    width: 24,
                    height: 24,
                    damage: 18,
                    isPlayer: false,
                    type: 'fcfs-boulder',
                    color: '#7a756b'
                }));
            } else if (this.bossId === 'sjf') {
                // Rapid burst needle directed at player
                const speed = 360;
                projectilesList.push(new Projectile({
                    x: spawnX,
                    y: spawnY,
                    vx: (dx / dist) * speed,
                    vy: (dy / dist) * speed,
                    width: 18,
                    height: 10,
                    damage: 14,
                    isPlayer: false,
                    type: 'sjf-needle',
                    color: '#5d6d39'
                }));
            } else if (this.bossId === 'rr') {
                // Cast rotating quantum slice ring
                const speed = 250;
                projectilesList.push(new Projectile({
                    x: spawnX,
                    y: spawnY,
                    vx: (dx / dist) * speed,
                    vy: (dy / dist) * speed,
                    width: 22,
                    height: 22,
                    damage: 16,
                    isPlayer: false,
                    type: 'rr-ring',
                    color: '#c45126'
                }));
            } else if (this.bossId === 'priority') {
                // Fire royal gilded priority seal #0
                const speed = 280;
                projectilesList.push(new Projectile({
                    x: spawnX,
                    y: spawnY - 10,
                    vx: -speed,
                    vy: 0,
                    width: 20,
                    height: 20,
                    damage: 20,
                    isPlayer: false,
                    type: 'priority-seal',
                    color: '#d49b29'
                }));
            }

            if (particlesList) {
                spawnImpactParticles(particlesList, spawnX, spawnY, '#163323', 6);
            }
        }

        draw(ctx) {
            ctx.save();
            // Incorporate horizontal hit stagger recoil and high-frequency impact shake
            const shakeX = this.hitFlashTimer > 0 ? (Math.sin(this.hitFlashTimer * 45) * 5) : 0;
            ctx.translate(this.x + this.width / 2 + this.hitStaggerX + shakeX, this.y + this.height / 2);

            // Hit flash feedback: tints white/light cream when recently struck
            const isFlashing = this.hitFlashTimer > 0;

            switch (this.bossId) {
                case 'fcfs':
                    this.drawQueueTitan(ctx, isFlashing);
                    if (this.fifoLockActive || this.fifoLockTimer > 0) {
                        this.drawFifoLockBarrier(ctx);
                    }
                    break;
                case 'sjf':
                    if (this.hasSpeedShield) {
                        this.drawSpeedShield(ctx);
                    }
                    if (this.shieldShatterTimer > 0) {
                        this.drawShieldShatter(ctx);
                    }
                    this.drawSpeedDemon(ctx, isFlashing);
                    break;
                case 'rr':
                    this.drawTimeWizard(ctx, isFlashing);
                    this.drawQuantumAstrolabe(ctx);
                    break;
                case 'priority':
                    this.drawRoyalAura(ctx);
                    this.drawPriorityKing(ctx, isFlashing);
                    break;
                default:
                    this.drawQueueTitan(ctx, isFlashing);
            }

            ctx.restore();
        }

        // =====================================================================
        // BOSS POWER VISUAL RENDERING
        // =====================================================================

        /**
         * Power 1 Visual: FCFS FIFO Lock Barrier
         * Renders a heavy stone barrier with iron crossbars, padlock emblem,
         * and warning banner when player attempts to bypass earlier arrivals.
         */
        drawFifoLockBarrier(ctx) {
            ctx.save();
            const pulse = Math.sin(this.animTimer * 10) * 2;

            // 1. Monolithic stone gateposts left of titan
            ctx.fillStyle = '#b8ae9c';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2.5;
            ctx.fillRect(-70, -56, 16, 110);
            ctx.strokeRect(-70, -56, 16, 110);

            // 2. Iron locking crossbars with hazard stripes
            ctx.fillStyle = '#c45126';
            ctx.fillRect(-74, -20 + pulse, 24, 12);
            ctx.strokeRect(-74, -20 + pulse, 24, 12);
            ctx.fillRect(-74, 18 - pulse, 24, 12);
            ctx.strokeRect(-74, 18 - pulse, 24, 12);

            // 3. Heavy Iron Padlock Seal
            ctx.fillStyle = '#163323';
            ctx.beginPath();
            ctx.arc(-62, -2, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d49b29';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Padlock shackle
            ctx.strokeStyle = '#d49b29';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(-62, -10, 7, Math.PI, 0);
            ctx.stroke();

            // Padlock keyhole
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-62, -3, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 4. Warning FIFO LOCK Header Tag
            ctx.fillStyle = '#c45126';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 1.5;
            ctx.fillRect(-74, -76, 148, 18);
            ctx.strokeRect(-74, -76, 148, 18);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔒 FIFO LOCK: EARLIEST FIRST', 0, -67);

            ctx.restore();
        }

        /**
         * Power 2 Visual: SJF Shortest Job Shield
         * Aerodynamic elliptical forcefield surrounding the Speed Demon.
         */
        drawSpeedShield(ctx) {
            ctx.save();
            const hover = Math.sin(this.animTimer * 4.5) * 4;
            const shieldSpin = this.animTimer * 3;

            // 1. Translucent aerodynamic elliptical forcefield bubble
            ctx.fillStyle = 'rgba(178, 196, 148, 0.28)';
            ctx.strokeStyle = '#5d6d39';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(0, hover, 62, 54, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 2. Outer pulsing caliper arc rings
            ctx.save();
            ctx.translate(0, hover);
            ctx.rotate(shieldSpin);
            ctx.strokeStyle = '#d49b29';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([12, 10]);
            ctx.beginPath();
            ctx.arc(0, 0, 68, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // 3. Shield Status Badge above boss
            ctx.fillStyle = '#163323';
            ctx.strokeStyle = '#5d6d39';
            ctx.lineWidth = 1.5;
            ctx.fillRect(-58, -68 + hover, 116, 16);
            ctx.strokeRect(-58, -68 + hover, 116, 16);

            ctx.fillStyle = '#d49b29';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🛡️ SHIELD: MIN(BURST)', 0, -60 + hover);

            ctx.restore();
        }

        /**
         * Power 2 Shatter Effect: Shortest burst pierces the shield
         */
        drawShieldShatter(ctx) {
            ctx.save();
            const progress = 1 - (this.shieldShatterTimer / 0.6);
            const radius = 60 + progress * 40;
            ctx.strokeStyle = '#b2c494';
            ctx.lineWidth = 2.5 * (1 - progress);
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        /**
         * Power 3 Visual: Round Robin Quantum Clock & Requeue Spiral
         */
        drawQuantumAstrolabe(ctx) {
            ctx.save();
            const hover = Math.sin(this.animTimer * 3) * 3;

            // Live Quantum Badge above wizard
            ctx.fillStyle = '#163323';
            ctx.strokeStyle = '#c45126';
            ctx.lineWidth = 1.5;
            ctx.fillRect(-52, -70 + hover, 104, 16);
            ctx.strokeRect(-52, -70 + hover, 104, 16);

            ctx.fillStyle = '#fbf8ee';
            ctx.font = 'bold 8.5px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⏱️ QUANTUM: q=2ms', 0, -62 + hover);

            // Requeue tail rotation feedback
            if (this.quantumRequeueTimer > 0) {
                const spiralAngle = this.animTimer * 12;
                ctx.save();
                ctx.translate(0, hover);
                ctx.rotate(spiralAngle);
                ctx.strokeStyle = '#c45126';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(0, 0, 56, 0, Math.PI * 1.5);
                ctx.stroke();
                ctx.restore();

                // Notification pill below wizard
                ctx.fillStyle = '#c45126';
                ctx.fillRect(-54, 48 + hover, 108, 14);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 7.5px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('↺ REQUEUE TO TAIL', 0, 55 + hover);
            }

            ctx.restore();
        }

        /**
         * Power 4 Visual: Priority King Royal Override Aura
         */
        drawRoyalAura(ctx) {
            ctx.save();
            const hover = Math.sin(this.animTimer * 2) * 2.5;

            // Sovereign Ray Beams fanning from crown
            ctx.strokeStyle = '#d49b29';
            ctx.lineWidth = 1.5;
            [-0.4, -0.2, 0, 0.2, 0.4].forEach(angle => {
                ctx.save();
                ctx.translate(0, -42 + hover);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(0, -28);
                ctx.stroke();
                ctx.restore();
            });

            // Royal Override Crest above crown
            ctx.fillStyle = '#163323';
            ctx.strokeStyle = '#d49b29';
            ctx.lineWidth = 1.8;
            ctx.fillRect(-56, -72 + hover, 112, 16);
            ctx.strokeRect(-56, -72 + hover, 112, 16);

            ctx.fillStyle = '#f5b041';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👑 ROYAL OVERRIDE', 0, -64 + hover);

            // Royal Decree Shockwave during retaliation
            if (this.royalWrathTimer > 0) {
                ctx.strokeStyle = '#c45126';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(0, hover, 65, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#c45126';
                ctx.fillRect(-50, 50 + hover, 100, 14);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 7.5px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('👑 ROYAL DECREE!', 0, 57 + hover);
            }

            ctx.restore();
        }

        // =====================================================================
        // BOSS 1: FCFS — The Queue Titan
        // =====================================================================
        drawQueueTitan(ctx, isFlashing) {
            const bob = Math.sin(this.animTimer * 2.5) * 2;
            const reelRot = this.animTimer * 4;

            // 1. Monolith stone body
            ctx.fillStyle = isFlashing ? '#ffffff' : '#d8d0be';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(-38, -42 + bob, 76, 84, 6);
            ctx.fill();
            ctx.stroke();

            // 2. Heavy stone shoulder blocks
            ctx.fillStyle = isFlashing ? '#ffffff' : '#b8ae9c';
            ctx.fillRect(-48, -30 + bob, 12, 44);
            ctx.strokeRect(-48, -30 + bob, 12, 44);
            ctx.fillRect(36, -30 + bob, 12, 44);
            ctx.strokeRect(36, -30 + bob, 12, 44);

            // 3. Dual rotating tape reels
            [-18, 18].forEach(xOff => {
                ctx.save();
                ctx.translate(xOff, -15 + bob);
                ctx.rotate(reelRot);
                ctx.fillStyle = '#fbf8ee';
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Spokes
                ctx.strokeStyle = '#163323';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
                ctx.moveTo(0, -14); ctx.lineTo(0, 14);
                ctx.stroke();
                // Center hub
                ctx.fillStyle = '#c45126';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            // 4. Punch-tape connection between reels
            ctx.strokeStyle = '#c45126';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-18, -1 + bob);
            ctx.lineTo(18, -1 + bob);
            ctx.stroke();

            // 5. Heavy iron chest plate stamped with FIFO
            ctx.fillStyle = '#163323';
            ctx.fillRect(-26, 12 + bob, 52, 22);
            ctx.fillStyle = '#fbf8ee';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('FIFO', 0, 23 + bob);

            // 6. Monolith Head & Steadfast Eyes
            ctx.fillStyle = isFlashing ? '#ffffff' : '#c8bea8';
            ctx.fillRect(-20, -54 + bob, 40, 14);
            ctx.strokeRect(-20, -54 + bob, 40, 14);
            // Steady red rectangular eyes
            ctx.fillStyle = '#c45126';
            ctx.fillRect(-12, -49 + bob, 8, 4);
            ctx.fillRect(4, -49 + bob, 8, 4);
        }

        // =====================================================================
        // BOSS 2: SJF — The Speed Demon
        // =====================================================================
        drawSpeedDemon(ctx, isFlashing) {
            const hover = Math.sin(this.animTimer * 4.5) * 4;
            const wingAngle = Math.sin(this.animTimer * 8) * 0.15;

            // 1. Aerodynamic Wings (swept back)
            ctx.save();
            ctx.rotate(wingAngle);
            ctx.fillStyle = isFlashing ? '#ffffff' : '#b2c494';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2;
            // Left wing
            ctx.beginPath();
            ctx.moveTo(-20, -10 + hover);
            ctx.lineTo(-46, -30 + hover);
            ctx.lineTo(-30, 20 + hover);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Right wing
            ctx.beginPath();
            ctx.moveTo(20, -10 + hover);
            ctx.lineTo(46, -30 + hover);
            ctx.lineTo(30, 20 + hover);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();

            // 2. Streamlined Main Core Body
            ctx.fillStyle = isFlashing ? '#ffffff' : '#5d6d39';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, -42 + hover);
            ctx.lineTo(26, -6 + hover);
            ctx.lineTo(18, 38 + hover);
            ctx.lineTo(-18, 38 + hover);
            ctx.lineTo(-26, -6 + hover);
            ctx.closePath();
            ctx.fill(); ctx.stroke();

            // 3. Caliper Gauge Visor (Burst Meter)
            ctx.fillStyle = '#163323';
            ctx.beginPath();
            ctx.ellipse(0, -16 + hover, 18, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            // Visor line & diode
            ctx.strokeStyle = '#d49b29';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-14, -16 + hover);
            ctx.lineTo(14, -16 + hover);
            ctx.stroke();
            ctx.fillStyle = '#c45126';
            ctx.beginPath();
            ctx.arc(0, -16 + hover, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // 4. Burst length indicator plate
            ctx.fillStyle = '#fdfbf5';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 1.5;
            ctx.fillRect(-16, 6 + hover, 32, 16);
            ctx.strokeRect(-16, 6 + hover, 32, 16);
            ctx.fillStyle = '#5d6d39';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('MIN(B)', 0, 14 + hover);

            // 5. Swept exhaust fins (twin jet points)
            ctx.fillStyle = '#c45126';
            ctx.beginPath();
            ctx.moveTo(-12, 38 + hover);
            ctx.lineTo(-18, 50 + hover);
            ctx.lineTo(-4, 42 + hover);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(12, 38 + hover);
            ctx.lineTo(18, 50 + hover);
            ctx.lineTo(4, 42 + hover);
            ctx.fill();
        }

        // =====================================================================
        // BOSS 3: Round Robin — The Time Wizard
        // =====================================================================
        drawTimeWizard(ctx, isFlashing) {
            const hover = Math.sin(this.animTimer * 3) * 3;
            const dialAngle = this.animTimer * 1.8;

            // 1. Rotating Quantum Chronometer Ring (Astrolabe)
            ctx.save();
            ctx.translate(0, -4 + hover);
            ctx.rotate(dialAngle);
            ctx.lineWidth = 4;
            // 4 quadrant colors
            ctx.strokeStyle = '#c45126';
            ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 0.5); ctx.stroke();
            ctx.strokeStyle = '#5d6d39';
            ctx.beginPath(); ctx.arc(0, 0, 42, Math.PI * 0.5, Math.PI); ctx.stroke();
            ctx.strokeStyle = '#d49b29';
            ctx.beginPath(); ctx.arc(0, 0, 42, Math.PI, Math.PI * 1.5); ctx.stroke();
            ctx.strokeStyle = '#163323';
            ctx.beginPath(); ctx.arc(0, 0, 42, Math.PI * 1.5, Math.PI * 2); ctx.stroke();
            // Outer dial rim
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 46, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // 2. Wizard Robes (Forest green with rotating queue motifs)
            ctx.fillStyle = isFlashing ? '#ffffff' : '#1e3d2b';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-20, -12 + hover);
            ctx.lineTo(20, -12 + hover);
            ctx.lineTo(28, 42 + hover);
            ctx.lineTo(-28, 42 + hover);
            ctx.closePath();
            ctx.fill(); ctx.stroke();

            // Robe central trim
            ctx.fillStyle = '#d49b29';
            ctx.fillRect(-4, -10 + hover, 8, 50);

            // 3. Chronomancer Head & Hat
            ctx.fillStyle = '#163323';
            ctx.beginPath();
            ctx.moveTo(-18, -20 + hover);
            ctx.lineTo(0, -50 + hover);
            ctx.lineTo(18, -20 + hover);
            ctx.closePath();
            ctx.fill(); ctx.stroke();

            // Mask visage
            ctx.fillStyle = '#fbf8ee';
            ctx.beginPath();
            ctx.arc(0, -14 + hover, 13, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();

            // Goggles
            ctx.fillStyle = '#c45126';
            ctx.beginPath();
            ctx.arc(-5, -15 + hover, 3.5, 0, Math.PI * 2);
            ctx.arc(5, -15 + hover, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // 4. Pendulum wand in hand
            const wandAngle = Math.sin(this.animTimer * 4) * 0.4;
            ctx.save();
            ctx.translate(-26, 8 + hover);
            ctx.rotate(wandAngle);
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(0, 20);
            ctx.stroke();
            ctx.fillStyle = '#d49b29';
            ctx.beginPath();
            ctx.arc(0, 20, 6, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // =====================================================================
        // BOSS 4: Priority Scheduling — The Priority King
        // =====================================================================
        drawPriorityKing(ctx, isFlashing) {
            const hover = Math.sin(this.animTimer * 2) * 2.5;

            // 1. Royal Mainframe Mantle Robes
            ctx.fillStyle = isFlashing ? '#ffffff' : '#d49b29';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-28, -14 + hover);
            ctx.lineTo(28, -14 + hover);
            ctx.lineTo(38, 45 + hover);
            ctx.lineTo(-38, 45 + hover);
            ctx.closePath();
            ctx.fill(); ctx.stroke();

            // 2. Ermine Collar with Circuit Address Points
            ctx.fillStyle = '#fbf8ee';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2;
            ctx.fillRect(-26, -14 + hover, 52, 16);
            ctx.strokeRect(-26, -14 + hover, 52, 16);
            // Black address points
            ctx.fillStyle = '#163323';
            [-16, 0, 16].forEach(x => {
                ctx.beginPath();
                ctx.arc(x, -6 + hover, 2.5, 0, Math.PI * 2);
                ctx.fill();
            });

            // 3. Royal Chest Insignia: PRIO
            ctx.fillStyle = '#163323';
            ctx.fillRect(-18, 12 + hover, 36, 18);
            ctx.fillStyle = '#fbf8ee';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PRIO', 0, 21 + hover);

            // 4. Sovereign Head & Tiered Register Crown
            ctx.fillStyle = isFlashing ? '#ffffff' : '#e5dcc8';
            ctx.fillRect(-16, -32 + hover, 32, 18);
            ctx.strokeRect(-16, -32 + hover, 32, 18);
            // Crown
            ctx.fillStyle = '#c45126';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-20, -32 + hover);
            ctx.lineTo(-14, -48 + hover);
            ctx.lineTo(-5, -38 + hover);
            ctx.lineTo(0, -52 + hover);
            ctx.lineTo(5, -38 + hover);
            ctx.lineTo(14, -48 + hover);
            ctx.lineTo(20, -32 + hover);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Crown Jewel
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, -42 + hover, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 5. Gilded Priority Scepter in Right Hand
            ctx.save();
            ctx.translate(34, hover);
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -25);
            ctx.lineTo(0, 42);
            ctx.stroke();
            // Scepter Orb
            ctx.fillStyle = '#d49b29';
            ctx.beginPath();
            ctx.arc(0, -25, 10, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#163323';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('#0', 0, -25);
            ctx.restore();
        }
    }

    const api = {
        Boss
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.ArcadeGame = window.ArcadeGame || {};
        window.ArcadeGame.boss = api;
    }
})();
