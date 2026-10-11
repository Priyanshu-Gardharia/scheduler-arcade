/**
 * Scheduler Arcade — Player Character Entity
 * 
 * Implements the "Kernel Operator":
 * - Physics: Left/right run, jump, gravity, ground clamping.
 * - Combat: Energy burst projectile firing with cooldown.
 * - Visual: Original 2D vector canvas rendering with run/jump/attack animations.
 * - Defense: Damage handling with invulnerability frames (i-frames).
 */

(function () {
    'use strict';

    const combatApi = typeof require !== 'undefined' 
        ? require('./combat') 
        : (window.ArcadeGame ? window.ArcadeGame.combat : null);

    const { Projectile, spawnImpactParticles } = combatApi || {};

    class Player {
        constructor(x = 100, y = 350) {
            this.x = x;
            this.y = y;
            this.width = 34;
            this.height = 48;
            this.vx = 0;
            this.vy = 0;

            // Physics constants
            this.moveSpeed = 260;
            this.jumpForce = -470;
            this.gravity = 1100;
            this.isGrounded = false;
            this.facing = 1; // 1 = right, -1 = left

            // Combat stats
            this.maxHealth = 100;
            this.health = 100;
            this.attackCooldown = 0;
            this.attackCooldownDuration = 0.28; // ~280ms cooldown
            this.invulnerabilityTimer = 0;
            this.invulnerabilityDuration = 0.85; // 850ms i-frames

            // Animation state
            this.animTimer = 0;
            this.isAttacking = false;
            this.attackVisualTimer = 0;
            this.recoilOffset = 0;
            this.dispatchPid = null;
        }

        reset(x = 100, y = 350) {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.isGrounded = false;
            this.facing = 1;
            this.health = this.maxHealth;
            this.attackCooldown = 0;
            this.invulnerabilityTimer = 0;
            this.animTimer = 0;
            this.isAttacking = false;
            this.attackVisualTimer = 0;
            this.recoilOffset = 0;
            this.dispatchPid = null;
        }

        update(dt, inputState, groundY, arenaWidth, projectilesList, particlesList) {
            this.animTimer += dt;

            // Recoil recovery
            if (this.recoilOffset < 0) {
                this.recoilOffset = Math.min(0, this.recoilOffset + dt * 45);
            }

            // Decrement timers
            if (this.attackCooldown > 0) {
                this.attackCooldown = Math.max(0, this.attackCooldown - dt);
            }
            if (this.invulnerabilityTimer > 0) {
                this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
            }
            if (this.attackVisualTimer > 0) {
                this.attackVisualTimer = Math.max(0, this.attackVisualTimer - dt);
                if (this.attackVisualTimer === 0) {
                    this.isAttacking = false;
                    this.dispatchPid = null;
                }
            }

            // 1. Horizontal Movement
            let moveDir = 0;
            if (inputState.left) moveDir -= 1;
            if (inputState.right) moveDir += 1;

            if (moveDir !== 0) {
                this.vx = moveDir * this.moveSpeed;
                this.facing = moveDir;
            } else {
                this.vx = 0;
            }

            // 2. Jumping
            if (inputState.jump && this.isGrounded) {
                this.vy = this.jumpForce;
                this.isGrounded = false;
                if (particlesList) {
                    // Small jump dust
                    spawnImpactParticles(particlesList, this.x + this.width / 2, this.y + this.height, '#e5dcc8', 4);
                }
            }

            // 3. Gravity
            this.vy += this.gravity * dt;

            // Apply positions
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // 4. Ground Collision
            if (this.y + this.height >= groundY) {
                this.y = groundY - this.height;
                this.vy = 0;
                this.isGrounded = true;
            } else {
                this.isGrounded = false;
            }

            // 5. Arena Bounds
            if (this.x < 10) this.x = 10;
            if (this.x + this.width > arenaWidth - 10) this.x = arenaWidth - 10 - this.width;

            // 6. Attack handling
            if (inputState.attack && this.attackCooldown <= 0) {
                this.fireAttack(projectilesList, particlesList);
            }
        }

        fireAttack(projectilesList, particlesList) {
            this.attackCooldown = this.attackCooldownDuration;
            this.isAttacking = true;
            this.attackVisualTimer = 0.18;
            this.recoilOffset = -4;
            this.dispatchPid = null;

            const projX = this.facing > 0 ? this.x + this.width + 6 : this.x - 6;
            const projY = this.y + 22;
            const projVx = this.facing * 520;

            if (projectilesList) {
                projectilesList.push(new Projectile({
                    x: projX,
                    y: projY,
                    vx: projVx,
                    vy: 0,
                    width: 14,
                    height: 10,
                    damage: 0, // Diagnostic deflect packet deals 0 damage to boss
                    isPlayer: true,
                    isDiagnostic: true,
                    type: 'diagnostic',
                    color: '#d49b29'
                }));
            }

            if (particlesList) {
                // Diagnostic zap spark
                spawnImpactParticles(particlesList, projX, projY, '#d49b29', 5);
            }
        }

        /**
         * Triggers the main CPU dispatch attack when a correct scheduling decision is made.
         * Visually fires a high-energy dispatch packet labeled with the PID directly at the boss.
         */
        triggerDispatchAttack(pid, duration, projectilesList, particlesList) {
            this.facing = 1; // Always face the boss
            this.isAttacking = true;
            this.attackVisualTimer = 0.45; // 450ms sustained arcade firing pose
            this.recoilOffset = -10; // Kickback recoil
            this.dispatchPid = pid;

            const projX = this.x + this.width + 12;
            const projY = this.y + 20;

            if (projectilesList) {
                projectilesList.push(new Projectile({
                    x: projX,
                    y: projY,
                    vx: 760, // Fast arcade projectile velocity
                    vy: 0,
                    width: 32,
                    height: 20,
                    damage: 0, // Boss health is tied directly to completed scheduling work
                    isPlayer: true,
                    isDispatchAttack: true,
                    type: 'dispatch-packet',
                    pid: pid,
                    color: '#c45126'
                }));
            }

            if (particlesList) {
                // Charged muzzle blast particles
                spawnImpactParticles(particlesList, projX, projY, '#d49b29', 8);
                spawnImpactParticles(particlesList, projX, projY, '#c45126', 6);
            }
        }

        takeDamage(amount, particlesList) {
            if (this.invulnerabilityTimer > 0 || this.health <= 0) {
                return false;
            }

            this.health = Math.max(0, this.health - amount);
            this.invulnerabilityTimer = this.invulnerabilityDuration;

            if (particlesList) {
                spawnImpactParticles(particlesList, this.x + this.width / 2, this.y + this.height / 2, '#c45126', 12);
            }
            return true;
        }

        getBounds() {
            return {
                x: this.x + 4,
                y: this.y + 4,
                width: this.width - 8,
                height: this.height - 4
            };
        }

        draw(ctx) {
            // Invulnerability flashing effect (blinks when taking damage)
            if (this.invulnerabilityTimer > 0) {
                if (Math.floor(this.animTimer * 24) % 2 === 0) {
                    return; // Skip frame for blink
                }
            }

            ctx.save();
            ctx.translate(this.x + this.width / 2 + this.recoilOffset, this.y);

            // Flip according to facing direction
            if (this.facing < 0) {
                ctx.scale(-1, 1);
            }

            const isMoving = Math.abs(this.vx) > 0 && this.isGrounded;
            const walkBob = isMoving ? Math.sin(this.animTimer * 16) * 2 : 0;
            const legOffset = isMoving ? Math.sin(this.animTimer * 16) * 5 : 0;

            // 1. Legs (tactile forest green with dark boots)
            ctx.fillStyle = '#163323';
            if (this.isGrounded) {
                // Left leg
                ctx.fillRect(-10, 32 + walkBob, 6, 16 - legOffset);
                // Right leg
                ctx.fillRect(4, 32 + walkBob, 6, 16 + legOffset);
            } else {
                // Tucked in air
                ctx.fillRect(-10, 30, 6, 12);
                ctx.fillRect(4, 32, 6, 10);
            }

            // 2. Torso / Suit (Forest Green with terracotta belt)
            ctx.fillStyle = '#1f3d2c';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 1.8;
            ctx.fillRect(-12, 14 + walkBob, 24, 20);
            ctx.strokeRect(-12, 14 + walkBob, 24, 20);

            // Terracotta utility belt
            ctx.fillStyle = '#c45126';
            ctx.fillRect(-12, 30 + walkBob, 24, 4);

            // Central process badge
            ctx.fillStyle = '#d49b29';
            ctx.fillRect(-3, 19 + walkBob, 6, 6);

            // 3. Head & Helmet (Ivory helmet with visor)
            ctx.fillStyle = '#fbf8ee';
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(-11, walkBob, 22, 16, 4);
            } else {
                ctx.rect(-11, walkBob, 22, 16);
            }
            ctx.fill();
            ctx.stroke();

            // Visor (Terracotta)
            ctx.fillStyle = '#c45126';
            ctx.fillRect(0, 4 + walkBob, 10, 6);

            // Antenna beacon on helmet
            ctx.strokeStyle = '#163323';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, walkBob);
            ctx.lineTo(0, -6 + walkBob);
            ctx.stroke();
            // Blinking beacon tip
            ctx.fillStyle = Math.floor(this.animTimer * 4) % 2 === 0 ? '#d49b29' : '#c45126';
            ctx.beginPath();
            ctx.arc(0, -6 + walkBob, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 4. Arms & Dispatch Blaster
            if (this.isAttacking) {
                // Charged Dispatch Blaster aimed at boss
                ctx.fillStyle = '#163323';
                ctx.fillRect(4, 17 + walkBob, 18, 7);
                ctx.strokeStyle = '#163323';
                ctx.strokeRect(4, 17 + walkBob, 18, 7);

                // Blaster energy capacitor ring
                ctx.fillStyle = '#d49b29';
                ctx.fillRect(10, 15 + walkBob, 6, 11);

                // Blaster muzzle tip
                ctx.fillStyle = '#c45126';
                ctx.fillRect(20, 16 + walkBob, 4, 9);

                // Muzzle energy flare
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(24, 18 + walkBob, 3, 5);

                // Floating tactical PID callout badge above helmet if dispatching
                if (this.dispatchPid) {
                    ctx.fillStyle = '#163323';
                    ctx.fillRect(-18, -22 + walkBob, 36, 13);
                    ctx.strokeStyle = '#d49b29';
                    ctx.lineWidth = 1.2;
                    ctx.strokeRect(-18, -22 + walkBob, 36, 13);

                    ctx.fillStyle = '#fbf8ee';
                    ctx.font = 'bold 8px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`EXEC:${this.dispatchPid}`, 0, -15 + walkBob);
                }
            } else {
                // Idle / running arm swing
                ctx.fillStyle = '#163323';
                ctx.fillRect(2 + (isMoving ? legOffset * 0.4 : 0), 18 + walkBob, 6, 12);
            }

            ctx.restore();
        }
    }

    const api = {
        Player
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.ArcadeGame = window.ArcadeGame || {};
        window.ArcadeGame.player = api;
    }
})();
