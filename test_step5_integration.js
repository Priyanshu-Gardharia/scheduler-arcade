/**
 * Scheduler Arcade — Step 5 Automated Integration Test Suite
 * 
 * Verifies real CPU scheduling integration with the 2D game engine:
 * 1. Workload configurations for all 4 bosses.
 * 2. StepSimulator algorithmic dispatch validation against src/core/.
 * 3. Valid and invalid process selections with educational feedback.
 * 4. Rejection of unarrived and already completed processes.
 * 5. Simultaneous arrivals and deterministic tie-breaking.
 * 6. CPU idle interval representation.
 * 7. Round Robin quantum slicing, queue rotation, and requeuing rules.
 * 8. Non-preemptive execution for SJF and Priority.
 * 9. Game engine dispatch handling, health rewards, and violation penalties.
 * 10. Pause, resume, and restart simulation consistency.
 * 11. Final calculated metrics and timeline match with core engine.
 * 12. Victory state only achieved upon full workload completion.
 */

const fs = require('fs');
const path = require('path');

const coreApi = require('./src/core/index');
const { WORKLOADS, getWorkloadForBoss } = require('./src/game/workloads');
const { StepSimulator } = require('./src/game/stepSimulator');
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
console.log('   STEP 5 — REAL SCHEDULING INTEGRATION TESTS       ');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Configurable Workloads for Each Boss
// -----------------------------------------------------------------------------
console.log('▶ Test 1: Configurable Process Workloads for All Four Bosses');
{
    const bossIds = ['fcfs', 'sjf', 'rr', 'priority'];
    bossIds.forEach(bId => {
        const config = getWorkloadForBoss(bId);
        assert(config !== null, `Workload exists for ${bId}`);
        assertEqual(config.bossId, bId, `Workload bossId matches ${bId}`);
        assert(Array.isArray(config.processes) && config.processes.length >= 3, `${bId} has at least 3 processes`);
        assert(typeof config.lesson === 'string' && config.lesson.length > 20, `${bId} has educational lesson`);

        config.processes.forEach(p => {
            assert(typeof p.pid === 'string' && p.pid.length > 0, `${bId} process has valid PID`);
            assert(typeof p.arrivalTime === 'number' && p.arrivalTime >= 0, `${bId} process has valid arrivalTime`);
            assert(typeof p.burstTime === 'number' && p.burstTime > 0, `${bId} process has valid positive burstTime`);
            if (bId === 'priority') {
                assert(typeof p.priority === 'number', `${bId} process has priority rank`);
            }
        });
    });

    // Check Round Robin specific quantum
    const rrConfig = getWorkloadForBoss('rr');
    assertEqual(rrConfig.quantum, 2, 'Round Robin configured with time quantum q=2');
}

