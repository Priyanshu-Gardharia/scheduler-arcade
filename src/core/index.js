/**
 * Scheduler Arcade — Core Scheduling Engine Index
 * 
 * Central entry point aggregating all scheduling algorithms,
 * metric calculations, and input validation utilities.
 */

(function () {
    'use strict';

    const validation = typeof require !== 'undefined' ? require('./validation') : window.SchedulerCore.validation;
    const metrics = typeof require !== 'undefined' ? require('./metrics') : window.SchedulerCore.metrics;
    const fcfs = typeof require !== 'undefined' ? require('./fcfs') : window.SchedulerCore.fcfs;
    const sjf = typeof require !== 'undefined' ? require('./sjf') : window.SchedulerCore.sjf;
    const roundRobin = typeof require !== 'undefined' ? require('./roundRobin') : window.SchedulerCore.roundRobin;
    const priority = typeof require !== 'undefined' ? require('./priority') : window.SchedulerCore.priority;

    /**
     * Dispatches scheduling requests dynamically based on algorithm identifier.
     * 
     * @param {string} algorithm - 'fcfs' | 'sjf' | 'rr' | 'priority'
     * @param {Array<Object>} processes - List of process definitions
     * @param {Object} [options={}] - Extra options (e.g., { quantum: 2 } for Round Robin)
     * @returns {Object} Structured scheduling results and performance metrics.
     */
    function schedule(algorithm, processes, options = {}) {
        const algoKey = String(algorithm || '').toLowerCase().trim();

        switch (algoKey) {
            case 'fcfs':
                return fcfs.scheduleFCFS(processes);
            case 'sjf':
                return sjf.scheduleSJF(processes);
            case 'rr':
            case 'roundrobin':
            case 'round_robin':
                return roundRobin.scheduleRoundRobin(processes, options.quantum);
            case 'priority':
                return priority.schedulePriority(processes);
            default:
                throw new Error(`Unsupported algorithm "${algorithm}". Supported: "fcfs", "sjf", "rr", "priority".`);
        }
    }

    const core = {
        // Validation & Errors
        ValidationError: validation.ValidationError,
        validateProcesses: validation.validateProcesses,
        validateQuantum: validation.validateQuantum,

        // Metric calculation
        calculateMetrics: metrics.calculateMetrics,

        // Specific Algorithms
        scheduleFCFS: fcfs.scheduleFCFS,
        scheduleSJF: sjf.scheduleSJF,
        scheduleRoundRobin: roundRobin.scheduleRoundRobin,
        schedulePriority: priority.schedulePriority,

        // Universal Dispatcher
        schedule
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = core;
    }
    if (typeof window !== 'undefined') {
        window.SchedulerCore = Object.assign(window.SchedulerCore || {}, core);
    }
})();
