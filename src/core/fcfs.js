/**
 * Scheduler Arcade — First-Come, First-Served (FCFS) Scheduling
 * 
 * Algorithm Characteristics:
 * - Non-Preemptive.
 * - Dispatch Discipline: Jobs execute in order of arrival time.
 * - Tie-Breaking: Simultaneous arrivals broken by original input order / PID.
 * - Idle Intervals: Recorded when no process is ready at currentTime.
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
     * Executes First-Come, First-Served scheduling on a set of processes.
     * 
     * @param {Array<Object>} rawProcesses - Input process definitions.
     * @returns {Object} Structured scheduling results and verified metrics.
     */
    function scheduleFCFS(rawProcesses) {
        const processes = validateProcesses(rawProcesses);

        if (processes.length === 0) {
            return calculateMetrics([], []);
        }

        // Sort by arrival time. Tie-break deterministically by input order.
        const queue = [...processes].sort((a, b) => {
            if (a.arrivalTime !== b.arrivalTime) {
                return a.arrivalTime - b.arrivalTime;
            }
            if (a.inputOrder !== b.inputOrder) {
                return a.inputOrder - b.inputOrder;
            }
            return String(a.pid).localeCompare(String(b.pid));
        });

        const timeline = [];
        let currentTime = 0;

        for (const p of queue) {
            // Check for CPU idle time before this process arrives
            if (p.arrivalTime > currentTime) {
                timeline.push({
                    isIdle: true,
                    pid: null,
                    startTime: currentTime,
                    endTime: p.arrivalTime,
                    remainingBurstBefore: 0,
                    remainingBurstAfter: 0
                });
                currentTime = p.arrivalTime;
            }

            const startTime = currentTime;
            const endTime = currentTime + p.burstTime;

            timeline.push({
                isIdle: false,
                pid: p.pid,
                startTime,
                endTime,
                remainingBurstBefore: p.burstTime,
                remainingBurstAfter: 0
            });

            currentTime = endTime;
        }

        return calculateMetrics(processes, timeline);
    }

    const api = {
        scheduleFCFS
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.SchedulerCore = window.SchedulerCore || {};
        window.SchedulerCore.fcfs = api;
    }
})();
