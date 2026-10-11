/**
 * Scheduler Arcade — CPU Scheduling Engine Test Suite
 * 
 * Verifies all four CPU scheduling algorithms against independently hand-calculated
 * textbook test cases, edge cases, invariant verifications, and validation errors.
 */

const {
    ValidationError,
    validateProcesses,
    validateQuantum,
    scheduleFCFS,
    scheduleSJF,
    scheduleRoundRobin,
    schedulePriority,
    schedule
} = require('./index');

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

function assertDeepEqual(actual, expected, message) {
    totalTests++;
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
        failedTests++;
        const err = `${message} — Expected ${expStr}, got ${actStr}`;
        console.error(`  FAIL: ${err}`);
        throw new Error(err);
    } else {
        passedTests++;
    }
}

function assertCloseTo(actual, expected, tolerance = 1e-4, message) {
    totalTests++;
    if (Math.abs(actual - expected) > tolerance) {
        failedTests++;
        const err = `${message} — Expected close to ${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`;
        console.error(`  FAIL: ${err}`);
        throw new Error(err);
    } else {
        passedTests++;
    }
}

function assertThrows(fn, expectedSubstring, message) {
    totalTests++;
    try {
        fn();
        failedTests++;
        const err = `${message} — Expected error containing "${expectedSubstring}", but no error was thrown.`;
        console.error(`  FAIL: ${err}`);
        throw new Error(err);
    } catch (e) {
        if (expectedSubstring && !e.message.includes(expectedSubstring)) {
            failedTests++;
            const err = `${message} — Expected error to include "${expectedSubstring}", but got "${e.message}".`;
            console.error(`  FAIL: ${err}`);
            throw new Error(err);
        }
        passedTests++;
    }
}

/**
 * Universal verification helper for all scheduling results.
 */
function verifyResultInvariants(result, originalProcesses) {
    const totalExpectedBurst = originalProcesses.reduce((sum, p) => sum + p.burstTime, 0);

    // 1. Gantt chart segment continuity
    let prevEnd = 0;
    let sumBusyTime = 0;
    let sumIdleTime = 0;

    for (let i = 0; i < result.ganttChart.length; i++) {
        const seg = result.ganttChart[i];
        assert(seg.startTime === prevEnd, `Gantt segment ${i} must start where previous segment ended (t=${prevEnd}).`);
        assert(seg.endTime > seg.startTime, `Gantt segment ${i} must have positive duration.`);

        if (seg.isIdle) {
            sumIdleTime += seg.duration;
            assert(seg.pid === null, `Idle segment ${i} must have null pid.`);
        } else {
            sumBusyTime += seg.duration;
            const orig = originalProcesses.find(p => p.pid === seg.pid);
            assert(Boolean(orig), `Gantt segment ${i} pid "${seg.pid}" must exist in workload.`);
            assert(seg.startTime >= orig.arrivalTime, `Process "${seg.pid}" cannot execute before arrivalTime (${orig.arrivalTime}).`);
        }
        prevEnd = seg.endTime;
    }

    // 2. Timeline sums
    assertEqual(result.totalBusyTime, totalExpectedBurst, 'Total busy time must equal sum of all burst times.');
    assertEqual(prevEnd, result.totalElapsedTime, 'Total elapsed time must match end time of final segment.');
    assertEqual(result.totalBusyTime + result.totalIdleTime, result.totalElapsedTime, 'Busy + Idle must equal total elapsed time.');

    // 3. Process metrics consistency
    for (const pr of result.processes) {
        const orig = originalProcesses.find(p => p.pid === pr.pid);
        assertEqual(pr.turnaroundTime, pr.completionTime - orig.arrivalTime, `TAT = CT - AT for process ${pr.pid}`);
        assertEqual(pr.waitingTime, pr.turnaroundTime - orig.burstTime, `WT = TAT - BT for process ${pr.pid}`);
        assertEqual(pr.responseTime, pr.firstStartTime - orig.arrivalTime, `RT = FirstStart - AT for process ${pr.pid}`);
        assert(pr.waitingTime >= 0, `WT cannot be negative for process ${pr.pid}`);
        assert(pr.responseTime >= 0, `RT cannot be negative for process ${pr.pid}`);
    }
}

