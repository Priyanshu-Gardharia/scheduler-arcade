/**
 * Scheduler Arcade — Shortest Job First (SJF) Scheduling
 * 
 * Algorithm Characteristics:
 * - Non-Preemptive.
 * - Dispatch Discipline: Selects the ready process with the minimal CPU burst duration.
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
     * Executes non-preemptive Shortest Job First scheduling.
     * 
     * @param {Array<Object>} rawProcesses - Input process definitions.
     * @returns {Object} Structured scheduling results and verified metrics.
     */
    function scheduleSJF(rawProcesses) {
        const processes = validateProcesses(rawProcesses);

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

            // Select job with shortest burst time.
            // Tie-break deterministically: burstTime -> arrivalTime -> inputOrder -> pid
            ready.sort((a, b) => {
                if (a.burstTime !== b.burstTime) {
                    return a.burstTime - b.burstTime;
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
        scheduleSJF
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.SchedulerCore = window.SchedulerCore || {};
        window.SchedulerCore.sjf = api;
    }
})();
