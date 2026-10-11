/**
 * Scheduler Arcade — Priority Scheduling (Non-Preemptive)
 * 
 * Algorithm Characteristics:
 * - Non-Preemptive.
 * - Priority Convention: Smaller numerical rank = Higher priority (e.g., 0 > 1 > 2).
 * - Dispatch Discipline: Selects the ready process with the highest priority rank.
 * - Once awarded the CPU, the process executes uninterrupted to completion.
 * - Tie-Breaking: Broken by arrival time, then original input order / PID.
 * - Idle Intervals: Handled when no arrived process is ready at currentTime.
 */

(function () {
    'use strict';

    const { validateProcesses } = typeof require !== 'undefined' 
        ? require('./validation') 
        : window.SchedulerCore.validation;

    const { calculateMetrics } = typeof require !== 'undefined' 
        ? require('./metrics') 
        : window.SchedulerCore.metrics;

    /**
     * Executes non-preemptive Priority scheduling.
     * 
     * @param {Array<Object>} rawProcesses - Input process definitions (must include numeric priority).
     * @returns {Object} Structured scheduling results and verified metrics.
     */
    function schedulePriority(rawProcesses) {
        // Enforce that priority is provided for all processes
        const processes = validateProcesses(rawProcesses, { requirePriority: true });

        if (processes.length === 0) {
            return calculateMetrics([], []);
        }

        const remaining = processes.map(p => ({ ...p }));
        const timeline = [];
        let currentTime = 0;

        while (remaining.length > 0) {
            // Find all arrived, ready processes at currentTime
            const ready = remaining.filter(p => p.arrivalTime <= currentTime);

            if (ready.length === 0) {
                // CPU is idle: Advance to the earliest arrival time among remaining processes
                const nextArrival = Math.min(...remaining.map(p => p.arrivalTime));
                timeline.push({
                    isIdle: true,
                    pid: null,
                    startTime: currentTime,
                    endTime: nextArrival,
                    remainingBurstBefore: 0,
                    remainingBurstAfter: 0
                });
                currentTime = nextArrival;
                continue;
            }

            // Select job with highest priority (smallest numerical rank).
            // Tie-break deterministically: priority -> arrivalTime -> inputOrder -> pid
            ready.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                if (a.arrivalTime !== b.arrivalTime) {
                    return a.arrivalTime - b.arrivalTime;
                }
                if (a.inputOrder !== b.inputOrder) {
                    return a.inputOrder - b.inputOrder;
                }
                return String(a.pid).localeCompare(String(b.pid));
            });

            const selected = ready[0];

            // Non-preemptive execution to completion
            const startTime = currentTime;
            const endTime = currentTime + selected.burstTime;

            timeline.push({
                isIdle: false,
                pid: selected.pid,
                startTime,
                endTime,
                remainingBurstBefore: selected.burstTime,
                remainingBurstAfter: 0
            });

            currentTime = endTime;

            // Remove completed process from remaining pool
            const idx = remaining.findIndex(p => p.pid === selected.pid);
            if (idx !== -1) {
                remaining.splice(idx, 1);
            }
        }

        return calculateMetrics(processes, timeline);
    }

    const api = {
        schedulePriority
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.SchedulerCore = window.SchedulerCore || {};
        window.SchedulerCore.priority = api;
    }
})();
