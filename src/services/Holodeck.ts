import { PureZenBKernel, RuntimeState } from './RustKernelBridge';
import { useSettingsStore } from '../stores/settingsStore';
import { useSessionStore } from '../stores/sessionStore';
import { useUIStore } from '../stores/uiStore';
import { ZenVitalsSnapshot, Metric, QualityReport } from '../vitals/snapshot';
import { SignalQuality } from '../vitals/reasons';
import { SafetyConfig } from '../config/SafetyConfig';
import { WakeLockManager } from './WakeLockManager';
import { OnlineStatusManager } from './OnlineStatusManager';
import { GeminiSomaticBridge } from './GeminiSomaticBridge';

/**
 * 🜂 THE HOLODECK (Simulation Runtime)
 * =====================================
 * Runs automated integration tests on the live Biological OS.
 */

type LogEntry = { time: number; msg: string; type: 'info' | 'pass' | 'fail' };
type HolodeckMode = 'app' | 'headless';
type SleepFn = (ms: number) => Promise<void>;

type HolodeckAttachOptions = {
    mode?: HolodeckMode;
    sleep?: SleepFn;
    controlHz?: number;
};

export class Holodeck {
    private static instance: Holodeck;
    public isActive = false;
    private logs: LogEntry[] = [];
    private listeners = new Set<() => void>();

    // Injected References
    private kernel: PureZenBKernel | null = null;
    private mode: HolodeckMode = 'app';
    private sleepFn: SleepFn = (ms) => new Promise(r => setTimeout(r, ms));
    private controlHz: number = SafetyConfig.clocks.controlHz;
    private unsubSession: (() => void) | null = null;
    private unsubKernel: (() => void) | null = null;

    private constructor() { }

    public static getInstance(): Holodeck {
        if (!Holodeck.instance) Holodeck.instance = new Holodeck();
        return Holodeck.instance;
    }

    public attach(kernel: PureZenBKernel, opts: HolodeckAttachOptions = {}) {
        // Clear any previous headless bindings when re-attaching.
        this.unbindHeadless();

        this.kernel = kernel;

        this.mode = opts.mode ?? this.mode;
        this.sleepFn = opts.sleep ?? this.sleepFn;
        this.controlHz = opts.controlHz ?? SafetyConfig.clocks.controlHz;

        if (this.mode === 'headless') this.bindHeadless();
    }

    public getLogs() { return this.logs; }

    public clearLogs() {
        this.logs = [];
        this.notify();
    }

    private log(msg: string, type: 'info' | 'pass' | 'fail' = 'info') {
        this.logs.push({ time: Date.now(), msg, type });
        console.log(`[Holodeck] ${type.toUpperCase()}: ${msg}`);
        this.notify();
    }

    public subscribe(cb: () => void) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify() { this.listeners.forEach(cb => cb()); }

    // --- HEADLESS DRIVER (for automated tests) ---

    private bindHeadless() {
        if (!this.kernel) return;
        if (this.unsubKernel || this.unsubSession) return;

        const kernel = this.kernel;
        const stopSession = useSessionStore.getState().stopSession;
        const syncState = useSessionStore.getState().syncState;
        const showSnackbar = useUIStore.getState().showSnackbar;

        let lastStatus: RuntimeState['status'] | null = null;

        this.unsubKernel = kernel.subscribe((state: RuntimeState) => {
            if (state.status === 'SAFETY_LOCK' && lastStatus !== 'SAFETY_LOCK') {
                showSnackbar('Safety lock engaged. Session stopped.', 'error');
                stopSession();
            }
            lastStatus = state.status;

            const session = useSessionStore.getState();
            if (state.phase !== session.phase || state.cycleCount !== session.cycleCount) {
                syncState(state.phase, state.cycleCount);
            }
        });

        this.unsubSession = useSessionStore.subscribe((state, prev) => {
            if (!prev.isActive && state.isActive) {
                kernel.dispatch({ type: 'LOAD_PROTOCOL', patternId: state.currentPattern.id, timestamp: Date.now() });
                kernel.dispatch({ type: 'START_SESSION', timestamp: Date.now() });
                return;
            }

            if (prev.isActive && !state.isActive) {
                kernel.dispatch({ type: 'HALT', reason: 'holodeck_stop', timestamp: Date.now() });
            }

            if (state.isActive && state.isPaused !== prev.isPaused) {
                if (state.isPaused) {
                    kernel.dispatch({ type: 'INTERRUPTION', kind: 'pause', timestamp: Date.now() });
                } else {
                    kernel.dispatch({ type: 'RESUME', timestamp: Date.now() });
                }
            }
        });
    }