console.log('====================================================');
console.log('   SCHEDULER ARCADE — CPU SCHEDULING ENGINE TESTS   ');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Basic Workload (FCFS, SJF, RR)
// -----------------------------------------------------------------------------
console.log('▶ Test 1: Basic Workload with Varied Arrivals and Burst Times');
{
    const workload = [
        { pid: 'P1', arrivalTime: 0, burstTime: 5 },
        { pid: 'P2', arrivalTime: 1, burstTime: 3 },
        { pid: 'P3', arrivalTime: 2, burstTime: 8 },
        { pid: 'P4', arrivalTime: 3, burstTime: 6 }
    ];

    // A. FCFS
    const fcfsRes = scheduleFCFS(workload);
    verifyResultInvariants(fcfsRes, workload);
    assertDeepEqual(fcfsRes.executionOrder, ['P1', 'P2', 'P3', 'P4'], 'FCFS execution order');
    assertEqual(fcfsRes.totalElapsedTime, 22, 'FCFS total elapsed time');
    assertEqual(fcfsRes.averageTurnaroundTime, 11.25, 'FCFS average TAT');
    assertEqual(fcfsRes.averageWaitingTime, 5.75, 'FCFS average WT');
    assertEqual(fcfsRes.averageResponseTime, 5.75, 'FCFS average RT');
    assertEqual(fcfsRes.cpuUtilization, 100, 'FCFS CPU utilization is 100%');
    assertCloseTo(fcfsRes.throughput, 4 / 22, 1e-4, 'FCFS throughput');

    const p1 = fcfsRes.processes.find(p => p.pid === 'P1');
    assertEqual(p1.completionTime, 5, 'P1 CT');
    assertEqual(p1.turnaroundTime, 5, 'P1 TAT');
    assertEqual(p1.waitingTime, 0, 'P1 WT');
    assertEqual(p1.responseTime, 0, 'P1 RT');

    const p4 = fcfsRes.processes.find(p => p.pid === 'P4');
    assertEqual(p4.completionTime, 22, 'P4 CT');
    assertEqual(p4.turnaroundTime, 19, 'P4 TAT');
    assertEqual(p4.waitingTime, 13, 'P4 WT');
    assertEqual(p4.responseTime, 13, 'P4 RT');

    // B. SJF (Non-preemptive)
    const sjfRes = scheduleSJF(workload);
    verifyResultInvariants(sjfRes, workload);
    assertDeepEqual(sjfRes.executionOrder, ['P1', 'P2', 'P4', 'P3'], 'SJF execution order (P2 then P4 then P3)');
    assertEqual(sjfRes.totalElapsedTime, 22, 'SJF total elapsed time');
    assertEqual(sjfRes.averageTurnaroundTime, 10.75, 'SJF average TAT');
    assertEqual(sjfRes.averageWaitingTime, 5.25, 'SJF average WT');
    assertEqual(sjfRes.averageResponseTime, 5.25, 'SJF average RT');

    const sjfP4 = sjfRes.processes.find(p => p.pid === 'P4');
    assertEqual(sjfP4.completionTime, 14, 'SJF P4 CT');
    assertEqual(sjfP4.turnaroundTime, 11, 'SJF P4 TAT');
    assertEqual(sjfP4.waitingTime, 5, 'SJF P4 WT');

    const sjfP3 = sjfRes.processes.find(p => p.pid === 'P3');
    assertEqual(sjfP3.completionTime, 22, 'SJF P3 CT');
    assertEqual(sjfP3.turnaroundTime, 20, 'SJF P3 TAT');
    assertEqual(sjfP3.waitingTime, 12, 'SJF P3 WT');

    // C. Round Robin (q = 3)
    const rrRes = scheduleRoundRobin(workload, 3);
    verifyResultInvariants(rrRes, workload);
    assertEqual(rrRes.totalElapsedTime, 22, 'RR total elapsed time');
    assertEqual(rrRes.averageTurnaroundTime, 14.0, 'RR average TAT');
    assertEqual(rrRes.averageWaitingTime, 8.5, 'RR average WT');
    assertEqual(rrRes.averageResponseTime, 3.0, 'RR average RT');

    const rrP1 = rrRes.processes.find(p => p.pid === 'P1');
    assertEqual(rrP1.completionTime, 14, 'RR P1 CT');
    assertEqual(rrP1.responseTime, 0, 'RR P1 RT');

    const rrP2 = rrRes.processes.find(p => p.pid === 'P2');
    assertEqual(rrP2.completionTime, 6, 'RR P2 CT');
    assertEqual(rrP2.responseTime, 2, 'RR P2 RT');

    const rrP3 = rrRes.processes.find(p => p.pid === 'P3');
    assertEqual(rrP3.completionTime, 22, 'RR P3 CT');
    assertEqual(rrP3.responseTime, 4, 'RR P3 RT');

    const rrP4 = rrRes.processes.find(p => p.pid === 'P4');
    assertEqual(rrP4.completionTime, 20, 'RR P4 CT');
    assertEqual(rrP4.responseTime, 6, 'RR P4 RT');
}

