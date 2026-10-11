/**
 * Scheduler Arcade — Interactive Step-by-Step CPU Scheduling Simulator
 * 
 * Bridges real CPU scheduling algorithms with interactive gameplay.
 * Reuses the core scheduling modules in src/core/ as the authoritative source of truth.
 * Validates player dispatch choices against exact algorithmic rules and provides
 * clear pedagogical feedback.
 */

(function () {
    'use strict';

    // Import core scheduling engine modules
    const coreApi = typeof require !== 'undefined'
        ? require('../core/index')
        : (window.SchedulerCore || {});

    const workloadsApi = typeof require !== 'undefined'
        ? require('./workloads')
        : (window.ArcadeGame ? window.ArcadeGame.workloads : {});

    const { calculateMetrics, schedule } = coreApi;
    const { getWorkloadForBoss } = workloadsApi;

    class StepSimulator {
        constructor() {
            this.bossId = 'fcfs';
            this.algorithm = 'fcfs';
            this.algorithmName = 'First-Come, First-Served';
            this.quantum = 2;
            this.lesson = '';

            // State
            this.currentTime = 0;
            this.processes = [];
            this.readyQueue = [];
            this.ganttChart = [];
            this.isWaitingForDecision = false;
            this.isCompleted = false;
            this.currentRunning = null;

            // Precomputed reference results for post-battle verification
            this.expectedEngineResult = null;
            this.finalMetrics = null;
        }

        /**
         * Initialize the simulator with a specific boss level workload.
         * @param {string} bossId - 'fcfs' | 'sjf' | 'rr' | 'priority'
         * @param {Object} [customWorkload=null] - Optional override workload
         */
        init(bossId = 'fcfs', customWorkload = null) {
            const config = customWorkload || (getWorkloadForBoss ? getWorkloadForBoss(bossId) : null);
            if (!config) {
                throw new Error(`Unable to load workload configuration for boss "${bossId}".`);
            }

            this.bossId = config.bossId;
            this.algorithm = String(config.bossId).toLowerCase();
            this.algorithmName = config.algorithmName;
            this.quantum = config.quantum || 2;
            this.lesson = config.lesson;

            this.currentTime = 0;
            this.ganttChart = [];
            this.isCompleted = false;
            this.currentRunning = null;
            this.finalMetrics = null;

            // Clone process state records
            this.processes = config.processes.map((p, index) => ({
                pid: p.pid,
                arrivalTime: p.arrivalTime,
                burstTime: p.burstTime,
                priority: p.priority,
                remainingBurst: p.burstTime,
                status: 'unarrived', // 'unarrived' | 'ready' | 'running' | 'completed'
                firstStartTime: null,
                completionTime: null,
                inputOrder: index
            }));

            // Precompute expected results from core engine
            if (schedule) {
                try {
                    const cleanInputs = this.processes.map(p => ({
                        pid: p.pid,
                        arrivalTime: p.arrivalTime,
                        burstTime: p.burstTime,
                        priority: p.priority
                    }));
                    this.expectedEngineResult = schedule(this.algorithm, cleanInputs, { quantum: this.quantum });
                } catch (e) {
                    console.warn('[StepSimulator] Failed to precompute reference schedule:', e.message);
                }
            }

            // Ready queue starts empty
            this.readyQueue = [];

            // Check initial idle time if no process arrives at t=0
            const firstArrival = Math.min(...this.processes.map(p => p.arrivalTime));
            if (firstArrival > 0) {
                this.ganttChart.push({
                    pid: null,
                    isIdle: true,
                    startTime: 0,
                    endTime: firstArrival,
                    duration: firstArrival
                });
                this.currentTime = firstArrival;
            }

            // Admit all processes arriving at or before initial currentTime
            this.admitArrivedProcesses();

            this.isWaitingForDecision = this.readyQueue.length > 0;
        }

        /**
         * Admits unarrived processes whose arrivalTime <= currentTime into the readyQueue.
         */
        admitArrivedProcesses() {
            const arriving = this.processes.filter(p => p.status === 'unarrived' && p.arrivalTime <= this.currentTime);

            // Sort incoming arrivals by arrivalTime, then inputOrder, then pid
            arriving.sort((a, b) => {
                if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
                if (a.inputOrder !== b.inputOrder) return a.inputOrder - b.inputOrder;
                return String(a.pid).localeCompare(String(b.pid));
            });

            for (const p of arriving) {
                p.status = 'ready';
                this.readyQueue.push(p);
            }
        }

        /**
         * Returns list of processes currently eligible to be dispatched.
         */
        getEligibleChoices() {
            return [...this.readyQueue];
        }

        /**
         * Computes the uniquely correct process according to the core scheduling engine.
         */
        getCanonicalChoice() {
            if (this.readyQueue.length === 0) return null;

            const pool = [...this.readyQueue];

            switch (this.algorithm) {
                case 'fcfs':
                    // Earliest arrival. Tie-breaker: inputOrder -> pid
                    pool.sort((a, b) => {
                        if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
                        if (a.inputOrder !== b.inputOrder) return a.inputOrder - b.inputOrder;
                        return String(a.pid).localeCompare(String(b.pid));
                    });
                    return pool[0];

                case 'sjf':
                    // Shortest remaining/initial burst. Tie-breaker: arrivalTime -> inputOrder -> pid
                    pool.sort((a, b) => {
                        if (a.burstTime !== b.burstTime) return a.burstTime - b.burstTime;
                        if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
                        if (a.inputOrder !== b.inputOrder) return a.inputOrder - b.inputOrder;
                        return String(a.pid).localeCompare(String(b.pid));
                    });
                    return pool[0];

                case 'rr':
                    // Strict head of FIFO ready queue
                    return pool[0];

                case 'priority':
                    // Smallest priority rank number. Tie-breaker: arrivalTime -> inputOrder -> pid
                    pool.sort((a, b) => {
                        if (a.priority !== b.priority) return a.priority - b.priority;
                        if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
                        if (a.inputOrder !== b.inputOrder) return a.inputOrder - b.inputOrder;
                        return String(a.pid).localeCompare(String(b.pid));
                    });
                    return pool[0];

                default:
                    return pool[0];
            }
        }

        /**
         * Validates a player's proposed process dispatch selection.
         * @param {string} chosenPid 
         * @returns {Object} Validation outcome with explanatory rationale.
         */
        validateDecision(chosenPid) {
            const canonical = this.getCanonicalChoice();
            if (!canonical) {
                return {
                    valid: false,
                    error: 'NO_ELIGIBLE_PROCESS',
                    message: 'No processes are currently waiting in the ready queue!'
                };
            }

            const chosen = this.processes.find(p => p.pid === chosenPid);
            if (!chosen) {
                return {
                    valid: false,
                    error: 'UNKNOWN_PID',
                    message: `Process "${chosenPid}" does not exist in this workload!`
                };
            }

            // Check if process has not arrived yet
            if (chosen.arrivalTime > this.currentTime) {
                return {
                    valid: false,
                    error: 'NOT_ARRIVED',
                    message: `Process ${chosen.pid} has NOT arrived yet! It arrives at t=${chosen.arrivalTime}, but the CPU clock is at t=${this.currentTime}.`
                };
            }

            // Check if process is already completed
            if (chosen.remainingBurst === 0 || chosen.status === 'completed') {
                return {
                    valid: false,
                    error: 'ALREADY_COMPLETED',
                    message: `Process ${chosen.pid} has already completed execution!`
                };
            }

            // Check if choice matches canonical rule
            if (chosen.pid === canonical.pid) {
                return {
                    valid: true,
                    canonicalPid: canonical.pid,
                    explanation: this.generateSuccessExplanation(canonical)
                };
            }

            // Choice is incorrect — generate educational feedback
            return {
                valid: false,
                error: 'RULE_VIOLATION',
                correctPid: canonical.pid,
                chosenPid: chosen.pid,
                message: this.generateFailureExplanation(canonical, chosen)
            };
        }

        generateSuccessExplanation(canonical) {
            switch (this.algorithm) {
                case 'fcfs':
                    return `Correct! Under FCFS, process ${canonical.pid} arrived earliest at t=${canonical.arrivalTime} and must be executed next.`;
                case 'sjf':
                    return `Correct! Under Shortest Job First, process ${canonical.pid} has the smallest burst duration (${canonical.burstTime}ms) among arrived tasks.`;
                case 'rr':
                    return `Correct! Under Round Robin, process ${canonical.pid} is at the head of the circular ready queue for a ${this.quantum}ms quantum slice.`;
                case 'priority':
                    return `Correct! Under Priority Scheduling, process ${canonical.pid} has the highest priority rank (${canonical.priority}) among ready tasks.`;
                default:
                    return `Correct dispatch decision!`;
            }
        }

        generateFailureExplanation(canonical, chosen) {
            switch (this.algorithm) {
                case 'fcfs':
                    return `Scheduling Violation (FIFO Lock Triggered): First-Come, First-Served mandates strictly earliest arrival order! Process ${canonical.pid} arrived at t=${canonical.arrivalTime}, earlier than process ${chosen.pid} (arrived at t=${chosen.arrivalTime}).`;
                case 'sjf':
                    return `Scheduling Violation (Shortest Job Shield Deflection): Shortest Job First demands dispatching the ready process with the minimal burst length! Process ${canonical.pid} requires ${canonical.burstTime}ms, whereas process ${chosen.pid} requires ${chosen.burstTime}ms.`;
                case 'rr':
                    return `Scheduling Violation (Quantum Clock Desync): Round Robin mandates dispatching strictly from the head of the ready queue! Process ${canonical.pid} is at the front of the queue, while process ${chosen.pid} is further behind.`;
                case 'priority':
                    return `Scheduling Violation (Royal Override Decree): Priority Scheduling mandates choosing the lowest numerical priority rank! Process ${canonical.pid} has priority ${canonical.priority}, which outranks process ${chosen.pid} (priority ${chosen.priority}).`;
                default:
                    return `Scheduling Violation: Selected process violates the ${this.algorithmName} dispatch rule.`;
            }
        }

        /**
         * Executes the dispatch decision and advances simulated CPU state.
         * @param {string} chosenPid 
         * @returns {Object} Execution step result.
         */
        step(chosenPid) {
            const validation = this.validateDecision(chosenPid);
            if (!validation.valid) {
                throw new Error(validation.message);
            }

            const procIndex = this.readyQueue.findIndex(p => p.pid === chosenPid);
            const proc = this.readyQueue.splice(procIndex, 1)[0];

            const startTime = this.currentTime;
            let duration = 0;

            // Record first start time
            if (proc.firstStartTime === null) {
                proc.firstStartTime = startTime;
            }

            if (this.algorithm === 'rr') {
                // Round Robin: runs for at most one time quantum
                duration = Math.min(this.quantum, proc.remainingBurst);
                proc.remainingBurst -= duration;
            } else {
                // Non-preemptive (FCFS, SJF, Priority): runs to completion
                duration = proc.remainingBurst;
                proc.remainingBurst = 0;
            }

            const endTime = startTime + duration;
            this.currentTime = endTime;

            // Record Gantt segment
            this.ganttChart.push({
                pid: proc.pid,
                isIdle: false,
                startTime,
                endTime,
                duration
            });

            // Admit newly arrived processes that arrived during (startTime, endTime]
            this.admitArrivedProcesses();

            // Requeue or complete the process
            const wasRequeued = proc.remainingBurst > 0;
            if (wasRequeued) {
                proc.status = 'ready';
                this.readyQueue.push(proc); // Appended to rear of readyQueue
            } else {
                proc.status = 'completed';
                proc.completionTime = endTime;
            }

            // Check if ready queue is empty while unarrived processes remain (CPU Idle Gap)
            if (this.readyQueue.length === 0) {
                const unarrived = this.processes.filter(p => p.status === 'unarrived');
                if (unarrived.length > 0) {
                    const nextArrival = Math.min(...unarrived.map(p => p.arrivalTime));
                    this.ganttChart.push({
                        pid: null,
                        isIdle: true,
                        startTime: this.currentTime,
                        endTime: nextArrival,
                        duration: nextArrival - this.currentTime
                    });
                    this.currentTime = nextArrival;
                    this.admitArrivedProcesses();
                }
            }

            // Check overall workload completion
            const allCompleted = this.processes.every(p => p.status === 'completed');
            if (allCompleted) {
                this.isCompleted = true;
                this.isWaitingForDecision = false;
                this.finalizeMetrics();
            } else {
                this.isWaitingForDecision = this.readyQueue.length > 0;
            }

            return {
                executedPid: proc.pid,
                startTime,
                endTime,
                duration,
                remainingBurst: proc.remainingBurst,
                wasRequeued,
                isCompleted: this.isCompleted,
                nextCanonicalChoice: this.getCanonicalChoice()
            };
        }

        /**
         * Computes verified metrics after workload completion.
         */
        finalizeMetrics() {
            if (calculateMetrics) {
                const cleanInputs = this.processes.map(p => ({
                    pid: p.pid,
                    arrivalTime: p.arrivalTime,
                    burstTime: p.burstTime,
                    priority: p.priority,
                    inputOrder: p.inputOrder
                }));

                this.finalMetrics = calculateMetrics(cleanInputs, this.ganttChart);
            }
        }

        /**
         * Returns a clean representation of the current live simulation state.
         */
        getLiveState() {
            return {
                bossId: this.bossId,
                algorithm: this.algorithm,
                algorithmName: this.algorithmName,
                quantum: this.quantum,
                lesson: this.lesson,
                currentTime: this.currentTime,
                processes: this.processes.map(p => ({ ...p })),
                readyQueue: this.readyQueue.map(p => ({ ...p })),
                ganttChart: [...this.ganttChart],
                isWaitingForDecision: this.isWaitingForDecision,
                isCompleted: this.isCompleted,
                eligibleChoices: this.getEligibleChoices(),
                canonicalChoice: this.getCanonicalChoice(),
                finalMetrics: this.finalMetrics,
                expectedEngineResult: this.expectedEngineResult
            };
        }
    }

    const api = {
        StepSimulator
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.ArcadeGame = window.ArcadeGame || {};
        window.ArcadeGame.stepSimulator = api;
    }
})();