    private unbindHeadless() {
        if (this.unsubKernel) {
            this.unsubKernel();
            this.unsubKernel = null;
        }
        if (this.unsubSession) {
            this.unsubSession();
            this.unsubSession = null;
        }
    }

    // --- SCENARIO RUNNER ---

    public async runScenario(scenarioId: string): Promise<void> {
        if (!this.kernel) { this.log("Kernel not attached!", 'fail'); return; }
        if (this.mode === 'headless') this.bindHeadless();

        this.isActive = true;
        this.clearLogs();
        this.notify();

        try {
            switch (scenarioId) {
                case 'nominal': await this.scenarioNominal(); break;
                case 'panic': await this.scenarioPanicResponse(); break;
                case 'ai_tune': await this.scenarioAiTuning(); break;
                case 'pause_resume_long': await this.scenarioPauseResumeLong(); break;
                case 'safety_lock_ux': await this.scenarioSafetyLockUX(); break;
                case 'ai_confirm_timeout': await this.scenarioAiConfirmTimeout(); break;
                case 'wake_lock_visibility': await this.scenarioWakeLockVisibility(); break;
                case 'pwa_offline': await this.scenarioPwaOffline(); break;
                default: this.log(`Unknown scenario: ${scenarioId}`, 'fail');
            }
        } catch (e: any) {
            this.log(`Scenario Crashed: ${e.message}`, 'fail');
        } finally {
            this.isActive = false;
            this.stopSimulationEffects();
            this.unbindHeadless();
            this.notify();
        }
    }

    // --- SCENARIO 01: NOMINAL FLOW ---
    private async scenarioNominal() {
        this.log("Initializing SCENARIO 01: NOMINAL FLOW", 'info');

        // 1. Setup Environment
        useSettingsStore.getState().setQuality('low');

        // 2. Start Session (4-7-8)
        this.log("Action: Start Session (4-7-8)", 'info');
        useSessionStore.getState().startSession('4-7-8');

        // Wait for Boot
        await this.advance(500);
        const state = this.kernel!.getState();
        if (state.status !== 'RUNNING') throw new Error("Kernel failed to start");
        this.log("Kernel State: RUNNING", 'pass');

        // 3. Inject "Perfect" Bio-Data (Coherent HR)
        this.startMockVitals(() => this.createSnapshot({
            hr: 60 + Math.sin(Date.now() / 1000) * 5, // RSA-like
            confidence: 0.95,
            quality: 'excellent',
            stressIndex: 80,
            snr: 20
        }));
        this.log("Injecting: Coherent Bio-Signals", 'info');

        // 4. Run for 5 seconds (fast forward)
        await this.advance(5000);

        // Assert: Phase Machine
        const p = this.kernel!.getState().phase;
        if (p === 'inhale' || p === 'holdIn') {
            this.log(`Phase transition verified (Current: ${p})`, 'pass');
        } else {
            this.log(`Unexpected phase: ${p}`, 'fail');
        }

        // 5. Clean Stop
        useSessionStore.getState().stopSession();
        await this.advance(500);
        if (this.kernel!.getState().status === 'HALTED' || this.kernel!.getState().status === 'IDLE') {
            this.log("Kernel Halted Cleanly", 'pass');
        } else {
            throw new Error("Kernel failed to halt");
        }
    }