// -----------------------------------------------------------------------------
// Test 2: Simultaneous Process Arrivals (t = 0)
// -----------------------------------------------------------------------------
console.log('▶ Test 2: Simultaneous Process Arrivals at t = 0');
{
    const workload = [
        { pid: 'P1', arrivalTime: 0, burstTime: 6, priority: 2 },
        { pid: 'P2', arrivalTime: 0, burstTime: 2, priority: 1 },
        { pid: 'P3', arrivalTime: 0, burstTime: 8, priority: 3 }
    ];

    // FCFS: tie broken by input order P1, P2, P3
    const fcfsRes = scheduleFCFS(workload);
    assertDeepEqual(fcfsRes.executionOrder, ['P1', 'P2', 'P3'], 'FCFS simultaneous arrival order');

    // SJF: sorted by burst time P2 (2), P1 (6), P3 (8)
    const sjfRes = scheduleSJF(workload);
    assertDeepEqual(sjfRes.executionOrder, ['P2', 'P1', 'P3'], 'SJF simultaneous arrival order');
    const sP2 = sjfRes.processes.find(p => p.pid === 'P2');
    assertEqual(sP2.completionTime, 2, 'SJF P2 CT');
    assertEqual(sP2.waitingTime, 0, 'SJF P2 WT');

    // Priority: sorted by priority rank P2 (1), P1 (2), P3 (3)
    const prioRes = schedulePriority(workload);
    assertDeepEqual(prioRes.executionOrder, ['P2', 'P1', 'P3'], 'Priority simultaneous arrival order');
}

// -----------------------------------------------------------------------------
// Test 3: CPU Idle Time Before First Arrival
// -----------------------------------------------------------------------------
console.log('▶ Test 3: CPU Idle Interval Before First Arrival (Initial Idle)');
{
    const workload = [
        { pid: 'P1', arrivalTime: 4, burstTime: 3, priority: 1 }
    ];

    const res = scheduleFCFS(workload);
    verifyResultInvariants(res, workload);
    assertEqual(res.ganttChart.length, 2, 'Two Gantt segments: Idle then P1');
    assertEqual(res.ganttChart[0].isIdle, true, 'First segment is Idle');
    assertEqual(res.ganttChart[0].startTime, 0, 'Idle starts at 0');
    assertEqual(res.ganttChart[0].endTime, 4, 'Idle ends at 4');
    assertEqual(res.ganttChart[1].pid, 'P1', 'Second segment is P1');
    assertEqual(res.ganttChart[1].startTime, 4, 'P1 starts at 4');
    assertEqual(res.ganttChart[1].endTime, 7, 'P1 ends at 7');
    assertEqual(res.totalElapsedTime, 7, 'Total elapsed time is 7');
    assertEqual(res.totalIdleTime, 4, 'Total idle time is 4');
    assertEqual(res.totalBusyTime, 3, 'Total busy time is 3');
    assertCloseTo(res.cpuUtilization, (3 / 7) * 100, 1e-4, 'CPU Utilization calculation');
    assertCloseTo(res.throughput, 1 / 7, 1e-4, 'Throughput calculation');
}