// -----------------------------------------------------------------------------
// Test 2: FCFS Step-by-Step Simulation & Rule Validation
// -----------------------------------------------------------------------------
console.log('▶ Test 2: FCFS — Queue Titan Scheduling & Decision Validation');
{
    const sim = new StepSimulator();
    sim.init('fcfs');

    assertEqual(sim.currentTime, 0, 'FCFS starts at t=0');
    assertEqual(sim.isWaitingForDecision, true, 'FCFS awaits decision at t=0');

    // Eligible choices at t=0: only P1 has arrived
    const eligible = sim.getEligibleChoices();
    assertEqual(eligible.length, 1, 'Only P1 arrived at t=0');
    assertEqual(eligible[0].pid, 'P1', 'P1 is eligible at t=0');

    // Selecting an unarrived process (P2 arrives at t=1)
    const invalidUnarrived = sim.validateDecision('P2');
    assertEqual(invalidUnarrived.valid, false, 'Cannot select unarrived process P2');
    assertEqual(invalidUnarrived.error, 'NOT_ARRIVED', 'Error code is NOT_ARRIVED');
    assert(invalidUnarrived.message.includes('NOT arrived'), 'Educational explanation for unarrived process');

    // Selecting unknown PID
    const invalidUnknown = sim.validateDecision('P99');
    assertEqual(invalidUnknown.valid, false, 'Cannot select unknown process');

    // Selecting correct process P1
    const validChoice = sim.validateDecision('P1');
    assertEqual(validChoice.valid, true, 'P1 is valid FCFS choice');
    assert(validChoice.explanation.includes('FCFS'), 'Explanation mentions FCFS');

    // Execute step P1 (burst 6)
    const step1 = sim.step('P1');
    assertEqual(step1.executedPid, 'P1', 'Executed P1');
    assertEqual(step1.startTime, 0, 'P1 started at 0');
    assertEqual(step1.endTime, 6, 'P1 ended at 6');
    assertEqual(sim.currentTime, 6, 'Clock advanced to 6');

    // Process P1 is completed: cannot be selected again
    const invalidCompleted = sim.validateDecision('P1');
    assertEqual(invalidCompleted.valid, false, 'Completed process P1 cannot be selected again');
    assertEqual(invalidCompleted.error, 'ALREADY_COMPLETED', 'Error code is ALREADY_COMPLETED');

    // At t=6, processes P2 (arr:1), P3 (arr:2), P4 (arr:4) have all arrived.
    // Earliest arrival is P2. Selecting P3 should violate FCFS rule.
    const invalidRule = sim.validateDecision('P3');
    assertEqual(invalidRule.valid, false, 'Selecting P3 over P2 violates FCFS');
    assertEqual(invalidRule.error, 'RULE_VIOLATION', 'Error code is RULE_VIOLATION');
    assert(invalidRule.message.includes('Scheduling Violation'), 'Feedback explains FCFS arrival rule');

    // Step P2
    sim.step('P2');
    assertEqual(sim.currentTime, 8, 'Clock advanced to 8 after P2 (burst 2)');

    // Step P3
    sim.step('P3');
    assertEqual(sim.currentTime, 12, 'Clock advanced to 12 after P3 (burst 4)');

    // Step P4
    sim.step('P4');
    assertEqual(sim.currentTime, 15, 'Clock advanced to 15 after P4 (burst 3)');

    assertEqual(sim.isCompleted, true, 'FCFS workload is complete');
    assert(sim.finalMetrics !== null, 'Final metrics calculated');

    // Verify final metrics against src/core/fcfs.js
    const refResult = coreApi.schedule('fcfs', WORKLOADS.fcfs.processes);
    assertEqual(sim.finalMetrics.totalElapsedTime, refResult.totalElapsedTime, 'Total elapsed time matches core engine');
    assertEqual(sim.finalMetrics.averageWaitingTime, refResult.averageWaitingTime, 'Average waiting time matches core engine');
    assertEqual(sim.finalMetrics.averageTurnaroundTime, refResult.averageTurnaroundTime, 'Average turnaround time matches core engine');
    assertEqual(sim.finalMetrics.averageResponseTime, refResult.averageResponseTime, 'Average response time matches core engine');
}

// -----------------------------------------------------------------------------
// Test 3: SJF (Non-Preemptive) — Speed Demon Scheduling
// -----------------------------------------------------------------------------
console.log('▶ Test 3: Non-Preemptive SJF — Speed Demon Scheduling & Verification');
{
    const sim = new StepSimulator();
    sim.init('sjf');

    // Workload SJF:
    // P1: arr 0, burst 5
    // P2: arr 1, burst 2
    // P3: arr 2, burst 6
    // P4: arr 3, burst 3

    // At t=0, only P1 is ready -> must select P1
    assertEqual(sim.getCanonicalChoice().pid, 'P1', 'P1 is only arrived job at t=0');
    sim.step('P1');
    assertEqual(sim.currentTime, 5, 'Clock is 5 after P1');

    // At t=5, P2 (burst 2), P3 (burst 6), P4 (burst 3) are ready.
    // Shortest burst is P2 (2). Selecting P4 (3) should violate SJF.
    const invalidSJF = sim.validateDecision('P4');
    assertEqual(invalidSJF.valid, false, 'Selecting P4 violates SJF because P2 has shorter burst');
    assert(invalidSJF.message.includes('Shortest Job First'), 'Feedback cites SJF rule');

    // Dispatch P2
    sim.step('P2');
    assertEqual(sim.currentTime, 7, 'Clock is 7 after P2 (2ms)');

    // At t=7, remaining are P3 (burst 6) and P4 (burst 3).
    // Shortest is P4.
    assertEqual(sim.getCanonicalChoice().pid, 'P4', 'P4 has shorter burst than P3');
    sim.step('P4');
    assertEqual(sim.currentTime, 10, 'Clock is 10 after P4 (3ms)');

    // Dispatch P3
    sim.step('P3');
    assertEqual(sim.currentTime, 16, 'Clock is 16 after P3 (6ms)');
    assertEqual(sim.isCompleted, true, 'SJF workload completed');

    // Verify metrics against src/core/sjf.js
    const refSJF = coreApi.schedule('sjf', WORKLOADS.sjf.processes);
    assertEqual(sim.finalMetrics.averageWaitingTime, refSJF.averageWaitingTime, 'SJF average waiting time matches core engine');
    assertEqual(sim.finalMetrics.averageTurnaroundTime, refSJF.averageTurnaroundTime, 'SJF average turnaround time matches core engine');
}