    // --- SCENARIO 02: PANIC RESPONSE (Safety Lock) ---
    private async scenarioPanicResponse() {
        this.log("Initializing SCENARIO 02: TRAUMA RESPONSE", 'info');

        useSessionStore.getState().startSession('4-7-8');
        await this.advance(1000);

        // 1. Inject "Panic" Data (HR 160, Low HRV)
        this.log("Injecting: PANIC SIGNAL (HR 160, SI 800)", 'info');
        this.startMockVitals(() => this.createSnapshot({
            hr: 160,
            confidence: 0.9,
            quality: 'good',
            stressIndex: 800,
            snr: 15
        }));

        // 2. Force Belief Update in Kernel to reflect this immediately (bypass smoothers)
        this.kernel!.dispatch({
            type: 'BELIEF_UPDATE',
            belief: {
                ...this.kernel!.getState().belief,
                prediction_error: 0.99, // CRITICAL ERROR
                arousal: 1.0
            },
            timestamp: Date.now()
        });

        // Wait for Safety Guard to trip
        this.log("Simulating Safety Interdiction Event...", 'info');
        this.kernel!.dispatch({
            type: 'SAFETY_INTERDICTION',
            riskLevel: 0.99,
            action: 'EMERGENCY_HALT',
            timestamp: Date.now()
        });

        await this.advance(500);
        const status = this.kernel!.getState().status;

        if (status === 'SAFETY_LOCK') {
            this.log("System entered SAFETY_LOCK", 'pass');
        } else {
            this.log(`System failed to lock. Status: ${status}`, 'fail');
        }

        useSessionStore.getState().stopSession();
    }

    // --- SCENARIO 03: AI TUNING ---
    private async scenarioAiTuning() {
        this.log("Initializing SCENARIO 03: AI CO-REGULATION", 'info');
        useSessionStore.getState().startSession('box');
        await this.advance(1000);

        // 1. Simulate "AI Connected"
        this.kernel!.dispatch({ type: 'AI_STATUS_CHANGE', status: 'connected', timestamp: Date.now() });
        this.log("AI Agent: Connected", 'pass');

        // 2. Simulate AI Tool Call (Slow Down)
        this.log("Simulating AI Tool: adjust_tempo(1.2)", 'info');
        this.kernel!.dispatch({
            type: 'ADJUST_TEMPO',
            scale: 1.2,
            reason: 'Holodeck Test',
            timestamp: Date.now()
        });

        await this.advance(200);
        if (this.kernel!.getState().tempoScale === 1.2) {
            this.log("Tempo adjusted successfully", 'pass');
        } else {
            this.log("Tempo adjustment failed", 'fail');
        }

        useSessionStore.getState().stopSession();
    }

    // --- SCENARIO 04: PAUSE/RESUME (LONG) ---
    private async scenarioPauseResumeLong() {
        this.log("Initializing SCENARIO 04: PAUSE/RESUME LONG", 'info');
        useSettingsStore.getState().setQuality('low');

        this.log("Action: Start Session (box)", 'info');
        useSessionStore.getState().startSession('box');
        await this.advance(500);

        if (this.kernel!.getState().status !== 'RUNNING') throw new Error("Kernel failed to start");

        await this.advance(5000);
        const beforePause = this.kernel!.getState().sessionDuration;
        this.log(`Pre-pause duration: ${beforePause.toFixed(1)}s`, 'info');

        this.log("Action: Pause", 'info');
        useSessionStore.getState().togglePause();
        await this.advance(200);

        if (this.kernel!.getState().status !== 'PAUSED') {
            this.log(`Kernel did not enter PAUSED. Status: ${this.kernel!.getState().status}`, 'fail');
        } else {
            this.log("Kernel State: PAUSED", 'pass');
        }

        const pausedStart = this.kernel!.getState().sessionDuration;
        const longPauseMs = this.mode === 'headless' ? 60000 : 5000;
        await this.advance(longPauseMs);
        const pausedEnd = this.kernel!.getState().sessionDuration;

        if (Math.abs(pausedEnd - pausedStart) <= 0.2) {
            this.log("Session duration frozen while paused", 'pass');
        } else {
            this.log(`Session duration advanced while paused (${pausedStart.toFixed(2)}s → ${pausedEnd.toFixed(2)}s)`, 'fail');
        }

        this.log("Action: Resume", 'info');
        useSessionStore.getState().togglePause();
        await this.advance(5000);

        const afterResume = this.kernel!.getState().sessionDuration;
        if (afterResume >= pausedEnd + 4.5) {
            this.log("Session duration resumes smoothly", 'pass');
        } else {
            this.log(`Session duration failed to resume (${pausedEnd.toFixed(2)}s → ${afterResume.toFixed(2)}s)`, 'fail');
        }

        useSessionStore.getState().stopSession();
    }

