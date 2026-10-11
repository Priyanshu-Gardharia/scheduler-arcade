/**
 * Scheduler Arcade — Round Robin (RR) Scheduling
 * 
 * Algorithm Characteristics:
 * - Preemptive Scheduling.
 * - Time Slicing: Each ready process receives at most one configurable time quantum (q).
 * - Ready Queue: Strict FIFO queue.
 * - Arrival Priority: Processes arriving during an active time slice enter the ready queue
 *   BEFORE an unfinished preempted process is requeued.
 * - Idle Intervals: Handled when the ready queue is empty but unarrived tasks remain.
 */

(function () {
    'use strict';

    const { validateProcesses, validateQuantum } = typeof require !== 'undefined' 
        ? require('./validation') 
        : window.SchedulerCore.validation;

    const { calculateMetrics } = typeof require !== 'undefined' 
        ? require('./metrics') 
        : window.SchedulerCore.metrics;

    /**
     * Executes Round Robin scheduling with a configurable time quantum.
     * 
     * @param {Array<Object>} rawProcesses - Input process definitions.
     * @param {number} rawQuantum - Time slice duration (> 0).
     * @returns {Object} Structured scheduling results and verified metrics.
     */
    function scheduleRoundRobin(rawProcesses, rawQuantum) {
        const processes = validateProcesses(rawProcesses);
        const quantum = validateQuantum(rawQuantum);

        if (processes.length === 0) {
            return calculateMetrics([], []);
        }

        // Prepare process state tracking
        const unarrived = processes
            .map(p => ({
                pid: p.pid,
                arrivalTime: p.arrivalTime,
                burstTime: p.burstTime,
                remainingBurst: p.burstTime,
                inputOrder: p.inputOrder
            }))
            .sort((a, b) => {
                if (a.arrivalTime !== b.arrivalTime) {
                    return a.arrivalTime - b.arrivalTime;
                }
                return a.inputOrder - b.inputOrder;
            });

        const readyQueue = [];
        const timeline = [];
        let currentTime = 0;

        // Admit any processes arriving at t=0
        while (unarrived.length > 0 && unarrived[0].arrivalTime <= currentTime) {
            readyQueue.push(unarrived.shift());
        }

        while (readyQueue.length > 0 || unarrived.length > 0) {
            // Case 1: Ready queue is empty, but processes have yet to arrive (CPU Idle)
            if (readyQueue.length === 0) {
                const nextArrival = unarrived[0].arrivalTime;

                timeline.push({
                    isIdle: true,
                    pid: null,
                    startTime: currentTime,
                    endTime: nextArrival,
                    remainingBurstBefore: 0,
                    remainingBurstAfter: 0
                });

                currentTime = nextArrival;

                // Admit all processes arriving at or before this new timestamp
                while (unarrived.length > 0 && unarrived[0].arrivalTime <= currentTime) {
                    readyQueue.push(unarrived.shift());
                }
                continue;
            }

            // Case 2: Dequeue next ready process from front of queue
            const current = readyQueue.shift();
            const slice = Math.min(quantum, current.remainingBurst);
            const startTime = currentTime;
            const endTime = currentTime + slice;
            const burstBefore = current.remainingBurst;
            const burstAfter = current.remainingBurst - slice;

            current.remainingBurst = burstAfter;

            timeline.push({
                isIdle: false,
                pid: current.pid,
                startTime,
                endTime,
                remainingBurstBefore: burstBefore,
                remainingBurstAfter: burstAfter
            });

            currentTime = endTime;

            // Admit any new processes that arrived during this execution slice (startTime < arrival <= endTime)
            // OS Rule: Newly arrived jobs enter the ready queue BEFORE a preempted job is requeued.
            while (unarrived.length > 0 && unarrived[0].arrivalTime <= currentTime) {
                readyQueue.push(unarrived.shift());
            }

            // If the process has remaining burst, place it at the rear of the ready queue
            if (current.remainingBurst > 0) {
                readyQueue.push(current);
            }
        }

        return calculateMetrics(processes, timeline);
    }

    const api = {
        scheduleRoundRobin
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.SchedulerCore = window.SchedulerCore || {};
        window.SchedulerCore.roundRobin = api;
    }
})();