// -----------------------------------------------------------------------------
// Test 4: Round Robin (q=2) — Time Wizard Scheduling & Queue Rotation
// -----------------------------------------------------------------------------
console.log('▶ Test 4: Round Robin — Time Wizard Queue Rotation & Time Slicing');
{
    const sim = new StepSimulator();
    sim.init('rr');

    // Workload RR:
    // P1: arr 0, burst 5
    // P2: arr 1, burst 3
    // P3: arr 2, burst 4
    // quantum = 2

    // At t=0: P1 is at head of queue
    assertEqual(sim.getCanonicalChoice().pid, 'P1', 'P1 at head of RR queue');
    const step1 = sim.step('P1');
    assertEqual(step1.duration, 2, 'P1 runs for quantum slice of 2ms');
    assertEqual(step1.remainingBurst, 3, 'P1 remaining burst is 3ms');
    assertEqual(sim.currentTime, 2, 'Clock advanced to 2ms');

    // At t=2, P2 (arr:1) and P3 (arr:2) arrived during slice.
    // OS Rule: new arrivals enter BEFORE preempted P1 is requeued!
    // Queue order should be: P2, P3, P1!
    const queuePids = sim.readyQueue.map(p => p.pid);
    assertEqual(queuePids[0], 'P2', 'P2 is at front of ready queue');
    assertEqual(queuePids[1], 'P3', 'P3 is second in ready queue');
    assertEqual(queuePids[2], 'P1', 'Preempted P1 is at tail of ready queue');

    // Step P2: runs for quantum 2 (burst 3 -> 1 remaining), clock becomes 4
    sim.step('P2');
    assertEqual(sim.currentTime, 4, 'Clock advanced to 4ms');

    // Step P3: runs for quantum 2 (burst 4 -> 2 remaining), clock becomes 6
    sim.step('P3');
    assertEqual(sim.currentTime, 6, 'Clock advanced to 6ms');

    // Now P1 is at head (remaining 3). Slices 2ms (remaining 1), clock becomes 8
    assertEqual(sim.getCanonicalChoice().pid, 'P1', 'P1 is next');
    sim.step('P1');
    assertEqual(sim.currentTime, 8, 'Clock advanced to 8ms');

    // P2 is at head (remaining 1). Runs for 1ms (< quantum), completes! Clock becomes 9
    assertEqual(sim.getCanonicalChoice().pid, 'P2', 'P2 is next');
    const p2Finish = sim.step('P2');
    assertEqual(p2Finish.duration, 1, 'P2 runs for remaining 1ms');
    assertEqual(p2Finish.remainingBurst, 0, 'P2 completed');
    assertEqual(sim.currentTime, 9, 'Clock advanced to 9ms');

    // Finish remaining steps for P3 and P1
    while (!sim.isCompleted) {
        const next = sim.getCanonicalChoice();
        sim.step(next.pid);
    }

    assertEqual(sim.isCompleted, true, 'Round Robin completed');

    // Verify against core engine
    const refRR = coreApi.schedule('roundrobin', WORKLOADS.rr.processes, { quantum: 2 });
    assertEqual(sim.finalMetrics.totalElapsedTime, refRR.totalElapsedTime, 'RR total elapsed time matches core engine');
    assertEqual(sim.finalMetrics.averageWaitingTime, refRR.averageWaitingTime, 'RR average waiting time matches core engine');
    assertEqual(sim.finalMetrics.averageTurnaroundTime, refRR.averageTurnaroundTime, 'RR average turnaround time matches core engine');
}

// -----------------------------------------------------------------------------
// Test 5: Priority Scheduling — Priority King
// -----------------------------------------------------------------------------
console.log('▶ Test 5: Priority Scheduling — Priority King Non-Preemptive Order');
{
    const sim = new StepSimulator();
    sim.init('priority');

    // Workload Priority:
    // P1: arr 0, burst 4, prio 2
    // P2: arr 1, burst 3, prio 0 (highest)
    // P3: arr 2, burst 2, prio 3 (lowest)
    // P4: arr 3, burst 4, prio 1 (high)

    // At t=0, only P1 is ready -> non-preemptive execution to completion
    sim.step('P1');
    assertEqual(sim.currentTime, 4, 'P1 runs to completion (4ms)');

    // At t=4, P2 (prio 0), P3 (prio 3), P4 (prio 1) have all arrived.
    // Highest priority is P2 (0). Selecting P4 (1) is a violation.
    const invalidPriority = sim.validateDecision('P4');
    assertEqual(invalidPriority.valid, false, 'Selecting P4 violates Priority rule');
    assert(invalidPriority.message.includes('Priority Scheduling'), 'Feedback cites Priority rule');

    // Step P2 (prio 0)
    sim.step('P2');
    assertEqual(sim.currentTime, 7, 'Clock is 7 after P2 (3ms)');

    // At t=7, between P3 (3) and P4 (1), P4 outranks P3
    assertEqual(sim.getCanonicalChoice().pid, 'P4', 'P4 (prio 1) outranks P3 (prio 3)');
    sim.step('P4');
    assertEqual(sim.currentTime, 11, 'Clock is 11 after P4 (4ms)');

    // Step P3 (prio 3)
    sim.step('P3');
    assertEqual(sim.currentTime, 13, 'Clock is 13 after P3 (2ms)');
    assertEqual(sim.isCompleted, true, 'Priority workload completed');

    // Verify against core engine
    const refPrio = coreApi.schedule('priority', WORKLOADS.priority.processes);
    assertEqual(sim.finalMetrics.averageWaitingTime, refPrio.averageWaitingTime, 'Priority average waiting matches core engine');
    assertEqual(sim.finalMetrics.averageTurnaroundTime, refPrio.averageTurnaroundTime, 'Priority average turnaround matches core engine');
}

