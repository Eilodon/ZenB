/**
 * TAURI RUNTIME ADAPTER
 * =====================
 *
 * This module provides a TauriZenOneRuntime class that calls the Rust backend
 * via Tauri's invoke() mechanism. It mirrors the MockZenOneRuntime API for
 * drop-in replacement.
 *
 * Usage:
 *   - In Tauri desktop: Uses real Rust engine via invoke()
 *   - In web/dev: Falls back to MockZenOneRuntime
 */

import { detectRuntime } from '../platform/runtime';

// Types matching Rust FFI structs (already defined in RustKernelBridge.ts)
import type {
    FfiFrame,
    FfiSessionStats,
    FfiRuntimeState,
} from './RustKernelBridge';

let invokeFunc: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

/**
 * Initialize the Tauri invoke function.
 * Must be called before using TauriZenOneRuntime.
 */
export async function initTauriInvoke(): Promise<boolean> {
    const runtime = detectRuntime();
    if (runtime !== 'tauri') {
        console.log('[TauriRuntime] Not running in Tauri, invoke not available');
        return false;
    }

    try {
        const tauriCore = await import('@tauri-apps/api/core');
        invokeFunc = tauriCore.invoke;
        console.log('[TauriRuntime] Tauri invoke initialized');
        return true;
    } catch (e) {
        console.warn('[TauriRuntime] Failed to import @tauri-apps/api/core:', e);
        return false;
    }
}

/**
 * Check if Tauri runtime is available
 */
export function isTauriAvailable(): boolean {
    return invokeFunc !== null;
}

/**
 * TauriZenOneRuntime - Calls Rust backend via Tauri IPC
 */
export class TauriZenOneRuntime {
    // Cache for synchronous getters
    private cachedPatternId: string = '4-7-8';
    private cachedState: FfiRuntimeState | null = null;

    /**
     * Get all available breathing patterns
     */
    async get_patterns(): Promise<unknown[]> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        return invokeFunc('get_patterns') as Promise<unknown[]>;
    }

    /**
     * Load a pattern by ID
     */
    async load_pattern(patternId: string): Promise<boolean> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        const result = await invokeFunc('load_pattern', { patternId });
        if (result) this.cachedPatternId = patternId;
        return result as boolean;
    }

    /**
     * Get current pattern ID (sync - uses cache)
     */
    current_pattern_id(): string {
        return this.cachedPatternId;
    }

    /**
     * Start a breathing session
     */
    async start_session(): Promise<void> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        await invokeFunc('start_session');
    }

    /**
     * Stop session and get stats
     */
    async stop_session(): Promise<FfiSessionStats> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        return invokeFunc('stop_session') as Promise<FfiSessionStats>;
    }

    /**
     * Pause session
     */
    async pause_session(): Promise<void> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        await invokeFunc('pause_session');
    }

    /**
     * Resume session
     */
    async resume_session(): Promise<void> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        await invokeFunc('resume_session');
    }

    /**
     * Check if session is active
     */
    async is_session_active(): Promise<boolean> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        return invokeFunc('is_session_active') as Promise<boolean>;
    }

    /**
     * Tick the engine (timer-based, no camera)
     */
    async tick(dt_sec: number, timestamp_us: number): Promise<FfiFrame> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        return invokeFunc('tick', { dtSec: dt_sec, timestampUs: timestamp_us }) as Promise<FfiFrame>;
    }

    /**
     * Process a camera frame (rPPG pipeline)
     */
    async process_frame(r: number, g: number, b: number, timestamp_us: number): Promise<FfiFrame> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        return invokeFunc('process_frame', { r, g, b, timestampUs: timestamp_us }) as Promise<FfiFrame>;
    }

    /**
     * Get full runtime state snapshot
     */
    async get_state(): Promise<FfiRuntimeState> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        const state = await invokeFunc('get_state') as FfiRuntimeState;
        this.cachedState = state;
        return state;
    }

    /**
     * Sync getter for cached state (for UI that needs immediate access)
     */
    get_cached_state(): FfiRuntimeState | null {
        return this.cachedState;
    }

    /**
     * Adjust tempo scale
     */
    async adjust_tempo(scale: number, reason: string): Promise<number> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        return invokeFunc('adjust_tempo', { scale, reason }) as Promise<number>;
    }

    /**
     * Emergency halt
     */
    async emergency_halt(reason: string): Promise<void> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        await invokeFunc('emergency_halt', { reason });
    }

    /**
     * Reset safety lock
     */
    async reset_safety_lock(): Promise<void> {
        if (!invokeFunc) throw new Error('Tauri not initialized');
        await invokeFunc('reset_safety_lock');
    }
}

// Singleton instance
let tauriRuntimeInstance: TauriZenOneRuntime | null = null;

/**
 * Get or create the TauriZenOneRuntime instance
 */
export function getTauriRuntime(): TauriZenOneRuntime {
    if (!tauriRuntimeInstance) {
        tauriRuntimeInstance = new TauriZenOneRuntime();
    }
    return tauriRuntimeInstance;
}
