/**
 * Scheduler Arcade — Shared CPU Scheduling Metrics Engine
 * 
 * Computes standard Operating Systems performance criteria:
 * - Completion Time (CT)
 * - Turnaround Time (TAT = CT - Arrival Time)
 * - Waiting Time (WT = TAT - Burst Time)
 * - Response Time (RT = First Start Time - Arrival Time)
 * - Averages, Total Elapsed Time, CPU Utilization, and Throughput.
 * 
 * Includes invariant verification to guarantee mathematical correctness.
 */

(function () {
    'use strict';

    /**
     * Calculates structured performance metrics from normalized processes and timeline segments.
     * 
     * @param {Array<Object>} processes - Normalized process definitions.
     * @param {Array<Object>} timeline - Ordered Gantt chart segments (process slices and idle intervals).
     * @returns {Object} Comprehensive metrics and verified performance summary.
     */
    function calculateMetrics(processes, timeline) {
        if (!Array.isArray(processes) || processes.length === 0) {
            return {
                processes: [],
                executionOrder: [],
                ganttChart: [],
                totalElapsedTime: 0,
                totalBusyTime: 0,
                totalIdleTime: 0,
                cpuUtilization: 0,
                throughput: 0,
                averageTurnaroundTime: 0,
                averageWaitingTime: 0,
                averageResponseTime: 0
            };
        }

        const processMap = new Map();
        processes.forEach(p => {
            processMap.set(p.pid, {
                pid: p.pid,
                arrivalTime: p.arrivalTime,
                burstTime: p.burstTime,
                priority: p.priority,
                inputOrder: p.inputOrder,
                firstStartTime: null,
                completionTime: null,
                turnaroundTime: null,
                waitingTime: null,
                responseTime: null,
                executedDuration: 0,
                slices: []
            });
        });

        let totalBusyTime = 0;
        let totalIdleTime = 0;
        const executionOrder = [];
        const seenOrderPids = new Set();

        // 1. Process timeline segments
        for (let i = 0; i < timeline.length; i++) {
            const segment = timeline[i];
            const duration = segment.endTime - segment.startTime;

            if (duration < 0) {
                throw new Error(`Invalid timeline segment at index ${i}: endTime (${segment.endTime}) < startTime (${segment.startTime})`);
            }

            if (segment.isIdle) {
                totalIdleTime += duration;
                continue;
            }

            const record = processMap.get(segment.pid);
            if (!record) {
                throw new Error(`Timeline references unknown process PID "${segment.pid}".`);
            }

            // Invariant: Process cannot run before its arrival
            if (segment.startTime < record.arrivalTime) {
                throw new Error(`Process "${segment.pid}" started execution at t=${segment.startTime} before its arrival at t=${record.arrivalTime}.`);
            }

            // Record first start time for Response Time (RT)
            if (record.firstStartTime === null) {
                record.firstStartTime = segment.startTime;
            }

            // Track completion time (updates with each slice until final slice)
            record.completionTime = segment.endTime;
            record.executedDuration += duration;
            totalBusyTime += duration;

            // Track slices
            record.slices.push({
                startTime: segment.startTime,
                endTime: segment.endTime,
                duration: duration
            });

            // Unique PID execution sequence
            if (!seenOrderPids.has(segment.pid)) {
                seenOrderPids.add(segment.pid);
                executionOrder.push(segment.pid);
            }
        }

        // 2. Compute individual process metrics & verify invariants
        const processResults = [];
        let totalTAT = 0;
        let totalWT = 0;
        let totalRT = 0;

        for (const p of processes) {
            const record = processMap.get(p.pid);

            if (record.completionTime === null) {
                throw new Error(`Process "${p.pid}" was never scheduled on the CPU.`);
            }

            // Invariant: Total executed CPU duration must exactly match process burst time
            // Use floating-point epsilon check for precision safety
            if (Math.abs(record.executedDuration - p.burstTime) > 1e-9) {
                throw new Error(`Process "${p.pid}" executed for ${record.executedDuration} time units, but required burstTime was ${p.burstTime}.`);
            }

            // Calculations
            record.turnaroundTime = record.completionTime - record.arrivalTime;
            record.waitingTime = record.turnaroundTime - record.burstTime;
            record.responseTime = record.firstStartTime - record.arrivalTime;

            // Sanity assertions
            if (record.turnaroundTime < record.burstTime) {
                throw new Error(`Process "${p.pid}" TAT (${record.turnaroundTime}) cannot be less than its burstTime (${record.burstTime}).`);
            }
            if (record.waitingTime < 0) {
                throw new Error(`Process "${p.pid}" has negative waiting time (${record.waitingTime}).`);
            }
            if (record.responseTime < 0) {
                throw new Error(`Process "${p.pid}" has negative response time (${record.responseTime}).`);
            }

            totalTAT += record.turnaroundTime;
            totalWT += record.waitingTime;
            totalRT += record.responseTime;

            processResults.push({
                pid: record.pid,
                arrivalTime: record.arrivalTime,
                burstTime: record.burstTime,
                priority: record.priority,
                firstStartTime: record.firstStartTime,
                completionTime: record.completionTime,
                turnaroundTime: record.turnaroundTime,
                waitingTime: record.waitingTime,
                responseTime: record.responseTime,
                slices: record.slices
            });
        }

        const count = processes.length;
        const totalElapsedTime = timeline.length > 0 ? timeline[timeline.length - 1].endTime : 0;

        // Invariant: Total elapsed time should equal total busy time + total idle time
        const sumTimelineTime = totalBusyTime + totalIdleTime;
        if (Math.abs(totalElapsedTime - sumTimelineTime) > 1e-9) {
            throw new Error(`Timeline duration mismatch: totalElapsedTime (${totalElapsedTime}) != busy (${totalBusyTime}) + idle (${totalIdleTime}).`);
        }

        /**
         * CPU Utilization Definition:
         * Percentage of total elapsed time that the CPU was actively executing processes.
         * Formula: (Total Busy Time / Total Elapsed Time) * 100
         */
        const cpuUtilization = totalElapsedTime > 0 ? (totalBusyTime / totalElapsedTime) * 100 : 0;

        /**
         * Throughput Definition:
         * Number of processes completed per unit of simulation time.
         * Formula: Total Completed Processes / Total Elapsed Time
         */
        const throughput = totalElapsedTime > 0 ? count / totalElapsedTime : 0;

        return {
            processes: processResults,
            executionOrder,
            ganttChart: timeline.map(segment => ({
                pid: segment.pid,
                isIdle: Boolean(segment.isIdle),
                startTime: segment.startTime,
                endTime: segment.endTime,
                duration: segment.endTime - segment.startTime,
                remainingBurstBefore: segment.remainingBurstBefore,
                remainingBurstAfter: segment.remainingBurstAfter
            })),
            totalElapsedTime,
            totalBusyTime,
            totalIdleTime,
            cpuUtilization: Number(cpuUtilization.toFixed(4)),
            throughput: Number(throughput.toFixed(6)),
            averageTurnaroundTime: Number((totalTAT / count).toFixed(4)),
            averageWaitingTime: Number((totalWT / count).toFixed(4)),
            averageResponseTime: Number((totalRT / count).toFixed(4))
        };
    }

    const api = {
        calculateMetrics
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.SchedulerCore = window.SchedulerCore || {};
        window.SchedulerCore.metrics = api;
    }
})();