// -----------------------------------------------------------------------------
// Test 4: Gaps Between Process Arrivals (Intermittent Idle)
// -----------------------------------------------------------------------------
console.log('▶ Test 4: Gaps Between Process Arrivals (Intermittent Idle Intervals)');
{
    const workload = [
        { pid: 'P1', arrivalTime: 1, burstTime: 2, priority: 1 },
        { pid: 'P2', arrivalTime: 7, burstTime: 4, priority: 2 }
    ];

    const res = scheduleFCFS(workload);
    verifyResultInvariants(res, workload);
    assertEqual(res.ganttChart.length, 4, 'Four segments: Idle, P1, Idle, P2');
    assertEqual(res.ganttChart[0].isIdle, true, 'Idle [0, 1]');
    assertEqual(res.ganttChart[1].pid, 'P1', 'P1 [1, 3]');
    assertEqual(res.ganttChart[2].isIdle, true, 'Idle [3, 7]');
    assertEqual(res.ganttChart[3].pid, 'P2', 'P2 [7, 11]');
    assertEqual(res.totalElapsedTime, 11, 'Total elapsed time is 11');
    assertEqual(res.totalIdleTime, 5, 'Total idle time is 1 + 4 = 5');
    assertEqual(res.totalBusyTime, 6, 'Total busy time is 2 + 4 = 6');
}

// -----------------------------------------------------------------------------
// Test 5: Single Process
// -----------------------------------------------------------------------------
console.log('▶ Test 5: Single Process Workload');
{
    const workload = [
        { pid: 'Solo', arrivalTime: 0, burstTime: 4, priority: 0 }
    ];

    ['fcfs', 'sjf', 'priority'].forEach(algo => {
        const res = schedule(algo, workload);
        verifyResultInvariants(res, workload);
        assertEqual(res.totalElapsedTime, 4, `${algo} single process elapsed`);
        assertEqual(res.averageTurnaroundTime, 4, `${algo} single process TAT`);
        assertEqual(res.averageWaitingTime, 0, `${algo} single process WT`);
        assertEqual(res.averageResponseTime, 0, `${algo} single process RT`);
        assertEqual(res.cpuUtilization, 100, `${algo} single process 100% util`);
    });

    const rrRes = scheduleRoundRobin(workload, 2);
    verifyResultInvariants(rrRes, workload);
    assertEqual(rrRes.ganttChart.length, 2, 'RR slices Solo into two 2-unit segments');
    assertEqual(rrRes.processes[0].completionTime, 4, 'RR single process CT');
    assertEqual(rrRes.processes[0].waitingTime, 0, 'RR single process WT');
}

// -----------------------------------------------------------------------------
// Test 6: Equal Burst Times and Equal Priorities (Deterministic Tie-breaking)
// -----------------------------------------------------------------------------
console.log('▶ Test 6: Equal Burst Times and Equal Priorities (Tie-Breaking)');
{
    const workload = [
        { pid: 'Alpha', arrivalTime: 0, burstTime: 4, priority: 2 },
        { pid: 'Beta', arrivalTime: 0, burstTime: 4, priority: 2 }
    ];

    ['fcfs', 'sjf', 'priority'].forEach(algo => {
        const res = schedule(algo, workload);
        assertDeepEqual(res.executionOrder, ['Alpha', 'Beta'], `${algo} breaks tie by input order`);
    });
}