    // --- SCENARIO 05: SAFETY LOCK → UX ---
    private async scenarioSafetyLockUX() {
        this.log("Initializing SCENARIO 05: SAFETY LOCK → UX", 'info');
        useUIStore.getState().hideSnackbar();

        useSessionStore.getState().startSession('4-7-8');
        await this.advance(500);

        this.log("Simulating Safety Interdiction Event...", 'info');
        this.kernel!.dispatch({
            type: 'SAFETY_INTERDICTION',
            riskLevel: 0.99,
            action: 'EMERGENCY_HALT',
            timestamp: Date.now()
        });

        await this.advance(200);

        const status = this.kernel!.getState().status;
        if (status === 'SAFETY_LOCK') this.log("Kernel State: SAFETY_LOCK", 'pass');
        else this.log(`Unexpected Kernel status: ${status}`, 'fail');

        if (!useSessionStore.getState().isActive) this.log("Session stopped automatically", 'pass');
        else this.log("Session still active after safety lock", 'fail');

        const snackbar = useUIStore.getState().snackbar;
        if (snackbar && snackbar.kind === 'error') this.log("User informed via snackbar", 'pass');
        else this.log("Missing safety lock snackbar UX", 'fail');

        useSessionStore.getState().stopSession();
    }

    // --- SCENARIO 06: AI TOOL CONFIRM TIMEOUT ---
    private async scenarioAiConfirmTimeout() {
        this.log("Initializing SCENARIO 06: AI TOOL CONFIRM TIMEOUT", 'info');
        useUIStore.getState().dismissConfirmation();

        // Start session and run long enough to bypass the tool's 30s precondition.
        useSessionStore.getState().startSession('box');
        await this.advance(31000);

        if (this.kernel!.getState().sessionDuration < 30) {
            this.log(`SessionDuration too short for tool precondition: ${this.kernel!.getState().sessionDuration.toFixed(1)}s`, 'fail');
            useSessionStore.getState().stopSession();
            return;
        }

        const toolResponses: any[] = [];
        const bridge = new GeminiSomaticBridge(this.kernel!);
        (bridge as any).audioContext = {} as AudioContext;
        (bridge as any).session = { sendToolResponse: (payload: any) => toolResponses.push(payload) };

        const toolCallMessage = {
            toolCall: {
                functionCalls: [{
                    id: 'call_zenb_1',
                    name: 'switch_pattern',
                    args: { patternId: 'awake', reason: 'Clinical escalation test. Requires user confirmation.' }
                }]
            }
        };

        const pending = (bridge as any).handleMessage(toolCallMessage);

        // Wait until the confirmation state is actually raised before time-traveling 30s forward.
        // (Otherwise we might fast-forward time before the timeout is scheduled.)
        let confirmationRaised = false;
        for (let i = 0; i < 50; i++) {
            if (useUIStore.getState().pendingConfirmation) { confirmationRaised = true; break; }
            await this.advance(0);
        }

        if (confirmationRaised) this.log("Confirmation modal raised", 'pass');
        else {
            this.log("Expected confirmation modal not raised", 'fail');
            await pending;
            useSessionStore.getState().stopSession();
            return;
        }

        // Do not confirm: allow the 30s timeout to auto-deny.
        await this.advance(30000);
        await pending;

        if (!useUIStore.getState().pendingConfirmation) this.log("Confirmation auto-dismissed on timeout", 'pass');
        else this.log("Confirmation still pending after timeout", 'fail');

        const status = toolResponses?.[0]?.functionResponses?.[0]?.response?.result?.status;
        if (status === 'denied_by_user') this.log("Tool auto-denied on timeout", 'pass');
        else this.log(`Unexpected tool response status: ${String(status)}`, 'fail');

        useSessionStore.getState().stopSession();
    }

