/**
 * SCHEDULER ARCADE — Core Navigation & Arcade Dispatch Logic
 * Step 2: Main Menu, Algorithm Selection & Boss Dossiers
 */

console.log("Scheduler Arcade: script.js successfully connected.");

(function () {
    'use strict';

    // =========================================================================
    // 1. Algorithmic Boss Dossier Database
    // =========================================================================
    const BOSS_DATA = {
        fcfs: {
            id: 'fcfs',
            name: 'THE QUEUE TITAN',
            algorithm: 'First-Come, First-Served',
            code: 'FCFS',
            type: 'NON-PREEMPTIVE',
            rule: 'Executes processes in strict order of their arrival. Once awarded CPU control, the titan never yields until execution terminates.',
            vulnerability: 'Convoy Effect — A massive CPU burst monopolizes execution, trapping short processes behind it.',
            description: 'You stand at the kernel dispatch gate. In this battle, you will face incoming bursts with varied arrival timestamps. Predict the Queue Titan’s next schedule step, compute process completion times, and calculate average turnaround time before the ready queue buffer overflows.',
            overhead: 'O(1) FIFO Queue',
            preemption: 'None (Cooperative)',
            metric: 'Throughput (Predictable Workloads)',
            countermeasure: 'Short Job Interleaving & Batching',
            svg: `
                <svg class="boss-svg" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="160" rx="6" fill="#f6f1e5"/>
                    <rect x="50" y="40" width="100" height="100" rx="6" fill="#e2dac8" stroke="#163323" stroke-width="2.2"/>
                    <path d="M 65 40 L 75 22 L 125 22 L 135 40 Z" fill="#d2c8b2" stroke="#163323" stroke-width="2"/>
                    <circle cx="80" cy="75" r="16" fill="#ede5d2" stroke="#163323" stroke-width="1.8"/>
                    <circle cx="80" cy="75" r="5" fill="#163323"/>
                    <circle cx="120" cy="75" r="16" fill="#ede5d2" stroke="#163323" stroke-width="1.8"/>
                    <circle cx="120" cy="75" r="5" fill="#163323"/>
                    <line x1="80" y1="91" x2="120" y2="91" stroke="#c45126" stroke-width="2"/>
                    <line x1="80" y1="59" x2="120" y2="59" stroke="#163323" stroke-width="1.5"/>
                    <rect x="64" y="102" width="72" height="26" rx="3" fill="#163323"/>
                    <text x="100" y="119" font-family="'Space Grotesk', sans-serif" font-size="11" font-weight="700" fill="#fbf8ee" text-anchor="middle">FIRST-IN</text>
                    <rect x="36" y="55" width="16" height="50" rx="3" fill="#cfc4ac" stroke="#163323" stroke-width="1.8"/>
                    <rect x="148" y="55" width="16" height="50" rx="3" fill="#cfc4ac" stroke="#163323" stroke-width="1.8"/>
                    <rect x="82" y="32" width="12" height="4" fill="#c45126"/>
                    <rect x="106" y="32" width="12" height="4" fill="#c45126"/>
                </svg>
            `
        },
        sjf: {
            id: 'sjf',
            name: 'THE SPEED DEMON',
            algorithm: 'Shortest Job First (Non-Preemptive)',
            code: 'SJF',
            type: 'NON-PREEMPTIVE',
            rule: 'Selects the ready process with the smallest CPU burst duration. Under non-preemptive SJF, once a process is allocated the CPU, it runs to completion without interruption even if a shorter job subsequently enters the ready queue.',
            vulnerability: 'Starvation Hazard — Continuous streams of short bursts starve lengthy background computations indefinitely.',
            description: 'The Speed Demon hunts down minimal burst durations with predatory precision. In non-preemptive Shortest Job First, the ready process with the shortest burst executes uninterrupted to completion. Calculate completion and turnaround times accurately while managing the persistent risk of starving long-running jobs.',
            overhead: 'O(log n) Priority Heap',
            preemption: 'None (Non-Preemptive)',
            metric: 'Min. Average Waiting Time (for static arrivals)',
            countermeasure: 'Burst Estimation & Aging Protocols',
            svg: `
                <svg class="boss-svg" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="160" rx="6" fill="#f4f7ee"/>
                    <path d="M 25 85 L 70 50 L 70 115 Z" fill="#cfddb2" stroke="#163323" stroke-width="1.8"/>
                    <path d="M 175 85 L 130 50 L 130 115 Z" fill="#cfddb2" stroke="#163323" stroke-width="1.8"/>
                    <path d="M 100 20 L 135 65 L 125 130 L 75 130 L 65 65 Z" fill="#5d6d39" stroke="#163323" stroke-width="2.2"/>
                    <ellipse cx="100" cy="58" rx="24" ry="12" fill="#163323"/>
                    <line x1="82" y1="58" x2="118" y2="58" stroke="#d49b29" stroke-width="2"/>
                    <circle cx="100" cy="58" r="4" fill="#c45126"/>
                    <rect x="80" y="86" width="40" height="18" rx="3" fill="#fdfbf5" stroke="#163323" stroke-width="1.5"/>
                    <text x="100" y="99" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="700" fill="#5d6d39" text-anchor="middle">MIN(B)</text>
                    <path d="M 85 130 L 75 150 L 95 142 Z" fill="#c45126"/>
                    <path d="M 115 130 L 125 150 L 105 142 Z" fill="#c45126"/>
                </svg>
            `
        },
        rr: {
            id: 'rr',
            name: 'THE TIME WIZARD',
            algorithm: 'Round Robin Scheduling',
            code: 'RR',
            type: 'PREEMPTIVE ROTATION',
            rule: 'Allocates a configurable time quantum (q) to each ready process in circular order. Preempts immediately when the quantum timer fires, placing the process at the tail of the ready queue.',
            vulnerability: 'Thrashing Overhead — An excessively small time quantum causes crippling context-switch penalties, while a very large quantum degenerates into FCFS.',
            description: 'The Time Wizard bends CPU cycles into equal, equitable slices governed by a configurable time quantum (q). Master the ticking rhythm of the quantum timer, track remaining burst slices, and rotate processes back to the tail of the queue without dropping context registers.',
            overhead: 'O(1) Circular Queue',
            preemption: 'Timer-Interrupt Enforced (Configurable Quantum)',
            metric: 'Interactive Response Time',
            countermeasure: 'Quantum Calibration (Balancing response time vs context switch cost)',
            svg: `
                <svg class="boss-svg" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="160" rx="6" fill="#fbf7ec"/>
                    <circle cx="100" cy="80" r="48" fill="#f4efe2" stroke="#163323" stroke-width="2.2"/>
                    <path d="M 100 32 A 48 48 0 0 1 148 80" stroke="#c45126" stroke-width="4" stroke-linecap="round"/>
                    <path d="M 148 80 A 48 48 0 0 1 100 128" stroke="#5d6d39" stroke-width="4" stroke-linecap="round"/>
                    <path d="M 100 128 A 48 48 0 0 1 52 80" stroke="#d49b29" stroke-width="4" stroke-linecap="round"/>
                    <path d="M 52 80 A 48 48 0 0 1 100 32" stroke="#3e5245" stroke-width="4" stroke-linecap="round"/>
                    <path d="M 80 65 L 100 22 L 120 65 Z" fill="#163323" stroke="#163323" stroke-width="1.5"/>
                    <circle cx="100" cy="76" r="16" fill="#e7dfcf" stroke="#163323" stroke-width="1.8"/>
                    <circle cx="94" cy="74" r="4" fill="#c45126"/>
                    <circle cx="106" cy="74" r="4" fill="#c45126"/>
                    <line x1="100" y1="80" x2="100" y2="60" stroke="#163323" stroke-width="2" stroke-linecap="round"/>
                    <line x1="100" y1="80" x2="116" y2="80" stroke="#c45126" stroke-width="2" stroke-linecap="round"/>
                    <path d="M 68 45 L 75 42 L 72 50" fill="#163323"/>
                    <path d="M 132 115 L 125 118 L 128 110" fill="#163323"/>
                </svg>
            `
        },
        priority: {
            id: 'priority',
            name: 'THE PRIORITY KING',
            algorithm: 'Priority Scheduling (Non-Preemptive)',
            code: 'PRIORITY',
            type: 'NON-PREEMPTIVE',
            rule: 'Dispatches the process with the highest priority rank, where a smaller priority number represents a higher priority (e.g., Priority 0 is the highest). Our initial implementation operates in non-preemptive mode: once awarded the CPU, a process executes to completion without being preempted by higher-priority arrivals.',
            vulnerability: 'Indefinite Blocking — Low-priority workloads (larger priority numbers) languish indefinitely unless an aging protocol is applied.',
            description: 'The Priority King demands unquestioned deference to top-ranking jobs (where smaller priority numbers signify higher priority). In our initial non-preemptive implementation, once a job starts, newly arriving higher-priority tasks must wait for it to finish. Monitor starved low-tier processes and learn to deploy dynamic aging before critical system timeouts occur.',
            overhead: 'O(log n) Priority Queue',
            preemption: 'None (Initial Non-Preemptive Implementation)',
            metric: 'Urgent / High-Priority Throughput',
            countermeasure: 'Dynamic Aging Protocol',
            svg: `
                <svg class="boss-svg" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="160" rx="6" fill="#fdfbf2"/>
                    <path d="M 55 140 L 70 65 L 130 65 L 145 140 Z" fill="#d49b29" stroke="#163323" stroke-width="2.2"/>
                    <rect x="74" y="65" width="52" height="18" rx="2" fill="#fbf8ee" stroke="#163323" stroke-width="1.8"/>
                    <circle cx="84" cy="74" r="2" fill="#163323"/>
                    <circle cx="100" cy="74" r="2" fill="#163323"/>
                    <circle cx="116" cy="74" r="2" fill="#163323"/>
                    <rect x="80" y="45" width="40" height="24" rx="4" fill="#e7dfcf" stroke="#163323" stroke-width="2"/>
                    <path d="M 72 45 L 80 22 L 93 34 L 100 16 L 107 34 L 120 22 L 128 45 Z" fill="#c45126" stroke="#163323" stroke-width="2"/>
                    <circle cx="100" cy="24" r="3" fill="#ffffff"/>
                    <line x1="150" y1="40" x2="160" y2="135" stroke="#163323" stroke-width="2.5"/>
                    <circle cx="148" cy="38" r="8" fill="#d49b29" stroke="#163323" stroke-width="1.8"/>
                    <text x="148" y="41" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="700" fill="#163323" text-anchor="middle">#0</text>
                    <rect x="84" y="94" width="32" height="20" rx="2" fill="#163323"/>
                    <text x="100" y="108" font-family="'Space Grotesk', sans-serif" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">PRIO</text>
                </svg>
            `
        }
    };

    // =========================================================================
    // 2. Navigation State Management & Game Arena Hooks
    // =========================================================================
    let currentScreenId = 'screen-main-menu';
    let activeBossId = 'fcfs';

    /**
     * Switch view to the target screen id.
     * @param {string} targetScreenId 
     * @param {object} options 
     */
    function navigateTo(targetScreenId, options = {}) {
        const screens = document.querySelectorAll('.screen');
        const targetScreen = document.getElementById(targetScreenId);

        if (!targetScreen) {
            console.warn(`Screen with ID "${targetScreenId}" not found.`);
            return;
        }

        // Clean up active game loop if leaving the game arena
        if (currentScreenId === 'screen-game' && targetScreenId !== 'screen-game') {
            if (typeof window !== 'undefined' && window.ArcadeGame && window.ArcadeGame.engine) {
                window.ArcadeGame.engine.instance.stop();
            }
        }

        screens.forEach(screen => {
            if (screen.id === targetScreenId) {
                screen.classList.add('screen-active');
                screen.setAttribute('aria-hidden', 'false');
            } else {
                screen.classList.remove('screen-active');
                screen.setAttribute('aria-hidden', 'true');
            }
        });

        currentScreenId = targetScreenId;

        // Scroll to top of page smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Focus management for keyboard accessibility
        const heading = targetScreen.querySelector('h1, h2, h3');
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus();
        }

        console.log(`[Navigation] Transitioned to: ${targetScreenId}`);
    }

    /**
     * Populate the Boss Dossier view with specific boss data.
     * @param {string} bossId 
     */
    function displayBossDossier(bossId) {
        const data = BOSS_DATA[bossId];
        if (!data) {
            console.error(`Boss with ID "${bossId}" not found in database.`);
            return;
        }

        activeBossId = bossId;

        // Populate elements
        const nameEl = document.getElementById('dossier-boss-name');
        const algoNameEl = document.getElementById('dossier-algo-name');
        const codeEl = document.getElementById('dossier-algo-code');
        const typeEl = document.getElementById('dossier-algo-type');
        const ruleEl = document.getElementById('dossier-rule-text');
        const descEl = document.getElementById('dossier-description-text');
        const vulnEl = document.getElementById('dossier-vulnerability');
        const artEl = document.getElementById('dossier-art');
        const badgeEl = document.getElementById('dossier-badge');
        const overheadEl = document.getElementById('dossier-overhead');
        const preemptionEl = document.getElementById('dossier-preemption');
        const metricEl = document.getElementById('dossier-metric');
        const counterEl = document.getElementById('dossier-countermeasure');

        if (nameEl) nameEl.textContent = data.name;
        if (algoNameEl) algoNameEl.textContent = data.algorithm;
        if (codeEl) codeEl.textContent = data.code;
        if (typeEl) typeEl.textContent = data.type;
        if (ruleEl) ruleEl.textContent = data.rule;
        if (descEl) descEl.textContent = data.description;
        if (vulnEl) vulnEl.textContent = data.vulnerability;
        if (artEl) artEl.innerHTML = data.svg;
        if (badgeEl) badgeEl.textContent = `DOSSIER FILE // ${data.code} GUARDIAN`;
        if (overheadEl) overheadEl.textContent = data.overhead;
        if (preemptionEl) preemptionEl.textContent = data.preemption;
        if (metricEl) metricEl.textContent = data.metric;
        if (counterEl) counterEl.textContent = data.countermeasure;

        navigateTo('screen-boss-intro');
        console.log(`[Boss Dossier] Loaded profile: ${data.name} (${data.code})`);
    }

    /**
     * Launch the 2D arena battle for the selected boss.
     */
    function startBossLevel(bossId) {
        const targetBoss = bossId || activeBossId || 'fcfs';
        navigateTo('screen-game');

        if (typeof window !== 'undefined' && window.ArcadeGame && window.ArcadeGame.engine) {
            const canvas = document.getElementById('game-canvas');
            if (canvas && !window.ArcadeGame.engine.instance.canvas) {
                window.ArcadeGame.engine.instance.init(canvas);
            }
            window.ArcadeGame.engine.instance.startLevel(targetBoss);
            console.log(`[Game Arena] Started level: ${targetBoss.toUpperCase()}`);
        }
    }

    // =========================================================================
    // 3. Event Listeners Setup
    // =========================================================================
    function initEvents() {
        // Generic screen navigation buttons
        document.querySelectorAll('[data-navigate]').forEach(button => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('data-navigate');
                if (targetId) {
                    navigateTo(targetId);
                }
            });
        });

        // Boss selection buttons
        document.querySelectorAll('[data-boss-id]').forEach(button => {
            button.addEventListener('click', function (e) {
                e.preventDefault();
                const bossId = this.getAttribute('data-boss-id');
                if (bossId) {
                    displayBossDossier(bossId);
                }
            });
        });

        // Start Level button on Dossier
        const startLevelBtn = document.getElementById('btn-start-level');
        if (startLevelBtn) {
            startLevelBtn.addEventListener('click', function (e) {
                e.preventDefault();
                startBossLevel(activeBossId);
            });
        }

        // Exit Game button in Arena HUD
        const exitGameBtn = document.getElementById('btn-exit-game');
        if (exitGameBtn) {
            exitGameBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if (typeof window !== 'undefined' && window.ArcadeGame && window.ArcadeGame.engine) {
                    window.ArcadeGame.engine.instance.stop();
                }
                navigateTo('screen-boss-intro');
            });
        }

        // Pause Game button in Arena HUD
        const pauseGameBtn = document.getElementById('btn-pause-game');
        if (pauseGameBtn) {
            pauseGameBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if (typeof window !== 'undefined' && window.ArcadeGame && window.ArcadeGame.engine) {
                    window.ArcadeGame.engine.instance.togglePause();
                }
            });
        }

        // Initialize Canvas when document is ready
        const canvas = document.getElementById('game-canvas');
        if (canvas && typeof window !== 'undefined' && window.ArcadeGame && window.ArcadeGame.engine) {
            window.ArcadeGame.engine.instance.init(canvas);
        }

        console.log("[Init] Event handlers attached for navigation, boss selection, and game arena.");
    }

    // Initialize once DOM is ready (browser environment)
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initEvents);
        } else {
            initEvents();
        }
    }

    // Expose for debugging if in browser
    if (typeof window !== 'undefined') {
        window.SchedulerArcade = {
            navigateTo,
            displayBossDossier,
            startBossLevel,
            getActiveBossId: () => activeBossId,
            getBossData: () => BOSS_DATA
        };
    }
})();