// -----------------------------------------------------------------------------
// Test 7: Round Robin with Multiple Preemptions & Mid-Slice Arrivals
// -----------------------------------------------------------------------------
console.log('▶ Test 7: Round Robin with Multiple Preemptions & Mid-Slice Arrivals');
{
    const workload = [
        { pid: 'P1', arrivalTime: 0, burstTime: 5 },
        { pid: 'P2', arrivalTime: 1, burstTime: 4 },
        { pid: 'P3', arrivalTime: 2, burstTime: 2 }
    ];

    const res = scheduleRoundRobin(workload, 2);
    verifyResultInvariants(res, workload);

    // Hand-calculated trace:
    // [0, 2] P1 (rem 3). P2 (arr 1), P3 (arr 2) admitted. Queue: [P2, P3, P1]
    // [2, 4] P2 (rem 2). Queue: [P3, P1, P2]
    // [4, 6] P3 (rem 0). Finished! Queue: [P1, P2]
    // [6, 8] P1 (rem 1). Queue: [P2, P1]
    // [8, 10] P2 (rem 0). Finished! Queue: [P1]
    // [10, 11] P1 (rem 0). Finished!
    const expectedGantt = [
        { pid: 'P1', startTime: 0, endTime: 2, remainingBurstAfter: 3 },
        { pid: 'P2', startTime: 2, endTime: 4, remainingBurstAfter: 2 },
        { pid: 'P3', startTime: 4, endTime: 6, remainingBurstAfter: 0 },
        { pid: 'P1', startTime: 6, endTime: 8, remainingBurstAfter: 1 },
        { pid: 'P2', startTime: 8, endTime: 10, remainingBurstAfter: 0 },
        { pid: 'P1', startTime: 10, endTime: 11, remainingBurstAfter: 0 }
    ];

    assertEqual(res.ganttChart.length, expectedGantt.length, 'RR Gantt segment count');
    for (let i = 0; i < expectedGantt.length; i++) {
        assertEqual(res.ganttChart[i].pid, expectedGantt[i].pid, `Segment ${i} PID`);
        assertEqual(res.ganttChart[i].startTime, expectedGantt[i].startTime, `Segment ${i} Start`);
        assertEqual(res.ganttChart[i].endTime, expectedGantt[i].endTime, `Segment ${i} End`);
        assertEqual(res.ganttChart[i].remainingBurstAfter, expectedGantt[i].remainingBurstAfter, `Segment ${i} Remaining Burst`);
    }

    const p1 = res.processes.find(p => p.pid === 'P1');
    assertEqual(p1.completionTime, 11, 'P1 CT');
    assertEqual(p1.turnaroundTime, 11, 'P1 TAT');
    assertEqual(p1.waitingTime, 6, 'P1 WT');
    assertEqual(p1.responseTime, 0, 'P1 RT');

    const p2 = res.processes.find(p => p.pid === 'P2');
    assertEqual(p2.completionTime, 10, 'P2 CT');
    assertEqual(p2.turnaroundTime, 9, 'P2 TAT');
    assertEqual(p2.waitingTime, 5, 'P2 WT');
    assertEqual(p2.responseTime, 1, 'P2 RT');

    const p3 = res.processes.find(p => p.pid === 'P3');
    assertEqual(p3.completionTime, 6, 'P3 CT');
    assertEqual(p3.turnaroundTime, 4, 'P3 TAT');
    assertEqual(p3.waitingTime, 2, 'P3 WT');
    assertEqual(p3.responseTime, 2, 'P3 RT');

    assertEqual(res.averageTurnaroundTime, 8.0, 'RR Avg TAT');
    assertCloseTo(res.averageWaitingTime, 13 / 3, 1e-4, 'RR Avg WT (13/3)');
    assertEqual(res.averageResponseTime, 1.0, 'RR Avg RT');
}