    // --- SCENARIO 07: WAKE LOCK / VISIBILITY ---
    private async scenarioWakeLockVisibility() {
        this.log("Initializing SCENARIO 07: WAKE LOCK / VISIBILITY", 'info');

        const visListeners = new Set<() => void>();
        const fakeDoc = {
            visibilityState: 'visible' as DocumentVisibilityState,
            addEventListener: (type: string, cb: () => void) => {
                if (type === 'visibilitychange') visListeners.add(cb);
            },
            removeEventListener: (type: string, cb: () => void) => {
                if (type === 'visibilitychange') visListeners.delete(cb);
            }
        };

        let requested = 0;
        let released = 0;

        const makeSentinel = () => {
            const releaseListeners = new Set<() => void>();
            const sentinel: WakeLockSentinel = {
                released: false,
                addEventListener: (type: string, cb: any) => { if (type === 'release') releaseListeners.add(() => cb()); },
                removeEventListener: (type: string, cb: any) => { if (type === 'release') releaseListeners.delete(cb); },
                dispatchEvent: () => true,
                release: async () => {
                    released++;
                    (sentinel as any).released = true;
                    releaseListeners.forEach(l => l());
                }
            } as any;
            return sentinel;
        };

        const fakeNav = {
            wakeLock: {
                request: async (_type: 'screen') => {
                    requested++;
                    return makeSentinel();
                }
            }
        } as any;

        const mgr = new WakeLockManager({ document: fakeDoc as any, navigator: fakeNav });
        mgr.start();
        mgr.setSessionState({ isActive: true, isPaused: false });
        await mgr.refresh();

        if (requested === 1) this.log("Wake lock requested on active session", 'pass');
        else this.log(`Wake lock request count mismatch: ${requested}`, 'fail');

        fakeDoc.visibilityState = 'hidden';
        visListeners.forEach(l => l());
        await mgr.refresh();

        if (released >= 1) this.log("Wake lock released on hidden visibility", 'pass');
        else this.log("Wake lock not released on hidden visibility", 'fail');

        fakeDoc.visibilityState = 'visible';
        visListeners.forEach(l => l());
        await mgr.refresh();

        if (requested >= 2) this.log("Wake lock re-requested on visible", 'pass');
        else this.log("Wake lock not re-requested on visible", 'fail');

        mgr.setSessionState({ isActive: true, isPaused: true });
        await mgr.refresh();

        if (released >= 2) this.log("Wake lock released on pause", 'pass');
        else this.log("Wake lock not released on pause", 'fail');

        await mgr.dispose();
    }

    // --- SCENARIO 08: PWA OFFLINE (NETWORK LOSS) ---
    private async scenarioPwaOffline() {
        this.log("Initializing SCENARIO 08: PWA OFFLINE", 'info');
        useUIStore.getState().hideSnackbar();

        const listeners: Record<string, Set<() => void>> = {
            online: new Set(),
            offline: new Set()
        };

        const fakeWindow = {
            addEventListener: (type: string, cb: () => void) => {
                listeners[type]?.add(cb);
            },
            removeEventListener: (type: string, cb: () => void) => {
                listeners[type]?.delete(cb);
            }
        };

        let didInit = false;
        const mgr = new OnlineStatusManager({
            window: fakeWindow as any,
            navigator: { onLine: true } as any,
            onChange: (online) => {
                if (!didInit) { didInit = true; return; }
                useUIStore.getState().showSnackbar(online ? 'Back online.' : 'Offline mode.', online ? 'success' : 'warn');
            }
        });

        mgr.start();

        listeners.offline.forEach(l => l());
        const off = useUIStore.getState().snackbar;
        if (off && off.kind === 'warn') this.log("Offline snackbar shown", 'pass');
        else this.log("Offline snackbar missing", 'fail');

        listeners.online.forEach(l => l());
        const on = useUIStore.getState().snackbar;
        if (on && on.kind === 'success') this.log("Online snackbar shown", 'pass');
        else this.log("Online snackbar missing", 'fail');

        mgr.dispose();
    }