// -----------------------------------------------------------------------------
// Test 6: Simultaneous Arrivals & Deterministic Tie-Breaking
// -----------------------------------------------------------------------------
console.log('▶ Test 6: Simultaneous Arrivals & Deterministic Tie-Breaking');
{
    const sim = new StepSimulator();
    // Custom simultaneous arrival workload
    const tieWorkload = {
        bossId: 'sjf',
        bossName: 'Speed Demon Tie Test',
        algorithmName: 'SJF',
        processes: [
            { pid: 'P1', arrivalTime: 0, burstTime: 4 },
            { pid: 'P2', arrivalTime: 0, burstTime: 4 },
            { pid: 'P3', arrivalTime: 0, burstTime: 2 }
        ]
    };
    sim.init('sjf', tieWorkload);

    // Shortest burst at t=0 is P3 (burst 2)
    assertEqual(sim.getCanonicalChoice().pid, 'P3', 'P3 chosen due to shortest burst');
    sim.step('P3');

    // Now P1 and P2 have equal burst (4) and equal arrival (0).
    // Tie-breaker: inputOrder -> P1
    assertEqual(sim.getCanonicalChoice().pid, 'P1', 'P1 chosen due to inputOrder tie-breaker');
    sim.step('P1');
    assertEqual(sim.getCanonicalChoice().pid, 'P2', 'P2 chosen last');
    sim.step('P2');
    assertEqual(sim.isCompleted, true, 'Tie workload completed');
}

// -----------------------------------------------------------------------------
// Test 7: Initial and Intermittent CPU Idle Intervals
// -----------------------------------------------------------------------------
console.log('▶ Test 7: Initial and Intermittent CPU Idle Interval Handling');
{
    const sim = new StepSimulator();
    const idleWorkload = {
        bossId: 'fcfs',
        bossName: 'Idle Test',
        algorithmName: 'FCFS',
        processes: [
            { pid: 'P1', arrivalTime: 3, burstTime: 2 }, // Initial idle 0 to 3
            { pid: 'P2', arrivalTime: 8, burstTime: 2 }  // Gap between 5 and 8
        ]
    };
    sim.init('fcfs', idleWorkload);

    // Initial idle interval should be recorded
    assertEqual(sim.currentTime, 3, 'Initial clock jumped across idle gap to first arrival at t=3');
    assertEqual(sim.ganttChart.length, 1, 'Gantt chart contains initial idle segment');
    assertEqual(sim.ganttChart[0].isIdle, true, 'First segment is idle');
    assertEqual(sim.ganttChart[0].startTime, 0, 'Idle from 0');
    assertEqual(sim.ganttChart[0].endTime, 3, 'Idle to 3');

    // Execute P1 (t=3 to 5)
    sim.step('P1');
    // Clock at t=5, P2 arrives at 8. Intermediate idle gap must be inserted!
    assertEqual(sim.currentTime, 8, 'Clock jumped across gap to next arrival at t=8');
    assertEqual(sim.ganttChart.length, 3, 'Gantt has Idle, P1, and second Idle segment');
    assertEqual(sim.ganttChart[2].isIdle, true, 'Second idle segment inserted');
    assertEqual(sim.ganttChart[2].startTime, 5, 'Gap start at 5');
    assertEqual(sim.ganttChart[2].endTime, 8, 'Gap end at 8');

    // Execute P2 (t=8 to 10)
    sim.step('P2');
    assertEqual(sim.isCompleted, true, 'Idle workload completed');
    assertEqual(sim.finalMetrics.totalIdleTime, 6, 'Total idle time is 3 + 3 = 6ms');
}

