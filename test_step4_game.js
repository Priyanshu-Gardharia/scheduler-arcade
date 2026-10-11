/**
 * Scheduler Arcade — Step 4 Automated Game Engine Test Suite
 * 
 * Verifies 2D physics, combat, collision detection, attack cooldowns,
 * boss configurations, and game state transitions.
 */

const fs = require('fs');
const path = require('path');

const { Particle, Projectile, checkAABB, spawnImpactParticles } = require('./src/game/combat');
const { Player } = require('./src/game/player');
const { Boss } = require('./src/game/boss');
const { GameEngine } = require('./src/game/engine');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        failedTests++;
        console.error(`  FAIL: ${message}`);
        throw new Error(message);
    } else {
        passedTests++;
    }
}

function assertEqual(actual, expected, message) {
    totalTests++;
    if (actual !== expected) {
        failedTests++;
        const err = `${message} — Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
        console.error(`  FAIL: ${err}`);
        throw new Error(err);
    } else {
        passedTests++;
    }
}

console.log('====================================================');
console.log('   STEP 4 — 2D GAME ENGINE & COMBAT TEST SUITE      ');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Projectile & Collision Detection (AABB)
// -----------------------------------------------------------------------------
console.log('▶ Test 1: Combat & Collision Detection (AABB)');
{
    const b1 = { x: 50, y: 50, width: 20, height: 20 };
    const b2 = { x: 60, y: 60, width: 20, height: 20 };
    const b3 = { x: 100, y: 100, width: 20, height: 20 };

    assert(checkAABB(b1, b2), 'Overlapping boxes must collide');
    assert(!checkAABB(b1, b3), 'Separated boxes must not collide');

    const proj = new Projectile({ x: 100, y: 200, vx: 300, vy: 0, damage: 15, isPlayer: true });
    assertEqual(proj.x, 100, 'Initial projectile X');
    assertEqual(proj.active, true, 'Projectile is initially active');

    // Update with dt = 0.5s
    proj.update(0.5);
    assertEqual(proj.x, 250, 'Projectile moved 150px at 300px/s for 0.5s');

    // Deactivation
    proj.life = 0;
    proj.update(0.1);
    assertEqual(proj.active, false, 'Expired projectile becomes inactive');
}

// -----------------------------------------------------------------------------
// Test 2: Player Movement, Ground Clamping & Jump Physics
// -----------------------------------------------------------------------------
console.log('▶ Test 2: Player Physics & Ground Clamping');
{
    const groundY = 415;
    const player = new Player(100, groundY - 48);
    assertEqual(player.y, groundY - 48, 'Player starts standing on ground');

    // Move right for 0.2s
    player.update(0.2, { right: true }, groundY, 960, [], []);
    assert(player.x > 100, 'Player moves right when right input is true');
    assertEqual(player.facing, 1, 'Player faces right');

    // Jump
    player.update(0.1, { jump: true }, groundY, 960, [], []);
    assert(!player.isGrounded, 'Player is airborne after jumping');
    assert(player.vy < 0, 'Player has upward vertical velocity on jump');

    // Simulate falling back down over 1.0s
    for (let i = 0; i < 20; i++) {
        player.update(0.05, {}, groundY, 960, [], []);
    }
    assertEqual(player.y, groundY - player.height, 'Player is clamped cleanly to ground');
    assertEqual(player.isGrounded, true, 'Player is grounded again');
    assertEqual(player.vy, 0, 'Vertical velocity zeroed on landing');
}

// -----------------------------------------------------------------------------
// Test 3: Player Attack Cooldown & Burst Packets
// -----------------------------------------------------------------------------
console.log('▶ Test 3: Attack Cooldown & Burst Packet Generation');
{
    const groundY = 415;
    const player = new Player(100, groundY - 48);
    const projectiles = [];
    const particles = [];

    // First attack
    player.update(0.05, { attack: true }, groundY, 960, projectiles, particles);
    assertEqual(projectiles.length, 1, 'First attack fires exactly one projectile');
    assert(player.attackCooldown > 0, 'Attack cooldown is activated');

    // Immediate second attack attempt within cooldown
    player.update(0.05, { attack: true }, groundY, 960, projectiles, particles);
    assertEqual(projectiles.length, 1, 'Attack within cooldown must NOT fire additional projectile');

    // Advance time past cooldown duration (~0.28s)
    player.update(0.3, {}, groundY, 960, projectiles, particles);
    assertEqual(player.attackCooldown, 0, 'Cooldown expires after elapsed time');

    // Third attack should now succeed
    player.update(0.05, { attack: true }, groundY, 960, projectiles, particles);
    assertEqual(projectiles.length, 2, 'Attack fires again once cooldown has cleared');
}

// -----------------------------------------------------------------------------
// Test 4: Player Damage & Invulnerability Frames (i-frames)
// -----------------------------------------------------------------------------
console.log('▶ Test 4: Player Damage & Invulnerability Frames');
{
    const player = new Player(100, 300);
    assertEqual(player.health, 100, 'Initial player health is 100');

    // Take 20 damage
    const hit1 = player.takeDamage(20, []);
    assertEqual(hit1, true, 'First hit accepted');
    assertEqual(player.health, 80, 'Player health reduced to 80');
    assert(player.invulnerabilityTimer > 0, 'Invulnerability timer is active');

    // Immediate second hit attempt during i-frames
    const hit2 = player.takeDamage(20, []);
    assertEqual(hit2, false, 'Hit during i-frames ignored');
    assertEqual(player.health, 80, 'Player health protected by i-frames');

    // Advance time past i-frames duration
    player.invulnerabilityTimer = 0;
    const hit3 = player.takeDamage(30, []);
    assertEqual(hit3, true, 'Hit accepted after i-frames expire');
    assertEqual(player.health, 50, 'Health reduced to 50');
}

// -----------------------------------------------------------------------------
// Test 5: Four Distinct Bosses
// -----------------------------------------------------------------------------
console.log('▶ Test 5: Four Distinct Bosses Configuration');
{
    const boss = new Boss('fcfs', 700, 300);
    const bossList = ['fcfs', 'sjf', 'rr', 'priority'];

    bossList.forEach(id => {
        boss.configureBoss(id);
        assertEqual(boss.bossId, id, `Boss id is ${id}`);
        assert(boss.name.length > 0, `Boss ${id} has name: ${boss.name}`);
        assertEqual(boss.health, 100, `Boss ${id} has 100 health`);
        assert(boss.width > 70 && boss.height > 80, `Boss ${id} has valid dimensions`);
    });

    // Boss damage test
    boss.takeDamage(25, []);
    assertEqual(boss.health, 75, 'Boss health reduced to 75');
    assert(boss.hitFlashTimer > 0, 'Boss hit flash timer activated');
}

// -----------------------------------------------------------------------------
// Test 6: Boss AI Attack Generation
// -----------------------------------------------------------------------------
console.log('▶ Test 6: Boss AI Attack Pattern Generation');
{
    const boss = new Boss('fcfs', 700, 300);
    const projectiles = [];
    const particles = [];

    // Force attack timer to expire
    boss.attackTimer = 0;
    boss.update(0.1, 100, 360, 415, projectiles, particles);

    assertEqual(projectiles.length, 1, 'Boss fires hazard projectile on attack interval');
    assertEqual(projectiles[0].isPlayer, false, 'Boss projectile marked isPlayer: false');
    assertEqual(projectiles[0].type, 'fcfs-boulder', 'FCFS boss fires fcfs-boulder');
    assert(projectiles[0].vx < 0, 'Boss projectile travels towards player (negative vx)');
}

// -----------------------------------------------------------------------------
// Test 7: Game Engine State Machine & Level Transitions
// -----------------------------------------------------------------------------
console.log('▶ Test 7: Game Engine State Machine & Overlays');
{
    // Mock minimal DOM for headless test
    global.document = {
        getElementById: (id) => ({
            id,
            style: {},
            textContent: '',
            classList: { add: ()=>{}, remove: ()=>{} },
            setAttribute: ()=>{},
            focus: ()=>{}
        }),
        querySelectorAll: () => []
    };

    const engine = new GameEngine();
    const mockCanvas = {
        getContext: () => ({
            save: ()=>{}, restore: ()=>{}, translate: ()=>{}, scale: ()=>{},
            fillRect: ()=>{}, strokeRect: ()=>{}, beginPath: ()=>{}, roundRect: ()=>{},
            moveTo: ()=>{}, lineTo: ()=>{}, closePath: ()=>{}, stroke: ()=>{}, fill: ()=>{},
            arc: ()=>{}, ellipse: ()=>{}, fillText: ()=>{}, setLineDash: ()=>{}, clip: ()=>{}
        }),
        width: 960,
        height: 480
    };

    engine.init(mockCanvas);
    assertEqual(engine.width, 960, 'Engine width is 960');
    assertEqual(engine.height, 480, 'Engine height is 480');

    // Start each of the 4 boss levels
    ['fcfs', 'sjf', 'rr', 'priority'].forEach(bId => {
        engine.startLevel(bId);
        assertEqual(engine.currentBossId, bId, `Level started for ${bId}`);
        assertEqual(engine.state, 'ready', 'Engine enters ready state on level start');
        assertEqual(engine.player.health, 100, 'Player health reset to 100');
        assertEqual(engine.boss.health, 100, 'Boss health reset to 100');
    });

    // Ready -> Playing
    engine.resumeGame();
    assertEqual(engine.state, 'playing', 'Engine transitions to playing state');

    // Playing -> Paused
    engine.pauseGame();
    assertEqual(engine.state, 'paused', 'Engine transitions to paused state');

    // Paused -> Playing
    engine.resumeGame();
    assertEqual(engine.state, 'playing', 'Engine resumes playing state');

    // Victory transition
    engine.boss.health = 0;
    engine.triggerVictory();
    assertEqual(engine.state, 'victory', 'Engine transitions to victory state on boss defeat');

    // Game over transition
    engine.player.health = 0;
    engine.triggerGameOver();
    assertEqual(engine.state, 'gameover', 'Engine transitions to gameover state on player death');

    // Stop engine
    engine.stop();
    assertEqual(engine.isRunning, false, 'Engine stopped cleanly');
}

// -----------------------------------------------------------------------------
// Test 8: HTML and Navigation Integrity for Step 4
// -----------------------------------------------------------------------------
console.log('▶ Test 8: HTML and Script Integrity for Game Arena');
{
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

    assert(html.includes('id="screen-game"'), 'index.html includes #screen-game');
    assert(html.includes('id="game-canvas"'), 'index.html includes #game-canvas');
    assert(html.includes('id="btn-start-level"'), 'index.html includes #btn-start-level');
    assert(html.includes('id="btn-exit-game"'), 'index.html includes #btn-exit-game');
    assert(html.includes('id="btn-pause-game"'), 'index.html includes #btn-pause-game');
    assert(html.includes('id="hud-boss-hp-bar"'), 'index.html includes boss health bar');
    assert(html.includes('id="hud-player-hp-bar"'), 'index.html includes player health bar');
    assert(html.includes('id="hud-score-val"'), 'index.html includes score display');
    assert(html.includes('id="game-overlay"'), 'index.html includes game state overlay');

    assert(html.includes('src="src/game/combat.js"'), 'index.html loads combat.js');
    assert(html.includes('src="src/game/player.js"'), 'index.html loads player.js');
    assert(html.includes('src="src/game/boss.js"'), 'index.html loads boss.js');
    assert(html.includes('src="src/game/engine.js"'), 'index.html loads engine.js');
}

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} assertions passed, ${failedTests} failed.`);
console.log('STATUS: ' + (failedTests === 0 ? 'ALL STEP 4 GAME TESTS PASSED! ✓' : 'FAILURES DETECTED! ✗'));
console.log('====================================================');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
