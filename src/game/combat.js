/**
 * Scheduler Arcade — Combat, Projectiles, and Collision Engine
 * 
 * Manages player burst packets, boss hazard projectiles,
 * axis-aligned bounding box (AABB) collisions, single-hit enforcement,
 * and warm editorial particle effects.
 */

(function () {
    'use strict';

    /**
     * Particle effect for restrained arcade impacts.
     */
    class Particle {
        constructor(x, y, vx, vy, color, size, life) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.color = color;
            this.size = size;
            this.maxLife = life;
            this.life = life;
        }

        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.life -= dt;
            this.size = Math.max(0.5, this.size * 0.95);
        }

        draw(ctx) {
            if (this.life <= 0) return;
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Projectile entity representing attacks.
     */
    class Projectile {
        constructor(options) {
            this.x = options.x || 0;
            this.y = options.y || 0;
            this.vx = options.vx || 0;
            this.vy = options.vy || 0;
            this.width = options.width || 12;
            this.height = options.height || 12;
            this.damage = options.damage !== undefined ? options.damage : 10;
            this.isPlayer = Boolean(options.isPlayer);
            this.isDispatchAttack = Boolean(options.isDispatchAttack);
            this.pid = options.pid || null;
            this.type = options.type || 'burst';
            this.color = options.color || '#c45126';
            this.active = true;
            this.life = options.life || 3.0; // Seconds before self-expiration
        }

        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.life -= dt;
            if (this.life <= 0) {
                this.active = false;
            }
        }

        getBounds() {
            return {
                x: this.x - this.width / 2,
                y: this.y - this.height / 2,
                width: this.width,
                height: this.height
            };
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);

            if (this.isPlayer) {
                if (this.type === 'dispatch-packet') {
                    // High-energy Dispatch Energy Packet with PID label & thruster trail
                    ctx.fillStyle = '#c45126';
                    ctx.strokeStyle = '#163323';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    if (typeof ctx.roundRect === 'function') {
                        ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 3);
                    } else {
                        ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
                    }
                    ctx.fill();
                    ctx.stroke();

                    // Golden central accelerator core
                    ctx.fillStyle = '#d49b29';
                    ctx.fillRect(-this.width / 2 + 3, -2, this.width - 6, 4);

                    // Process PID text badge
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(this.pid || 'EXEC', 0, 0);

                    // Trailing energy thruster exhaust
                    ctx.fillStyle = '#f5b041';
                    ctx.beginPath();
                    ctx.moveTo(-this.width / 2, -4);
                    ctx.lineTo(-this.width / 2 - 8, 0);
                    ctx.lineTo(-this.width / 2, 4);
                    ctx.closePath();
                    ctx.fill();
                } else if (this.type === 'diagnostic') {
                    // Diagnostic / Deflection packet
                    ctx.fillStyle = '#d49b29';
                    ctx.strokeStyle = '#163323';
                    ctx.lineWidth = 1.2;
                    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
                    ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

                    ctx.fillStyle = '#163323';
                    ctx.font = 'bold 7px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Z', 0, 0);
                } else {
                    // Standard fallback player burst packet
                    ctx.fillStyle = '#c45126';
                    ctx.strokeStyle = '#163323';
                    ctx.lineWidth = 1.5;
                    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
                    ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

                    // Small center core
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-2, -2, 4, 4);
                }
            } else {
                // Boss Hazard Projectiles
                if (this.type === 'fcfs-boulder') {
                    // FIFO stone block
                    ctx.fillStyle = '#7a756b';
                    ctx.strokeStyle = '#163323';
                    ctx.lineWidth = 2;
                    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
                    ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
                    ctx.fillStyle = '#fbf8ee';
                    ctx.font = 'bold 8px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('FIFO', 0, 0);
                } else if (this.type === 'sjf-needle') {
                    // Speed Demon burst needle
                    ctx.fillStyle = '#5d6d39';
                    ctx.strokeStyle = '#163323';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(this.width / 2, 0);
                    ctx.lineTo(-this.width / 2, -this.height / 2);
                    ctx.lineTo(-this.width / 2 + 4, 0);
                    ctx.lineTo(-this.width / 2, this.height / 2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                } else if (this.type === 'rr-ring') {
                    // Time Wizard quantum ring
                    ctx.strokeStyle = '#c45126';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = '#163323';
                    ctx.beginPath();
                    ctx.arc(0, 0, 3, 0, Math.PI * 2);
                    ctx.fill();
                } else if (this.type === 'priority-seal') {
                    // Priority King gilded seal
                    ctx.fillStyle = '#d49b29';
                    ctx.strokeStyle = '#163323';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = '#163323';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('#0', 0, 0);
                } else {
                    // Generic fallback projectile
                    ctx.fillStyle = this.color;
                    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
                }
            }

            ctx.restore();
        }
    }

    /**
     * Checks AABB intersection between two bounding boxes.
     */
    function checkAABB(b1, b2) {
        return (
            b1.x < b2.x + b2.width &&
            b1.x + b1.width > b2.x &&
            b1.y < b2.y + b2.height &&
            b1.y + b1.height > b2.y
        );
    }

    /**
     * Spawns a radial burst of impact particles.
     */
    function spawnImpactParticles(particlesArray, x, y, color = '#c45126', count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = 60 + Math.random() * 120;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 2 + Math.random() * 2.5;
            const life = 0.25 + Math.random() * 0.25;
            particlesArray.push(new Particle(x, y, vx, vy, color, size, life));
        }
    }

    const api = {
        Particle,
        Projectile,
        checkAABB,
        spawnImpactParticles
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.ArcadeGame = window.ArcadeGame || {};
        window.ArcadeGame.combat = api;
    }
})();