// -----------------------------------------------------------------------------
// Test 8: GameEngine Combat Integration & Decision Rewards / Penalties
// -----------------------------------------------------------------------------
console.log('▶ Test 8: GameEngine Combat Wiring, Health Milestones & Penalties');
{
    // Headless DOM mock
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

    const engine = new GameEngine();
    engine.init(mockCanvas);
    engine.startLevel('fcfs');

    assertEqual(engine.state, 'ready', 'Engine starts in ready state');
    assertEqual(engine.boss.health, 100, 'Boss starts at 100 health');
    assertEqual(engine.player.health, 100, 'Player starts at 100 health');

    engine.resumeGame();
    assertEqual(engine.state, 'playing', 'Engine transitioned to playing');
    assertEqual(engine.stepSimulator.isWaitingForDecision, true, 'Simulator waiting for player dispatch decision');

    // 1. Player makes INCORRECT selection (P2 instead of P1)
    engine.handleDispatchChoice('P2');
    assertEqual(engine.player.health, 85, 'Player integrity penalized by -15 on incorrect selection');
    assertEqual(engine.boss.health, 100, 'Boss health untouched on incorrect selection');
    assertEqual(engine.stepSimulator.isWaitingForDecision, true, 'Player can retry');

    // 2. Player makes CORRECT selection (P1)
    engine.handleDispatchChoice('P1');
    assertEqual(engine.score, 250, 'Score increased by +250 on correct dispatch');
    assert(engine.boss.health < 100, 'Boss health decreased after scheduling milestone');

    // 3. Step remaining processes to completion
    engine.handleDispatchChoice('P2');
    engine.handleDispatchChoice('P3');
    engine.handleDispatchChoice('P4');

    assertEqual(engine.boss.health, 0, 'Boss health reduced to 0 upon completing workload');
    assertEqual(engine.stepSimulator.isCompleted, true, 'Simulator completed all processes');

    // Check Gantt chart consistency
    const gantt = engine.stepSimulator.ganttChart;
    assert(gantt.length === 4, 'Gantt chart has 4 execution blocks');
    assertEqual(gantt[0].pid, 'P1', 'Gantt block 1 is P1');
    assertEqual(gantt[1].pid, 'P2', 'Gantt block 2 is P2');
    assertEqual(gantt[2].pid, 'P3', 'Gantt block 3 is P3');
    assertEqual(gantt[3].pid, 'P4', 'Gantt block 4 is P4');

    // 4. Test Pause, Resume, and Restart
    engine.pauseGame();
    assertEqual(engine.state, 'paused', 'Engine paused cleanly');
    engine.resumeGame();
    assertEqual(engine.state, 'playing', 'Engine resumed cleanly');

    engine.startLevel('fcfs');
    assertEqual(engine.boss.health, 100, 'Restart reset boss health to 100');
    assertEqual(engine.player.health, 100, 'Restart reset player health to 100');
    assertEqual(engine.score, 0, 'Restart reset score to 0');
    assertEqual(engine.stepSimulator.currentTime, 0, 'Restart reset simulation clock to 0');
}

// -----------------------------------------------------------------------------
// Test 9: HTML and Script Connection Integrity
// -----------------------------------------------------------------------------
console.log('▶ Test 9: HTML, DOM IDs & Script Connection Integrity for Step 5');
{
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

    assert(html.includes('id="scheduling-console"'), 'index.html includes #scheduling-console');
    assert(html.includes('id="sim-clock"'), 'index.html includes #sim-clock');
    assert(html.includes('id="sim-rule-badge"'), 'index.html includes #sim-rule-badge');
    assert(html.includes('id="sim-status-badge"'), 'index.html includes #sim-status-badge');
    assert(html.includes('id="dispatch-panel"'), 'index.html includes #dispatch-panel');
    assert(html.includes('id="dispatch-queue-container"'), 'index.html includes #dispatch-queue-container');
    assert(html.includes('id="dispatch-feedback-box"'), 'index.html includes #dispatch-feedback-box');
    assert(html.includes('id="live-gantt-track"'), 'index.html includes #live-gantt-track');
    assert(html.includes('id="debrief-container"'), 'index.html includes #debrief-container');

    assert(html.includes('src="src/game/workloads.js"'), 'index.html loads workloads.js');
    assert(html.includes('src="src/game/stepSimulator.js"'), 'index.html loads stepSimulator.js');
}