    // --- UTILS ---
    private sleep(ms: number) { return this.sleepFn(ms); }

    private async advance(ms: number) {
        if (ms <= 0) {
            await Promise.resolve();
            return;
        }
        if (this.mode !== 'headless') {
            await this.sleep(ms);
            return;
        }

        const hz = this.controlHz || SafetyConfig.clocks.controlHz;
        const stepMs = 1000 / hz;
        const stepSec = 1 / hz;
        const steps = Math.ceil(ms / stepMs);

        for (let i = 0; i < steps; i++) {
            await this.sleep(stepMs);
            this.pump(stepSec);
        }
    }

    private pump(dtSec: number) {
        if (!this.kernel) return;

        const session = useSessionStore.getState();
        if (!session.isActive || session.isPaused) return;

        const hidden = typeof document !== 'undefined' ? document.hidden : false;

        const tickData: any = {
            timestamp: Date.now(),
            delta_time: dtSec,
            visibilty_state: hidden ? 'hidden' : 'visible',
            user_interaction: undefined
        };

        // Optional vitals injection (mirrors useBreathEngine gating).
        const gen = typeof window !== 'undefined' ? (window as any).__ZENB_HOLODECK_VITALS__ : null;
        if (typeof gen === 'function') {
            try {
                const latestVitals: ZenVitalsSnapshot | null = gen();
                if (latestVitals && latestVitals.quality.quality !== 'invalid') {
                    if (latestVitals.hr.value !== undefined) {
                        tickData.heart_rate = latestVitals.hr.value;
                        tickData.hr_confidence = latestVitals.hr.confidence;
                    }
                    if (latestVitals.rr.value !== undefined) {
                        tickData.respiration_rate = latestVitals.rr.value;
                    }
                    if (latestVitals.hrv.value !== undefined) {
                        tickData.stress_index = latestVitals.hrv.value.stressIndex;
                    }
                    if (latestVitals.affect.value !== undefined) {
                        tickData.facial_valence = latestVitals.affect.value.valence;
                    }
                }
            } catch {
                // Ignore sim generator errors
            }
        }

        this.kernel.tick(dtSec, tickData);
    }

    private startMockVitals(generator: () => ZenVitalsSnapshot) {
        // Mock global hook that CameraVitalsEngine listens to
        if (typeof window === 'undefined') return;
        (window as any).__ZENB_HOLODECK_VITALS__ = generator;
    }

    private stopSimulationEffects() {
        if (typeof window !== 'undefined') {
            (window as any).__ZENB_HOLODECK_VITALS__ = null;
        }
    }

    private createSnapshot(p: { hr: number, quality: SignalQuality, confidence: number, stressIndex: number, snr: number }): ZenVitalsSnapshot {
        const now = Date.now();
        const baseQuality: Metric<QualityReport> = {
            value: {
                facePresent: true,
                motion: 0,
                brightnessMean: 100,
                brightnessStd: 10,
                saturationRatio: 0,
                fpsEstimated: 30,
                fpsJitterMs: 0,
                bufferSpanSec: 60,
                snr: p.snr
            },
            confidence: p.confidence,
            quality: p.quality,
            reasons: [],
            windowSec: 60,
            updatedAtMs: now
        };

        const createMetric = <T>(val: T) => ({
            value: val,
            confidence: p.confidence,
            quality: p.quality,
            reasons: [],
            windowSec: 60,
            updatedAtMs: now
        });

        return {
            quality: baseQuality,
            hr: createMetric(p.hr),
            rr: createMetric(15),
            hrv: createMetric({ rmssd: 50, sdnn: 50, stressIndex: p.stressIndex }),
            affect: createMetric({ valence: 0, arousal: 0, moodLabel: 'neutral' })
        };
    }
}
