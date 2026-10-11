/**
 * Scheduler Arcade — Pedagogical Process Workloads
 * 
 * Defines structured, student-friendly workloads for each boss battle.
 * Kept strictly modular and separated from rendering logic.
 */

(function () {
    'use strict';

    const WORKLOADS = {
        fcfs: {
            bossId: 'fcfs',
            bossName: 'THE QUEUE TITAN',
            algorithmName: 'First-Come, First-Served',
            code: 'FCFS',
            description: 'Face the Queue Titan by respecting strict arrival order. Observe how the long burst of P1 delays shorter subsequent tasks (The Convoy Effect).',
            lesson: 'First-Come, First-Served (FCFS) guarantees strict FIFO arrival order without preemption. However, a lengthy job at the head of the ready queue causes the "Convoy Effect", inflating the average waiting time for agile, short processes behind it.',
            processes: [
                { pid: 'P1', arrivalTime: 0, burstTime: 6, priority: 2 },
                { pid: 'P2', arrivalTime: 1, burstTime: 2, priority: 1 },
                { pid: 'P3', arrivalTime: 2, burstTime: 4, priority: 3 },
                { pid: 'P4', arrivalTime: 4, burstTime: 3, priority: 2 }
            ]
        },
        sjf: {
            bossId: 'sjf',
            bossName: 'THE SPEED DEMON',
            algorithmName: 'Shortest Job First (Non-Preemptive)',
            code: 'SJF',
            description: 'Outsmart the Speed Demon by prioritizing the ready process with the minimal CPU burst duration. Once started, runs to completion.',
            lesson: 'Non-preemptive Shortest Job First is mathematically optimal for minimizing average waiting times. However, if short tasks arrive continuously, long-running processes suffer indefinite starvation.',
            processes: [
                { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 2 },
                { pid: 'P2', arrivalTime: 1, burstTime: 2, priority: 1 },
                { pid: 'P3', arrivalTime: 2, burstTime: 6, priority: 3 },
                { pid: 'P4', arrivalTime: 3, burstTime: 3, priority: 2 }
            ]
        },
        rr: {
            bossId: 'rr',
            bossName: 'THE TIME WIZARD',
            algorithmName: 'Round Robin Scheduling',
            code: 'RR',
            quantum: 2,
            description: 'Master the clockwork rhythm of the Time Wizard. Execute ready processes for at most one time quantum (q=2) and rotate them back to the ready queue.',
            lesson: 'Round Robin delivers equitable interactive response times through cyclical time slicing. Choosing the right time quantum (q) is critical: an excessively small quantum generates crushing context-switching overhead, while an excessively large quantum degenerates into FCFS.',
            processes: [
                { pid: 'P1', arrivalTime: 0, burstTime: 5, priority: 1 },
                { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 2 },
                { pid: 'P3', arrivalTime: 2, burstTime: 4, priority: 1 }
            ]
        },
        priority: {
            bossId: 'priority',
            bossName: 'THE PRIORITY KING',
            algorithmName: 'Priority Scheduling (Non-Preemptive)',
            code: 'PRIORITY',
            description: 'Navigate the royal court of the Priority King. Dispatches the ready process with the highest priority rank (smaller number = higher priority). Non-preemptive execution.',
            lesson: 'Non-preemptive Priority Scheduling guarantees that critical executive jobs (smaller rank number = higher privilege) execute before lower-tier commoners. To prevent low-priority tasks from starving permanently, real kernels apply dynamic priority aging.',
            processes: [
                { pid: 'P1', arrivalTime: 0, burstTime: 4, priority: 2 },
                { pid: 'P2', arrivalTime: 1, burstTime: 3, priority: 0 }, // Priority 0 is highest
                { pid: 'P3', arrivalTime: 2, burstTime: 2, priority: 3 }, // Priority 3 is lowest
                { pid: 'P4', arrivalTime: 3, burstTime: 4, priority: 1 }  // Priority 1 is high
            ]
        }
    };

    /**
     * Retrieves a clean clone of the workload configuration for a boss.
     * @param {string} bossId - 'fcfs' | 'sjf' | 'rr' | 'priority'
     * @returns {Object} Workload configuration.
     */
    function getWorkloadForBoss(bossId) {
        const key = String(bossId || 'fcfs').toLowerCase().trim();
        const base = WORKLOADS[key] || WORKLOADS.fcfs;

        return {
            bossId: base.bossId,
            bossName: base.bossName,
            algorithmName: base.algorithmName,
            code: base.code,
            quantum: base.quantum,
            description: base.description,
            lesson: base.lesson,
            processes: base.processes.map((p, index) => ({
                pid: p.pid,
                arrivalTime: p.arrivalTime,
                burstTime: p.burstTime,
                priority: p.priority,
                inputOrder: index
            }))
        };
    }

    const api = {
        WORKLOADS,
        getWorkloadForBoss
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.ArcadeGame = window.ArcadeGame || {};
        window.ArcadeGame.workloads = api;
    }
})();