// -----------------------------------------------------------------------------
// Test 10: Visible Character Attack, Impact & Boss Damage Animation
// -----------------------------------------------------------------------------
console.log('▶ Test 10: Visible Character Attack Animation, Dispatch Projectile & Boss Damage Reaction');
{
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

    const engine = new GameEngine();
    engine.init(mockCanvas);
    engine.startLevel('fcfs');
    engine.resumeGame();

    assertEqual(engine.player.isAttacking, false, 'Player not attacking before dispatch');
    assertEqual(engine.boss.hitFlashTimer, 0, 'Boss has no hit flash before attack');
    assertEqual(engine.boss.hitStaggerX, 0, 'Boss has no stagger before attack');

    // Make correct selection P1
    engine.handleDispatchChoice('P1');

    // 1. Character visible attack animation
    assertEqual(engine.player.isAttacking, true, 'Player enters visible attack stance on correct dispatch');
    assertEqual(engine.player.dispatchPid, 'P1', 'Player stores dispatched PID for rendering');
    assert(engine.player.attackVisualTimer > 0, 'Player attack visual timer is active');
    assert(engine.player.recoilOffset < 0, 'Player experiences kickback recoil offset');

    // 2. High-energy dispatch projectile
    const dispatchProj = engine.projectiles.find(p => p.type === 'dispatch-packet');
    assert(dispatchProj !== undefined, 'Dispatch packet projectile spawned in projectiles list');
    assertEqual(dispatchProj.pid, 'P1', 'Dispatch projectile carries PID P1');
    assertEqual(dispatchProj.isPlayer, true, 'Dispatch projectile belongs to player');
    assert(dispatchProj.vx > 500, 'Dispatch projectile moves at high velocity toward boss');

    // 3. Boss visible damage reaction
    assert(engine.boss.hitFlashTimer > 0, 'Boss hit flash timer activated');
    assert(engine.boss.hitStaggerX > 0, 'Boss experiences horizontal stagger recoil away from player');
    assertEqual(engine.boss.health, 60, 'Boss health decreased to 60% based on remaining CPU burst (9/15ms)');

    // 4. Exactly one selection executed one scheduling step
    assertEqual(engine.stepSimulator.currentTime, 6, 'Simulation clock advanced for P1 only (6ms)');
    assertEqual(engine.stepSimulator.readyQueue.length, 3, 'Exactly 3 processes remain in ready queue');
    assertEqual(engine.stepSimulator.isCompleted, false, 'Workload not completed after single step');
    assertEqual(engine.stepSimulator.isWaitingForDecision, true, 'Engine waiting for next decision');
}

// -----------------------------------------------------------------------------
// Test 11: Arbitrary Manual Attacks (Z/J) Cannot Defeat Boss or Bypass Scheduling
// -----------------------------------------------------------------------------
console.log('▶ Test 11: Preventing Arbitrary Attacks (Z/J) from Bypassing Scheduling Engine');
{
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

    const engine = new GameEngine();
    engine.init(mockCanvas);
    engine.startLevel('fcfs');
    engine.resumeGame();

    const initialBossHp = engine.boss.health;
    assertEqual(initialBossHp, 100, 'Boss starts with 100 HP');

    // Player fires manual diagnostic attack (Z / J key)
    engine.player.fireAttack(engine.projectiles, engine.particles);
    const manualProj = engine.projectiles.find(p => p.type === 'diagnostic');
    assert(manualProj !== undefined, 'Manual Z/J attack fires diagnostic packet');
    assertEqual(manualProj.damage, 0, 'Manual diagnostic attack has damage 0 against boss');

    // Place manual projectile on top of boss to force collision
    manualProj.x = engine.boss.x + 20;
    manualProj.y = engine.boss.y + 20;

    // Run engine update to process collision
    engine.update(0.01);

    // Verify boss health is UNCHANGED
    assertEqual(engine.boss.health, initialBossHp, 'Boss health must NOT decrease from manual Z/J attacks');
    assertEqual(engine.state, 'playing', 'Engine remains in playing state (boss cannot be defeated by manual attacks)');
    assertEqual(engine.stepSimulator.currentTime, 0, 'Simulation clock has not moved');
    assertEqual(engine.stepSimulator.isWaitingForDecision, true, 'Scheduling decision is still required');

    // Verify movement and jumping do not bypass scheduling
    engine.inputState.left = true;
    engine.inputState.jump = true;
    engine.update(0.05);
    engine.inputState.left = false;
    engine.inputState.jump = false;

    assertEqual(engine.boss.health, initialBossHp, 'Movement/jumping does not alter boss health');
    assertEqual(engine.stepSimulator.currentTime, 0, 'Movement/jumping does not advance simulation clock');

    // Incorrect scheduling decision penalties
    engine.handleDispatchChoice('P3'); // Violates FCFS arrival rule (P1 arrived at 0, P3 arrives at 2)
    assertEqual(engine.player.health, 85, 'Player integrity penalized by 15 on incorrect decision');
    assertEqual(engine.boss.health, initialBossHp, 'Boss takes NO damage from incorrect scheduling decision');

    // Only correct scheduling choices can defeat the boss
    engine.handleDispatchChoice('P1');
    assertEqual(engine.boss.health, 60, 'Boss health drops to 60 after P1');
    engine.handleDispatchChoice('P2');
    assertEqual(engine.boss.health, 47, 'Boss health drops to 47 after P2');
    engine.handleDispatchChoice('P3');
    assertEqual(engine.boss.health, 20, 'Boss health drops to 20 after P3');
    engine.handleDispatchChoice('P4');
    assertEqual(engine.boss.health, 0, 'Boss health drops to 0 ONLY upon completing entire workload');
}

