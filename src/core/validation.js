/**
 * Scheduler Arcade — Input Validation & Process Normalization
 * 
 * Validates process definitions, prevents mutations to caller objects,
 * and ensures robust preconditions for CPU scheduling simulations.
 */

(function () {
    'use strict';

    /**
     * Custom validation error with descriptive messages for students and developers.
     */
    class ValidationError extends Error {
        constructor(message, details = {}) {
            super(message);
            this.name = 'ValidationError';
            this.details = details;
        }
    }

    /**
     * Validates and normalizes an array of processes.
     * 
     * @param {Array<Object>} processes - List of raw process objects.
     * @param {Object} [options={}] - Validation options (e.g., requirePriority).
     * @returns {Array<Object>} Deep copy of validated, normalized process objects.
     * @throws {ValidationError} When process data violates OS preconditions.
     */
    function validateProcesses(processes, options = {}) {
        if (!Array.isArray(processes)) {
            throw new ValidationError('Processes input must be an array.', { processes });
        }

        if (processes.length === 0) {
            return [];
        }

        const seenPids = new Set();
        const normalized = [];

        for (let i = 0; i < processes.length; i++) {
            const raw = processes[i];

            if (!raw || typeof raw !== 'object') {
                throw new ValidationError(`Process at index ${i} must be a valid object.`, { index: i, raw });
            }

            // 1. Process ID (pid)
            if (raw.pid === undefined || raw.pid === null || String(raw.pid).trim() === '') {
                throw new ValidationError(`Process at index ${i} has an invalid or missing pid.`, { index: i, pid: raw.pid });
            }
            const pid = String(raw.pid).trim();

            if (seenPids.has(pid)) {
                throw new ValidationError(`Duplicate process ID "${pid}" detected at index ${i}. PIDs must be unique.`, { pid, index: i });
            }
            seenPids.add(pid);

            // 2. Arrival Time
            if (typeof raw.arrivalTime !== 'number' || !Number.isFinite(raw.arrivalTime)) {
                throw new ValidationError(`Process "${pid}" arrivalTime must be a finite number. Received: ${raw.arrivalTime}`, { pid, arrivalTime: raw.arrivalTime });
            }
            if (raw.arrivalTime < 0) {
                throw new ValidationError(`Process "${pid}" has negative arrivalTime (${raw.arrivalTime}). Arrival times must be non-negative (>= 0).`, { pid, arrivalTime: raw.arrivalTime });
            }

            // 3. Burst Time
            if (typeof raw.burstTime !== 'number' || !Number.isFinite(raw.burstTime)) {
                throw new ValidationError(`Process "${pid}" burstTime must be a finite number. Received: ${raw.burstTime}`, { pid, burstTime: raw.burstTime });
            }
            if (raw.burstTime <= 0) {
                throw new ValidationError(`Process "${pid}" has non-positive burstTime (${raw.burstTime}). Burst times must be strictly positive (> 0).`, { pid, burstTime: raw.burstTime });
            }

            // 4. Priority (Optional unless specified by requirePriority)
            let priority = undefined;
            if (options.requirePriority) {
                if (typeof raw.priority !== 'number' || !Number.isFinite(raw.priority)) {
                    throw new ValidationError(`Process "${pid}" requires a numeric priority. Received: ${raw.priority}`, { pid, priority: raw.priority });
                }
                priority = raw.priority;
            } else if (raw.priority !== undefined && raw.priority !== null) {
                if (typeof raw.priority !== 'number' || !Number.isFinite(raw.priority)) {
                    throw new ValidationError(`Process "${pid}" priority must be numeric if provided. Received: ${raw.priority}`, { pid, priority: raw.priority });
                }
                priority = raw.priority;
            }

            // Deep clone into a clean normalized record
            normalized.push({
                pid,
                arrivalTime: raw.arrivalTime,
                burstTime: raw.burstTime,
                priority,
                inputOrder: i // Preserved for deterministic tie-breaking
            });
        }

        return normalized;
    }

    /**
     * Validates a Round Robin time quantum.
     * 
     * @param {number} quantum - Time slice length.
     * @returns {number} Validated positive numeric quantum.
     * @throws {ValidationError} When quantum is not a positive finite number.
     */
    function validateQuantum(quantum) {
        if (typeof quantum !== 'number' || !Number.isFinite(quantum) || quantum <= 0) {
            throw new ValidationError(`Time quantum must be a positive number (> 0). Received: ${quantum}`, { quantum });
        }
        return quantum;
    }

    const api = {
        ValidationError,
        validateProcesses,
        validateQuantum
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.SchedulerCore = window.SchedulerCore || {};
        window.SchedulerCore.validation = api;
    }
})();