// -----------------------------------------------------------------------------
// Test 8: Non-preemptive Priority Scheduling Hand-Calculated Case
// -----------------------------------------------------------------------------
console.log('▶ Test 8: Non-Preemptive Priority Scheduling');
{
    const workload = [
        { pid: 'P1', arrivalTime: 0, burstTime: 4, priority: 3 },
        { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 },
        { pid: 'P3', arrivalTime: 2, burstTime: 1, priority: 4 },
        { pid: 'P4', arrivalTime: 3, burstTime: 5, priority: 2 }
    ];

    const res = schedulePriority(workload);
    verifyResultInvariants(res, workload);

    // Non-preemptive priority:
    // P1 runs [0, 4] (only job available at t=0)
    // At t=4: P2 (prio 1), P3 (prio 4), P4 (prio 2) are ready.
    // Smallest priority number = Highest priority: P2 (1) runs [4, 7]
    // At t=7: P4 (2) runs [7, 12]
    // At t=12: P3 (4) runs [12, 13]
    assertDeepEqual(res.executionOrder, ['P1', 'P2', 'P4', 'P3'], 'Priority execution order');

    const p1 = res.processes.find(p => p.pid === 'P1');
    assertEqual(p1.completionTime, 4, 'P1 CT');
    assertEqual(p1.turnaroundTime, 4, 'P1 TAT');
    assertEqual(p1.waitingTime, 0, 'P1 WT');

    const p2 = res.processes.find(p => p.pid === 'P2');
    assertEqual(p2.completionTime, 7, 'P2 CT');
    assertEqual(p2.turnaroundTime, 6, 'P2 TAT');
    assertEqual(p2.waitingTime, 3, 'P2 WT');

    const p4 = res.processes.find(p => p.pid === 'P4');
    assertEqual(p4.completionTime, 12, 'P4 CT');
    assertEqual(p4.turnaroundTime, 9, 'P4 TAT');
    assertEqual(p4.waitingTime, 4, 'P4 WT');

    const p3 = res.processes.find(p => p.pid === 'P3');
    assertEqual(p3.completionTime, 13, 'P3 CT');
    assertEqual(p3.turnaroundTime, 11, 'P3 TAT');
    assertEqual(p3.waitingTime, 10, 'P3 WT');

    assertEqual(res.averageTurnaroundTime, 7.5, 'Priority Avg TAT');
    assertEqual(res.averageWaitingTime, 4.25, 'Priority Avg WT');
    assertEqual(res.averageResponseTime, 4.25, 'Priority Avg RT');
}

// -----------------------------------------------------------------------------
// Test 9: Diverse Execution Orders Across All Four Algorithms
// -----------------------------------------------------------------------------
console.log('▶ Test 9: Distinct Execution Orders Across All Four Algorithms');
{
    const workload = [
        { pid: 'P1', arrivalTime: 0, burstTime: 4, priority: 3 },
        { pid: 'P2', arrivalTime: 1, burstTime: 2, priority: 1 },
        { pid: 'P3', arrivalTime: 1, burstTime: 1, priority: 2 },
        { pid: 'P4', arrivalTime: 2, burstTime: 3, priority: 0 }
    ];

    const fcfsRes = scheduleFCFS(workload);
    const sjfRes = scheduleSJF(workload);
    const prioRes = schedulePriority(workload);
    const rrRes = scheduleRoundRobin(workload, 1);

    // FCFS: P1, P2, P3, P4
    assertDeepEqual(fcfsRes.executionOrder, ['P1', 'P2', 'P3', 'P4'], 'FCFS Order');

    // SJF: P1, P3 (BT 1), P2 (BT 2), P4 (BT 3)
    assertDeepEqual(sjfRes.executionOrder, ['P1', 'P3', 'P2', 'P4'], 'SJF Order');

    // Priority: P1, P4 (Prio 0), P2 (Prio 1), P3 (Prio 2)
    assertDeepEqual(prioRes.executionOrder, ['P1', 'P4', 'P2', 'P3'], 'Priority Order');

    // RR completion order: P3, P2, P1, P4
    const rrCompletionOrder = [...rrRes.processes]
        .sort((a, b) => a.completionTime - b.completionTime)
        .map(p => p.pid);
    assertDeepEqual(rrCompletionOrder, ['P3', 'P2', 'P1', 'P4'], 'RR Completion Order');
}