// -----------------------------------------------------------------------------
// Test 12: Four Genuinely Distinct Boss Powers Integration
// -----------------------------------------------------------------------------
console.log('▶ Test 12: Four Genuinely Distinct Boss Powers Integration');
{
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

    // 1. FCFS — The Queue Titan: FIFO Lock
    {
        const engine = new GameEngine();
        engine.init(mockCanvas);
        engine.startLevel('fcfs');
        engine.resumeGame();

        assertEqual(engine.boss.fifoLockActive, false, 'FCFS starts with FIFO Lock inactive');
        assertEqual(engine.boss.fifoLockTimer, 0, 'FCFS FIFO Lock timer starts at 0');

        // Execute P1 (t=0 -> 6)
        engine.handleDispatchChoice('P1');
        assertEqual(engine.stepSimulator.currentTime, 6, 'P1 executed to t=6');
        // At t=6, ready processes are P2 (arr:1), P3 (arr:2), P4 (arr:4).
        // Attempting to skip P2 by selecting P3:
        const prevHp = engine.boss.health;
        const prevPlayerHp = engine.player.health;
        engine.handleDispatchChoice('P3');

        // Gameplay Consequences & State Verification
        assertEqual(engine.boss.fifoLockActive, true, 'FIFO Lock activates on attempting to skip earlier arrival');
        assert(engine.boss.fifoLockTimer > 0, 'FIFO Lock timer is counting down');
        assertEqual(engine.player.health, prevPlayerHp - 15, 'Player integrity penalized by 15 on FIFO lock breach');
        assertEqual(engine.stepSimulator.currentTime, 6, 'CPU execution NEVER advances on incorrect choice');
        assertEqual(engine.boss.health, prevHp, 'Boss takes NO damage from blocked FIFO lock choice');

        // Selecting correct earliest-arrived process P2 releases the FIFO lock
        engine.handleDispatchChoice('P2');
        assertEqual(engine.boss.fifoLockActive, false, 'FIFO Lock is released on selecting earliest arrival');
        assertEqual(engine.stepSimulator.currentTime, 8, 'CPU execution advances to 8 after P2');
        assert(engine.boss.health < prevHp, 'Boss takes damage only on valid scheduling execution');
    }

    // 2. SJF — The Speed Demon: Shortest Job Shield
    {
        const engine = new GameEngine();
        engine.init(mockCanvas);
        engine.startLevel('sjf');
        engine.resumeGame();

        // Starts with shield active
        assertEqual(engine.boss.hasSpeedShield, true, 'Speed Demon starts with Shortest Job Shield active');
        assertEqual(engine.boss.shieldShatterTimer, 0, 'Shield shatter timer starts at 0');

        // At t=0, only P1 arrived (burst 5)
        engine.handleDispatchChoice('P1');
        assertEqual(engine.stepSimulator.currentTime, 5, 'P1 completes at t=5 (non-preemptive SJF)');
        assertEqual(engine.boss.hasSpeedShield, true, 'Shield restores for next decision point');

        // At t=5, P2 (burst 2), P4 (burst 3), P3 (burst 6) are ready.
        // Selecting longer job P4 (burst 3) instead of shortest job P2 (burst 2)
        const prevProjectilesCount = engine.projectiles.length;
        const prevPlayerHp = engine.player.health;
        const prevBossHp = engine.boss.health;

        engine.handleDispatchChoice('P4');

        // Gameplay Consequences & Counterattack Verification
        assertEqual(engine.boss.hasSpeedShield, true, 'Shield remains intact on incorrect choice');
        assertEqual(engine.player.health, prevPlayerHp - 15, 'Player integrity penalized by 15');
        assertEqual(engine.stepSimulator.currentTime, 5, 'CPU execution NEVER advances on incorrect choice');
        assertEqual(engine.boss.health, prevBossHp, 'Boss health untouched behind shield');

        // Distinct speed counterattack: rapid needle projectiles spawned
        const speedNeedles = engine.projectiles.filter(p => p.type === 'sjf-needle');
        assert(speedNeedles.length >= 3, 'Speed Demon counterattacks with rapid needle projectile volley');

        // Selecting correct minimal-burst process P2 shatters the shield
        engine.handleDispatchChoice('P2');
        assert(engine.boss.shieldShatterTimer > 0, 'Shortest Job Shield shatters upon minimal burst selection');
        assertEqual(engine.stepSimulator.currentTime, 7, 'Non-preemptive SJF advances by P2 burst (2ms)');
        assert(engine.boss.health < prevBossHp, 'Boss takes damage from CPU burst strike');
    }

    // 3. Round Robin — The Time Wizard: Quantum Clock
    {
        const engine = new GameEngine();
        engine.init(mockCanvas);
        engine.startLevel('rr');
        engine.resumeGame();

        assertEqual(engine.stepSimulator.quantum, 2, 'Configured time quantum is 2ms');

        // Ready queue starts with P1 at head (burst 5).
        // Step P1 to run 1st quantum slice
        engine.handleDispatchChoice('P1');
        assertEqual(engine.stepSimulator.currentTime, 2, 'P1 executed for quantum of 2ms');
        
        // P1 had burst 5 -> remaining 3ms. Process P1 is returned to end of ready queue!
        // New arrivals at t=1 (P2) and t=2 (P3) were admitted BEFORE preempted P1.
        // Ready queue order: P2, P3, P1.
        assertEqual(engine.stepSimulator.readyQueue[0].pid, 'P2', 'P2 is at head of ready queue');
        assertEqual(engine.stepSimulator.readyQueue[1].pid, 'P3', 'P3 is second in ready queue');
        assertEqual(engine.stepSimulator.readyQueue[2].pid, 'P1', 'Unfinished P1 returned to queue tail');

        // Attempting to select P1 (which is at the tail) instead of head P2
        const prevPlayerHp = engine.player.health;
        const prevBossHp = engine.boss.health;
        engine.handleDispatchChoice('P1');

        // Counterattack & Penalty
        assertEqual(engine.player.health, prevPlayerHp - 15, 'Player integrity penalized by 15');
        assertEqual(engine.stepSimulator.currentTime, 2, 'CPU execution does NOT advance');
        assertEqual(engine.boss.health, prevBossHp, 'Boss health untouched');

        const temporalRings = engine.projectiles.filter(p => p.type === 'rr-ring');
        assert(temporalRings.length >= 2, 'Time Wizard triggers temporal ring counterattack');

        // Selecting head P2 succeeds for 2ms quantum
        engine.handleDispatchChoice('P2');
        assertEqual(engine.stepSimulator.currentTime, 4, 'Clock advanced by quantum of 2ms to t=4');
        assert(engine.boss.health < prevBossHp, 'Boss takes damage from quantum slice attack');
    }

    // 4. Priority Scheduling — The Priority King: Royal Override
    {
        const engine = new GameEngine();
        engine.init(mockCanvas);
        engine.startLevel('priority');
        engine.resumeGame();

        // At t=0, only P1 arrived (priority 2, burst 4)
        engine.handleDispatchChoice('P1');
        assertEqual(engine.stepSimulator.currentTime, 4, 'P1 runs to completion (non-preemptive priority)');

        // At t=4, ready queue has:
        // P2: priority 0 (Royal Override)
        // P4: priority 1 (high)
        // P3: priority 3 (lowest)
        const canonical = engine.stepSimulator.getCanonicalChoice();
        assertEqual(canonical.pid, 'P2', 'Process P2 (priority 0) holds Royal Override');
        assertEqual(canonical.priority, 0, 'Smaller number 0 represents higher priority');

        // Player picks lower-priority process P4 (priority 1)
        const prevPlayerHp = engine.player.health;
        const prevBossHp = engine.boss.health;
        engine.handleDispatchChoice('P4');

        // Counterattack & Penalty
        assertEqual(engine.player.health, prevPlayerHp - 15, 'Player integrity penalized by 15');
        assertEqual(engine.stepSimulator.currentTime, 4, 'CPU execution does NOT advance');
        assertEqual(engine.boss.health, prevBossHp, 'Boss health untouched');
        assert(engine.boss.royalWrathTimer > 0, 'Priority King royal wrath activated');

        const royalSeals = engine.projectiles.filter(p => p.type === 'priority-seal');
        assert(royalSeals.length >= 1, 'Priority King launches gilded Royal Seal counterattack');

        // Selecting Royal Override process P2 succeeds and runs to completion (3ms)
        engine.handleDispatchChoice('P2');
        assertEqual(engine.stepSimulator.currentTime, 7, 'Clock advanced to 7 after P2');
        assert(engine.boss.health < prevBossHp, 'Boss takes damage from Royal Override dispatch');
    }
}

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} assertions passed, ${failedTests} failed.`);
console.log('STATUS: ' + (failedTests === 0 ? 'ALL STEP 5 INTEGRATION TESTS PASSED! ✓' : 'FAILURES DETECTED! ✗'));
console.log('====================================================');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