// -----------------------------------------------------------------------------
// Test 10: Input Immutability & Deep Cloning
// -----------------------------------------------------------------------------
console.log('▶ Test 10: Input Immutability');
{
    const originalInput = [
        { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 2 },
        { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 1 }
    ];
    const snapshot = JSON.stringify(originalInput);

    scheduleFCFS(originalInput);
    scheduleSJF(originalInput);
    scheduleRoundRobin(originalInput, 2);
    schedulePriority(originalInput);

    assertEqual(JSON.stringify(originalInput), snapshot, 'Original input array and objects remain strictly untouched.');
}

// -----------------------------------------------------------------------------
// Test 11: Validation Errors & Edge Cases
// -----------------------------------------------------------------------------
console.log('▶ Test 11: Input Validation & Error Handling');
{
    // Non-array
    assertThrows(() => validateProcesses('not-an-array'), 'Processes input must be an array', 'Non-array input throws');

    // Duplicate PID
    assertThrows(() => validateProcesses([
        { pid: 'P1', arrivalTime: 0, burstTime: 2 },
        { pid: 'P1', arrivalTime: 1, burstTime: 3 }
    ]), 'Duplicate process ID "P1"', 'Duplicate PID throws');

    // Missing PID
    assertThrows(() => validateProcesses([
        { arrivalTime: 0, burstTime: 2 }
    ]), 'invalid or missing pid', 'Missing PID throws');

    // Negative arrival time
    assertThrows(() => validateProcesses([
        { pid: 'P1', arrivalTime: -1, burstTime: 2 }
    ]), 'negative arrivalTime', 'Negative arrival time throws');

    // Non-positive burst time
    assertThrows(() => validateProcesses([
        { pid: 'P1', arrivalTime: 0, burstTime: 0 }
    ]), 'non-positive burstTime', 'Zero burst time throws');
    assertThrows(() => validateProcesses([
        { pid: 'P1', arrivalTime: 0, burstTime: -4 }
    ]), 'non-positive burstTime', 'Negative burst time throws');

    // Missing priority when required
    assertThrows(() => schedulePriority([
        { pid: 'P1', arrivalTime: 0, burstTime: 2 }
    ]), 'requires a numeric priority', 'Missing priority for Priority Scheduling throws');

    // Invalid quantum for Round Robin
    assertThrows(() => validateQuantum(0), 'positive number (> 0)', 'Quantum 0 throws');
    assertThrows(() => validateQuantum(-3), 'positive number (> 0)', 'Quantum -3 throws');
    assertThrows(() => validateQuantum('abc'), 'positive number (> 0)', 'Non-numeric quantum throws');
    assertThrows(() => scheduleRoundRobin([{ pid: 'P1', arrivalTime: 0, burstTime: 3 }], 0), 'positive number (> 0)', 'RR with invalid quantum throws');

    // Empty workload handling
    const emptyRes = scheduleFCFS([]);
    assertEqual(emptyRes.totalElapsedTime, 0, 'Empty workload returns 0 elapsed time');
    assertEqual(emptyRes.processes.length, 0, 'Empty workload returns empty processes');
    assertEqual(emptyRes.ganttChart.length, 0, 'Empty workload returns empty ganttChart');
}

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} assertions passed, ${failedTests} failed.`);
console.log('STATUS: ' + (failedTests === 0 ? 'ALL TESTS PASSED SUCCESSFULLY! ✓' : 'FAILURES DETECTED! ✗'));
console.log('====================================================');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
